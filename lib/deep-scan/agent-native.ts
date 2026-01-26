import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import { registry } from '@/lib/agent-tools';
import type { ToolContext } from '@/lib/agent-tools';
import { buildAgentContext, formatContextForPrompt } from '@/lib/agent-tools/context-builder';
import { getOpenAIProvider } from '@/lib/ai/providers';
import { defaultSettings, modelNames } from '@/lib/ai/config';
import { saveCheckpoint, saveError, type DeepScanPhase } from '@/lib/deep-scan/checkpoint';
import { EXPERT_TO_SECTIONS } from '@/lib/deep-scan/section-expert-mapping';

const completionSchema = z.object({
  completedExperts: z.array(z.string()).default([]),
  failedExperts: z.array(z.string()).default([]),
  sectionConfidences: z.record(z.string(), z.number()).default({}),
});

type DeepScanCompletion = z.infer<typeof completionSchema>;

const DEFAULT_EXPERTS = [
  'scraper',
  'tech',
  'website',
  'performance',
  'architecture',
  'hosting',
  'integrations',
  'migration',
  'project',
  'costs',
  'decision',
];

function buildToolContext(context: Awaited<ReturnType<typeof buildAgentContext>>): ToolContext {
  return {
    userId: context.user.id,
    userRole: context.user.role,
    userEmail: context.user.email,
    userName: context.user.name,
    businessUnitId: context.user.businessUnitId,
  };
}

