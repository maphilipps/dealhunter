import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  bitDecisionSchema,
  alternativeRecSchema,
  type BitEvaluationResult,
  type BitDecision,
  type AlternativeRec,
} from './schema';
import { runCapabilityAgent } from './agents/capability-agent';
import { runDealQualityAgent } from './agents/deal-quality-agent';
import { runStrategicFitAgent } from './agents/strategic-fit-agent';
import { runCompetitionAgent } from './agents/competition-agent';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

export interface BitEvaluationInput {
  bidId: string;
  extractedRequirements: any;
  quickScanResults?: any;
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

    // Run all four agents in parallel
    logActivity('Running parallel agent evaluation');
    const [capabilityMatch, dealQuality, strategicFit, competitionCheck] = await Promise.all([
      runCapabilityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
      }),
      runDealQualityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
      }),
      runStrategicFitAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
      }),
      runCompetitionAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
      }),
    ]);

    logActivity('All agents completed', 'Calculating weighted scores');

    // Calculate weighted scores
    // Capability: 30%, Deal Quality: 25%, Strategic Fit: 20%, Win Probability: 25%
    const weightedScores = {
      capability: capabilityMatch.overallCapabilityScore,
      dealQuality: dealQuality.overallDealQualityScore,
      strategicFit: strategicFit.overallStrategicFitScore,
      winProbability: competitionCheck.estimatedWinProbability,
      overall:
        capabilityMatch.overallCapabilityScore * 0.3 +
        dealQuality.overallDealQualityScore * 0.25 +
        strategicFit.overallStrategicFitScore * 0.2 +
        competitionCheck.estimatedWinProbability * 0.25,
    };

    // Collect all critical blockers
    const allCriticalBlockers = [
      ...capabilityMatch.criticalBlockers,
      ...dealQuality.criticalBlockers,
      ...strategicFit.criticalBlockers,
      ...competitionCheck.criticalBlockers,
    ];

    // Determine if we should BIT or NO BIT
    // BIT if: overall score >= 55 AND no critical blockers
    // NO BIT if: overall score < 55 OR critical blockers present
    const shouldBit = weightedScores.overall >= 55 && allCriticalBlockers.length === 0;

    logActivity('Making final decision', shouldBit ? 'Recommendation: BIT' : 'Recommendation: NO BIT');

    // Generate final decision with AI
    const decision = await generateBitDecision({
      scores: weightedScores,
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      allCriticalBlockers,
      initialRecommendation: shouldBit ? 'bit' : 'no_bit',
    });

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
      decision,
      alternative,
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
    overall: number;
  };
  capabilityMatch: any;
  dealQuality: any;
  strategicFit: any;
  competitionCheck: any;
  allCriticalBlockers: string[];
  initialRecommendation: 'bit' | 'no_bit';
}): Promise<BitDecision> {
  const result = await generateObject({
    // @ts-expect-error - AI SDK v5 type mismatch between LanguageModelV3 and LanguageModel
    model: openai('gpt-4o-mini'),
    schema: bitDecisionSchema,
    prompt: `You are the final decision maker for BIT/NO BIT evaluation at adesso SE.

Review all agent assessments and make the final decision.

**Weighted Scores:**
- Capability Match: ${context.scores.capability}/100 (30% weight)
- Deal Quality: ${context.scores.dealQuality}/100 (25% weight)
- Strategic Fit: ${context.scores.strategicFit}/100 (20% weight)
- Win Probability: ${context.scores.winProbability}/100 (25% weight)
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

**Decision Criteria:**
- BIT if: Overall score >= 55 AND no critical blockers
- NO BIT if: Overall score < 55 OR critical blockers present
- Low confidence warning if: Overall confidence < 70%

**Your Task:**
1. Make the final BIT or NO BIT decision
2. Calculate overall confidence (average of all agent confidences)
3. List 3-5 key strengths for this opportunity
4. List 3-5 key risks for this opportunity
5. List all critical blockers (if any)
6. Provide executive summary reasoning
7. Recommend next steps

**Important:**
- Follow the initial recommendation unless you have strong reason to override
- Be honest about confidence level
- Key strengths should be specific and compelling
- Key risks should be realistic and actionable
- Next steps should be practical and immediate

Provide your decision:`,
    temperature: 0.3,
  });

  return {
    ...result.object,
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
  const result = await generateObject({
    // @ts-expect-error - AI SDK v5 type mismatch between LanguageModelV3 and LanguageModel
    model: openai('gpt-4o-mini'),
    schema: alternativeRecSchema,
    prompt: `You are recommending an alternative approach for a NO BIT decision at adesso SE.

The opportunity did not meet our criteria for a full BIT, but we should suggest a constructive alternative.

**Decision Context:**
${JSON.stringify(context.decision, null, 2)}

**Assessment Summaries:**
- Capability: ${context.capabilityMatch.reasoning}
- Deal Quality: ${context.dealQuality.reasoning}
- Strategic Fit: ${context.strategicFit.reasoning}
- Competition: ${context.competitionCheck.reasoning}

**Alternative Options:**

1. **partner_collaboration**
   - Use when: We have gaps in capabilities that partners could fill
   - Example: "We can deliver the Drupal CMS part, but partner with X for the mobile app"

2. **partial_scope**
   - Use when: Full project is too large/risky, but part of it is viable
   - Example: "We can handle Phase 1 (CMS) but not Phase 2 (custom ERP integration)"

3. **delay_and_reassess**
   - Use when: Timing is wrong but opportunity might be good later
   - Example: "Budget unclear now, reassess in Q3 when they finalize planning"

4. **refer_to_competitor**
   - Use when: Genuinely not a fit for us, but we want to maintain relationship
   - Example: "This needs SAP expertise we don't have, refer to CGI but stay engaged"

5. **decline_gracefully**
   - Use when: No viable alternative, but maintain good relationship
   - Example: "This is outside our focus, but we'd love to help with future CMS projects"

**Your Task:**
1. Choose the most appropriate alternative
2. If applicable, suggest specific partners (real companies in the industry)
3. If partial scope, outline 1-3 reduced scope options with viability
4. Explain why this alternative is best
5. Draft a professional customer communication (2-3 sentences)

**Important:**
- Be constructive and helpful, not just "no"
- Maintain the relationship for future opportunities
- Be specific about what we CAN do, if anything
- Customer communication should be professional and preserve relationship

Provide your alternative recommendation:`,
    temperature: 0.3,
  });

  return result.object;
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

    // Run all four agents in parallel (best practice: async-parallel)
    // Emit progress as each agent starts
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: 'Running parallel agent evaluation (Capability, Deal Quality, Strategic Fit, Competition)',
      },
    });

    const agentPromises = [
      runCapabilityAgent({
        extractedRequirements: input.extractedRequirements,
        quickScanResults: input.quickScanResults,
      }).then((result) => {
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
      }).then((result) => {
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
      }).then((result) => {
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
      }).then((result) => {
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
    ];

    const [capabilityMatch, dealQuality, strategicFit, competitionCheck] =
      await Promise.all(agentPromises);

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: 'All agents completed. Calculating weighted scores...',
      },
    });

    // Calculate weighted scores
    const weightedScores = {
      capability: capabilityMatch.overallCapabilityScore,
      dealQuality: dealQuality.overallDealQualityScore,
      strategicFit: strategicFit.overallStrategicFitScore,
      winProbability: competitionCheck.estimatedWinProbability,
      overall:
        capabilityMatch.overallCapabilityScore * 0.3 +
        dealQuality.overallDealQualityScore * 0.25 +
        strategicFit.overallStrategicFitScore * 0.2 +
        competitionCheck.estimatedWinProbability * 0.25,
    };

    // Collect all critical blockers
    const allCriticalBlockers = [
      ...capabilityMatch.criticalBlockers,
      ...dealQuality.criticalBlockers,
      ...strategicFit.criticalBlockers,
      ...competitionCheck.criticalBlockers,
    ];

    // Determine if we should BIT or NO BIT
    const shouldBit = weightedScores.overall >= 55 && allCriticalBlockers.length === 0;

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: `Making final decision (Overall score: ${weightedScores.overall.toFixed(1)}/100)...`,
      },
    });

    // Generate final decision with AI
    const decision = await generateBitDecision({
      scores: weightedScores,
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      allCriticalBlockers,
      initialRecommendation: shouldBit ? 'bit' : 'no_bit',
    });

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

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Coordinator',
        message: `BIT evaluation completed in ${(duration / 1000).toFixed(1)}s`,
      },
    });

    return {
      capabilityMatch,
      dealQuality,
      strategicFit,
      competitionCheck,
      decision,
      alternative,
      evaluatedAt: new Date().toISOString(),
      evaluationDuration: duration,
    };
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
