import { runTimingAgent } from './timing-agent';
import { runDeliverablesAgent } from './deliverables-agent';
import { runTechStackAgent } from './techstack-agent';
import { runLegalRfpAgent } from './legal-rfp-agent';
import { runSummaryAgent } from './summary-agent';
import type { ExpertAgentInput } from './types';

export interface OrchestratorResult {
  success: boolean;
  results: {
    timing: { success: boolean; confidence: number };
    deliverables: { success: boolean; confidence: number };
    techstack: { success: boolean; confidence: number };
    legal: { success: boolean; confidence: number };
    summary: { success: boolean; confidence: number };
  };
  errors: string[];
  completedAt: string;
}

export async function runExpertAgents(input: ExpertAgentInput): Promise<OrchestratorResult> {
  console.error(`[Expert Orchestrator] Starting all agents for RFP ${input.rfpId}`);

  const errors: string[] = [];

  // Run parallel agents (timing, deliverables, techstack, legal)
  const [timing, deliverables, techstack, legal] = await Promise.allSettled([
    runTimingAgent(input),
    runDeliverablesAgent(input),
    runTechStackAgent(input),
    runLegalRfpAgent(input),
  ]);

  // Collect results and errors
  const timingResult = timing.status === 'fulfilled' ? timing.value : null;
  const deliverablesResult = deliverables.status === 'fulfilled' ? deliverables.value : null;
  const techstackResult = techstack.status === 'fulfilled' ? techstack.value : null;
  const legalResult = legal.status === 'fulfilled' ? legal.value : null;

  if (!timingResult?.success) errors.push(`Timing: ${timingResult?.error || 'failed'}`);
  if (!deliverablesResult?.success)
    errors.push(`Deliverables: ${deliverablesResult?.error || 'failed'}`);
  if (!techstackResult?.success) errors.push(`TechStack: ${techstackResult?.error || 'failed'}`);
  if (!legalResult?.success) errors.push(`Legal: ${legalResult?.error || 'failed'}`);

  // Run summary AFTER others complete (needs their output)
  const summaryResult = await runSummaryAgent(input);
  if (!summaryResult.success) errors.push(`Summary: ${summaryResult.error || 'failed'}`);

  return {
    success: errors.length === 0,
    results: {
      timing: {
        success: timingResult?.success ?? false,
        confidence: timingResult?.confidence ?? 0,
      },
      deliverables: {
        success: deliverablesResult?.success ?? false,
        confidence: deliverablesResult?.confidence ?? 0,
      },
      techstack: {
        success: techstackResult?.success ?? false,
        confidence: techstackResult?.confidence ?? 0,
      },
      legal: {
        success: legalResult?.success ?? false,
        confidence: legalResult?.confidence ?? 0,
      },
      summary: {
        success: summaryResult.success,
        confidence: summaryResult.confidence,
      },
    },
    errors,
    completedAt: new Date().toISOString(),
  };
}
