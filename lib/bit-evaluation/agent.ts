import OpenAI from 'openai';

import { BIT_EVALUATION_WEIGHTS, calculateWeightedBitScore } from '@/lib/config/business-rules';
import { runCapabilityAgent } from './agents/capability-agent';
import { runCompetitionAgent } from './agents/competition-agent';
import { runContractAgent } from './agents/contract-agent';
import { runDealQualityAgent } from './agents/deal-quality-agent';
import { runLegalAgent } from './agents/legal-agent';
import { runReferenceAgent } from './agents/reference-agent';
import { runStrategicFitAgent } from './agents/strategic-fit-agent';
import { runCoordinatorAgent } from './coordinator-agent';
import {
  bitDecisionSchema,
  alternativeRecSchema,
  type BitEvaluationResult,
  type BitDecision,
  type AlternativeRec,
  type CapabilityMatch,
  type DealQuality,
  type StrategicFit,
  type CompetitionCheck,
  type LegalAssessment,
  type ContractAnalysis,
  type ReferenceMatch,
  type CoordinatorOutput,
} from './schema';

// Intelligent Agent Framework - NEW
import { quickEvaluate, BIT_EVALUATION_SCHEMA } from '@/lib/agent-tools/evaluator';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

/**
 * Helper function to call AI and parse JSON response
 */
