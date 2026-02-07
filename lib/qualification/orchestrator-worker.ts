/**
 * Orchestrator-Worker Pattern für PreQualification Sections
 *
 * Architektur:
 * 1. ORCHESTRATOR: Analysiert Dokumente und plant Section-Execution
 * 2. WORKERS: Führen BD-Fragen parallel aus (budget, timing, contracts, deliverables, references, award-criteria, offer-structure, risks)
 * 3. EVALUATOR: Prüft Section-Qualität und triggert Retries bei niedrigem Score
 * 4. CMS MATRIX: Requirement Research (bestehender Agent)
 * 5. DECISION: Bid/No Bid Synthese aller Sections
 *
 * Performance: ~120s (sequentiell) → ~25-35s (parallel)
 */

import { generateText, Output } from 'ai';
import { z } from 'zod';

import { getModelForSlot } from '@/lib/ai/providers';
import { runPreQualSectionAgent } from '@/lib/json-render/prequal-section-agent';
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';
import { runWithConcurrency } from '@/lib/utils/concurrency';

// ═══════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * BD-Fragen als Section-Definitionen (Single Source of Truth)
 */
export const SECTION_DEFINITIONS = [
  {
    id: 'budget' as const,
    label: 'Budget & Laufzeit',
    question:
      'Welche Budgetangaben, Kostenrahmen, Laufzeiten und finanziellen Rahmenbedingungen nennt die Ausschreibung?',
    topics:
      'Budget, Kostenrahmen, Preisobergrenzen, Verguetung, Laufzeit, Rahmenbedingungen, Wirtschaftlichkeit',
  },
  {
    id: 'timing' as const,
    label: 'Zeitplan & Fristen',
    question:
      'Welche Fristen, Meilensteine, Abgabedaten, Projektlaufzeiten und Zeitplaene nennt die Ausschreibung?',
    topics:
      'Fristen, Termine, Abgabefrist, Angebotsfrist, Projektlaufzeit, Meilensteine, Zeitplan, Liefertermine',
  },
  {
    id: 'contracts' as const,
    label: 'Vertragsbedingungen',
    question:
      'Welche Vertragsbedingungen, Vertragstypen (z.B. EVB-IT, Werk/Dienst), SLAs und rechtlichen Rahmenbedingungen nennt die Ausschreibung?',
    topics:
      'Vertrag, EVB-IT, Werkvertrag, Dienstvertrag, SLA, Haftung, Datenschutz, Vertragsbedingungen, AGB',
  },
  {
    id: 'deliverables' as const,
    label: 'Leistungen & Deliverables',
    question:
      'Welche konkreten Leistungen, Liefergegenstaende und Ergebnisse werden gefordert (Scope, Anforderungen, technische Lieferobjekte)?',
    topics:
      'Leistungen, Liefergegenstaende, Deliverables, Anforderungen, Scope, Pflichtenheft, technische Anforderungen',
  },
  {
    id: 'references' as const,
    label: 'Referenzen & Eignung',
    question:
      'Welche Referenzen, Erfahrung, Eignungsnachweise oder vergleichbare Projekte werden verlangt?',
    topics:
      'Referenzen, Eignung, Nachweise, Zertifikate, Erfahrung, vergleichbare Projekte, Mindestanforderungen',
  },
  {
    id: 'award-criteria' as const,
    label: 'Zuschlagskriterien',
    question:
      'Welche Zuschlagskriterien und Bewertungskriterien nennt die Ausschreibung (Gewichtung, Punkte, qualitative Kriterien)?',
    topics:
      'Zuschlagskriterien, Bewertungskriterien, Gewichtung, Punkte, Kriterienkatalog, Bewertungssystem',
  },
  {
    id: 'offer-structure' as const,
    label: 'Angebotsstruktur',
    question:
      'Welche Angebotsstruktur und welche Inhalte/Unterlagen muessen im Angebot geliefert werden (Gliederung, Formulare, Nachweise, Konzepte)?',
    topics:
      'Angebotsstruktur, Angebotsunterlagen, Formulare, Inhalte, Gliederung, einzureichende Dokumente',
  },
  {
    id: 'risks' as const,
    label: 'Risiken',
    question:
      'Welche Projektrisiken sind erkennbar (Termine, Budget, Technik, Recht, Personal, Scope, Abhaengigkeiten)?',
    topics:
      'Risiko, Vertragsstrafe, Poenale, Haftung, Verzug, Komplexitaet, Abhaengigkeiten, Migration, Personalengpass, Termindruck',
  },
] as const;

