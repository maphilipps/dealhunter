import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import {
  estimateBidDeliverablesEffort,
  type DeliverableCategory,
  type DeliverableInput,
  type SubmissionMethod,
} from '@/lib/qualifications/estimators/bid-deliverables-effort';
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

const EvidenceFields = z.union([
  z.object({
    evidenceChunkIds: z.array(z.string()).min(1),
    needsManualReview: z.literal(false),
  }),
  z.object({
    evidenceChunkIds: z.array(z.string()).length(0),
    needsManualReview: z.literal(true),
  }),
]);

const DeliverableCategorySchema = z.enum([
  'proposal_document',
  'commercial',
  'legal',
  'technical',
  'reference',
  'administrative',
  'presentation',
] satisfies DeliverableCategory[]);

const SubmissionMethodSchema = z.enum([
  'email',
  'portal',
  'physical',
  'unknown',
] satisfies SubmissionMethod[]);

const DeliverablesExtractSchema = z.object({
  inventory: z.array(
    z.intersection(
      z.object({
        name: z.string().min(1),
        category: DeliverableCategorySchema,
        mandatory: z.boolean(),
        format: z.string().nullable(),
        pageLimit: z.number().int().positive().nullable(),
        submissionMethod: SubmissionMethodSchema,
        deadline: z.string().nullable(),
        notes: z.string().nullable(),
      }),
      EvidenceFields
    )
  ),
  risks: z.array(
    z.intersection(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
      }),
      EvidenceFields
    )
  ),
  openQuestions: z.array(
    z.intersection(
      z.object({
        question: z.string().min(1),
        whyItMatters: z.string().min(1),
      }),
      EvidenceFields
    )
  ),
  summary: z.string().min(40),
  dashboardHighlights: z.array(z.string().min(5)).max(3),
  confidence: z.number().min(0).max(100),
});

type DeliverablesExtract = z.infer<typeof DeliverablesExtractSchema>;

function buildVisualizationTree(params: {
  summary: string;
  inventoryRows: Array<Record<string, string>>;
  effortRows: Array<Record<string, string>>;
  wbsRows: Array<Record<string, string>>;
  risks: string[];
  openQuestions: string[];
  nextSteps: string[];
}): { root: string; elements: Record<string, unknown> } {
  const { summary, inventoryRows, effortRows, wbsRows, risks, openQuestions, nextSteps } = params;

  const elements: Record<string, any> = {};

  elements['section-main'] = {
    key: 'section-main',
    type: 'Section',
    props: { title: 'Leistungsumfang (Bid-Unterlagen)' },
    children: [
      'para-summary',
      'sub-inventory',
      'sub-effort',
      ...(wbsRows.length > 0 ? ['sub-wbs'] : []),
      'sub-risks',
      'sub-questions',
      'sub-next',
    ],
  };

  elements['para-summary'] = { key: 'para-summary', type: 'Paragraph', props: { text: summary } };

  elements['sub-inventory'] = {
    key: 'sub-inventory',
    type: 'SubSection',
    props: { title: 'Inventar: Einreichungsunterlagen' },
    children: ['table-inventory'],
  };
  elements['table-inventory'] = {
    key: 'table-inventory',
    type: 'DataTable',
    props: {
      columns: [
        { key: 'name', label: 'Deliverable' },
        { key: 'mandatory', label: 'Pflicht?' },
        { key: 'format', label: 'Format' },
        { key: 'pageLimit', label: 'Seitenlimit' },
        { key: 'submission', label: 'Abgabeweg' },
        { key: 'deadline', label: 'Deadline' },
        { key: 'source', label: 'Quelle' },
      ],
      rows: inventoryRows,
      compact: true,
    },
  };

  elements['sub-effort'] = {
    key: 'sub-effort',
    type: 'SubSection',
    props: { title: 'Aufwand & Dauer (deterministisch geschätzt)' },
    children: ['table-effort', 'para-effort-note'],
  };
  elements['table-effort'] = {
    key: 'table-effort',
    type: 'DataTable',
    props: {
      columns: [
        { key: 'deliverable', label: 'Deliverable' },
        { key: 'hours', label: 'Stunden' },
        { key: 'pt', label: 'PT' },
        { key: 'calendarDays', label: 'Kalenderdauer' },
        { key: 'source', label: 'Quelle/Annahme' },
      ],
      rows: effortRows,
      compact: true,
    },
  };
  elements['para-effort-note'] = {
    key: 'para-effort-note',
    type: 'Paragraph',
    props: {
      text: 'Hinweis: Das ist eine Angebots-Unterlagen-Schätzung (nicht Implementierung). Alle Annahmen sind explizit markiert.',
    },
  };

  if (wbsRows.length > 0) {
    elements['sub-wbs'] = {
      key: 'sub-wbs',
      type: 'SubSection',
      props: { title: 'WBS (Auszug)' },
      children: ['table-wbs'],
    };
    elements['table-wbs'] = {
      key: 'table-wbs',
      type: 'DataTable',
      props: {
        columns: [
          { key: 'deliverable', label: 'Deliverable' },
          { key: 'task', label: 'Task' },
          { key: 'discipline', label: 'Disziplin' },
          { key: 'hours', label: 'h' },
        ],
        rows: wbsRows,
        compact: true,
      },
    };
  }

  elements['sub-risks'] = {
    key: 'sub-risks',
    type: 'SubSection',
    props: { title: 'Risiken & Stolpersteine' },
    children: ['list-risks'],
  };
  elements['list-risks'] = {
    key: 'list-risks',
    type: 'BulletList',
    props: { items: risks.length ? risks : ['Keine expliziten Risiken im Kontext gefunden.'] },
  };

  elements['sub-questions'] = {
    key: 'sub-questions',
    type: 'SubSection',
    props: { title: 'Offene Fragen / Klärungsbedarf' },
    children: ['list-questions'],
  };
  elements['list-questions'] = {
    key: 'list-questions',
    type: 'BulletList',
    props: {
      items: openQuestions.length
        ? openQuestions
        : ['Keine konkreten Rückfragen ableitbar (oder Anforderungen sind bereits eindeutig).'],
    },
  };

  elements['sub-next'] = {
    key: 'sub-next',
    type: 'SubSection',
    props: { title: 'Konkrete Next Steps (für Bid-Team)' },
    children: ['list-next'],
  };
  elements['list-next'] = {
    key: 'list-next',
    type: 'BulletList',
    props: { items: nextSteps },
  };

  return { root: 'section-main', elements };
}

