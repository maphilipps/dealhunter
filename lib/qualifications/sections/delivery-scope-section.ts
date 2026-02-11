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

const ScopeItemSchema = z.object({
  name: z.string().min(1),
  mandatory: z.boolean(),
  description: z.string().min(1),
  phaseOrMilestone: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  dependencies: z.array(z.string().min(1)).max(12),
  evidenceChunkIds: z.array(z.string()),
  needsManualReview: z.boolean(),
});

const OutOfScopeItemSchema = z.object({
  item: z.string().min(1),
  details: z.string().nullable(),
  evidenceChunkIds: z.array(z.string()),
  needsManualReview: z.boolean(),
});

const AssumptionSchema = z.object({
  assumption: z.string().min(1),
  rationale: z.string().min(1),
  evidenceChunkIds: z.array(z.string()),
  needsManualReview: z.boolean(),
});

const DeliveryScopeExtractSchema = z.object({
  scopeInventory: z.array(ScopeItemSchema),
  outOfScope: z.array(OutOfScopeItemSchema),
  assumptions: z.array(AssumptionSchema),
  risks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
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
  nextSteps: z.array(z.string().min(5)).min(3).max(8),
  summary: z.string().min(60),
  dashboardHighlights: z.array(z.string().min(5)).max(3),
  confidence: z.number().min(0).max(100),
});

type DeliveryScopeExtract = z.infer<typeof DeliveryScopeExtractSchema>;

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

function fmtBool(v: boolean): string {
  return v ? 'Pflicht' : 'Optional';
}