async function callAI<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T> {
  const completion = await openai.chat.completions.create({
    model: 'gemini-3-flash-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);
  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return schema.parse(cleanedResult) as T;
}

export interface BitEvaluationInput {
  bidId: string;
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean; // NEW: Enable web search for Competition Agent
}

export interface BitEvaluationActivityLog {
  timestamp: string;
  action: string;
  details?: string;
}

/**
 * BIT/NO BIT Evaluation Coordinator
 * Runs all four evaluation agents in parallel and makes final decision
 */
export async function runBitEvaluation(input: BitEvaluationInput): Promise<BitEvaluationResult> {
  const startTime = Date.now();
  const activityLog: BitEvaluationActivityLog[] = [];

  const logActivity = (action: string, details?: string) => {
    activityLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  };

  try {
    logActivity('Starting BIT evaluation', `Bid ID: ${input.bidId}`);

    // Run all seven agents in parallel (including Contract Agent - DEA-7)
    logActivity('Running parallel agent evaluation');
    // useWebSearch für alle Agents aktivieren
    const useWebSearch = input.useWebSearch ?? true;

    const [
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      legalAssessment,
      contractAnalysis,
      referenceMatch,
    ]: [
      CapabilityMatch,
      DealQuality,
      StrategicFit,
      CompetitionCheck,
      LegalAssessment,
      ContractAnalysis,
      ReferenceMatch,
    ] = await Promise.all([
      runCapabilityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // GitHub + Web Search für Tech-Infos
      }),
      runDealQualityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Markt-Benchmarks + Kunden-News
      }),
      runStrategicFitAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Kunden- + Branchen-Recherche
      }),
      runCompetitionAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Wettbewerber-Recherche
      }),
      runLegalAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Vertrags- + Compliance-Recherche
      }),
      runContractAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Vertragsmodell-Recherche (DEA-7)
      }),
      runReferenceAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // adesso Referenz-Recherche
      }),
    ]);

    logActivity('All agents completed', 'Calculating weighted scores');

    // Calculate weighted scores using centralized config
    const individualScores = {
      capability: capabilityMatch.overallCapabilityScore,
      dealQuality: dealQuality.overallDealQualityScore,
      strategicFit: strategicFit.overallStrategicFitScore,
      winProbability: competitionCheck.estimatedWinProbability,
      legal: legalAssessment.overallLegalScore,
      reference: referenceMatch.overallReferenceScore,
    };

    const weightedScores = {
      ...individualScores,
      overall: calculateWeightedBitScore(individualScores),
    };

    // Collect all critical blockers (including Contract Agent - DEA-7)
    const allCriticalBlockers = [
      ...capabilityMatch.criticalBlockers,
      ...dealQuality.criticalBlockers,
      ...strategicFit.criticalBlockers,
      ...competitionCheck.criticalBlockers,
      ...legalAssessment.criticalBlockers,
      ...contractAnalysis.criticalBlockers,
      ...referenceMatch.criticalBlockers,
    ];

    // Run Coordinator Agent for decision synthesis
    logActivity('Running Coordinator Agent', 'Synthesizing results and building decision tree');

    const coordinatorOutput = await runCoordinatorAgent({
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      legalAssessment,
      contractAnalysis,
      referenceMatch,
      scores: weightedScores,
      allCriticalBlockers,
    });

    logActivity(
      'Coordinator completed',
      `Decision: ${coordinatorOutput.recommendation.toUpperCase()}, Confidence: ${coordinatorOutput.confidence.toFixed(1)}%`
    );

    // Build BitDecision from coordinator output
    const decision: BitDecision = {
      decision: coordinatorOutput.recommendation,
      scores: weightedScores,
      overallConfidence: coordinatorOutput.confidence,
      keyStrengths: coordinatorOutput.synthesis.keyStrengths,
      keyRisks: coordinatorOutput.synthesis.keyRisks,
      criticalBlockers: coordinatorOutput.synthesis.criticalBlockers,
      reasoning: coordinatorOutput.synthesis.executiveSummary,
      nextSteps: coordinatorOutput.nextSteps,
    };

    logActivity('Final decision generated', `Decision: ${decision.decision.toUpperCase()}`);

    // Generate alternative recommendation if NO BIT
    let alternative: AlternativeRec | undefined;
    if (decision.decision === 'no_bit') {
      logActivity('Generating alternative recommendation');
      alternative = await generateAlternativeRecommendation({
        capabilityMatch,
        dealQuality,
        strategicFit,
        competitionCheck,
        decision,
      });
    }

    const duration = Date.now() - startTime;
    logActivity('BIT evaluation completed', `Duration: ${duration}ms`);

    return {
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      legalAssessment,
      contractAnalysis, // DEA-7: Contract Agent results
      referenceMatch,
      decision,
      alternative,
      coordinatorOutput,
      evaluatedAt: new Date().toISOString(),
      evaluationDuration: duration,
    };
  } catch (error) {
    logActivity('BIT evaluation failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Generate final BIT decision using AI
 */
async function generateBitDecision(context: {
  scores: {
    capability: number;
    dealQuality: number;
    strategicFit: number;
    winProbability: number;
    legal: number;
    reference: number;
    overall: number;
  };
  capabilityMatch: any;
  dealQuality: any;
  strategicFit: any;
  competitionCheck: any;
  legalAssessment: any;
  referenceMatch: any;
  allCriticalBlockers: string[];
  initialRecommendation: 'bit' | 'no_bit';
}): Promise<BitDecision> {
  const systemPrompt = `Du bist der finale Entscheider für BIT/NO BIT Bewertungen bei adesso SE.
Treffe fundierte Entscheidungen basierend auf allen Agent-Bewertungen.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Alle Texte und Begründungen müssen auf Deutsch sein.`;

  const userPrompt = `Review all agent assessments and make the final decision.

**Weighted Scores:**
- Capability Match: ${context.scores.capability}/100 (25% weight)
- Deal Quality: ${context.scores.dealQuality}/100 (20% weight)
- Strategic Fit: ${context.scores.strategicFit}/100 (15% weight)
- Win Probability: ${context.scores.winProbability}/100 (15% weight)
- Legal Assessment: ${context.scores.legal}/100 (15% weight)
- Reference Match: ${context.scores.reference}/100 (10% weight)
- **Overall Score: ${context.scores.overall.toFixed(1)}/100**

**Initial Recommendation:** ${context.initialRecommendation.toUpperCase()}

**Critical Blockers Found:** ${context.allCriticalBlockers.length}
${context.allCriticalBlockers.length > 0 ? context.allCriticalBlockers.map(b => `- ${b}`).join('\n') : 'None'}

**Capability Assessment:**
${JSON.stringify(context.capabilityMatch, null, 2)}

**Deal Quality Assessment:**
${JSON.stringify(context.dealQuality, null, 2)}

**Strategic Fit Assessment:**
${JSON.stringify(context.strategicFit, null, 2)}

**Competition Assessment:**
${JSON.stringify(context.competitionCheck, null, 2)}

**Legal Assessment:**
${JSON.stringify(context.legalAssessment, null, 2)}

**Reference Match Assessment:**
${JSON.stringify(context.referenceMatch, null, 2)}

**Decision Criteria:**
- BIT if: Overall score >= 55 AND no critical blockers
- NO BIT if: Overall score < 55 OR critical blockers present

Antworte mit JSON:
- decision (string: "bit" oder "no_bit"): Die finale Entscheidung
- overallConfidence (number 0-100): Gesamt-Confidence der Bewertung
- reasoning (string): Executive Summary auf Deutsch (min. 3-4 Sätze)
- keyStrengths (array of strings): 3-5 Schlüsselstärken auf Deutsch
- keyRisks (array of strings): 3-5 Schlüsselrisiken auf Deutsch
- criticalBlockers (array of strings): Alle kritischen Blocker auf Deutsch
- nextSteps (array of strings): Empfohlene nächste Schritte auf Deutsch`;

  const result = await callAI<Omit<BitDecision, 'scores'>>(
    systemPrompt,
    userPrompt,
    bitDecisionSchema
  );

  return {
    ...result,
    scores: context.scores,
  };
}

/**
 * Generate alternative recommendation for NO BIT decision
 */
async function generateAlternativeRecommendation(context: {
  capabilityMatch: any;
  dealQuality: any;
  strategicFit: any;
  competitionCheck: any;
  decision: BitDecision;
}): Promise<AlternativeRec> {
  const systemPrompt = `Du empfiehlst alternative Ansätze für NO BIT Entscheidungen bei adesso SE.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Alle Texte und Begründungen müssen auf Deutsch sein.`;

  const userPrompt = `The opportunity did not meet our criteria for a full BIT, but we should suggest a constructive alternative.

**Decision Context:**
${JSON.stringify(context.decision, null, 2)}

**Assessment Summaries:**
- Capability: ${context.capabilityMatch.reasoning}
- Deal Quality: ${context.dealQuality.reasoning}
- Strategic Fit: ${context.strategicFit.reasoning}
- Competition: ${context.competitionCheck.reasoning}

**Alternative Options:**
1. partner_collaboration - Use when we have capability gaps partners could fill
2. partial_scope - Use when full project is too large/risky but part is viable
3. delay_and_reassess - Use when timing is wrong but opportunity might be good later
4. refer_to_competitor - Use when genuinely not a fit but want to maintain relationship
5. decline_gracefully - Use when no viable alternative but maintain good relationship

Antworte mit JSON:
- recommendedAlternative (string: eine der Optionen oben): Die empfohlene Alternative
- reasoning (string): Warum diese Alternative die beste ist (auf Deutsch)
- partnerSuggestions (array of strings, optional): Konkrete Partner-Vorschläge
- reducedScopeOptions (array of {scope: string, viability: string "low"/"medium"/"high"}, optional): Für partial_scope
- customerCommunication (string): Professioneller 2-3 Satz Entwurf für Kundenkommunikation auf Deutsch`;

  return callAI<AlternativeRec>(systemPrompt, userPrompt, alternativeRecSchema);
}

/**
 * BIT Evaluation with Streaming Support
 * Emits real-time events for progress tracking
 * Best practice: Parallel agent execution with progress callbacks (async-parallel)
 */
export async function runBitEvaluationWithStreaming(
  input: BitEvaluationInput,
  emit: EventEmitter
): Promise<BitEvaluationResult> {
  const startTime = Date.now();

  try {
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: 'Starting BIT evaluation...',
      },
    });

    // Run all seven agents in parallel (best practice: async-parallel)
    // Emit progress as each agent starts
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message:
          'Running parallel agent evaluation (Capability, Deal Quality, Strategic Fit, Competition, Legal, Contract, Reference)',
      },
    });

    // useWebSearch für alle Agents aktivieren
    const useWebSearch = input.useWebSearch ?? true;

    const agentPromises: [
      Promise<CapabilityMatch>,
      Promise<DealQuality>,
      Promise<StrategicFit>,
      Promise<CompetitionCheck>,
      Promise<LegalAssessment>,
      Promise<ContractAnalysis>,
      Promise<ReferenceMatch>,
    ] = [
      runCapabilityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // GitHub + Web Search für Tech-Infos
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Capability',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
      runDealQualityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Markt-Benchmarks + Kunden-News
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Deal Quality',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
      runStrategicFitAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Kunden- + Branchen-Recherche
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Strategic Fit',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
      runCompetitionAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Wettbewerber-Recherche
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Competition',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
      runLegalAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Vertrags- + Compliance-Recherche
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Legal',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
      runContractAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // Vertragsmodell-Recherche (DEA-7)
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Contract',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
      runReferenceAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
        useWebSearch, // adesso Referenz-Recherche
      }).then(result => {
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Reference',
            result,
            confidence: result.confidence,
          },
        });
        return result;
      }),
    ];

    const [
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      legalAssessment,
      contractAnalysis,
      referenceMatch,
    ]: [
      CapabilityMatch,
      DealQuality,
      StrategicFit,
      CompetitionCheck,
      LegalAssessment,
      ContractAnalysis,
      ReferenceMatch,
    ] = await Promise.all(agentPromises);

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: 'All agents completed. Calculating weighted scores...',
      },
    });

    // Calculate weighted scores using centralized config
    const individualScores = {
      capability: capabilityMatch.overallCapabilityScore,
      dealQuality: dealQuality.overallDealQualityScore,
      strategicFit: strategicFit.overallStrategicFitScore,
      winProbability: competitionCheck.estimatedWinProbability,
      legal: legalAssessment.overallLegalScore,
      reference: referenceMatch.overallReferenceScore,
    };

    const weightedScores = {
      ...individualScores,
      overall: calculateWeightedBitScore(individualScores),
    };

    // Collect all critical blockers (including Contract Agent - DEA-7)
    const allCriticalBlockers = [
      ...capabilityMatch.criticalBlockers,
      ...dealQuality.criticalBlockers,
      ...strategicFit.criticalBlockers,
      ...competitionCheck.criticalBlockers,
      ...legalAssessment.criticalBlockers,
      ...contractAnalysis.criticalBlockers,
      ...referenceMatch.criticalBlockers,
    ];

    // Run Coordinator Agent
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: `Synthesizing results and building decision tree (Overall score: ${weightedScores.overall.toFixed(1)}/100)...`,
      },
    });

    const coordinatorOutput = await runCoordinatorAgent({
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      legalAssessment,
      contractAnalysis,
      referenceMatch,
      scores: weightedScores,
      allCriticalBlockers,
    });

    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Coordinator',
        result: coordinatorOutput,
        confidence: coordinatorOutput.confidence,
      },
    });

    // Build BitDecision from coordinator output
    const decision: BitDecision = {
      decision: coordinatorOutput.recommendation,
      scores: weightedScores,
      overallConfidence: coordinatorOutput.confidence,
      keyStrengths: coordinatorOutput.synthesis.keyStrengths,
      keyRisks: coordinatorOutput.synthesis.keyRisks,
      criticalBlockers: coordinatorOutput.synthesis.criticalBlockers,
      reasoning: coordinatorOutput.synthesis.executiveSummary,
      nextSteps: coordinatorOutput.nextSteps,
    };

    // Generate alternative recommendation if NO BIT
    let alternative: AlternativeRec | undefined;
    if (decision.decision === 'no_bit') {
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Coordinator',
          message: 'Generating alternative recommendation...',
        },
      });

      alternative = await generateAlternativeRecommendation({
        capabilityMatch,
        dealQuality,
        strategicFit,
        competitionCheck,
        decision,
      });
    }

    const duration = Date.now() - startTime;

    // Build result object
    const result = {
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      legalAssessment,
      contractAnalysis, // DEA-7: Contract Agent results
      referenceMatch,
      decision,
      alternative,
      coordinatorOutput,
      evaluatedAt: new Date().toISOString(),
      evaluationDuration: duration,
    };

    // Quality evaluation (NEW)
    const quickEval = quickEvaluate(result as Record<string, unknown>, BIT_EVALUATION_SCHEMA);

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Evaluator',
        message: `Qualitäts-Score: ${quickEval.score}/100`,
        details:
          quickEval.issues.length > 0
            ? `${quickEval.issues.length} Bereiche prüfen`
            : 'Alle Kriterien erfüllt',
      },
    });

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: `BIT evaluation completed in ${(duration / 1000).toFixed(1)}s`,
      },
    });

    return result;
  } catch (error) {
    emit({
      type: AgentEventType.ERROR,
      data: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'BIT_EVALUATION_ERROR',
      },
    });
    throw error;
  }
}
