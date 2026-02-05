import { runCapabilityAgent } from './agents/capability-agent';
import { runCompetitionAgent } from './agents/competition-agent';
import { runContractAgent } from './agents/contract-agent';
import { runDealQualityAgent } from './agents/deal-quality-agent';
import { runLegalAgent } from './agents/legal-agent';
import { runReferenceAgent } from './agents/reference-agent';
import { runStrategicFitAgent } from './agents/strategic-fit-agent';
import { runCoordinatorAgent } from './coordinator-agent';
import {
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
} from './schema';

import { quickEvaluate, BIT_EVALUATION_SCHEMA } from '@/lib/agent-tools/evaluator';
import { generateStructuredOutput } from '@/lib/ai/config';
import { calculateWeightedBitScore, loadBusinessRulesConfig } from '@/lib/config/business-rules';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

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

    // Load business rules config from DB (falls back to hardcoded defaults)
    const businessConfig = await loadBusinessRulesConfig();

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
      overall: calculateWeightedBitScore(individualScores, businessConfig.bitWeights),
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

    const coordinatorOutput = await runCoordinatorAgent(
      {
        capabilityMatch,
        dealQuality,
        strategicFit,
        competitionCheck,
        legalAssessment,
        contractAnalysis,
        referenceMatch,
        scores: weightedScores,
        allCriticalBlockers,
      },
      { weights: businessConfig.bitWeights, threshold: businessConfig.bitThreshold }
    );

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

async function generateAlternativeRecommendation(context: {
  capabilityMatch: any;
  dealQuality: any;
  strategicFit: any;
  competitionCheck: any;
  decision: BitDecision;
}): Promise<AlternativeRec> {
  const systemPrompt = `Du bist ein strategischer Berater bei adesso SE.

## Deine Aufgabe
Empfehle eine konstruktive Alternative für diese NO BIT Entscheidung.

## Alternative Optionen

| Option | Wann verwenden |
|--------|----------------|
| partner_collaboration | Capability-Lücken die Partner füllen können |
| partial_scope | Vollprojekt zu groß/riskant, aber Teil machbar |
| delay_and_reassess | Timing falsch, aber später interessant |
| refer_to_competitor | Kein Fit, aber Beziehung pflegen |
| decline_gracefully | Keine Alternative, aber professionell absagen |

## Ausgabesprache
Alle Texte auf Deutsch.`;

  const userPrompt = `Die Opportunity erfüllt unsere BIT-Kriterien nicht. Empfehle eine konstruktive Alternative.

## Entscheidungs-Kontext
${JSON.stringify(context.decision, null, 2)}

## Agent-Bewertungen
- Capability: ${context.capabilityMatch.reasoning}
- Deal Quality: ${context.dealQuality.reasoning}
- Strategic Fit: ${context.strategicFit.reasoning}
- Competition: ${context.competitionCheck.reasoning}

## Deine Empfehlung
Liefere:
1. recommendedAlternative (eine der Optionen oben)
2. reasoning (Begründung auf Deutsch)
3. partnerSuggestions (konkrete Partner-Vorschläge, falls applicable)
4. reducedScopeOptions (für partial_scope: [{scope, viability}])
5. customerCommunication (2-3 Sätze für Kundenkommunikation auf Deutsch)`;

  return generateStructuredOutput({
    model: 'quality',
    schema: alternativeRecSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
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

    // Load business rules config from DB (falls back to hardcoded defaults)
    const businessConfig = await loadBusinessRulesConfig();

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
      overall: calculateWeightedBitScore(individualScores, businessConfig.bitWeights),
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

    const coordinatorOutput = await runCoordinatorAgent(
      {
        capabilityMatch,
        dealQuality,
        strategicFit,
        competitionCheck,
        legalAssessment,
        contractAnalysis,
        referenceMatch,
        scores: weightedScores,
        allCriticalBlockers,
      },
      { weights: businessConfig.bitWeights, threshold: businessConfig.bitThreshold }
    );

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
