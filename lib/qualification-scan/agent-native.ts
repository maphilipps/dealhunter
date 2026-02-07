import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import type { QualificationScanInput, QualificationScanResult } from './agent';
import {
  extendedQualificationScan2Schema,
  type ContentVolume,
  type TechStack,
  type Features,
  type BLRecommendation,
  type NavigationStructure,
  type AccessibilityAudit,
  type SEOAudit,
  type LegalCompliance,
  type PerformanceIndicators,
  type Screenshots,
  type CompanyIntelligence,
  type ContentTypeDistribution,
  type MigrationComplexity,
  type DecisionMakersResearch,
} from './schema';
import {
  registry,
  wrapRegistryTools,
  createRagWriteTool,
  createBatchRagWriteTool,
  createVisualizationWriteTool,
} from '../agent-tools';
import type { ToolContext } from '../agent-tools';
import type { WrapOptions } from '../agent-tools/ai-sdk-bridge';
import { buildAgentContext, formatContextForPrompt } from '../agent-tools/context-builder';
import { modelNames, defaultSettings, AI_TIMEOUTS } from '../ai/config';
import { getProviderForSlot } from '../ai/providers';

const completionSchema = extendedQualificationScan2Schema.extend({
  rawScanData: z.any().optional(),
  multiPageAnalysis: z.any().optional(),
});

type QualificationScanCompletion = z.infer<typeof completionSchema>;
/** @deprecated Use QualificationScanCompletion */
type LeadScanCompletion = QualificationScanCompletion;

function buildToolContext(context: Awaited<ReturnType<typeof buildAgentContext>>): ToolContext {
  return {
    userId: context.user.id,
    userRole: context.user.role,
    userEmail: context.user.email,
    userName: context.user.name,
    businessUnitId: context.user.businessUnitId,
  };
}