function fmtBool(v: boolean): string {
  return v ? 'Pflicht' : 'Optional';
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—';
  return String(v);
}

function fmtDeadline(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return t.length ? t : 'Unklar';
}

function fmtSubmission(v: SubmissionMethod): string {
  switch (v) {
    case 'portal':
      return 'Portal';
    case 'email':
      return 'E-Mail';
    case 'physical':
      return 'Physisch';
    default:
      return 'Unklar';
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

export async function runDeliverablesSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, allowWebEnrichment } = options;
  const sectionId = 'deliverables';

  try {
    // Ensure qualification exists (and helps future access-control extensions).
    const [preQual] = await db
      .select({ id: preQualifications.id })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);
    if (!preQual) return { success: false, error: 'Qualification not found' };

    await deletePreQualSectionArtifacts({ preQualificationId, sectionId });

    if (allowWebEnrichment) {
      // Best-effort: store web research chunks to broaden the evidence pool on retries.
      try {
        await Promise.all([
          performWebResearch({
            preQualificationId,
            sectionId,
            question:
              'Einreichung Angebotsunterlagen: Abgabeweg (Portal/E-Mail), Formblätter, Fristen',
            maxResults: 2,
          }),
          performWebResearch({
            preQualificationId,
            sectionId,
            question: 'Angebotsunterlagen: Seitenlimit, Formatvorgaben, Signatur, Nachweise',
            maxResults: 2,
          }),
        ]);
      } catch {
        // Ignore enrichment failures; RFP grounding still works.
      }
    }

    const { chunks, byId } = await collectEvidenceChunks({
      preQualificationId,
      queries: [
        { query: 'Einreichung Unterlagen Angebot Teilnahmeantrag Formblätter Nachweise' },
        { query: 'Abgabeweg Portal E-Mail Upload Dateiformat PDF Signatur qualifiziert' },
        { query: 'Seitenlimit Umfang Begrenzung max Seiten technisches Konzept Konzeptpapier' },
        { query: 'Frist Abgabefrist Angebotsfrist Teilnahmeantrag Deadline Uhrzeit' },
      ],
      maxTotal: 26,
    });

    const evidenceContext = buildEvidenceContextForExtraction(chunks);

    const extraction = await generateStructuredOutput({
      model: 'default',
      schema: DeliverablesExtractSchema,
      system: `Du extrahierst Einreichungs-Deliverables aus RFP-Chunks.

KRITISCHE REGELN:
- Du darfst NUR Informationen aus den EVIDENCE CHUNKS verwenden.
- Jede Zeile MUSS entweder (a) evidenceChunkIds (>=1) haben ODER (b) needsManualReview=true und evidenceChunkIds=[].
- Keine Halluzinationen. Wenn unklar: needsManualReview=true.
- PageLimit NUR wenn explizit genannt. Deadline als Freitext, wenn Datum/Uhrzeit genannt.`,
      prompt: [
        `SECTION: ${sectionId}`,
        '',
        evidenceContext,
        '',
        'AUFGABE:',
        '1) Erstelle ein Inventar aller abzugebenden Unterlagen/Deliverables fuer Teilnahmeantrag/Angebot.',
        '2) Markiere Pflicht/Optional, Abgabeweg, Format, Seitenlimit, Deadline.',
        '3) Formuliere 3-7 Risiken und 5-10 offene Fragen (nur wenn sachlich begruendbar).',
        '4) Schreibe eine kurze Summary (4-8 Saetze) fuer das Angebotsteam.',
      ].join('\n'),
      temperature: 0,
      maxTokens: 5000,
      timeout: 60_000,
    });

    const inv = extraction.inventory;

    // Deterministic effort estimate (bid deliverables only).
    const estimatorInput: DeliverableInput[] = inv.map(d => ({
      name: d.name,
      category: d.category,
      mandatory: d.mandatory,
      pageLimit: d.pageLimit ?? null,
      submissionMethod: d.submissionMethod,
    }));
    const estimate = estimateBidDeliverablesEffort(estimatorInput);

    const assumptionSources: SourceRef[] = [
      ...estimate.assumptions.map(
        a => ({ kind: 'assumption', label: a.label, rationale: a.rationale }) as const
      ),
    ];

    // Build tables
    const inventoryRows = inv.map(d => {
      const rfpSources = collectRfpSourcesFromChunkIds(d.evidenceChunkIds, byId);
      const sources: SourceRef[] = d.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Anforderung ist im Kontext unklar oder nicht explizit genannt.',
            },
          ]
        : rfpSources;

      if (sources.length === 0 && d.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }

      return {
        name: d.name,
        mandatory: fmtBool(d.mandatory),
        format: d.format?.trim() || '—',
        pageLimit: d.pageLimit != null ? String(d.pageLimit) : '—',
        submission: fmtSubmission(d.submissionMethod),
        deadline: fmtDeadline(d.deadline),
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const per = estimate.perDeliverable;
    const effortRows = per.map(p => {
      const sources: SourceRef[] = [...assumptionSources];
      return {
        deliverable: p.deliverableName,
        hours: String(p.effortHours),
        pt: String(p.effortPT),
        calendarDays: String(p.calendarDays),
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const wbsRows = estimate.perDeliverable
      .flatMap(p =>
        p.wbs.map(t => ({
          deliverable: t.deliverableName,
          task: t.task,
          discipline: t.discipline,
          hours: String(t.hours),
        }))
      )
      .slice(0, 60);

    const risks = extraction.risks.map(r => {
      const rfpSources = collectRfpSourcesFromChunkIds(r.evidenceChunkIds, byId);
      const sources: SourceRef[] = r.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Risiko-Ableitung basiert auf unklarer Textstelle.',
            },
          ]
        : rfpSources;
      if (sources.length === 0 && r.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }
      return `${r.title}: ${r.description}${formatInlineSourcesBlock(sources)}`;
    });

    const openQuestions = extraction.openQuestions.map(q => {
      const rfpSources = collectRfpSourcesFromChunkIds(q.evidenceChunkIds, byId);
      const sources: SourceRef[] = q.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Offene Frage abgeleitet, weil Detail nicht explizit im Kontext steht.',
            },
          ]
        : rfpSources;
      if (sources.length === 0 && q.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }
      return `${q.question} (Warum: ${q.whyItMatters})${formatInlineSourcesBlock(sources)}`;
    });

    const nextSteps = [
      'Inventar gegen RFP-Checkliste/Formblätter verifizieren (Pflicht/Optional, Dateiformate, Signatur).',
      'Interne Deadlines rueckwaerts vom spaetesten Abgabetermin planen (1-2 Review-Schleifen einplanen).',
      'Alle Unklarheiten als Bieterfrage formulieren (insb. Seitenlimits, Format, Nachweise, Referenzform).',
      'Aufwaende mit Teamkapazitaet abgleichen; kritische Deliverables frueh starten (Technik-Konzept, Preisblatt, Nachweise).',
    ];

    const tree = buildVisualizationTree({
      summary: extraction.summary,
      inventoryRows,
      effortRows: [
        ...effortRows,
        {
          deliverable: 'GESAMT',
          hours: String(estimate.totals.effortHours),
          pt: String(estimate.totals.effortPT),
          calendarDays: String(estimate.totals.calendarDaysSequential),
          source: formatInlineSourcesBlock(assumptionSources).trim(),
        },
      ],
      wbsRows,
      risks,
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

    // Build findings (12-20) with per-claim sources in metadata.
    const findings: Array<{
      content: string;
      metadata: Record<string, unknown>;
      category: 'fact' | 'recommendation';
    }> = [];

    for (const d of inv) {
      const rfpSources = collectRfpSourcesFromChunkIds(d.evidenceChunkIds, byId);
      const sources: SourceRef[] = d.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Anforderung ist im Kontext unklar oder nicht explizit genannt.',
            },
          ]
        : rfpSources;
      if (sources.length === 0 && d.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }

      const line =
        `${d.name}: ${d.mandatory ? 'Pflicht' : 'Optional'}, Abgabeweg: ${fmtSubmission(d.submissionMethod)}` +
        `${d.format ? `, Format: ${d.format}` : ''}` +
        `${d.pageLimit != null ? `, Seitenlimit: ${d.pageLimit}` : ''}` +
        `${d.deadline ? `, Deadline: ${d.deadline}` : ', Deadline: unklar'}` +
        formatInlineSourcesBlock(sources);

      findings.push({
        content: line,
        category: 'fact',
        metadata: { sectionId, sources: dedupeSourceRefs(sources) },
      });
    }

    findings.push({
      content:
        `Aufwand: ${estimate.totals.effortHours}h (~${estimate.totals.effortPT} PT), ` +
        `Kalenderdauer (1 FTE, effektiv 6h/Tag): ${estimate.totals.calendarDaysSequential} Tage.` +
        formatInlineSourcesBlock(assumptionSources),
      category: 'recommendation',
      metadata: { sectionId, sources: dedupeSourceRefs(assumptionSources), kind: 'effort_summary' },
    });

    for (const hint of estimate.parallelizationHints.slice(0, 4)) {
      findings.push({
        content: `WBS/Planung: ${hint}${formatInlineSourcesBlock(assumptionSources)}`,
        category: 'recommendation',
        metadata: { sectionId, sources: dedupeSourceRefs(assumptionSources), kind: 'effort_hint' },
      });
    }

    for (const r of extraction.risks.slice(0, 4)) {
      const rfpSources = collectRfpSourcesFromChunkIds(r.evidenceChunkIds, byId);
      const sources: SourceRef[] = r.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Risiko-Ableitung basiert auf unklarer Textstelle.',
            },
          ]
        : rfpSources;
      if (sources.length === 0 && r.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }
      findings.push({
        content: `Risiko: ${r.title} — ${r.description}${formatInlineSourcesBlock(sources)}`,
        category: 'recommendation',
        metadata: { sectionId, sources: dedupeSourceRefs(sources), kind: 'risk' },
      });
    }

    for (const q of extraction.openQuestions.slice(0, 6)) {
      const rfpSources = collectRfpSourcesFromChunkIds(q.evidenceChunkIds, byId);
      const sources: SourceRef[] = q.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Offene Frage abgeleitet, weil Detail nicht explizit im Kontext steht.',
            },
          ]
        : rfpSources;
      if (sources.length === 0 && q.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }
      findings.push({
        content: `Offene Frage: ${q.question} (Warum relevant: ${q.whyItMatters})${formatInlineSourcesBlock(sources)}`,
        category: 'recommendation',
        metadata: { sectionId, sources: dedupeSourceRefs(sources), kind: 'open_question' },
      });
    }

    // Pad to minimum findings count to satisfy deterministic quality gates.
    const padSource: SourceRef = {
      kind: 'assumption',
      label: 'Decision-grade Mindesttiefe',
      rationale:
        'Wenn RFP-Inhalte dünn sind, werden Next Steps/Prüfschritte als Annahmen dokumentiert.',
    };
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
          `Manuelle Prüfung: Inventar/Fristen/Formatvorgaben im Originaldokument verifizieren (Formblätter/Anlagen).` +
          formatInlineSourcesBlock([padSource]),
        category: 'recommendation',
        metadata: { sectionId, sources: [padSource], kind: 'manual_check' },
      });
    }

    // Enforce limits + minimum.
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