// Derived from SECTION_DEFINITIONS for backward compatibility
export const SECTION_IDS = SECTION_DEFINITIONS.map(s => s.id) as unknown as readonly [
  'budget',
  'timing',
  'contracts',
  'deliverables',
  'references',
  'award-criteria',
  'offer-structure',
  'risks',
];
export type SectionId = (typeof SECTION_IDS)[number];

/**
 * Orchestrator-Plan Schema
 */
const OrchestratorPlanSchema = z.object({
  tasks: z.array(
    z.object({
      sectionId: z.enum(SECTION_IDS),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      requiresWebEnrichment: z.boolean(),
      goal: z.string().describe('Kurze Beschreibung was diese Section erreichen soll'),
    })
  ),
  strategy: z.object({
    mode: z
      .enum(['documents-first', 'web-enriched', 'hybrid'])
      .describe(
        'documents-first: Nur Dokumente | web-enriched: Priorität auf Web | hybrid: Beides kombiniert'
      ),
    maxConcurrency: z.number().min(1).max(10).describe('Anzahl paralleler Worker (empfohlen: 5)'),
  }),
});

export type OrchestratorPlan = z.infer<typeof OrchestratorPlanSchema>;

/**
 * Section Execution Result
 */
export interface SectionResult {
  sectionId: SectionId;
  success: boolean;
  error?: string;
  retryAttempt: number;
  qualityScore?: number;
}

/**
 * Evaluator Result Schema
 */
const EvaluatorResultSchema = z.object({
  qualityScore: z.number().min(0).max(100).describe('Qualitätsscore 0-100%'),
  confidence: z.number().min(0).max(100).describe('Konfidenz der Antwort'),
  completeness: z.number().min(0).max(100).describe('Vollständigkeit der Information'),
  needsRetry: z.boolean().describe('Soll die Section wiederholt werden?'),
  reasoning: z.string().describe('Begründung für die Bewertung'),
});

export type EvaluatorResult = z.infer<typeof EvaluatorResultSchema>;

/**
 * Decision Schema (Bid/No Bid)
 */
const DecisionSchema = z.object({
  recommendation: z
    .enum(['bid', 'no-bid', 'conditional-bid'])
    .describe(
      'bid: Empfehlung mitbieten | no-bid: Nicht mitbieten | conditional-bid: Unter Bedingungen mitbieten'
    ),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe('Konfidenz als ganze Zahl von 0 bis 100 (z.B. 75 für 75%)'),
  reasoning: z.string().describe('Begründung für die Empfehlung'),
  strengths: z.array(z.string()).describe('Stärken der Ausschreibung für uns'),
  weaknesses: z.array(z.string()).describe('Schwächen/Risiken der Ausschreibung'),
  conditions: z
    .array(z.string())
    .describe('Bedingungen für conditional-bid. Leeres Array [] wenn keine Bedingungen.'),
});

export type Decision = z.infer<typeof DecisionSchema>;

/**
 * Orchestrator Options
 */
export interface OrchestratorOptions {
  maxConcurrency?: number;
  enableEvaluation?: boolean;
  qualityThreshold?: number;
  maxRetries?: number;
  skipPlanning?: boolean;
  onProgress?: (completed: number, total: number, sectionId: SectionId) => void;
}

/**
 * Orchestrator Result
 */
