import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateWithFallback } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { preQualifications, qualificationScans } from '@/lib/db/schema';
import {
  formatInlineSourcesBlock,
  type SourceRef,
  dedupeSourceRefs,
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
import { buildIndicativeBudgetEstimateFromScanPayload } from './budget-estimate';
import type { BudgetIndicatorResult } from '@/lib/qualification-scan/workflow/steps/budget-indicator';

type JsonRenderTree = { root: string; elements: Record<string, unknown> };

const BudgetExtractSchema = z.object({
  budgetStatements: z.array(
    z.object({
      amountOrRange: z.string().min(1),
      scope: z.string().min(1),
      interpretation: z.string().min(1),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  remunerationModel: z.array(
    z.object({
      modelType: z.string().min(1),
      description: z.string().min(1),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  durationAndOptions: z.array(
    z.object({
      duration: z.string().min(1),
      optionDetails: z.string().nullable(),
      evidenceChunkIds: z.array(z.string()),
      needsManualReview: z.boolean(),
    })
  ),
  specialCommercialRules: z.array(
    z.object({
      rule: z.string().min(1),
      explanation: z.string().min(1),
      implicationForBid: z.string().min(1),
      exampleCalculation: z.string().nullable(),
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

type BudgetExtract = z.infer<typeof BudgetExtractSchema>;

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadIndicativeBudgetEstimate(
  preQualificationId: string
): Promise<BudgetIndicatorResult | null> {
  const [scan] = await db
    .select({
      contentVolume: qualificationScans.contentVolume,
      features: qualificationScans.features,
      techStack: qualificationScans.techStack,
      migrationComplexity: qualificationScans.migrationComplexity,
    })
    .from(qualificationScans)
    .where(eq(qualificationScans.preQualificationId, preQualificationId))
    .limit(1);

  if (!scan) return null;

  return buildIndicativeBudgetEstimateFromScanPayload({
    contentVolume: parseJson(scan.contentVolume),
    features: parseJson(scan.features),
    techStack: parseJson(scan.techStack),
    migrationComplexity: parseJson(scan.migrationComplexity),
  });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildBudgetTree(params: {
  summary: string;
  budgetRows: Array<Record<string, string>>;
  remunerationRows: Array<Record<string, string>>;
  durationRows: Array<Record<string, string>>;
  specialRows: Array<Record<string, string>>;
  estimateRows: Array<Record<string, string>>;
  webRows: Array<Record<string, string>>;
  centralizedBidderQuestionHint: string;
  nextSteps: string[];
}): JsonRenderTree {
  const {
    summary,
    budgetRows,
    remunerationRows,
    durationRows,
    specialRows,
    estimateRows,
    webRows,
    centralizedBidderQuestionHint,
    nextSteps,
  } = params;

  const elements: Record<string, unknown> = {
    'section-main': {
      key: 'section-main',
      type: 'Section',
      props: { title: 'Budget & Finanzrahmen' },
      children: [
        'para-summary',
        'sub-rfp-budget',
        'sub-remuneration',
        'sub-duration',
        'sub-special-rules',
        'sub-estimate',
        ...(webRows.length > 0 ? ['sub-web-enrichment'] : []),
        'sub-bidder-questions',
        'sub-next',
      ],
    },
    'para-summary': {
      key: 'para-summary',
      type: 'Paragraph',
      props: { text: summary },
    },
    'sub-rfp-budget': {
      key: 'sub-rfp-budget',
      type: 'SubSection',
      props: { title: 'RFP: Budget & Preisrahmen' },
      children: ['table-rfp-budget'],
    },
    'table-rfp-budget': {
      key: 'table-rfp-budget',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'amountOrRange', label: 'Betrag/Spanne' },
          { key: 'scope', label: 'Bezugsrahmen' },
          { key: 'interpretation', label: 'Interpretation' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: budgetRows,
        compact: true,
      },
    },
    'sub-remuneration': {
      key: 'sub-remuneration',
      type: 'SubSection',
      props: { title: 'Vergütung & Abrechnung' },
      children: ['table-remuneration'],
    },
    'table-remuneration': {
      key: 'table-remuneration',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'modelType', label: 'Modell' },
          { key: 'description', label: 'Beschreibung' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: remunerationRows,
        compact: true,
      },
    },
    'sub-duration': {
      key: 'sub-duration',
      type: 'SubSection',
      props: { title: 'Laufzeit & Optionen' },
      children: ['table-duration'],
    },
    'table-duration': {
      key: 'table-duration',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'duration', label: 'Laufzeit' },
          { key: 'optionDetails', label: 'Optionen/Details' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: durationRows,
        compact: true,
      },
    },
    'sub-special-rules': {
      key: 'sub-special-rules',
      type: 'SubSection',
      props: { title: 'Sonderregeln & Beispiele' },
      children: ['table-special-rules'],
    },
    'table-special-rules': {
      key: 'table-special-rules',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'rule', label: 'Regel' },
          { key: 'explanation', label: 'Erklärung' },
          { key: 'exampleCalculation', label: 'Beispielrechnung' },
          { key: 'implicationForBid', label: 'Auswirkung fürs Angebot' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: specialRows,
        compact: true,
      },
    },
    'sub-estimate': {
      key: 'sub-estimate',
      type: 'SubSection',
      props: { title: 'Indikative Schätzung (Enrichment)' },
      children: ['table-estimate'],
    },
    'table-estimate': {
      key: 'table-estimate',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'scenario', label: 'Szenario' },
          { key: 'pt', label: 'PT' },
          { key: 'totalCost', label: 'Kosten (EUR)' },
          { key: 'source', label: 'Quelle/Annahme' },
        ],
        rows: estimateRows,
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
      props: { text: centralizedBidderQuestionHint },
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

  if (webRows.length > 0) {
    elements['sub-web-enrichment'] = {
      key: 'sub-web-enrichment',
      type: 'SubSection',
      props: { title: 'Web-Enrichment (nicht RFP)' },
      children: ['table-web-enrichment'],
    };
    elements['table-web-enrichment'] = {
      key: 'table-web-enrichment',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'title', label: 'Thema' },
          { key: 'insight', label: 'Hinweis' },
          { key: 'source', label: 'Quelle' },
        ],
        rows: webRows,
        compact: true,
      },
    };
  }

  return { root: 'section-main', elements };
}

export async function runBudgetSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, allowWebEnrichment } = options;
  const sectionId = 'budget';

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
            question: 'Marktübliche Tagessätze öffentliche IT-Ausschreibungen Deutschland 2025',
            maxResults: 2,
          }),
          performWebResearch({
            preQualificationId,
            sectionId,
            question: 'Bonus Malus Anrechnungsmodelle öffentliche Vergaben Praxis',
            maxResults: 2,
          }),
        ]);
      } catch {
        // Best-effort enrichment.
      }
    }

    const { chunks, byId } = await collectEvidenceChunks({
      preQualificationId,
      queries: [
        { query: 'Budget Kostenrahmen Auftragswert Schätzwert EUR €' },
        {
          query: 'Vergütung Verguetungsmodell Abrechnung Festpreis Pauschale Stundensatz Tagessatz',
        },
        { query: 'Rahmenvertrag Abruf Volumen Mindestmenge Höchstmenge' },
        { query: 'Laufzeit Vertragslaufzeit Verlängerung Option Jahre' },
        { query: 'Preisblatt Kalkulation Preispositionen Einheitspreise' },
        { query: 'Bonus Malus Vertragsstrafe Pönale Anrechnung Indexierung Preisgleitklausel' },
        { query: 'Erlösmodell revenue share Werbeerlöse Anzeigenakquise Provision' },
        { query: 'Zahlungsplan Abschlagszahlung Meilenstein Rechnung Fälligkeit' },
      ],
      maxTotal: 28,
    });

    const indicativeEstimate = await loadIndicativeBudgetEstimate(preQualificationId);
    const webChunks = chunks.filter(c =>
      Boolean(c.webSource?.url || (c.metadata as any)?.webSource?.url)
    );

    let extraction: BudgetExtract | null = null;

    if (chunks.length > 0) {
      const evidenceContext = buildEvidenceContextForExtraction(chunks);
      try {
        extraction = await generateWithFallback({
          model: 'default',
          schema: BudgetExtractSchema,
          system: `Du extrahierst Budgetinformationen aus RFP-Chunks für ein Angebotsteam.

KRITISCHE REGELN:
- NUR Informationen aus den EVIDENCE CHUNKS verwenden.
- Jede Aussage MUSS entweder evidenceChunkIds (>=1) haben ODER needsManualReview=true und evidenceChunkIds=[].
- Keine Halluzinationen. Wenn unklar: needsManualReview=true.
- Web-Chunks gelten als Enrichment (nicht RFP) und müssen als solche erkennbar sein.
- Wenn Budget nicht explizit genannt: klar benennen und offene Frage formulieren.`,
          prompt: [
            `SECTION: ${sectionId}`,
            '',
            evidenceContext,
            '',
            'AUFGABE:',
            '1) Extrahiere Budget-/Preisrahmenangaben inkl. Bezugsrahmen.',
            '2) Extrahiere Vergütungsmodell, Laufzeit/Optionen, Sonderregeln/Mechaniken.',
            '3) Formuliere offene Fragen für Bieterfragen (mit Relevanz).',
            '4) Schreibe eine Summary (4-10 Sätze) und 1-3 Dashboard Highlights.',
          ].join('\n'),
          temperature: 0,
          maxTokens: 5000,
          timeout: 60_000,
        });
      } catch (extractionError) {
        console.warn(
          '[BudgetSection] Structured extraction failed, continuing with deterministic fallback:',
          extractionError
        );
      }
    }

    const budgetRows = (extraction?.budgetStatements ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale:
          'Budgetangabe ist im Kontext nicht eindeutig; bitte Originaldokument manuell prüfen.',
      });

      return {
        amountOrRange: item.amountOrRange,
        scope: item.scope,
        interpretation: item.interpretation,
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const remunerationRows = (extraction?.remunerationModel ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Vergütungsmodell sollte gegen RFP-Originaltext verifiziert werden.',
      });

      return {
        modelType: item.modelType,
        description: item.description,
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const durationRows = (extraction?.durationAndOptions ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale:
          'Laufzeit/Option ist unklar und muss im Vertragsdokument validiert werden.',
      });

      return {
        duration: item.duration,
        optionDetails: item.optionDetails || '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const specialRows = (extraction?.specialCommercialRules ?? []).map(item => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: item.evidenceChunkIds,
        needsManualReview: item.needsManualReview,
        chunkById: byId,
        manualReviewRationale:
          'Sonderregel ist auslegungsbedürftig; juristisch/kommerziell prüfen.',
      });

      return {
        rule: item.rule,
        explanation: item.explanation,
        exampleCalculation: item.exampleCalculation || 'Beispielrechnung als Annahme erforderlich',
        implicationForBid: item.implicationForBid,
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const estimateAssumptionSources: SourceRef[] = [
      {
        kind: 'assumption',
        label: 'Indikative Schätzung',
        rationale:
          'Tagessatz 1.200 EUR/PT (intern), abgeleitet aus QuickScan-Merkmalen und Standard-Kalkulationsheuristik.',
      },
    ];

    const estimateRows = indicativeEstimate
      ? indicativeEstimate.scenarios.map(scenario => ({
          scenario: scenario.name,
          pt: String(scenario.totalPT),
          totalCost: formatMoney(scenario.totalCost),
          source: formatInlineSourcesBlock(estimateAssumptionSources).trim(),
        }))
      : [
          {
            scenario: 'Keine Schätzung möglich',
            pt: '—',
            totalCost: '—',
            source: formatInlineSourcesBlock([
              {
                kind: 'assumption',
                label: 'Keine QuickScan-Basisdaten',
                rationale:
                  'Für eine indikative Schätzung fehlen Content-/Feature-/TechStack-Daten aus qualification_scans.',
              },
            ]).trim(),
          },
        ];

    const webRows = webChunks.slice(0, 4).map(chunk => {
      const source = chunk.webSource?.url || (chunk.metadata as any)?.webSource?.url || '—';
      const title =
        chunk.webSource?.title || (chunk.metadata as any)?.webSource?.title || 'Web-Hinweis';
      return {
        title,
        insight: String(chunk.content || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 260),
        source: formatInlineSourcesBlock([
          {
            kind: 'web',
            url: source,
            title: typeof title === 'string' ? title : undefined,
            accessedAt:
              chunk.webSource?.accessedAt ||
              (chunk.metadata as any)?.webSource?.accessedAt ||
              new Date().toISOString(),
          },
        ]).trim(),
      };
    });

    if (budgetRows.length === 0) {
      budgetRows.push({
        amountOrRange: 'Nicht explizit genannt',
        scope: 'RFP enthält keinen eindeutigen Budgetrahmen',
        interpretation:
          'Kalkulation muss über Annahmen erfolgen; Budget-/Preislogik sollte als Bieterfrage geklärt werden.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Kein explizites Budget im RFP',
            rationale:
              'In den verfügbaren Chunks wurden keine belastbaren Budgetwerte mit eindeutiger Zuordnung gefunden.',
          },
        ]).trim(),
      });
    }

    if (remunerationRows.length === 0) {
      remunerationRows.push({
        modelType: 'Nicht eindeutig genannt',
        description: 'Vergütungslogik ist im Dokumentkontext nicht klar ersichtlich.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Vergütungsmodell unklar',
            rationale: 'Bitte Preisblatt/Vertragsbedingungen manuell prüfen.',
          },
        ]).trim(),
      });
    }

    if (durationRows.length === 0) {
      durationRows.push({
        duration: 'Nicht eindeutig genannt',
        optionDetails: 'Laufzeit/Optionen im RFP manuell validieren.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Laufzeit unklar',
            rationale: 'Keine belastbare Laufzeitpassage mit Locator gefunden.',
          },
        ]).trim(),
      });
    }

    if (specialRows.length === 0) {
      specialRows.push({
        rule: 'Keine explizite Sonderregel erkannt',
        explanation: 'Anrechnung/Bonus-Malus/Erlösmodell nicht eindeutig im Dokument erwähnt.',
        exampleCalculation: 'Falls relevant: Beispielrechnung als Angebotsannahme ergänzen.',
        implicationForBid: 'Vor Preisfinalisierung als Bieterfrage klären.',
        source: formatInlineSourcesBlock([
          {
            kind: 'assumption',
            label: 'Sonderregel unklar',
            rationale: 'Keine belastbare Textstelle für konkrete Mechanik gefunden.',
          },
        ]).trim(),
      });
    }

    const centralBidderQuestions = (extraction?.openQuestions ?? []).map(question => {
      const sources = buildEvidenceSources({
        evidenceChunkIds: question.evidenceChunkIds,
        needsManualReview: question.needsManualReview,
        chunkById: byId,
        manualReviewRationale: 'Bieterfrage wurde aus unklarer Budget-/Vertragslage abgeleitet.',
      });

      return {
        content: `Offene Frage: ${question.question} (Warum relevant: ${question.whyItMatters})${formatInlineSourcesBlock(sources)}`,
        sources,
      };
    });

    if (centralBidderQuestions.length === 0) {
      const fallbackSource: SourceRef = {
        kind: 'assumption',
        label: 'Standard-Bieterfrage',
        rationale:
          'Wenn Budget nicht eindeutig ist, sollte der Auftraggeber den Budgetrahmen bestätigen.',
      };
      centralBidderQuestions.push({
        content:
          `Offene Frage: Bitte bestätigen Sie Budgetrahmen, Preislogik und Sonderregeln (Anrechnung/Bonus-Malus).` +
          formatInlineSourcesBlock([fallbackSource]),
        sources: [fallbackSource],
      });
    }

    const summary =
      extraction?.summary ||
      'Die Budget-Synthese wurde auf Basis verfügbarer Evidenz erstellt. Budgetangaben ohne eindeutige Textgrundlage sind als Annahme markiert; offene Punkte sind als zentrale Bieterfragen zu klären.';

    const dashboardHighlights =
      extraction?.dashboardHighlights && extraction.dashboardHighlights.length > 0
        ? extraction.dashboardHighlights
        : [
            'Budgetangaben im RFP sind teilweise unklar und müssen verifiziert werden.',
            'Sonderregeln/Mechaniken vor Preisfinalisierung als Bieterfrage klären.',
            'Indikative Schätzung ist als Enrichment und Annahme gekennzeichnet.',
          ];

    const nextSteps = [
      'Budget-/Preisangaben im Original-PDF mit Seiten-/Absatzbezug verifizieren.',
      'Sonderregeln (Anrechnung, Bonus/Malus, Erlösmodell) als klare Angebotsannahmen formulieren.',
      'Zentrale Bieterfragen vor Angebotsfinalisierung mit Auftraggeber klären.',
      'Indikative Schätzung nur als Orientierung nutzen, nicht als RFP-Fakt.',
    ];

    let tree = buildBudgetTree({
      summary,
      budgetRows,
      remunerationRows,
      durationRows,
      specialRows,
      estimateRows,
      webRows,
      centralizedBidderQuestionHint:
        'Bieterfragen werden zentral in der Zusammenfassung geführt. Diese Sektion hat Fragen mit Verweis "Budget" hinterlegt.',
      nextSteps,
    });

    const sourcesPanel = buildSourcesFromRawChunks(chunks, {
      maxSources: 10,
      maxExcerptChars: 350,
    });
    tree = injectSourcesPanel(tree as any, sourcesPanel, {
      subSectionTitle: 'Quellen',
      panelTitle: 'Quellen',
      maxSources: 10,
    }) as unknown as JsonRenderTree;

    const findings: StoredSectionFinding[] = [];

    for (const row of budgetRows) {
      findings.push({
        content: `Budget: ${row.amountOrRange} — ${row.scope}; ${row.interpretation}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: {
          sectionId,
          kind: 'budget_statement',
          sources: [],
        },
      });
    }

    for (const row of remunerationRows) {
      findings.push({
        content: `Vergütungsmodell: ${row.modelType} — ${row.description}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: {
          sectionId,
          kind: 'remuneration',
          sources: [],
        },
      });
    }

    for (const row of durationRows) {
      findings.push({
        content: `Laufzeit/Option: ${row.duration} — ${row.optionDetails}${row.source ? ` (${row.source})` : ''}`,
        category: 'fact',
        metadata: {
          sectionId,
          kind: 'duration',
          sources: [],
        },
      });
    }

    for (const row of specialRows) {
      findings.push({
        content: `Sonderregel: ${row.rule} — ${row.explanation}; Beispiel: ${row.exampleCalculation}; Implikation: ${row.implicationForBid}${row.source ? ` (${row.source})` : ''}`,
        category: 'recommendation',
        metadata: {
          sectionId,
          kind: 'special_rule',
          sources: [],
        },
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

    findings.push({
      content: `Schätzung (Enrichment): ${estimateRows
        .map(row => `${row.scenario}: ${row.pt} PT / ${row.totalCost}`)
        .join('; ')}${formatInlineSourcesBlock(estimateAssumptionSources)}`,
      category: 'recommendation',
      metadata: {
        sectionId,
        kind: 'estimate',
        sources: estimateAssumptionSources,
      },
    });

    if (webRows.length > 0) {
      findings.push({
        content: `Web-Enrichment: ${webRows
          .map(row => `${row.title} — ${row.insight}`)
          .join('; ')}`,
        category: 'recommendation',
        metadata: {
          sectionId,
          kind: 'web_enrichment',
          sources: [
            {
              kind: 'assumption',
              label: 'Web-Enrichment',
              rationale: 'Web-Hinweise dienen als Kontext und ersetzen keine RFP-Fakten.',
            },
          ],
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
      minFindings: 12,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
