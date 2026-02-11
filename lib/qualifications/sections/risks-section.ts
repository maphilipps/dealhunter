import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import {
  chunkToWebSourceRef,
  chunkToRfpPdfSourceRef,
  dedupeSourceRefs,
  formatInlineSourcesBlock,
  type SourceRef,
} from '@/lib/qualifications/sources';
import type { RawRAGResult } from '@/lib/rag/raw-retrieval-service';
import { performWebResearch } from '@/lib/research/web-research-service';

import {
  buildEvidenceContextForExtraction,
  collectEvidenceChunks,
  deletePreQualSectionArtifacts,
  generateEmbeddingsWithConcurrency,
} from './section-utils';

const LikelihoodSchema = z.enum(['high', 'medium', 'low']);
const ImpactSchema = z.enum(['high', 'medium', 'low']);

const RiskItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  likelihood: LikelihoodSchema,
  impact: ImpactSchema,
  auswirkung: z.string().min(1).describe('Konkreter Effekt/Auswirkung für adesso/Projekt'),
  mitigation: z.string().min(1),
  openQuestions: z.array(z.string().min(1)).max(4),
  confidence: z.number().min(0).max(100),
  evidenceChunkIds: z.array(z.string()),
  needsManualReview: z.boolean(),
});

const RisksExtractSchema = z.object({
  risks: z.array(RiskItemSchema),
  summary: z.string().min(40),
  dashboardHighlights: z.array(z.string().min(5)).max(3),
  confidence: z.number().min(0).max(100),
});

type RisksExtract = z.infer<typeof RisksExtractSchema>;

function fmtLevel(value: z.infer<typeof LikelihoodSchema>): string {
  switch (value) {
    case 'high':
      return 'Hoch';
    case 'medium':
      return 'Mittel';
    case 'low':
      return 'Niedrig';
  }
}

function collectRfpSourcesFromChunkIds(
  chunkIds: string[],
  chunkById: Map<string, RawRAGResult>
): SourceRef[] {
  const out: SourceRef[] = [];
  for (const id of chunkIds) {
    const c = chunkById.get(id);
    if (!c) continue;
    const srcPdf = chunkToRfpPdfSourceRef(c);
    if (srcPdf) {
      out.push(srcPdf);
      continue;
    }
    const srcWeb = chunkToWebSourceRef(c);
    if (srcWeb) out.push(srcWeb);
  }
  return out;
}

function buildVisualizationTree(params: {
  summary: string;
  riskRows: Array<Record<string, string>>;
  openQuestions: string[];
  nextSteps: string[];
}): { root: string; elements: Record<string, unknown> } {
  const { summary, riskRows, openQuestions, nextSteps } = params;

  const elements: Record<string, any> = {};

  elements['section-main'] = {
    key: 'section-main',
    type: 'Section',
    props: { title: 'Risiken' },
    children: ['para-summary', 'sub-risks', 'sub-questions', 'sub-next'],
  };

  elements['para-summary'] = { key: 'para-summary', type: 'Paragraph', props: { text: summary } };

  elements['sub-risks'] = {
    key: 'sub-risks',
    type: 'SubSection',
    props: { title: 'Risikoregister (mit Auswirkung & Mitigation)' },
    children: ['table-risks'],
  };
  elements['table-risks'] = {
    key: 'table-risks',
    type: 'DataTable',
    props: {
      columns: [
        { key: 'title', label: 'Risiko' },
        { key: 'likelihood', label: 'Wahrscheinlichkeit' },
        { key: 'impact', label: 'Impact' },
        { key: 'auswirkung', label: 'Auswirkung' },
        { key: 'mitigation', label: 'Mitigation' },
        { key: 'source', label: 'Quelle' },
      ],
      rows: riskRows.length
        ? riskRows
        : [
            {
              title: 'Keine belastbaren Risiken extrahierbar',
              likelihood: '—',
              impact: '—',
              auswirkung: 'Manuelle Prüfung der Vertrags- und Zeitplanpassagen nötig.',
              mitigation: 'RFP nach Vertragsstrafen, Haftung, SLAs, Abhängigkeiten durchsuchen.',
              source: '',
            },
          ],
      compact: true,
    },
  };

  elements['sub-questions'] = {
    key: 'sub-questions',
    type: 'SubSection',
    props: { title: 'Offene Fragen (für Bieterfragen / Klärungen)' },
    children: ['list-questions'],
  };
  elements['list-questions'] = {
    key: 'list-questions',
    type: 'BulletList',
    props: {
      items: openQuestions.length
        ? openQuestions
        : ['Keine konkreten Rückfragen ableitbar (oder Anforderungen sind eindeutig).'],
    },
  };

  elements['sub-next'] = {
    key: 'sub-next',
    type: 'SubSection',
    props: { title: 'Konkrete Next Steps (für Angebotsteam)' },
    children: ['list-next'],
  };
  elements['list-next'] = {
    key: 'list-next',
    type: 'BulletList',
    props: { items: nextSteps },
  };

  return { root: 'section-main', elements };
}

