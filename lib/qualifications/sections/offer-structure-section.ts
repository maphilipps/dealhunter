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

import {
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

const OfferStructureExtractSchema = z.object({
  requiredParts: z.array(
    z.object({
      part: z.string().min(1),
      mandatory: z.boolean(),
      formatOrNotes: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  structureRules: z.array(
    z.object({
      rule: z.string().min(1),
      details: z.string().min(1),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  concepts: z.array(
    z.object({
      concept: z.string().min(1),
      mandatory: z.boolean(),
      notes: z.string().nullable(),
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

type OfferStructureExtract = z.infer<typeof OfferStructureExtractSchema>;

function buildOfferStructureTree(params: {
  summary: string;
  requiredRows: Array<Record<string, string>>;
  ruleRows: Array<Record<string, string>>;
  conceptRows: Array<Record<string, string>>;
  templateItems: string[];
  centralBidderQuestionsHint: string;
  nextSteps: string[];
}): JsonRenderTree {
  const {
    summary,
    requiredRows,
    ruleRows,
    conceptRows,
    templateItems,
    centralBidderQuestionsHint,
    nextSteps,
  } = params;

  const elements: Record<string, unknown> = {
    'section-main': {
      key: 'section-main',
      type: 'Section',
      props: { title: 'Angebotsstruktur' },
      children: [
        'para-summary',
        'sub-required',
        'sub-rules',
        'sub-concepts',
        'sub-template',
        'sub-bidder-questions',
        'sub-next',
      ],
    },
    'para-summary': { key: 'para-summary', type: 'Paragraph', props: { text: summary } },
    'sub-required': {
      key: 'sub-required',
      type: 'SubSection',
      props: { title: 'Pflichtbestandteile / Kapitel' },
      children: ['table-required'],
    },
    'table-required': {
      key: 'table-required',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'part', label: 'Teil/Kapitel/Anlage' },
          { key: 'mandatory', label: 'Pflicht?' },
          { key: 'formatOrNotes', label: 'Format/Hinweise' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: requiredRows,
        compact: true,
      },
    },
    'sub-rules': {
      key: 'sub-rules',
      type: 'SubSection',
      props: { title: 'Formale Strukturregeln' },
      children: ['table-rules'],
    },
    'table-rules': {
      key: 'table-rules',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'rule', label: 'Regel' },
          { key: 'details', label: 'Details' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: ruleRows,
        compact: true,
      },
    },
    'sub-concepts': {
      key: 'sub-concepts',
      type: 'SubSection',
      props: { title: 'Konzeptanforderungen' },
      children: ['table-concepts'],
    },
    'table-concepts': {
      key: 'table-concepts',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'concept', label: 'Konzept' },
          { key: 'mandatory', label: 'Pflicht?' },
          { key: 'notes', label: 'Hinweise' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: conceptRows,
        compact: true,
      },
    },
    'sub-template': {
      key: 'sub-template',
      type: 'SubSection',
      props: { title: 'Template-ToC (Annahme, wenn RFP unklar)' },
      children: ['list-template'],
    },
    'list-template': {
      key: 'list-template',
      type: 'BulletList',
      props: { items: templateItems },
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
      props: { title: 'Next Steps' },
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

export async function runOfferStructureSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId } = options;
  const sectionId = 'offer-structure';

  try {
    const [preQual] = await db
      .select({ id: preQualifications.id })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQual) return { success: false, error: 'Qualification not found' };

    await deletePreQualSectionArtifacts({ preQualificationId, sectionId });

    const { chunks, byId } = await collectEvidenceChunks({
      preQualificationId,
      queries: [
        { query: 'Angebotsstruktur Gliederung Teil A Teil B' },
        { query: 'Formblatt Anlage Unterlagen Reihenfolge' },
        { query: 'Konzept Projektmanagement Betrieb Sicherheit Barrierefreiheit' },
        { query: 'Dateibenennung Format PDF Upload Portal' },
      ],
      maxTotal: 28,
    });

    let extraction: OfferStructureExtract | null = null;

    if (chunks.length > 0) {
      try {
        extraction = await generateWithFallback({
          model: 'default',
          schema: OfferStructureExtractSchema,
          system: `Du extrahierst Angebotsstruktur aus RFP-Chunks.

REGELN:
- Nur EVIDENCE CHUNKS verwenden.
- evidenceChunkIds >=1 oder needsManualReview=true.
- Keine Halluzinationen.
- Wenn Struktur unklar: als Annahme markieren und Bieterfrage formulieren.`,
          prompt: [
            `SECTION: ${sectionId}`,
            '',
            buildEvidenceContextForExtraction(chunks),
            '',
            'AUFGABE:',
            '1) Pflichtbestandteile/Anlagen extrahieren.',
            '2) Formale Strukturregeln extrahieren.',
            '3) Konzeptanforderungen extrahieren.',
            '4) offene Fragen für zentrale Bieterfragen formulieren.',
            '5) Summary + Dashboard Highlights.',
          ].join('\n'),
          temperature: 0,
          maxTokens: 5000,
          timeout: 60_000,
        });
      } catch (extractionError) {
        console.warn(
          '[OfferStructureSection] Structured extraction failed, continuing with deterministic fallback:',
          extractionError
        );
      }
    }

    const requiredRows = (extraction?.requiredParts ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Pflichtbestandteil ist nicht eindeutig benannt.',
      });
      return {
        part: item.part,
        mandatory: item.mandatory ? 'Ja' : 'Nein',
        formatOrNotes: item.formatOrNotes || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const ruleRows = (extraction?.structureRules ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Formale Regel ist im Dokumentkontext nicht eindeutig.',
      });
      return {
        rule: item.rule,
        details: item.details,
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const conceptRows = (extraction?.concepts ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Konzeptanforderung muss gegen Formblatt validiert werden.',
      });
      return {
        concept: item.concept,
        mandatory: item.mandatory ? 'Ja' : 'Nein',
        notes: item.notes || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const centralBidderQuestions = (extraction?.openQuestions ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Bieterfrage aus unklarer Angebotsstruktur.',
      });
      return {
        content: `Offene Frage: ${item.question} (Warum relevant: ${item.whyItMatters})${formatInlineSourcesBlock(sources)}`,
        sources,
      };
    });

    const templateAssumption: SourceRef = {
      kind: 'assumption',
      label: 'Template-ToC',
      rationale:
        'Arbeitsvorlage bei unklarer RFP-Struktur, muss gegen Pflichtunterlagen validiert werden.',
    };

    const templateItems = [
      `Anschreiben / Formalia / Eigenerklärungen${formatInlineSourcesBlock([templateAssumption])}`,
      `Preisblatt / Kalkulation / kommerzielle Anlagen${formatInlineSourcesBlock([templateAssumption])}`,
      `Technisches Konzept / Vorgehenskonzept / Betrieb${formatInlineSourcesBlock([templateAssumption])}`,
      `Referenzen / Nachweise / Teamprofile${formatInlineSourcesBlock([templateAssumption])}`,
    ];

    if (requiredRows.length === 0) {
      requiredRows.push({
        part: 'Pflichtbestandteile unklar',
        mandatory: 'Unklar',
        formatOrNotes: 'RFP-Gliederung/Formblätter manuell prüfen.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Struktur unklar',
            rationale: 'Keine belastbare Liste der Pflichtunterlagen extrahiert.',
          },
        ]).trim(),
      });
    }

    if (ruleRows.length === 0) {
      ruleRows.push({
        rule: 'Formale Regeln nicht eindeutig extrahiert',
        details: 'Dateiformate, Signatur und Uploadregeln im Original prüfen.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Regeln unklar',
            rationale: 'Formale Vorgaben waren im Chunk-Kontext nicht ausreichend präzise.',
          },
        ]).trim(),
      });
    }

    if (conceptRows.length === 0) {
      conceptRows.push({
        concept: 'Konzeptanforderungen unklar',
        mandatory: 'Unklar',
        notes: 'Pflichtkonzepte gegen Bewertungsmatrix/Formblätter prüfen.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Konzeptpflicht unklar',
            rationale: 'Keine eindeutigen Konzeptpflichten mit Locator gefunden.',
          },
        ]).trim(),
      });
    }

    if (centralBidderQuestions.length === 0) {
      const src: SourceRef = {
        kind: 'assumption',
        label: 'Standard-Bieterfrage',
        rationale: 'Unklare Unterlagen-/Formatpflichten müssen vor Abgabe geklärt werden.',
      };
      centralBidderQuestions.push({
        content:
          `Offene Frage: Bitte bestätigen Sie vollständige Liste der Pflichtunterlagen inkl. Format-/Signaturvorgaben.` +
          formatInlineSourcesBlock([src]),
        sources: [src],
      });
    }

    const summary =
      extraction?.summary ||
      'Die Angebotsstruktur wurde aus verfügbaren Dokumenthinweisen rekonstruiert. Unklare Pflichtbestandteile und Formalia sind als zentrale Bieterfragen markiert.';

    const dashboardHighlights =
      extraction?.dashboardHighlights && extraction.dashboardHighlights.length > 0
        ? extraction.dashboardHighlights
        : [
            'Pflichtbestandteile/Formalia müssen gegen Originalunterlagen validiert werden.',
            'Konzeptanforderungen sind zentral für Vollständigkeit und Bewertung.',
            'Offene Strukturfragen sind zentral als Bieterfragen geführt.',
          ];

    const nextSteps = [
      'Angebots-Gliederung gegen RFP-Formblätter/Anlagen finalisieren.',
      'Pflichtkonzepte und formale Vorgaben in interne Checkliste überführen.',
      'Unklare Struktur-/Formatfragen zentral als Bieterfrage klären.',
    ];

    let tree = buildOfferStructureTree({
      summary,
      requiredRows,
      ruleRows,
      conceptRows,
      templateItems,
      centralBidderQuestionsHint:
        'Bieterfragen werden zentral gebündelt und mit Verweis auf die Section "Angebotsstruktur" geführt.',
      nextSteps,
    });

    tree = injectSourcesPanel(
      tree as any,
      buildSourcesFromRawChunks(chunks, { maxSources: 10, maxExcerptChars: 350 }),
      { subSectionTitle: 'Quellen', panelTitle: 'Quellen', maxSources: 10 }
    ) as unknown as JsonRenderTree;

    const findings: StoredSectionFinding[] = [];

    for (const row of requiredRows) {
      findings.push({
        content: `Pflichtbestandteil: ${row.part}; Pflicht: ${row.mandatory}; Hinweise: ${row.formatOrNotes}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'required_part', sources: [] },
      });
    }

    for (const row of ruleRows) {
      findings.push({
        content: `Strukturregel: ${row.rule} — ${row.details}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'structure_rule', sources: [] },
      });
    }

    for (const row of conceptRows) {
      findings.push({
        content: `Konzeptanforderung: ${row.concept}; Pflicht: ${row.mandatory}; Hinweise: ${row.notes}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'concept_requirement', sources: [] },
      });
    }

    findings.push({
      content: `Template-ToC Empfehlung: ${templateItems.join(' | ')}`,
      category: 'recommendation',
      metadata: {
        sectionId,
        kind: 'template_toc',
        sources: [templateAssumption],
      },
    });

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
