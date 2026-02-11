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

const AwardCriteriaExtractSchema = z.object({
  criteria: z.array(
    z.object({
      criterion: z.string().min(1),
      weight: z.string().nullable(),
      scoringHint: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  priceScoring: z.array(
    z.object({
      method: z.string().min(1),
      formulaOrScale: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  knockoutCriteria: z.array(
    z.object({
      criterion: z.string().min(1),
      details: z.string().nullable(),
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

type AwardCriteriaExtract = z.infer<typeof AwardCriteriaExtractSchema>;

function buildAwardCriteriaTree(params: {
  summary: string;
  criteriaRows: Array<Record<string, string>>;
  priceScoringItems: string[];
  knockoutItems: string[];
  centralBidderQuestionsHint: string;
  nextSteps: string[];
  hasWeightData: boolean;
}): JsonRenderTree {
  const {
    summary,
    criteriaRows,
    priceScoringItems,
    knockoutItems,
    centralBidderQuestionsHint,
    nextSteps,
    hasWeightData,
  } = params;

  const sectionChildren = [
    'para-summary',
    'sub-criteria',
    ...(hasWeightData ? ['chart-weights'] : []),
    'sub-price-scoring',
    'sub-knockout',
    'sub-bidder-questions',
    'sub-next',
  ];

  const elements: Record<string, unknown> = {
    'section-main': {
      key: 'section-main',
      type: 'Section',
      props: { title: 'Zuschlagskriterien & Bewertung' },
      children: sectionChildren,
    },
    'para-summary': { key: 'para-summary', type: 'Paragraph', props: { text: summary } },
    'sub-criteria': {
      key: 'sub-criteria',
      type: 'SubSection',
      props: { title: 'Kriterien & Gewichtung' },
      children: ['table-criteria'],
    },
    'table-criteria': {
      key: 'table-criteria',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'criterion', label: 'Kriterium' },
          { key: 'weight', label: 'Gewichtung' },
          { key: 'scoringHint', label: 'Bewertungshinweis' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: criteriaRows,
        compact: true,
      },
    },
    'sub-price-scoring': {
      key: 'sub-price-scoring',
      type: 'SubSection',
      props: { title: 'Bewertungsmethodik (Preis/Qualität)' },
      children: ['list-price-scoring'],
    },
    'list-price-scoring': {
      key: 'list-price-scoring',
      type: 'BulletList',
      props: { items: priceScoringItems },
    },
    'sub-knockout': {
      key: 'sub-knockout',
      type: 'SubSection',
      props: { title: 'K.O.-Kriterien / Mindestanforderungen' },
      children: ['list-knockout'],
    },
    'list-knockout': {
      key: 'list-knockout',
      type: 'BulletList',
      props: { items: knockoutItems },
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
      props: { title: 'Next Steps (Fokus im Angebot)' },
      children: ['list-next'],
    },
    'list-next': {
      key: 'list-next',
      type: 'BulletList',
      props: { items: nextSteps },
    },
  };

  if (hasWeightData) {
    const chartData = criteriaRows
      .map(row => {
        const m = row.weight.match(/\d+(?:[.,]\d+)?/);
        if (!m) return null;
        return {
          label: row.criterion.slice(0, 30),
          value: Number(m[0].replace(',', '.')),
        };
      })
      .filter((x): x is { label: string; value: number } => x !== null)
      .slice(0, 8);

    if (chartData.length > 0) {
      elements['chart-weights'] = {
        key: 'chart-weights',
        type: 'BarChart',
        props: {
          title: 'Gewichtungsverteilung (falls im RFP angegeben)',
          data: chartData,
          format: 'percent',
        },
      };
    }
  }

  return { root: 'section-main', elements };
}

export async function runAwardCriteriaSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId } = options;
  const sectionId = 'award-criteria';

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
        { query: 'Zuschlagskriterien Bewertung Gewichtung Punkte' },
        { query: 'Preiswertung Formel Punkteskala' },
        { query: 'Qualitätskriterien Konzept Bewertung' },
        { query: 'Mindestanforderung KO K.O. Ausschlusskriterium' },
      ],
      maxTotal: 28,
    });

    let extraction: AwardCriteriaExtract | null = null;

    if (chunks.length > 0) {
      try {
        extraction = await generateWithFallback({
          model: 'default',
          schema: AwardCriteriaExtractSchema,
          system: `Du extrahierst Zuschlagskriterien aus RFP-Chunks.

REGELN:
- Nur EVIDENCE CHUNKS verwenden.
- evidenceChunkIds >=1 oder needsManualReview=true.
- Keine Halluzinationen.
- Wenn Gewichtung fehlt: klar benennen statt schätzen.`,
          prompt: [
            `SECTION: ${sectionId}`,
            '',
            buildEvidenceContextForExtraction(chunks),
            '',
            'AUFGABE:',
            '1) Kriterien/Gewichtungen extrahieren.',
            '2) Preisbewertungsmethodik extrahieren.',
            '3) KO-Kriterien extrahieren.',
            '4) offene Fragen für zentrale Bieterfragen ableiten.',
            '5) Summary + Dashboard Highlights.',
          ].join('\n'),
          temperature: 0,
          maxTokens: 5000,
          timeout: 60_000,
        });
      } catch (extractionError) {
        console.warn(
          '[AwardCriteriaSection] Structured extraction failed, continuing with deterministic fallback:',
          extractionError
        );
      }
    }

    const criteriaRows = (extraction?.criteria ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale:
          'Kriterium/Gewichtung ist unklar und muss im Original verifiziert werden.',
      });
      return {
        criterion: item.criterion,
        weight: item.weight || 'Nicht genannt',
        scoringHint: item.scoringHint || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const priceScoringItems = (extraction?.priceScoring ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Preisbewertungslogik ist auslegungsbedürftig.',
      });
      return `${item.method}${item.formulaOrScale ? ` — ${item.formulaOrScale}` : ''}${formatInlineSourcesBlock(sources)}`;
    });

    const knockoutItems = (extraction?.knockoutCriteria ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'KO-Kriterium ist unklar formuliert und muss bestätigt werden.',
      });
      return `${item.criterion}${item.details ? ` — ${item.details}` : ''}${formatInlineSourcesBlock(sources)}`;
    });

    const centralBidderQuestions = (extraction?.openQuestions ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Bieterfrage aus unklarer Bewertungsmethodik.',
      });
      return {
        content: `Offene Frage: ${item.question} (Warum relevant: ${item.whyItMatters})${formatInlineSourcesBlock(sources)}`,
        sources,
      };
    });

    if (criteriaRows.length === 0) {
      criteriaRows.push({
        criterion: 'Kriterien nicht eindeutig extrahierbar',
        weight: 'Nicht genannt',
        scoringHint: 'Bewertungsmatrix im Originaldokument manuell prüfen.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Kriterien unklar',
            rationale: 'Keine belastbaren Bewertungsangaben mit Locator gefunden.',
          },
        ]).trim(),
      });
    }

    if (priceScoringItems.length === 0) {
      priceScoringItems.push(
        `Preisbewertungsmethodik nicht eindeutig genannt${formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Preiswertung unklar',
            rationale: 'Formel/Skala im Dokumentkontext nicht belastbar erkennbar.',
          },
        ])}`
      );
    }

    if (knockoutItems.length === 0) {
      knockoutItems.push(
        `Keine expliziten KO-Kriterien erkannt; Mindestanforderungen im Original prüfen${formatInlineSourcesBlock(
          [
            {
              kind: 'assumption',
              label: 'KO-Kriterien unklar',
              rationale: 'Keine eindeutigen Ausschlusskriterien mit Quelle extrahiert.',
            },
          ]
        )}`
      );
    }

    if (centralBidderQuestions.length === 0) {
      const src: SourceRef = {
        kind: 'assumption',
        label: 'Standard-Bieterfrage',
        rationale: 'Unklare Gewichtungen/Bewertungslogik beeinflussen die Angebotsstrategie.',
      };
      centralBidderQuestions.push({
        content:
          `Offene Frage: Bitte bestätigen Sie Bewertungsmatrix, Gewichtung und Preisformel inklusive Rundungsregeln.` +
          formatInlineSourcesBlock([src]),
        sources: [src],
      });
    }

    const summary =
      extraction?.summary ||
      'Die Zuschlagsanalyse fokussiert auf Kriterien, Gewichtungen und Bewertungsmethodik. Unklare Bewertungslogik ist als zentrale Bieterfrage markiert.';

    const dashboardHighlights =
      extraction?.dashboardHighlights && extraction.dashboardHighlights.length > 0
        ? extraction.dashboardHighlights
        : [
            'Kriterien/Gewichtungen sind nur teilweise belastbar aus Dokumenten ableitbar.',
            'Preiswertungslogik ist entscheidend für Angebotsstrategie und Margensteuerung.',
            'Unklare Bewertungspunkte sind zentral als Bieterfragen geführt.',
          ];

    const nextSteps = [
      'Bewertungsmatrix und Gewichtungen gegen Originaldokument validieren.',
      'Angebotsinhalte auf hoch gewichtete Kriterien priorisieren.',
      'Unklare Formel-/Skalenpunkte als zentrale Bieterfrage klären.',
    ];

    const hasWeightData = criteriaRows.some(row => /\d/.test(row.weight));

    let tree = buildAwardCriteriaTree({
      summary,
      criteriaRows,
      priceScoringItems,
      knockoutItems,
      centralBidderQuestionsHint:
        'Bieterfragen werden zentral gebündelt und mit Verweis auf die Section "Zuschlagskriterien" geführt.',
      nextSteps,
      hasWeightData,
    });

    tree = injectSourcesPanel(
      tree as any,
      buildSourcesFromRawChunks(chunks, { maxSources: 10, maxExcerptChars: 350 }),
      { subSectionTitle: 'Quellen', panelTitle: 'Quellen', maxSources: 10 }
    ) as unknown as JsonRenderTree;

    const findings: StoredSectionFinding[] = [];

    for (const row of criteriaRows) {
      findings.push({
        content: `Kriterium: ${row.criterion}; Gewichtung: ${row.weight}; Bewertungshinweis: ${row.scoringHint}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: { sectionId, kind: 'criterion', sources: [] },
      });
    }

    for (const item of priceScoringItems) {
      findings.push({
        content: `Preisbewertung: ${item}`,
        category: 'fact',
        metadata: { sectionId, kind: 'price_scoring', sources: [] },
      });
    }

    for (const item of knockoutItems) {
      findings.push({
        content: `KO/Mindestanforderung: ${item}`,
        category: 'fact',
        metadata: { sectionId, kind: 'knockout', sources: [] },
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