export async function runQualificationScanAgentNative(
  input: QualificationScanInput,
  options?: {
    onActivity?: (entry: { timestamp: string; action: string; details?: string }) => void;
  }
): Promise<QualificationScanResult> {
  if (!input.userId) {
    throw new Error('QualificationScan requires a userId for agent-native execution');
  }

  const activityLog: QualificationScanResult['activityLog'] = [];
  const logActivity = (action: string, details?: string) => {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    activityLog.push(entry);
    options?.onActivity?.(entry);
  };

  const mode = input.mode ?? 'full';

  const agentContext = await buildAgentContext(input.userId);
  const toolContext = buildToolContext(agentContext);
  const contextSection = formatContextForPrompt(agentContext);

  const listTools = tool({
    description: 'List available tools and their descriptions for QualificationScan.',
    inputSchema: z.object({
      category: z.string().optional(),
    }),
    execute: async ({ category }) => {
      const tools = registry.list(category);
      return tools.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
      }));
    },
  });

  // Direct tools with proper Zod schemas (replaces meta-tool "runTool")
  const wrapOptions: WrapOptions = {
    onExecute: toolName => {
      logActivity(`Tool start: ${toolName}`);
    },
    onResult: (toolName, _result, durationMs) => {
      logActivity(`Tool complete: ${toolName}`, `Duration: ${durationMs}ms`);
    },
  };

  // Core qualification scan tools
  const coreToolNames = [
    'qualificationScan.tech_stack_analyze',
    'qualificationScan.content_volume',
    'qualificationScan.features_detect',
    'qualificationScan.playwright_audit',
    'qualificationScan.seo_audit',
    'qualificationScan.legal_compliance',
    'qualificationScan.company_intelligence',
    'qualificationScan.content_classify',
    'qualificationScan.migration_analyze_ai',
    'qualificationScan.recommend_business_line',
    // Scan primitives
    'scan.webSearch',
    'scan.fetchUrl',
    'scan.rag.query',
  ];

  // Research tools only in full mode
  if (mode !== 'qualification') {
    coreToolNames.push('research.decisionMakers', 'research.contacts.quick');
  }

  const registryTools = wrapRegistryTools(coreToolNames, toolContext, wrapOptions);

  const completeQualificationScan = tool({
    description:
      'Finalize the qualifications scan. Call this once after collecting all required fields.',
    inputSchema: completionSchema,
    execute: async (payload: QualificationScanCompletion) => {
      return { success: true, payload };
    },
  });

  const tools = {
    listTools,
    ...registryTools,
    completeQualificationScan,
    ...(input.preQualificationId
      ? {
          storeFinding: createRagWriteTool({
            preQualificationId: input.preQualificationId,
            agentName: 'qualification_scan',
          }),
          storeFindingsBatch: createBatchRagWriteTool({
            preQualificationId: input.preQualificationId,
            agentName: 'qualification_scan',
          }),
          storeVisualization: createVisualizationWriteTool({
            preQualificationId: input.preQualificationId,
            agentName: 'qualification_scan',
          }),
        }
      : {}),
  };

  const agent = new ToolLoopAgent({
    model: (await getProviderForSlot('default'))(modelNames.default),
    instructions: [
      'You are the QualificationScan agent. Use tools to gather facts and then call completeQualificationScan.',
      'Follow agent-native rules: use tools for actions, do not invent data.',
      'Required outputs: techStack, contentVolume, features, blRecommendation.',
      mode === 'qualification'
        ? 'Qualification mode: only produce required outputs. Skip contact/decision-maker research and external people lookup.'
        : 'Optional outputs to include when possible: navigationStructure, accessibilityAudit, seoAudit, legalCompliance, performanceIndicators, screenshots, companyIntelligence, contentTypes, migrationComplexity, decisionMakers.',
      mode === 'qualification'
        ? 'Do NOT use research.* tools.'
        : 'Always attempt contacts via research.decisionMakers and research.contacts.quick.',
      'Use scan.webSearch and scan.fetchUrl for external research when needed.',
      'Use scan.rag.query to reuse existing findings for this prequalification.',
      'Call tools directly by name (e.g. qualificationScan.tech_stack_analyze, qualificationScan.content_volume).',
      'Use Bid ID for qualificationScan.playwright_audit when available.',
      'Tool results follow { success, data, error }.',
      'Record references by calling storeFinding or storeFindingsBatch when available.',
    ].join('\n'),
    tools,
    stopWhen: [stepCountIs(25), hasToolCall('completeQualificationScan')],
  });

  logActivity('QualificationScan agent started', `URL: ${input.websiteUrl}`);

  const prompt = [
    `Website URL: ${input.websiteUrl}`,
    input.bidId ? `Bid ID: ${input.bidId}` : 'Bid ID: none',
    input.extractedRequirements
      ? `Extracted requirements: ${JSON.stringify(input.extractedRequirements)}`
      : 'Extracted requirements: none',
    '',
    'Call tools to gather data. Use listTools if you need to discover additional tools. Then call completeQualificationScan.',
    '',
    contextSection ? `Context:\n${contextSection}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // AbortController für externes Timeout-Handling
  const controller = new AbortController();
  const TOTAL_TIMEOUT_MS = AI_TIMEOUTS.QUICK_SCAN_TOTAL;
  const STEP_TIMEOUT_MS = AI_TIMEOUTS.QUICK_SCAN_STEP;
  const timeoutId = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

  let result;
  try {
    result = await agent.generate({
      prompt,
      abortSignal: controller.signal,
      timeout: {
        totalMs: TOTAL_TIMEOUT_MS,
        stepMs: STEP_TIMEOUT_MS,
      },
      onStepFinish: stepResult => {
        const toolNames =
          stepResult.toolCalls
            ?.filter((t): t is NonNullable<typeof t> => t != null)
            .map(t => t.toolName)
            .join(', ') || 'none';
        logActivity('Step completed', `Tools: ${toolNames}`);
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    // Timeout-Fehler anreichern
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `QualificationScan Timeout: Agent hat nach ${TOTAL_TIMEOUT_MS / 1000}s nicht geantwortet`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const completion = result.steps
    .flatMap(step => step.toolCalls ?? [])
    .filter((call): call is NonNullable<typeof call> => call != null)
    .find(call => call.toolName === 'completeQualificationScan');

  if (!completion || !('input' in completion)) {
    throw new Error('QualificationScan agent did not call completeQualificationScan');
  }

  const payload = completion.input as QualificationScanCompletion;

  const output: QualificationScanResult = {
    techStack: payload.techStack,
    contentVolume: payload.contentVolume,
    features: payload.features,
    blRecommendation: payload.blRecommendation,
    navigationStructure: payload.navigationStructure,
    accessibilityAudit: payload.accessibilityAudit,
    seoAudit: payload.seoAudit,
    legalCompliance: payload.legalCompliance,
    performanceIndicators: payload.performanceIndicators,
    screenshots: payload.screenshots,
    companyIntelligence: payload.companyIntelligence,
    contentTypes: payload.contentTypes,
    migrationComplexity: payload.migrationComplexity,
    decisionMakers: payload.decisionMakers,
    rawScanData: payload.rawScanData as Record<string, unknown> | undefined,
    multiPageAnalysis: payload.multiPageAnalysis as QualificationScanResult['multiPageAnalysis'],
    activityLog,
  };

  logActivity('QualificationScan agent completed');
  return output;
}

/** @deprecated Use runQualificationScanAgentNative */
export const runLeadScanAgentNative = runQualificationScanAgentNative;
