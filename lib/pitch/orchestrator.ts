import { generateText, stepCountIs } from 'ai';

import { getModel } from '@/lib/ai/model-config';
import { loadCheckpoint, saveCheckpoint, updateRunStatus } from './checkpoints';
import { ORCHESTRATOR_SYSTEM_PROMPT, PHASES } from './constants';
import type { OrchestratorCheckpoint, PitchJobData, PitchJobResult } from './types';

// Tools
import { AskUserInterrupt, createAskUserTool } from './tools/ask-user';
import { createAuditTool } from './tools/audit-tool';
import { createCmsQueryTool, createIndustryQueryTool } from './tools/rag-query-tool';
import { createProgressTool, publishCompletion, publishError } from './tools/progress-tool';
import { createUncertaintyTool, type UncertaintyFlag } from './tools/uncertainty-tool';
import { createGenerateIndicationTool } from './tools/generation-tools';

/**
 * Run the pitch orchestrator agent.
 *
 * This is the core autonomous pipeline that:
 * 1. Loads checkpoint if resuming from an askUser pause
 * 2. Executes website audit
 * 3. Runs CMS + Industry expert analysis
 * 4. Flags uncertainties
 * 5. Generates the indication document
 * 6. Reports completion
 *
 * Uses AI SDK v6 generateText with tools and stopWhen for autonomous control.
 */
export async function runOrchestrator(jobData: PitchJobData): Promise<PitchJobResult> {
  const { runId, pitchId, websiteUrl, targetCmsIds, interviewResults } = jobData;

  // Mutable flags array — tools append to this during execution
  const uncertaintyFlags: UncertaintyFlag[] = [];

  // Build or resume checkpoint
  let checkpoint: OrchestratorCheckpoint;

  if (jobData.checkpointId) {
    const saved = await loadCheckpoint(runId);
    if (saved) {
      checkpoint = saved;
      checkpoint.pendingQuestion = null;

      // Inject the user's answer into the conversation history
      if (jobData.userAnswer) {
        checkpoint.conversationHistory.push({
          role: 'user',
          content: jobData.userAnswer,
        });
        checkpoint.collectedAnswers[checkpoint.phase] = jobData.userAnswer;
      }
    } else {
      checkpoint = createFreshCheckpoint(runId);
    }
  } else {
    checkpoint = createFreshCheckpoint(runId);
  }

  // Provide a getter so tools always see the latest checkpoint state
  const getCheckpoint = () => checkpoint;

  // Determine the industry from the pitch context
  const industry = interviewResults?.specialRequirements ?? null;
  const goal = interviewResults?.goal ?? 'Website-Relaunch';

  // Build tool set
  const tools = {
    reportProgress: createProgressTool({ runId }),
    runAudit: createAuditTool({ runId, pitchId, websiteUrl }),
    queryCmsKnowledge: createCmsQueryTool({
      runId,
      targetCmsIds,
      industry,
      websiteUrl,
    }),
    queryIndustryKnowledge: createIndustryQueryTool({
      runId,
      industry,
      websiteUrl,
      goal,
    }),
    flagUncertainty: createUncertaintyTool({ flags: uncertaintyFlags }),
    askUser: createAskUserTool({ runId, getCheckpoint }),
    generateIndication: createGenerateIndicationTool({
      runId,
      pitchId,
      flags: uncertaintyFlags,
    }),
  };

  // Mark run as running
  await updateRunStatus(runId, 'running', {
    progress: 5,
    currentStep: 'Orchestrator gestartet',
  });

  // Build prompt with context from checkpoint
  const contextParts: string[] = [];

  if (interviewResults) {
    contextParts.push(`Interview-Kontext:
- Ziel: ${interviewResults.goal}
- CMS-Präferenz: ${interviewResults.cmsPreference ?? 'keine'}
- Budget: ${interviewResults.budgetRange ?? 'unbekannt'}
- Anforderungen: ${interviewResults.specialRequirements ?? 'keine besonderen'}
- Tonalität: ${interviewResults.tonality ?? 'balanced'}`);
  }

  contextParts.push(`Website: ${websiteUrl}`);
  contextParts.push(`Ziel-CMS-IDs: ${targetCmsIds.join(', ')}`);

  if (checkpoint.completedAgents.length > 0) {
    contextParts.push(`Bereits abgeschlossene Agents: ${checkpoint.completedAgents.join(', ')}`);
  }

  if (Object.keys(checkpoint.collectedAnswers).length > 0) {
    contextParts.push(`User-Antworten: ${JSON.stringify(checkpoint.collectedAnswers)}`);
  }

  const prompt = contextParts.join('\n\n');

  try {
    const result = await generateText({
      model: getModel('quality'),
      system: ORCHESTRATOR_SYSTEM_PROMPT,
      prompt,
      tools,
      stopWhen: stepCountIs(50),
      temperature: 0.3,
      maxOutputTokens: 8000,
    });

    // Update checkpoint with final state
    checkpoint.phase = PHASES.REVIEW;
    checkpoint.conversationHistory.push({
      role: 'assistant',
      content: result.text || 'Pipeline abgeschlossen',
    });
    await saveCheckpoint(runId, checkpoint);

    // Mark run as completed
    await updateRunStatus(runId, 'completed', {
      progress: 100,
      currentStep: 'Indikation erstellt',
      completedAt: new Date(),
    });

    // Notify via SSE
    await publishCompletion(runId);

    // Collect generated document IDs from tool results
    const completedAgents = checkpoint.completedAgents;
    const generatedDocs: string[] = [];

    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        if (
          toolResult.toolName === 'generateIndication' &&
          typeof toolResult.output === 'object' &&
          toolResult.output !== null &&
          'documentId' in toolResult.output
        ) {
          generatedDocs.push((toolResult.output as { documentId: string }).documentId);
        }
      }
    }

    return {
      success: true,
      phase: 'complete',
      completedAgents,
      failedAgents: [],
      generatedDocuments: generatedDocs,
    };
  } catch (error) {
    // Handle AskUserInterrupt — graceful pause
    if (error instanceof AskUserInterrupt) {
      return {
        success: true,
        phase: 'waiting_for_user',
        completedAgents: checkpoint.completedAgents,
        failedAgents: [],
        generatedDocuments: [],
        checkpointId: runId,
      };
    }

    // Unexpected error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Orchestrator] Run ${runId} failed:`, error);

    await updateRunStatus(runId, 'failed', {
      currentStep: `Fehler: ${errorMessage}`,
    });

    await publishError(runId, errorMessage);

    return {
      success: false,
      phase: 'audit',
      completedAgents: checkpoint.completedAgents,
      failedAgents: [],
      generatedDocuments: [],
      error: errorMessage,
    };
  }
}

function createFreshCheckpoint(runId: string): OrchestratorCheckpoint {
  return {
    runId,
    phase: PHASES.AUDIT,
    completedAgents: [],
    agentResults: {},
    conversationHistory: [],
    collectedAnswers: {},
    pendingQuestion: null,
  };
}
