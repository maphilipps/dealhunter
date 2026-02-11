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

const TimingExtractSchema = z.object({
  keyDates: z.array(
    z.object({
      label: z.string().min(1),
      date: z.string().nullable(),
      notes: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  procedureSteps: z.array(
    z.object({
      step: z.string().min(1),
      notes: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  risks: z.array(
    z.object({
      risk: z.string().min(1),
      impact: z.string().min(1),
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

type TimingExtract = z.infer<typeof TimingExtractSchema>;

function buildTimingTree(params: {
  summary: string;
  keyDateRows: Array<Record<string, string>>;
  stepItems: string[];
  riskItems: string[];
  centralBidderQuestionsHint: string;
  nextSteps: string[];
}): JsonRenderTree {
  const { summary, keyDateRows, stepItems, riskItems, centralBidderQuestionsHint, nextSteps } =
    params;

  const elements: Record<string, unknown> = {
    'section-main': {
      key: 'section-main',
      type: 'Section',
      props: { title: 'Zeitplan & Verfahren' },
      children: [
        'para-summary',
        'sub-dates',
        'sub-steps',
        'sub-risks',
        'sub-bidder-questions',
        'sub-next',
      ],
    },
    'para-summary': {
      key: 'para-summary',
      type: 'Paragraph',
      props: { text: summary },
    },
    'sub-dates': {
      key: 'sub-dates',
      type: 'SubSection',
      props: { title: 'Key Dates (chronologisch)' },
      children: ['table-dates'],
    },
    'table-dates': {
      key: 'table-dates',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'label', label: 'Termin' },
          { key: 'date', label: 'Datum/Zeit' },
          { key: 'notes', label: 'Hinweise' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: keyDateRows,
        compact: true,
      },
    },
    'sub-steps': {
      key: 'sub-steps',
      type: 'SubSection',
      props: { title: 'Verfahrensablauf' },
      children: ['list-steps'],
    },
    'list-steps': {
      key: 'list-steps',
      type: 'BulletList',
      props: { items: stepItems },
    },
    'sub-risks': {
      key: 'sub-risks',
      type: 'SubSection',
      props: { title: 'Timing-Risiken' },
      children: ['list-risks'],
    },
    'list-risks': {
      key: 'list-risks',
      type: 'BulletList',
      props: { items: riskItems },
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

export async function runTimingSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, allowWebEnrichment } = options;
  const sectionId = 'timing';

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
          question: 'Vergabeverfahren Fristen Best Practices Rückfragenfristen',
          maxResults: 2,
        });
      } catch {
        // Best-effort.
      }
    }

    const { chunks, byId } = await collectEvidenceChunks({
      preQualificationId,
      queries: [
        { query: 'Frist Fristen Abgabefrist Angebotsfrist Teilnahmeantrag Bindefrist' },
        { query: 'Bieterfragen Rückfragen Frist Fragenfrist' },
        { query: 'Projektstart Kickoff Go-Live Laufzeit Meilensteine' },
        { query: 'Verhandlungsverfahren Präsentation Shortlist Verhandlungstermin' },
        { query: 'Terminplan Zeitplan Kalenderwoche KW' },
      ],
      maxTotal: 28,
    });

    let extraction: TimingExtract | null = null;

    if (chunks.length > 0) {
      const evidenceContext = buildEvidenceContextForExtraction(chunks);
      try {
        extraction = await generateWithFallback({
          model: 'default',
          schema: TimingExtractSchema,
          system: `Du extrahierst Zeitplan- und Verfahrensinformationen aus RFP-Chunks.

REGELN:
- NUR EVIDENCE CHUNKS verwenden.
- Jede Aussage hat evidenceChunkIds (>=1) oder needsManualReview=true.
- Keine Halluzinationen.`,
          prompt: [
            `SECTION: ${sectionId}`,
            '',
            evidenceContext,
            '',
            'AUFGABE:',
            '1) Extrahiere Termine/Fristen als keyDates.',
            '2) Extrahiere Verfahrensschritte.',
            '3) Formuliere Timing-Risiken und offene Fragen.',
            '4) Erzeuge Summary + 1-3 Dashboard Highlights.',
          ].join('\n'),
          temperature: 0,
          maxTokens: 4500,
          timeout: 60_000,
        });
      } catch (extractionError) {
        console.warn(
          '[TimingSection] Structured extraction failed, continuing with deterministic fallback:',
          extractionError
        );
      }
    }

    const keyDateRows = (extraction?.keyDates ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Terminangabe ist unklar; bitte im Originaldokument verifizieren.',
      });

      return {
        label: item.label,
        date: item.date || '—',
        notes: item.notes || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const stepItems = (extraction?.procedureSteps ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Verfahrensschritt ist nicht eindeutig beschrieben.',
      });
      return `${item.step}${item.notes ? ` — ${item.notes}` : ''}${formatInlineSourcesBlock(sources)}`;
    });

    const riskItems = (extraction?.risks ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale:
          'Timing-Risiko basiert auf unklarer Evidenz und muss geprüft werden.',
      });
      return `${item.risk} — ${item.impact}${formatInlineSourcesBlock(sources)}`;
    });

    const centralBidderQuestions = (extraction?.openQuestions ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Bieterfrage aus unklarer Termin-/Verfahrenslage.',
      });
      return {
        content: `Offene Frage: ${item.question} (Warum relevant: ${item.whyItMatters})${formatInlineSourcesBlock(sources)}`,
        sources,
      };
    });

    if (keyDateRows.length === 0) {
      keyDateRows.push({
        label: 'Keine belastbaren Termine gefunden',
        date: '—',
        notes: 'Fristen im PDF manuell prüfen und als Bieterfrage klären.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Termine unklar',
            rationale:
              'Im Chunk-Kontext konnten keine eindeutigen Datumsangaben mit Locator extrahiert werden.',
          },
        ]).trim(),
      });
    }

    if (stepItems.length === 0) {
      stepItems.push(
        `Verfahrensschritte sind im Dokumentkontext nicht klar strukturiert${formatInlineSourcesBlock(
          [
            {
              kind: 'assumption',
              label: 'Verfahrensablauf unklar',
              rationale: 'Bitte Bekanntmachung und Anlagen manuell prüfen.',
            },
          ]
        )}`
      );
    }

    if (riskItems.length === 0) {
      riskItems.push(
        `Keine expliziten Timing-Risiken extrahiert; Fristen- und Abhängigkeitsprüfung empfohlen${formatInlineSourcesBlock(
          [
            {
              kind: 'assumption',
              label: 'Risikoanalyse ergänzt',
              rationale: 'Bei dünner Evidenz sind manuelle Risikoprüfungen erforderlich.',
            },
          ]
        )}`
      );
    }

    if (centralBidderQuestions.length === 0) {
      const src: SourceRef = {
        kind: 'assumption',
        label: 'Standard-Bieterfrage',
        rationale: 'Wenn Fristen/Meilensteine unklar sind, muss der Auftraggeber sie präzisieren.',
      };
      centralBidderQuestions.push({
        content:
          `Offene Frage: Bitte bestätigen Sie verbindliche Abgabe-, Rückfragen- und Zuschlagsfristen.` +
          formatInlineSourcesBlock([src]),
        sources: [src],
      });
    }

    const summary =
      extraction?.summary ||
      'Die Zeitplananalyse basiert auf den verfügbaren Dokumenthinweisen. Unklare Fristen und Verfahrensschritte sind als zentrale Bieterfragen hinterlegt.';

    const dashboardHighlights =
      extraction?.dashboardHighlights && extraction.dashboardHighlights.length > 0
        ? extraction.dashboardHighlights
        : [
            'Fristen und Meilensteine müssen gegen das Originaldokument validiert werden.',
            'Verfahrensschritte enthalten potenzielle Timing-Risiken.',
            'Bieterfragen werden zentral mit Section-Verweis geführt.',
          ];

    const nextSteps = [
      'Alle Fristen/Termine gegen Bekanntmachung und Anlagen verifizieren.',
      'Interne Rückwärtsplanung mit Puffer für Freigaben/Upload aufsetzen.',
      'Unklare Fristen/Verfahrensschritte als zentrale Bieterfrage adressieren.',
    ];

    let tree = buildTimingTree({
      summary,
      keyDateRows,
      stepItems,
      riskItems,
      centralBidderQuestionsHint:
        'Bieterfragen sind zentral gebündelt und mit Verweis auf die Section "Zeitplan/Verfahren" versehen.',
      nextSteps,
    });

    tree = injectSourcesPanel(
      tree as any,
      buildSourcesFromRawChunks(chunks, { maxSources: 10, maxExcerptChars: 350 }),
      { subSectionTitle: 'Quellen', panelTitle: 'Quellen', maxSources: 10 }
    ) as unknown as JsonRenderTree;

    const findings: StoredSectionFinding[] = [];

    for (const row of keyDateRows) {
      findings.push({
        content: `Termin: ${row.label} — ${row.date}; ${row.notes}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'key_date', sources: [] },
      });
    }

    for (const item of stepItems) {
      findings.push({
        content: `Verfahrensschritt: ${item}`,
        category: 'fact',
        metadata: { sectionId, kind: 'procedure_step', sources: [] },
      });
    }

    for (const item of riskItems) {
      findings.push({
        content: `Timing-Risiko: ${item}`,
        category: 'recommendation',
        metadata: { sectionId, kind: 'timing_risk', sources: [] },
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