function buildVisualizationTree(params: {
  summary: string;
  scopeRows: Array<Record<string, string>>;
  outOfScope: string[];
  assumptions: string[];
  risks: string[];
  openQuestions: string[];
  nextSteps: string[];
}): { root: string; elements: Record<string, unknown> } {
  const { summary, scopeRows, outOfScope, assumptions, risks, openQuestions, nextSteps } = params;

  const elements: Record<string, any> = {};

  elements['section-main'] = {
    key: 'section-main',
    type: 'Section',
    props: { title: 'Lieferumfang (während Leistungserbringung)' },
    children: [
      'para-summary',
      'sub-scope',
      'sub-outscope',
      'sub-assumptions',
      'sub-risks',
      'sub-questions',
      'sub-next',
    ],
  };

  elements['para-summary'] = { key: 'para-summary', type: 'Paragraph', props: { text: summary } };

  elements['sub-scope'] = {
    key: 'sub-scope',
    type: 'SubSection',
    props: { title: 'Scope & Deliverables (Inventar)' },
    children: ['table-scope'],
  };
  elements['table-scope'] = {
    key: 'table-scope',
    type: 'DataTable',
    props: {
      columns: [
        { key: 'name', label: 'Deliverable/Leistung' },
        { key: 'mandatory', label: 'Pflicht?' },
        { key: 'phase', label: 'Phase/Meilenstein' },
        { key: 'acceptance', label: 'Abnahme/Akzeptanz' },
        { key: 'dependencies', label: 'Abhängigkeiten' },
        { key: 'source', label: 'Quelle' },
      ],
      rows: scopeRows,
      compact: true,
    },
  };

  elements['sub-outscope'] = {
    key: 'sub-outscope',
    type: 'SubSection',
    props: { title: 'Abgrenzung (Out of Scope)' },
    children: ['list-outscope'],
  };
  elements['list-outscope'] = {
    key: 'list-outscope',
    type: 'BulletList',
    props: {
      items: outOfScope.length
        ? outOfScope
        : [
            `Nicht explizit benannt.${formatInlineSourcesBlock([
              {
                kind: 'assumption',
                label: 'Out-of-scope unklar',
                rationale:
                  'Im Evidence-Kontext wurde kein expliziter Ausschluss gefunden. Unklare Bereiche sollten als Annahme oder Bieterfrage geklärt werden.',
              },
            ])}`,
          ],
    },
  };

  elements['sub-assumptions'] = {
    key: 'sub-assumptions',
    type: 'SubSection',
    props: { title: 'Annahmen (wenn RFP unklar)' },
    children: ['list-assumptions'],
  };
  elements['list-assumptions'] = {
    key: 'list-assumptions',
    type: 'BulletList',
    props: {
      items: assumptions.length
        ? assumptions
        : [
            `Keine expliziten Annahmen abgeleitet.${formatInlineSourcesBlock([
              {
                kind: 'assumption',
                label: 'Keine Annahmen',
                rationale:
                  'Wenn das RFP sehr klar ist, sind weniger Annahmen nötig. Trotzdem sollte der Scope in der Angebotsantwort präzise abgegrenzt werden.',
              },
            ])}`,
          ],
    },
  };

  elements['sub-risks'] = {
    key: 'sub-risks',
    type: 'SubSection',
    props: { title: 'Risiken (scope-basiert)' },
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

export async function runDeliveryScopeSection(options: {
  preQualificationId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, allowWebEnrichment } = options;
  const sectionId = 'deliverables';

  try {
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
              'Leistungsumfang in Ausschreibungen: typische Deliverables (Konzept, Umsetzung, Betrieb, Schulung, Doku), Abnahme',
            maxResults: 2,
          }),
          performWebResearch({
            preQualificationId,
            sectionId,
            question:
              'Mitwirkungspflichten und Abhaengigkeiten in RFPs: Zulieferungen Auftraggeber, Freigaben, Schnittstellen',
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
        { query: 'Leistungsbeschreibung Leistungsumfang Aufgaben Auftragnehmer Deliverables' },
        { query: 'Projektphasen Meilensteine Arbeitspakete Vorgehen Konzept Umsetzung' },
        { query: 'Abnahme Akzeptanzkriterien Tests Definition of Done Dokumentation Nachweise' },
        { query: 'Betrieb Wartung Support SLA Incident Reaktionszeiten Verfügbarkeit' },
        { query: 'Schulung Training Wissenstransfer Übergabe Dokumentation Handbuch' },
        { query: 'Mitwirkungspflichten Auftraggeber Zulieferungen Daten Schnittstellen Freigaben' },
        { query: 'nicht Bestandteil ausgeschlossen out of scope Abgrenzung' },
      ],
      maxTotal: 28,
    });

    const evidenceContext = buildEvidenceContextForExtraction(chunks);

    let extraction: DeliveryScopeExtract;
    try {
      extraction = await generateStructuredOutput({
        model: 'default',
        schema: DeliveryScopeExtractSchema,
        system: `Du extrahierst Lieferumfang (während Leistungserbringung) aus RFP-Chunks.

KRITISCHE REGELN:
- NUR Informationen aus den EVIDENCE CHUNKS verwenden.
- Jede Zeile MUSS entweder (a) evidenceChunkIds (>=1) haben ODER (b) needsManualReview=true und evidenceChunkIds=[].
- Keine Halluzinationen. Bei Unklarheit: needsManualReview=true.
- Out of scope NUR wenn explizit genannt; sonst leeres Array.`,
        prompt: [
          `SECTION: ${sectionId}`,
          '',
          evidenceContext,
          '',
          'AUFGABE:',
          '1) Erstelle ein Scope-Inventar: alle geforderten Leistungen/Deliverables waehrend der Leistungserbringung.',
          '   Pro Eintrag: Pflicht/Optional, kurze Beschreibung, Phase/Meilenstein (falls erkennbar), Abnahme/Akzeptanz (falls genannt), Abhaengigkeiten.',
          '2) Extrahiere explizite Out-of-scope Punkte (falls vorhanden).',
          '3) Formuliere 5-10 Annahmen, wenn RFP in wichtigen Details unklar ist (needsManualReview=true, evidenceChunkIds=[]).',
          '4) Formuliere 3-7 scope-basierte Risiken und 5-10 offene Fragen (mit Begründung).',
          '5) Gib 3-8 konkrete Next Steps fuer das Angebotsteam.',
          '6) Schreibe eine Summary (6-10 Saetze) fuer das Angebotsteam (entscheidungsrelevant).',
        ].join('\n'),
        temperature: 0,
        maxTokens: 5200,
        timeout: 70_000,
      });
    } catch (extractionError) {
      console.warn(
        '[DeliveryScopeSection] Structured extraction failed, continuing with deterministic fallback:',
        extractionError
      );
      extraction = {
        scopeInventory: [],
        outOfScope: [],
        assumptions: [],
        risks: [],
        openQuestions: [],
        nextSteps: [],
        summary:
          'Automatische Scope-Extraktion war nicht vollständig möglich. Die Sektion wurde mit deterministischen Fallback-Regeln aufgebaut und sollte gegen das Originaldokument validiert werden.',
        dashboardHighlights: [
          'Scope/Deliverables im Original-PDF verifizieren.',
          'Unklare Leistungen und Abgrenzungen als Bieterfrage klären.',
          'Annahmen vor Preis-/Leistungsfinalisierung absichern.',
        ],
        confidence: 25,
      };
    }

    const scopeRows = extraction.scopeInventory.map(s => {
      const rfpSources = collectRfpSourcesFromChunkIds(s.evidenceChunkIds, byId);
      const sources: SourceRef[] = s.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Scope-Detail ist im Kontext unklar oder nicht explizit genannt.',
            },
          ]
        : rfpSources;
      if (sources.length === 0 && s.evidenceChunkIds.length > 0) {
        sources.push({
          kind: 'assumption',
          label: 'Chunk ohne PDF-Locator',
          rationale:
            'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
        });
      }

      return {
        name: s.name,
        mandatory: fmtBool(s.mandatory),
        phase: (s.phaseOrMilestone ?? '').trim() || '—',
        acceptance: (s.acceptanceCriteria ?? '').trim() || '—',
        dependencies: s.dependencies.length ? s.dependencies.join('; ') : '—',
        source: formatInlineSourcesBlock(sources).trim(),
      };
    });

    const outOfScope = extraction.outOfScope.map(o => {
      const rfpSources = collectRfpSourcesFromChunkIds(o.evidenceChunkIds, byId);
      const sources: SourceRef[] = o.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Out-of-scope Punkt ist im Kontext unklar oder nicht explizit genannt.',
            },
          ]
        : rfpSources;
      return `${o.item}${o.details ? `: ${o.details}` : ''}${formatInlineSourcesBlock(sources)}`;
    });

    const assumptions = extraction.assumptions.map(a => {
      const rfpSources = collectRfpSourcesFromChunkIds(a.evidenceChunkIds, byId);
      const sources: SourceRef[] =
        a.evidenceChunkIds.length > 0
          ? rfpSources
          : [
              {
                kind: 'assumption',
                label: 'Annahme',
                rationale: a.rationale,
              },
            ];
      return `${a.assumption}${formatInlineSourcesBlock(sources)}`;
    });

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
      return `${q.question} (Warum: ${q.whyItMatters})${formatInlineSourcesBlock(sources)}`;
    });

    const nextSteps = extraction.nextSteps.length
      ? extraction.nextSteps
      : [
          'Scope-Inventar in Angebotsstruktur übernehmen (Kapitel Lieferumfang, Abgrenzung, Abhängigkeiten).',
          'Unklare Leistungsbestandteile als Annahmen formulieren oder als Bieterfragen klären.',
          'Abnahme/Akzeptanzkriterien prüfen und als DoD/Testnachweise im Angebot adressieren.',
        ];

    const tree = buildVisualizationTree({
      summary: extraction.summary,
      scopeRows,
      outOfScope,
      assumptions,
      risks,
      openQuestions,
      nextSteps,
    });

    // Store visualization
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

    // Findings (12-20) with per-claim sources in metadata.
    const findings: Array<{
      content: string;
      metadata: Record<string, unknown>;
      category: 'fact' | 'recommendation';
    }> = [];

    // Prefer scope inventory items first (usually best grounded).
    const sortedScopeForFindings = [...extraction.scopeInventory].sort(
      (a, b) => b.evidenceChunkIds.length - a.evidenceChunkIds.length
    );
    for (const s of sortedScopeForFindings) {
      const rfpSources = collectRfpSourcesFromChunkIds(s.evidenceChunkIds, byId);
      const sources: SourceRef[] = s.needsManualReview
        ? [
            ...rfpSources,
            {
              kind: 'assumption',
              label: 'Manuelle Prüfung erforderlich',
              rationale: 'Scope-Detail ist im Kontext unklar oder nicht explizit genannt.',
            },
          ]
        : rfpSources;

      findings.push({
        content:
          `Lieferumfang: ${s.name} — ${s.description} (${fmtBool(s.mandatory)})` +
          `${s.phaseOrMilestone ? `, Phase: ${s.phaseOrMilestone}` : ''}` +
          `${s.acceptanceCriteria ? `, Abnahme: ${s.acceptanceCriteria}` : ''}` +
          `${s.dependencies.length ? `, Abhängigkeiten: ${s.dependencies.join('; ')}` : ''}` +
          formatInlineSourcesBlock(sources),
        category: 'fact',
        metadata: { sectionId, sources: dedupeSourceRefs(sources), kind: 'scope_item' },
      });
      if (findings.length >= 14) break; // leave room for risks/questions/next steps
    }

    for (const r of extraction.risks.slice(0, 3)) {
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
      findings.push({
        content: `Risiko: ${r.title} — ${r.description}${formatInlineSourcesBlock(sources)}`,
        category: 'recommendation',
        metadata: { sectionId, sources: dedupeSourceRefs(sources), kind: 'risk' },
      });
    }

    for (const q of extraction.openQuestions.slice(0, 4)) {
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
      findings.push({
        content: `Offene Frage: ${q.question} (Warum relevant: ${q.whyItMatters})${formatInlineSourcesBlock(
          sources
        )}`,
        category: 'recommendation',
        metadata: { sectionId, sources: dedupeSourceRefs(sources), kind: 'open_question' },
      });
    }

    // Add 2-5 concrete next steps as recommendations (assumption sources).
    const padSource: SourceRef = {
      kind: 'assumption',
      label: 'Decision-grade Mindesttiefe',
      rationale:
        'Wenn RFP-Inhalte dünn sind, werden Next Steps/Prüfschritte als Annahmen dokumentiert.',
    };
    for (const step of nextSteps) {
      if (findings.length >= 18) break;
      findings.push({
        content: `Next Step: ${step}${formatInlineSourcesBlock([padSource])}`,
        category: 'recommendation',
        metadata: { sectionId, sources: [padSource], kind: 'next_step' },
      });
    }

    // Pad to minimum findings count.
    while (findings.length < 12) {
      findings.push({
        content:
          `Manuelle Prüfung: Leistungsbeschreibung/Anlagen auf Scope, Abnahme und Mitwirkungspflichten verifizieren.` +
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
