import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateWithFallback } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import {
  formatInlineSourcesBlock,
  dedupeSourceRefs,
  type SourceRef,
} from '@/lib/qualifications/sources';
import {
  buildSourcesFromRawChunks,
  injectSourcesPanel,
} from '@/lib/json-render/prequal-visualization-utils';
import { performWebResearch } from '@/lib/research/web-research-service';

import {
  EvidenceFieldsForLLM,
  buildEvidenceSources,
  storeDecisionGradeSectionArtifacts,
  type StoredSectionFinding,
} from './decision-grade-utils';
import {
  buildEvidenceContextForExtraction,
  collectEvidenceChunks,
  deletePreQualSectionArtifacts,
} from './section-utils';

type JsonRenderTree = { root: string; elements: Record<string, unknown> };

const ContractsExtractSchema = z.object({
  contractType: z.array(
    z.object({
      type: z.string().min(1),
      details: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  criticalClauses: z.array(
    z.object({
      topic: z.enum([
        'haftung',
        'gewaehrleistung',
        'vertragsstrafe',
        'datenschutz',
        'nutzungsrechte',
        'kuendigung',
        'aenderungsrechte',
        'sla',
        'sonstiges',
      ]),
      clauseSummary: z.string().min(1),
      implicationForBid: z.string().min(1),
      riskLevel: z.enum(['hoch', 'mittel', 'niedrig']),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  slaItems: z.array(
    z.object({
      metric: z.string().min(1),
      target: z.string().min(1),
      penalty: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  openQuestions: z.array(
    z.object({
      question: z.string().min(1),
      whyItMatters: z.string().min(1),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  summary: z.string().min(40),
  dashboardHighlights: z.array(z.string().min(5)).max(3),
  confidence: z.number().min(0).max(100),
});

type ContractsExtract = z.infer<typeof ContractsExtractSchema>;

function buildContractsTree(params: {
  summary: string;
  contractTypeRows: Array<Record<string, string>>;
  clauseRows: Array<Record<string, string>>;
  slaRows: Array<Record<string, string>>;
  centralBidderQuestionsHint: string;
  nextSteps: string[];
}): JsonRenderTree {
  const { summary, contractTypeRows, clauseRows, slaRows, centralBidderQuestionsHint, nextSteps } =
    params;

  const elements: Record<string, unknown> = {
    'section-main': {
      key: 'section-main',
      type: 'Section',
      props: { title: 'Vertragliche Rahmenbedingungen' },
      children: [
        'para-summary',
        'sub-contract-type',
        'sub-clauses',
        'sub-sla',
        'sub-bidder-questions',
        'sub-next',
      ],
    },
    'para-summary': { key: 'para-summary', type: 'Paragraph', props: { text: summary } },
    'sub-contract-type': {
      key: 'sub-contract-type',
      type: 'SubSection',
      props: { title: 'Vertragstyp & Dokumente' },
      children: ['table-contract-type'],
    },
    'table-contract-type': {
      key: 'table-contract-type',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'type', label: 'Vertragstyp' },
          { key: 'details', label: 'Details' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: contractTypeRows,
        compact: true,
      },
    },
    'sub-clauses': {
      key: 'sub-clauses',
      type: 'SubSection',
      props: { title: 'Kritische Klauseln (mit Angebotsimplikation)' },
      children: ['table-clauses'],
    },
    'table-clauses': {
      key: 'table-clauses',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'topic', label: 'Thema' },
          { key: 'clauseSummary', label: 'Klausel' },
          { key: 'implicationForBid', label: 'Implikation' },
          { key: 'riskLevel', label: 'Risiko' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: clauseRows,
        compact: true,
      },
    },
    'sub-sla': {
      key: 'sub-sla',
      type: 'SubSection',
      props: { title: 'SLAs / Service' },
      children: ['table-sla'],
    },
    'table-sla': {
      key: 'table-sla',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'metric', label: 'Metrik' },
          { key: 'target', label: 'Ziel' },
          { key: 'penalty', label: 'Pönale/Sanktion' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: slaRows,
        compact: true,
      },
    },
    'sub-bidder-questions': {
      key: 'sub-bidder-questions',
      type: 'SubSection',
      props: { title: 'Bieterfragen (zentral geführt)' },
      children: ['para-bidder-questions'],
    },
    'para-bidder-questions': {
      key: 'para-bidder-questions',
      type: 'Paragraph',
      props: { text: centralBidderQuestionsHint },
    },
    'sub-next': {
      key: 'sub-next',
      type: 'SubSection',
      props: { title: 'Next Steps (juristisch/kommerziell)' },
      children: ['list-next'],
    },
    'list-next': {
      key: 'list-next',
      type: 'BulletList',
      props: { items: nextSteps },
    },
  };

  return { root: 'section-main', elements };
}

export async function runContractsSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, allowWebEnrichment } = options;
  const sectionId = 'contracts';

  try {
    const [preQual] = await db
      .select({ id: preQualifications.id })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQual) return { success: false, error: 'Qualification not found' };

    await deletePreQualSectionArtifacts({ preQualificationId, sectionId });

    if (allowWebEnrichment) {
      try {
        await performWebResearch({
          preQualificationId,
          sectionId,
          question: 'EVB-IT Haftung Pönalen typische Klauseln öffentliche Vergaben',
          maxResults: 2,
        });
      } catch {
        // Best-effort.
      }
    }

    const { chunks, byId } = await collectEvidenceChunks({
      preQualificationId,
      queries: [
        { query: 'EVB-IT Vertrag Vertragstyp Werkvertrag Dienstvertrag Rahmenvertrag' },
        { query: 'Haftung Haftungsobergrenze unbeschränkt Gewährleistung Verjährung' },
        { query: 'Vertragsstrafe Pönale Verzug SLA Service Level' },
        { query: 'Datenschutz DSGVO AVV TOMs Informationssicherheit' },
        { query: 'Nutzungsrechte IP Rechteübertragung Quellcode' },
        { query: 'Kündigung Laufzeit Verlängerung Change Request Nachtrag' },
      ],
      maxTotal: 28,
    });

    let extraction: ContractsExtract | null = null;

    if (chunks.length > 0) {
      try {
        extraction = await generateWithFallback({
          model: 'default',
          schema: ContractsExtractSchema,
          system: `Du extrahierst vertragsrelevante Punkte aus RFP-Chunks.

REGELN:
- Nutze nur EVIDENCE CHUNKS.
- evidenceChunkIds >=1 oder needsManualReview=true.
- Keine Halluzinationen.
- Markiere Risiken klar und ordne Angebotsimplikation zu.`,
          prompt: [
            `SECTION: ${sectionId}`,
            '',
            buildEvidenceContextForExtraction(chunks),
            '',
            'AUFGABE:',
            '1) Extrahiere Vertragstypen und wichtige Klauseln.',
            '2) Extrahiere SLA-/Service-Regeln mit möglichen Pönalen.',
            '3) Formuliere offene Fragen für zentrale Bieterfragen.',
            '4) Liefere Summary + Dashboard Highlights.',
          ].join('\n'),
          temperature: 0,
          maxTokens: 5000,
          timeout: 60_000,
        });
      } catch (extractionError) {
        console.warn(
          '[ContractsSection] Structured extraction failed, continuing with deterministic fallback:',
          extractionError
        );
      }
    }

    const contractTypeRows = (extraction?.contractType ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale:
          'Vertragstyp ist nicht eindeutig und muss juristisch geprüft werden.',
      });
      return {
        type: item.type,
        details: item.details || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const clauseRows = (extraction?.criticalClauses ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Klausel ist auslegungsbedürftig; juristische Prüfung empfohlen.',
      });
      return {
        topic: item.topic,
        clauseSummary: item.clauseSummary,
        implicationForBid: item.implicationForBid,
        riskLevel: item.riskLevel,
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const slaRows = (extraction?.slaItems ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'SLA-Detail ist nicht hinreichend konkret im Dokumentkontext.',
      });
      return {
        metric: item.metric,
        target: item.target,
        penalty: item.penalty || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const centralBidderQuestions = (extraction?.openQuestions ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Bieterfrage aus unklaren Vertragsklauseln abgeleitet.',
      });
      return {
        content: `Offene Frage: ${item.question} (Warum relevant: ${item.whyItMatters})${formatInlineSourcesBlock(sources)}`,
        sources,
      };
    });

    if (contractTypeRows.length === 0) {
      contractTypeRows.push({
        type: 'Nicht eindeutig genannt',
        details: 'Vertragstyp/AGB müssen im Originaldokument validiert werden.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Vertragstyp unklar',
            rationale: 'Keine eindeutige Vertragsbezeichnung mit belastbarer Quelle gefunden.',
          },
        ]).trim(),
      });
    }

    if (clauseRows.length === 0) {
      clauseRows.push({
        topic: 'sonstiges',
        clauseSummary: 'Keine explizit kritischen Klauseln extrahiert.',
        implicationForBid:
          'Vertragsentwurf juristisch manuell prüfen (Haftung/Pönalen/Nutzungsrechte).',
        riskLevel: 'mittel',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Klauselprüfung manuell',
            rationale:
              'Automatische Extraktion fand keine eindeutigen Klauselpassagen mit ausreichender Evidenz.',
          },
        ]).trim(),
      });
    }

    if (slaRows.length === 0) {
      slaRows.push({
        metric: 'Nicht eindeutig genannt',
        target: 'SLA-Ziele im Vertrag prüfen',
        penalty: 'Pönalen/Service Credits klären',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'SLA unklar',
            rationale: 'Keine belastbaren SLA-Kennzahlen mit Quelle extrahiert.',
          },
        ]).trim(),
      });
    }

    if (centralBidderQuestions.length === 0) {
      const src: SourceRef = {
        kind: 'assumption',
        label: 'Standard-Bieterfrage',
        rationale: 'Unklare Haftungs-/SLA-Regeln sollten vor Angebotsabgabe geklärt werden.',
      };
      centralBidderQuestions.push({
        content:
          `Offene Frage: Bitte bestätigen Sie Haftungsgrenzen, Pönalen und SLA-Sanktionslogik.` +
          formatInlineSourcesBlock([src]),
        sources: [src],
      });
    }

    const summary =
      extraction?.summary ||
      'Die Vertragsanalyse priorisiert haftungs- und SLA-relevante Klauseln. Offene juristische Punkte sind als zentrale Bieterfragen markiert.';

    const dashboardHighlights =
      extraction?.dashboardHighlights && extraction.dashboardHighlights.length > 0
        ? extraction.dashboardHighlights
        : [
            'Vertragstyp und kritische Klauseln müssen mit Originalquelle verifiziert werden.',
            'Haftung/Pönalen/SLA sind wesentliche Preis- und Risikotreiber.',
            'Unklare Klauseln sind als zentrale Bieterfragen hinterlegt.',
          ];

    const nextSteps = [
      'Vertragstyp und anwendbare AGB/EVB-IT im Originaldokument bestätigen.',
      'Haftungs-/Pönalen-/SLA-Passagen juristisch und kommerziell bewerten.',
      'Unklare Vertragsmechaniken als zentrale Bieterfrage an den Auftraggeber adressieren.',
    ];

    let tree = buildContractsTree({
      summary,
      contractTypeRows,
      clauseRows,
      slaRows,
      centralBidderQuestionsHint:
        'Bieterfragen werden zentral gebündelt und mit Verweis auf die Section "Verträge" geführt.',
      nextSteps,
    });

    tree = injectSourcesPanel(
      tree as any,
      buildSourcesFromRawChunks(chunks, { maxSources: 10, maxExcerptChars: 350 }),
      { subSectionTitle: 'Quellen', panelTitle: 'Quellen', maxSources: 10 }
    ) as unknown as JsonRenderTree;

    const findings: StoredSectionFinding[] = [];

    for (const row of contractTypeRows) {
      findings.push({
        content: `Vertragstyp: ${row.type} — ${row.details}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'contract_type', sources: [] },
      });
    }

    for (const row of clauseRows) {
      findings.push({
        content: `Kritische Klausel (${row.topic}, Risiko ${row.riskLevel}): ${row.clauseSummary} — ${row.implicationForBid}${row.source ? ` (${row.source})` : ''}`,
        category: row.riskLevel === 'hoch' ? 'fact' : 'recommendation',
        metadata: { sectionId, kind: 'critical_clause', sources: [] },
      });
    }

    for (const row of slaRows) {
      findings.push({
        content: `SLA: ${row.metric} — Ziel: ${row.target}; Pönale: ${row.penalty}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'sla', sources: [] },
      });
    }

    for (const question of centralBidderQuestions) {
      findings.push({
        content: question.content,
        category: 'recommendation',
        metadata: {
          sectionId,
          kind: 'open_question',
          sources: dedupeSourceRefs(question.sources),
        },
      });
    }

    await storeDecisionGradeSectionArtifacts({
      preQualificationId,
      sectionId,
      tree,
      confidence: extraction?.confidence ?? 45,
      dashboardHighlights,
      findings,
      minFindings: 10,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