export async function runDeepScanAgentNative(
  input: {
    leadId: string;
    websiteUrl: string;
    userId: string;
    selectedExperts?: string[];
    completedExperts?: string[];
  },
  options?: {
    onProgress?: (state: {
      progress: number;
      currentExpert: string | null;
      completedExperts: string[];
      failedExperts: string[];
      sectionConfidences: Record<string, number>;
    }) => void;
    onActivity?: (entry: { timestamp: string; action: string; details?: string }) => void;
  }
): Promise<DeepScanCompletion> {
  const activityLog: Array<{ timestamp: string; action: string; details?: string }> = [];
  const logActivity = (action: string, details?: string) => {
    const entry = { timestamp: new Date().toISOString(), action, details };
    activityLog.push(entry);
    options?.onActivity?.(entry);
  };

  const agentContext = await buildAgentContext(input.userId);
  const toolContext = buildToolContext(agentContext);
  const contextSection = formatContextForPrompt(agentContext);

  const expectedExperts = input.selectedExperts?.length
    ? Array.from(new Set(['scraper', ...input.selectedExperts]))
    : DEFAULT_EXPERTS;
  const allowedExperts = new Set(input.selectedExperts ?? []);

  const completedSet = new Set(input.completedExperts ?? []);
  const failedSet = new Set<string>();
  const sectionConfidences: Record<string, number> = {};

  const emitProgress = (currentExpert: string | null) => {
    const total = expectedExperts.length;
    const completedCount = completedSet.size + failedSet.size;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    options?.onProgress?.({
      progress,
      currentExpert,
      completedExperts: Array.from(completedSet),
      failedExperts: Array.from(failedSet),
      sectionConfidences,
    });
  };

  const listTools = tool({
    description: 'List available DeepScan tools and their descriptions.',
    inputSchema: z.object({ category: z.string().optional() }),
    execute: async ({ category }) => {
      const tools = registry.list(category);
      return tools.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
      }));
    },
  });

  const runTool = tool({
    description: 'Run a tool by name with the provided input.',
    inputSchema: z.object({
      name: z.string(),
      input: z.any(),
    }),
    execute: async ({ name, input: toolInput }) => {
      const expertMatch = name.startsWith('scan.runExpert.')
        ? name.replace('scan.runExpert.', '')
        : null;
      const isScraper = name === 'scan.scrapeSite';
      const progressName = expertMatch ?? (isScraper ? 'scraper' : name);

      logActivity(`Tool start: ${name}`);
      emitProgress(progressName);

      if (expertMatch && input.selectedExperts?.length && !allowedExperts.has(expertMatch)) {
        const error = `Expert ${expertMatch} not selected for this run`;
        logActivity(`Tool skipped: ${name}`, error);
        return { success: false, error };
      }

      const result = await registry.execute(name, toolInput, toolContext);

      if (expertMatch || isScraper) {
        const expertName = isScraper ? 'scraper' : expertMatch!;
        const success = Boolean((result as { success?: boolean })?.success);

        if (success) {
          completedSet.add(expertName);
          const phase: DeepScanPhase = ['project', 'costs', 'decision'].includes(expertName)
            ? 'phase3'
            : 'phase2';
          await saveCheckpoint(input.leadId, expertName, true, phase);

          if (expertMatch && EXPERT_TO_SECTIONS[expertName]) {
            for (const sectionId of EXPERT_TO_SECTIONS[expertName]) {
              sectionConfidences[sectionId] =
                (result as { data?: { confidence?: number } })?.data?.confidence ?? 50;
            }
          }
        } else {
          const errorMessage =
            (result as { error?: string })?.error || `Expert ${expertName} failed`;
          failedSet.add(expertName);
          await saveError(input.leadId, errorMessage, 'phase2');
        }
      }

      emitProgress(expertMatch || (isScraper ? 'scraper' : null));
      logActivity(`Tool complete: ${name}`);
      return result;
    },
  });

  const completeDeepScan = tool({
    description: 'Finalize the deep scan after all experts are complete.',
    inputSchema: completionSchema,
    execute: async (payload: DeepScanCompletion) => {
      return { success: true, payload };
    },
  });

  const agent = new ToolLoopAgent({
    model: getOpenAIProvider().chat(modelNames.default),
    instructions: [
      'You are the DeepScan agent. Use tools to gather data, then call completeDeepScan.',
      'Follow agent-native rules: use tools for actions, do not invent data.',
      'Use scan.scrapeSite if RAG lacks scraped data.',
      'Run each expert via scan.runExpert.<name>.',
      'Use scan.rag.query and scan.webSearch when data is missing.',
      'After experts finish, call scan.cacheAuditPages to ensure UI caches are updated.',
      'Finally call completeDeepScan with completedExperts, failedExperts, sectionConfidences.',
    ].join('\n'),
    tools: { listTools, runTool, completeDeepScan },
    stopWhen: [stepCountIs(200), hasToolCall('completeDeepScan')],
  });

  logActivity('DeepScan agent started', `URL: ${input.websiteUrl}`);

  const prompt = [
    `Lead ID: ${input.leadId}`,
    `Website URL: ${input.websiteUrl}`,
    input.selectedExperts?.length
      ? `Selected experts: ${input.selectedExperts.join(', ')}`
      : `Experts: ${expectedExperts.join(', ')}`,
    completedSet.size > 0 ? `Completed experts: ${Array.from(completedSet).join(', ')}` : '',
    '',
    'Use listTools to discover available tools. Then run tools to complete the deep scan.',
    contextSection ? `Context:\n${contextSection}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  let result;
  try {
    result = await agent.generate({
      prompt,
    });
  } catch (error) {
    console.error('[DeepScan Agent] generate failed:', error);
    throw error;
  }

  const completion = result.steps
    .flatMap(step => step.toolCalls)
    .find(call => call.toolName === 'completeDeepScan');

  if (!completion || !('input' in completion)) {
    throw new Error('DeepScan agent did not call completeDeepScan');
  }

  const payload = completion.input as DeepScanCompletion;

  return {
    completedExperts: payload.completedExperts.length
      ? payload.completedExperts
      : Array.from(completedSet),
    failedExperts: payload.failedExperts.length ? payload.failedExperts : Array.from(failedSet),
    sectionConfidences:
      Object.keys(payload.sectionConfidences).length > 0
        ? payload.sectionConfidences
        : sectionConfidences,
  };
}