export interface OrchestratorResult {
  success: boolean;
  completedSections: number;
  failedSections: SectionResult[];
  plan?: OrchestratorPlan;
  decision?: Decision;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * ORCHESTRATOR: Analysiert Dokument-Preview und plant Section-Execution
 */
async function planSectionExecution(preQualificationId: string): Promise<OrchestratorPlan> {
  console.log('[Orchestrator] Plane Section-Execution...');

  // Hole Preview der Dokumente (Top 5 Chunks)
  const previewChunks = await queryRawChunks({
    preQualificationId,
    question: 'Gib mir einen Überblick über die Ausschreibung',
    maxResults: 5,
  });

  const previewContext = formatRAGContext(previewChunks);

  const model = await getModelForSlot('default');

  const { output: plan } = await generateText({
    model,
    output: Output.object({ schema: OrchestratorPlanSchema }),
    prompt: `Du bist ein Orchestrator für die Analyse von öffentlichen Ausschreibungen.

DOKUMENT-PREVIEW:
${previewContext}

AUFGABE:
Analysiere die Dokument-Preview und plane die Ausführung von ${SECTION_DEFINITIONS.length} BD-Fragen (Section-Analysen).

VERFÜGBARE SECTIONS:
${SECTION_DEFINITIONS.map(s => `- ${s.id}: ${s.label}`).join('\n')}

STRATEGIE:
1. Priorität: Welche Sections sind kritisch für die Bid/No-Bid Entscheidung?
2. Web-Enrichment: Welche Sections profitieren von externer Recherche (z.B. Marktpreise, Technologie-Trends)?
3. Concurrency: Wie viele Sections können parallel verarbeitet werden? (1-10, empfohlen: 5)

REGELN:
- Alle ${SECTION_DEFINITIONS.length} Sections müssen geplant werden
- mode: 'documents-first' wenn Dokumente ausreichend, 'web-enriched' wenn viel externe Info nötig, 'hybrid' für Mix
- requiresWebEnrichment=true nur wenn wirklich externe Daten helfen (z.B. Marktpreise bei Budget)
- maxConcurrency: 5 ist ein guter Standard (Balance zwischen Speed und Rate-Limits)

Erstelle jetzt den Execution-Plan:`,
  });

  console.log(
    `[Orchestrator] Plan erstellt: ${plan.tasks.length} Tasks, Mode: ${plan.strategy.mode}, Concurrency: ${plan.strategy.maxConcurrency}`
  );

  return plan;
}

// ═══════════════════════════════════════════════════════════════
// WORKERS
// ═══════════════════════════════════════════════════════════════

/**
 * WORKER: Führt eine Section aus
 */
async function executeSectionWorker(
  preQualificationId: string,
  sectionId: SectionId,
  allowWebEnrichment: boolean,
  retryAttempt: number = 0
): Promise<SectionResult> {
  console.log(
    `[Worker:${sectionId}] Start (Retry: ${retryAttempt}, WebEnrichment: ${allowWebEnrichment})`
  );

  try {
    const result = await runPreQualSectionAgent({
      preQualificationId,
      sectionId,
      allowWebEnrichment,
    });

    if (!result.success) {
      console.error(
        `[Worker:${sectionId}] Fehlgeschlagen: ${result.error || 'Unbekannter Fehler'}`
      );
      return {
        sectionId,
        success: false,
        error: result.error,
        retryAttempt,
      };
    }

    console.log(`[Worker:${sectionId}] Erfolgreich abgeschlossen`);
    return {
      sectionId,
      success: true,
      retryAttempt,
    };
  } catch (error) {
    console.error(`[Worker:${sectionId}] Fehler:`, error);
    return {
      sectionId,
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      retryAttempt,
    };
  }
}

/**
 * WORKERS (Parallel): Führt alle Sections parallel aus
 */
async function executeSectionWorkers(
  preQualificationId: string,
  plan: OrchestratorPlan,
  options: OrchestratorOptions
): Promise<SectionResult[]> {
  const { maxConcurrency = 5, onProgress } = options;

  console.log(
    `[Workers] Starte ${plan.tasks.length} Section-Workers mit Concurrency ${maxConcurrency}`
  );

  let completed = 0;

  const results = await runWithConcurrency(
    plan.tasks,
    async (task, index) => {
      const result = await executeSectionWorker(
        preQualificationId,
        task.sectionId,
        task.requiresWebEnrichment,
        0
      );

      completed++;
      if (onProgress) {
        onProgress(completed, plan.tasks.length, task.sectionId);
      }

      return result;
    },
    maxConcurrency
  );

  const successful = results.filter(r => r.success).length;
  console.log(`[Workers] Abgeschlossen: ${successful}/${results.length} erfolgreich`);

  return results;
}

// ═══════════════════════════════════════════════════════════════
// EVALUATOR
// ═══════════════════════════════════════════════════════════════

/**
 * EVALUATOR: Prüft Section-Qualität
 *
 * HINWEIS: Diese Version ist eine vereinfachte Implementierung ohne Evaluator.
 * In Phase 2 kann hier ein LLM-basierter Evaluator implementiert werden,
 * der die Section-Qualität prüft und bei niedrigem Score Retries triggert.
 *
 * Aktuell: Markiert alle erfolgreichen Sections als qualitativ ausreichend.
 */
async function evaluateSectionResult(
  preQualificationId: string,
  result: SectionResult
): Promise<EvaluatorResult> {
  if (!result.success) {
    return {
      qualityScore: 0,
      confidence: 0,
      completeness: 0,
      needsRetry: true,
      reasoning: result.error || 'Section fehlgeschlagen',
    };
  }

  // Fallback/dummy (used on LLM errors)
  const dummy: EvaluatorResult = {
    qualityScore: 75,
    confidence: 80,
    completeness: 80,
    needsRetry: false,
    reasoning: 'Section erfolgreich abgeschlossen',
  };

  const def = SECTION_DEFINITIONS.find(d => d.id === result.sectionId)!;

  try {
    const chunks = await queryRawChunks({
      preQualificationId,
      question: def.question,
      maxResults: 8,
    });

    if (chunks.length === 0) {
      // No grounding available: recommend retry with web enrichment.
      return {
        qualityScore: 20,
        confidence: 30,
        completeness: 10,
        needsRetry: true,
        reasoning:
          'Keine relevanten Dokument-Chunks im RAG gefunden; Retry mit Web-Enrichment empfohlen.',
      };
    }

    const context = formatRAGContext(chunks);
    const model = await getModelForSlot('fast');

    const { output } = await generateText({
      model,
      output: Output.object({ schema: EvaluatorResultSchema }),
      prompt: `Du bist ein Evaluator fuer Ausschreibungsanalyse-Sections. Bewerte die Datenlage im Dokument-Kontext fuer die Section "${result.sectionId}".

ZIEL:
- qualityScore: Gesamtqualitaet der Informationen fuer diese Section (0-100)
- completeness: Wie vollstaendig sind die Angaben im Kontext (0-100)
- confidence: Wie sicher ist die Bewertung (0-100)
- needsRetry: true wenn die Information im Kontext klar unvollstaendig/unklar ist und ein Retry mit Web-Enrichment sinnvoll ist

REGELN:
- Wenn zentrale Angaben fehlen (z.B. Budget fehlt komplett in budget), setze needsRetry=true und niedrige completeness.
- Wenn Kontext nur Kapitelueberschriften/Navigation ohne Inhalt enthaelt, needsRetry=true.
- Wenn ausreichend konkrete Daten vorhanden sind, needsRetry=false.

KONTEXT (RAG):
${context}`,
      temperature: 0,
    });

    return output;
  } catch (error) {
    console.error('[Evaluator] LLM evaluation failed; using dummy evaluator:', error);
    return dummy;
  }
}

// ═══════════════════════════════════════════════════════════════
// DECISION
// ═══════════════════════════════════════════════════════════════

/**
 * DECISION: Generiert Bid/No Bid Empfehlung basierend auf allen Sections
 */
async function generateBidDecision(
  preQualificationId: string,
  results: SectionResult[]
): Promise<Decision> {
  console.log('[Decision] Generiere Bid/No Bid Empfehlung...');

  const successRate = results.filter(r => r.success).length / results.length;
  const failedSections = results.filter(r => !r.success);

  // If all sections failed, don't generate a false no-bid decision
  if (successRate === 0) {
    return {
      recommendation: 'conditional-bid' as const,
      confidence: 10,
      reasoning:
        'Alle Section-Analysen fehlgeschlagen — Verarbeitungsfehler, keine inhaltliche Bewertung möglich.',
      strengths: [],
      weaknesses: ['Verarbeitungsfehler: Keine Section-Analyse konnte durchgeführt werden'],
      conditions: ['Dokument erneut verarbeiten nach Fehlerbehebung'],
    };
  }

  const model = await getModelForSlot('quality');

  const sectionSummarySchema = z.object({
    summary: z.string().describe('Kurze, faktenorientierte Zusammenfassung (max. ca. 6-10 Saetze)'),
    keyFacts: z.array(z.string()).describe('Wichtigste Fakten/Angaben als Bullet-Liste'),
    missingInfo: z
      .array(z.string())
      .describe(
        'Welche zentralen Angaben fehlen oder sind unklar? Leeres Array [] wenn nichts fehlt.'
      ),
    confidence: z.number().min(0).max(100).describe('Konfidenz in Prozent (0-100)'),
  });

  const fastModel = await getModelForSlot('fast');

  const sectionSummaries = await Promise.all(
    SECTION_IDS.map(async sectionId => {
      const def = SECTION_DEFINITIONS.find(d => d.id === sectionId)!;
      const chunks = await queryRawChunks({
        preQualificationId,
        question: def.topics,
        maxResults: 6,
      });

      if (chunks.length === 0) {
        return {
          sectionId,
          summary: 'Keine relevanten Informationen im Dokument-Kontext gefunden.',
          keyFacts: [],
          missingInfo: ['Keine dokumentierten Informationen im RAG gefunden'],
          confidence: 20,
        };
      }

      const context = formatRAGContext(chunks).slice(0, 12000);

      try {
        const { output } = await generateText({
          model: fastModel,
          output: Output.object({ schema: sectionSummarySchema }),
          prompt: `Du bist ein Experte fuer Ausschreibungsanalyse. Fasse den Dokument-Kontext fuer die Section "${sectionId}" zusammen.

REGELN:
- Nur Fakten aus dem Kontext, keine Halluzinationen.
- Wenn Angaben fehlen, nenne sie unter missingInfo.
- Halte keyFacts praezise (Zahlen, Termine, Bedingungen).

KONTEXT (RAG):
${context}`,
          temperature: 0,
        });

        return { sectionId, ...output };
      } catch (error) {
        console.error('[Decision] Section summarization failed; using fallback:', {
          sectionId,
          message: error instanceof Error ? error.message : String(error),
        });

        return {
          sectionId,
          summary: context.slice(0, 1500),
          keyFacts: [],
          missingInfo: ['LLM-Zusammenfassung fehlgeschlagen (Fallback auf Kontext-Auszug)'],
          confidence: 30,
        };
      }
    })
  );

  const sectionStatusLines = SECTION_IDS.map(sectionId => {
    const r = results.find(x => x.sectionId === sectionId);
    const status = r?.success ? 'ok' : 'failed';
    const score = typeof r?.qualityScore === 'number' ? `${r.qualityScore}/100` : 'n/a';
    return `- ${sectionId}: ${status} (qualityScore: ${score})`;
  }).join('\n');

  const summariesText = sectionSummaries
    .map(s => {
      const keyFacts = s.keyFacts.length > 0 ? `Key Facts:\n- ${s.keyFacts.join('\n- ')}` : '';
      const missing =
        s.missingInfo.length > 0 ? `Missing/Unclear:\n- ${s.missingInfo.join('\n- ')}` : '';
      return `## ${s.sectionId}\nSummary (conf ${s.confidence}%):\n${s.summary}\n\n${keyFacts}\n\n${missing}`.trim();
    })
    .join('\n\n---\n\n');

  const { output: decision } = await generateText({
    model,
    output: Output.object({ schema: DecisionSchema }),
    prompt: `Du bist ein Experte für öffentliche Ausschreibungen und hilfst bei der Bid/No-Bid Entscheidung.

SECTION STATUS:
${sectionStatusLines}

AUFGABE:
Basierend auf den Section-Analysen, gib eine Bid/No-Bid Empfehlung ab.

KRITERIEN:
- budget: Ist das Budget angemessen?
- timing: Sind die Fristen machbar?
- contracts: Sind die Vertragsbedingungen akzeptabel?
- deliverables: Können wir die Leistungen erbringen?
- references: Haben wir passende Referenzen?
- award-criteria: Können wir bei den Zuschlagskriterien punkten?
- offer-structure: Ist der Aufwand für das Angebot vertretbar?
- risks: Welche Projektrisiken sind identifiziert und wie schwerwiegend sind sie?

EMPFEHLUNG:
- bid: Klare Empfehlung mitbieten
- no-bid: Nicht mitbieten
- conditional-bid: Unter bestimmten Bedingungen mitbieten

SUCCESS RATE: ${(successRate * 100).toFixed(0)}%

SECTION SUMMARIES (aus RAG/Dokumenten):
${summariesText}

Generiere jetzt die Empfehlung:`,
  });

  // Normalize confidence: LLM might return 0-1 or 0-100
  const normalizedConfidence =
    decision.confidence <= 1
      ? Math.round(decision.confidence * 100)
      : Math.round(decision.confidence);

  console.log(
    `[Decision] Empfehlung: ${decision.recommendation} (Confidence: ${normalizedConfidence}%)`
  );

  return {
    ...decision,
    confidence: normalizedConfidence,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Hauptfunktion: Orchestrator-Worker für PreQualification Sections
 */
export async function runPreQualSectionOrchestrator(
  preQualificationId: string,
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const {
    maxConcurrency = 5,
    enableEvaluation = true,
    qualityThreshold = 60,
    maxRetries = 1,
    skipPlanning = false,
  } = options;

  console.log('[Orchestrator] Start PreQual Section Orchestrator');
  console.log(
    `[Orchestrator] Config: maxConcurrency=${maxConcurrency}, enableEvaluation=${enableEvaluation}, qualityThreshold=${qualityThreshold}`
  );

  try {
    // STEP 1: ORCHESTRATOR - Plan erstellen
    let plan: OrchestratorPlan;

    if (skipPlanning) {
      // Fallback: Standard-Plan ohne LLM-Call
      plan = {
        tasks: SECTION_IDS.map(sectionId => ({
          sectionId,
          priority: 'medium' as const,
          requiresWebEnrichment: sectionId === 'budget' || sectionId === 'references',
          goal: `Analysiere ${sectionId}`,
        })),
        strategy: {
          mode: 'documents-first',
          maxConcurrency,
        },
      };
      console.log('[Orchestrator] Skip Planning: Standard-Plan verwendet');
    } else {
      plan = await planSectionExecution(preQualificationId);
    }

    // STEP 2: WORKERS - Sections parallel ausführen
    const results = await executeSectionWorkers(preQualificationId, plan, options);

    // STEP 3: EVALUATOR - Qualität prüfen und ggf. Retries
    if (enableEvaluation && maxRetries > 0) {
      console.log('[Evaluator] Prüfe Section-Qualität...');

      for (const result of results) {
        if (!result.success) continue;

        const evaluation = await evaluateSectionResult(preQualificationId, result);

        result.qualityScore = evaluation.qualityScore;

        if (evaluation.needsRetry && result.retryAttempt < maxRetries) {
          console.log(
            `[Evaluator] Section ${result.sectionId} needs retry (Score: ${evaluation.qualityScore})`
          );

          // Retry mit Web-Enrichment
          const retryResult = await executeSectionWorker(
            preQualificationId,
            result.sectionId,
            true, // Force Web-Enrichment bei Retry
            result.retryAttempt + 1
          );

          // Update result
          Object.assign(result, retryResult);
        }
      }
    }

    // STEP 4: DECISION - Bid/No Bid Empfehlung
    const decision = await generateBidDecision(preQualificationId, results);

    const failedSections = results.filter(r => !r.success);
    const success = failedSections.length === 0;

    console.log(
      `[Orchestrator] Abgeschlossen: ${results.length - failedSections.length}/${results.length} Sections erfolgreich`
    );

    return {
      success,
      completedSections: results.length - failedSections.length,
      failedSections,
      plan,
      decision,
    };
  } catch (error) {
    console.error('[Orchestrator] Fehler:', error);
    return {
      success: false,
      completedSections: 0,
      failedSections: [],
      error:
        error instanceof Error
          ? error.message || error.constructor.name
          : String(error) || 'Unbekannter Fehler',
    };
  }
}
