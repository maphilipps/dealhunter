/**
 * Orchestrator-Worker Pattern für PreQualification Sections
 *
 * Architektur:
 * 1. ORCHESTRATOR: Analysiert Dokumente und plant Section-Execution
 * 2. WORKERS: Führen 7 BD-Fragen parallel aus (budget, timing, contracts, deliverables, references, award-criteria, offer-structure)
 * 3. EVALUATOR: Prüft Section-Qualität und triggert Retries bei niedrigem Score
 * 4. CMS MATRIX: Requirement Research (bestehender Agent)
 * 5. DECISION: Bid/No Bid Synthese aller Sections
 *
 * Performance: ~120s (sequentiell) → ~25-35s (parallel)
 */

import { generateObject } from 'ai';
import { z } from 'zod';

import { getModelForSlot } from '@/lib/ai/providers';
import { runPreQualSectionAgent } from '@/lib/json-render/prequal-section-agent';
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';

// ═══════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * 7 BD-Fragen als Section-IDs
 */
export const SECTION_IDS = [
  'budget',
  'timing',
  'contracts',
  'deliverables',
  'references',
  'award-criteria',
  'offer-structure',
] as const;

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
// CONCURRENCY HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Führt Funktionen mit begrenzter Parallelität aus
 * (kopiert von lib/cms-matching/parallel-matrix-orchestrator.ts)
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Create a promise that removes itself from the executing array upon completion
    let promiseToRemove: Promise<void> | null = null;
    const promise = (async () => {
      try {
        results[i] = await fn(item, i);
      } finally {
        // This will be executed when the promise settles (resolves or rejects)
        // We use a functional approach to remove the specific promise instance
        if (promiseToRemove) {
          const index = executing.indexOf(promiseToRemove);
          if (index !== -1) {
            void executing.splice(index, 1);
          }
        }
      }
    })();
    promiseToRemove = promise;
    void promise;

    executing.push(promise);

    if (executing.length >= concurrency) {
      const racePromise = Promise.race(executing);
      await racePromise;
    }
  }

  await Promise.all(executing);
  return results;
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

  const model = getModelForSlot('default');

  const { object: plan } = await generateObject({
    model,
    schema: OrchestratorPlanSchema,
    prompt: `Du bist ein Orchestrator für die Analyse von öffentlichen Ausschreibungen.

DOKUMENT-PREVIEW:
${previewContext}

AUFGABE:
Analysiere die Dokument-Preview und plane die Ausführung von 7 BD-Fragen (Section-Analysen).

VERFÜGBARE SECTIONS:
- budget: Budget und Laufzeit
- timing: Ausschreibungszeitplan, Shortlisting
- contracts: Vertragstyp (EVB-IT, Werk, Dienst, SLA)
- deliverables: Geforderte Leistungen
- references: Referenzanforderungen
- award-criteria: Zuschlagskriterien im Detail
- offer-structure: Angebotsstruktur (was muss Team erarbeiten)

STRATEGIE:
1. Priorität: Welche Sections sind kritisch für die Bid/No-Bid Entscheidung?
2. Web-Enrichment: Welche Sections profitieren von externer Recherche (z.B. Marktpreise, Technologie-Trends)?
3. Concurrency: Wie viele Sections können parallel verarbeitet werden? (1-10, empfohlen: 5)

REGELN:
- Alle 7 Sections müssen geplant werden
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
async function evaluateSectionResult(result: SectionResult): Promise<EvaluatorResult> {
  // Vereinfachte Implementierung ohne LLM-Call
  // In Phase 2: generateObject mit EvaluatorResultSchema
  // Dann würden preQualificationId, sectionId, qualityThreshold wieder genutzt

  if (!result.success) {
    return {
      qualityScore: 0,
      confidence: 0,
      completeness: 0,
      needsRetry: true,
      reasoning: result.error || 'Section fehlgeschlagen',
    };
  }

  // Erfolgreiche Sections werden als ausreichend qualitativ markiert
  return {
    qualityScore: 75, // Annahme: Erfolgreiche Sections haben gute Qualität
    confidence: 80,
    completeness: 80,
    needsRetry: false,
    reasoning: 'Section erfolgreich abgeschlossen',
  };
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

  // Hole alle Section-Daten aus der Datenbank
  // TODO: Hier müsste die Section-Daten aus der DB geladen werden
  // Für jetzt: Vereinfachte Implementierung basierend auf Success-Rate

  const successRate = results.filter(r => r.success).length / results.length;
  const failedSections = results.filter(r => !r.success);

  const model = getModelForSlot('quality');

  const { object: decision } = await generateObject({
    model,
    schema: DecisionSchema,
    prompt: `Du bist ein Experte für öffentliche Ausschreibungen und hilfst bei der Bid/No-Bid Entscheidung.

SECTION RESULTS:
- Erfolgreiche Sections: ${results.filter(r => r.success).length}/${results.length}
- Fehlgeschlagene Sections: ${failedSections.map(r => r.sectionId).join(', ') || 'keine'}

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

EMPFEHLUNG:
- bid: Klare Empfehlung mitbieten
- no-bid: Nicht mitbieten
- conditional-bid: Unter bestimmten Bedingungen mitbieten

SUCCESS RATE: ${(successRate * 100).toFixed(0)}%

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

        const evaluation = await evaluateSectionResult(result);

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
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