export async function runRisksSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, allowWebEnrichment } = options;
  const sectionId = 'risks';

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
        await Promise.all([
          performWebResearch({
            preQualificationId,
            sectionId,
            question: 'Vertragsstrafen Haftung SLA Pönalen Gewährleistung',
            maxResults: 2,
          }),
          performWebResearch({
            preQualificationId,
            sectionId,
            question: 'Mitwirkungspflichten Abhängigkeiten Liefertermine Risiko Hinweise',
            maxResults: 2,
          }),
        ]);
      } catch {
        // Ignore enrichment failures.
      }
    }

    const { chunks, byId } = await collectEvidenceChunks({
      preQualificationId,
      queries: [
        { query: 'Risiko Risiken Haftung Vertragsstrafe Pönale Verzug' },
        { query: 'Haftungsobergrenze Haftungsbeschränkung unbeschränkte Haftung' },
        { query: 'Gewährleistung Verjährung Nachbesserung Abnahme' },
        { query: 'SLA Service Level Verfügbarkeit Reaktionszeit Pönale' },
        { query: 'Datenschutz DSGVO AVV TOMs Auftragsverarbeitung' },
        { query: 'Informationssicherheit ISO 27001 BSI Grundschutz Sicherheitskonzept' },
        { query: 'Zeitplan Fristen Deadlines Angebotsfrist Bindefrist Projektstart' },
        { query: 'Mitwirkungspflichten Auftraggeber Abhängigkeiten Zulieferungen Dritte' },
        { query: 'Migration Altsystem Legacy Schnittstellen Datenübernahme' },
        { query: 'Personal Qualifikation Zertifizierung Sicherheitsüberprüfung Vor-Ort' },
      ],
      maxTotal: 28,
    });

    const evidenceContext = buildEvidenceContextForExtraction(chunks);

    let extraction: RisksExtract;
    try {
      extraction = await generateStructuredOutput({
        model: 'default',
        schema: RisksExtractSchema,
        system: `Du extrahierst Projektrisiken aus RFP-Chunks und formulierst sie decision-grade.

KRITISCHE REGELN:
- Du darfst NUR Informationen aus den EVIDENCE CHUNKS verwenden.
- Jede Risiko-Zeile MUSS entweder (a) evidenceChunkIds (>=1) haben ODER (b) needsManualReview=true und evidenceChunkIds=[].
- Keine Halluzinationen. Wenn unklar: needsManualReview=true.
- "Auswirkung" muss konkret sein (Kosten/Termin/Scope/Qualität/Compliance) – kein generischer Text.`,
        prompt: [
          `SECTION: ${sectionId}`,
          '',
          evidenceContext,
          '',
          'AUFGABE:',
          '1) Extrahiere 4-10 konkrete Risiken aus dem Material (inkl. Vertrags-/Termin-/Abhängigkeits-/Security-/Migrationsrisiken).',
          '2) Pro Risiko: likelihood, impact, AUSWIRKUNG (konkreter Effekt), mitigation, 0-4 offene Fragen.',
          '3) Schreibe eine Summary (4-8 Sätze) für das Angebotsteam.',
          '4) Erstelle 1-3 Dashboard Highlights (kurz, belastbar).',
        ].join('\n'),
        temperature: 0,
        maxTokens: 5000,
        timeout: 60_000,
      });
    } catch (extractionError) {
      console.warn(
        '[RisksSection] Structured extraction failed, continuing with deterministic fallback:',
        extractionError
      );
      extraction = {
        risks: [],
        summary:
          'Automatische Risiko-Extraktion war nicht vollständig möglich. Die Sektion wurde mit Fallback-Regeln erzeugt und muss gegen das Originaldokument validiert werden.',
        dashboardHighlights: [
          'Vertrags-/Terminrisiken im Originaldokument verifizieren.',
          'Risikotreiber in zentrale Bieterfragen und Annahmen überführen.',
          'Mitigations vor Angebotsfinalisierung abstimmen.',
        ],
        confidence: 25,
      };
    }

    const risks = extraction.risks ?? [];

    // Pad with explicit manual-review risks when evidence is too thin.
    const padSource: SourceRef = {
      kind: 'assumption',
      label: 'Manuelle Prüfung erforderlich',
      rationale:
        'Das Risiko ist im Kontext unklar oder nicht explizit genannt. Bitte Originaldokument prüfen.',
    };
    const MIN_RISKS = 4;
    while (risks.length < MIN_RISKS) {
      risks.push({
        title: 'Unklarer Vertrags-/Leistungsumfang',
        description:
          'Im Dokument ist unklar, welche Pflichten/Abnahmen/Qualitätskriterien gelten oder wie Änderungen geregelt sind.',
        likelihood: 'medium',
        impact: 'high',
        auswirkung:
          'Mehr Aufwand und Terminrisiko durch Nachforderungen/Interpretationsspielraum; Risiko von Nacharbeiten ohne Vergütung.',
        mitigation:
          'Als Angebotsannahmen klar abgrenzen; Change-Request Prozess vorschlagen; offene Punkte als Bieterfragen klären.',
        openQuestions: ['Welche Abnahmekriterien/DoD gelten verbindlich?'],
        confidence: 20,
        evidenceChunkIds: [],
        needsManualReview: true,
      });
    }

    const riskRows = risks.slice(0, 12).map(r => {
      const rfpSources = collectRfpSourcesFromChunkIds(r.evidenceChunkIds, byId);
      const sources: SourceRef[] = r.needsManualReview ? [...rfpSources, padSource] : rfpSources;

      return {
        title: r.title,
        likelihood: fmtLevel(r.likelihood),
        impact: fmtLevel(r.impact),
        auswirkung: r.auswirkung,
        mitigation: r.mitigation,
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const openQuestions = Array.from(
      new Set(
        risks
          .flatMap(r => r.openQuestions ?? [])
          .map(q => q.trim())
          .filter(Boolean)
      )
    ).slice(0, 12);

    const nextSteps = [
      'Kritische Vertragsklauseln (Haftung, Pönalen, SLAs, Gewährleistung) juristisch prüfen und Deal-Breaker markieren.',
      'Zeitplanrisiken bewerten (Rückwärtsplanung für Angebotsabgabe, interne Reviews, Puffer).',
      'Abhängigkeiten/Mitwirkungspflichten des AG als Annahmen dokumentieren (Zulieferungen, Zugänge, Freigaben).',
      'Security/DSGVO Anforderungen als Pflicht-Deliverables/Workpackages im Angebot abbilden (inkl. Aufwand).',
      'Migrations-/Schnittstellenrisiken als Discovery-Aufgabe bepreisen; Daten-/Systemzugang vorab klären.',
    ];

    const tree = buildVisualizationTree({
      summary: extraction.summary,
      riskRows,
      openQuestions,
      nextSteps,
    });

    // Store visualization (idempotent).
    await db.insert(dealEmbeddings).values({
      pitchId: null,
      preQualificationId,
      agentName: 'prequal_section_agent',
      chunkType: 'visualization',
      chunkIndex: 0,
      chunkCategory: 'elaboration',
      content: JSON.stringify(tree),
      confidence: extraction.confidence,
      embedding: null,
      metadata: JSON.stringify({
        sectionId,
        isVisualization: true,
        elementCount: Object.keys(tree.elements).length,
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
      }),
    });

    // Store dashboard highlights
    await db.insert(dealEmbeddings).values({
      pitchId: null,
      preQualificationId,
      agentName: `dashboard_${sectionId}`,
      chunkType: 'dashboard_highlight',
      chunkIndex: 0,
      chunkCategory: 'elaboration',
      content: JSON.stringify(extraction.dashboardHighlights ?? []),
      confidence: extraction.confidence,
      embedding: null,
      metadata: JSON.stringify({ sectionId }),
    });

    // Findings (12-20), each with sources.
    const findings: Array<{
      content: string;
      metadata: Record<string, unknown>;
      category: 'risk' | 'recommendation';
    }> = [];

    for (const r of risks) {
      const rfpSources = collectRfpSourcesFromChunkIds(r.evidenceChunkIds, byId);
      const sources: SourceRef[] = r.needsManualReview ? [...rfpSources, padSource] : rfpSources;

      findings.push({
        content:
          `Risiko: ${r.title} (Wahrscheinlichkeit: ${fmtLevel(r.likelihood)}, Impact: ${fmtLevel(r.impact)}). ` +
          `Auswirkung: ${r.auswirkung}. Mitigation: ${r.mitigation}.` +
          formatInlineSourcesBlock(sources),
        category: 'risk',
        metadata: { sectionId, sources: dedupeSourceRefs(sources) },
      });

      for (const q of (r.openQuestions ?? []).slice(0, 2)) {
        findings.push({
          content: `Offene Frage: ${q}${formatInlineSourcesBlock(sources)}`,
          category: 'recommendation',
          metadata: { sectionId, sources: dedupeSourceRefs(sources), kind: 'open_question' },
        });
      }
    }

    for (const step of nextSteps) {
      if (findings.length >= 12) break;
      findings.push({
        content: `Next Step: ${step}${formatInlineSourcesBlock([padSource])}`,
        category: 'recommendation',
        metadata: { sectionId, sources: [padSource], kind: 'next_step' },
      });
    }
    while (findings.length < 12) {
      findings.push({
        content:
          'Manuelle Prüfung: Vertrags-/Zeitplanpassagen im Originaldokument verifizieren und als Angebotsannahmen absichern.' +
          formatInlineSourcesBlock([padSource]),
        category: 'recommendation',
        metadata: { sectionId, sources: [padSource], kind: 'manual_check' },
      });
    }

    const capped = findings.slice(0, 20);
    const embeddings = await generateEmbeddingsWithConcurrency(
      capped.map(f => f.content),
      { concurrency: 3 }
    );

    await db.insert(dealEmbeddings).values(
      capped.map((f, idx) => ({
        pitchId: null,
        preQualificationId,
        agentName: 'prequal_section_agent',
        chunkType: sectionId,
        chunkIndex: idx,
        chunkCategory: f.category,
        content: f.content,
        confidence: extraction.confidence,
        requiresValidation: false,
        embedding: embeddings[idx],
        metadata: JSON.stringify(f.metadata),
      }))
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
