import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import type { QuickScanInput, QuickScanResult } from './agent';
import {
  extendedQuickScan2Schema,
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
import { registry, createRagWriteTool, createBatchRagWriteTool, createVisualizationWriteTool } from '../agent-tools';
import type { ToolContext } from '../agent-tools';
import { buildAgentContext, formatContextForPrompt } from '../agent-tools/context-builder';
import { modelNames, defaultSettings } from '../ai/config';
import { getProviderForSlot } from '../ai/providers';

const completionSchema = extendedQuickScan2Schema.extend({
  rawScanData: z.any().optional(),
  multiPageAnalysis: z.any().optional(),
});

type QuickScanCompletion = z.infer<typeof completionSchema>;

function buildToolContext(context: Awaited<ReturnType<typeof buildAgentContext>>): ToolContext {
  return {
    userId: context.user.id,
    userRole: context.user.role,
    userEmail: context.user.email,
    userName: context.user.name,
    businessUnitId: context.user.businessUnitId,
  };
}

export async function runQuickScanAgentNative(
  input: QuickScanInput,
  options?: {
    onActivity?: (entry: { timestamp: string; action: string; details?: string }) => void;
  }
): Promise<QuickScanResult> {
  if (!input.userId) {
    throw new Error('QuickScan requires a userId for agent-native execution');
  }

  const activityLog: QuickScanResult['activityLog'] = [];
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
    description: 'List available tools and their descriptions for QuickScan.',
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

  const runTool = tool({
    description:
      'Run a tool by name with the provided input. Use this for all atomic QuickScan actions.',
    inputSchema: z.object({
      name: z.string(),
      input: z.record(z.string(), z.any()),
    }),
    execute: async ({ name, input: toolInput }) => {
      if (mode === 'qualification' && name.startsWith('research.')) {
        const error = `Tool ${name} is disabled in qualification mode.`;
        logActivity(`Tool skipped: ${name}`, error);
        return { success: false, error };
      }
      const start = Date.now();
      logActivity(`Tool start: ${name}`);
      const result = await registry.execute(name, toolInput, toolContext);
      const duration = Date.now() - start;
      logActivity(`Tool complete: ${name}`, `Duration: ${duration}ms`);
      return result;
    },
  });

  const completeQuickScan = tool({
    description:
      'Finalize the quick scan. Call this once after collecting all required fields.',
    inputSchema: completionSchema,
    execute: async (payload: QuickScanCompletion) => {
      return { success: true, payload };
    },
  });

  const tools: Record<string, unknown> = {
    listTools,
    runTool,
    completeQuickScan,
  };

  if (input.preQualificationId) {
    tools.storeFinding = createRagWriteTool({
      preQualificationId: input.preQualificationId,
      agentName: 'quick_scan',
    });
    tools.storeFindingsBatch = createBatchRagWriteTool({
      preQualificationId: input.preQualificationId,
      agentName: 'quick_scan',
    });
    tools.storeVisualization = createVisualizationWriteTool({
      preQualificationId: input.preQualificationId,
      agentName: 'quick_scan',
    });
  }

  const agent = new ToolLoopAgent({
    model: getProviderForSlot('default')(modelNames.default),
    instructions: [
      'You are the QuickScan agent. Use tools to gather facts and then call completeQuickScan.',
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
      'Use runTool with these core tools when relevant:',
      '- scan.quickscan.techStack.analyze',
      '- scan.quickscan.content.volume',
      '- scan.quickscan.features.detect',
      '- scan.quickscan.playwright.audit',
      '- scan.quickscan.seo.audit',
      '- scan.quickscan.legal.compliance',
      '- scan.quickscan.company.intelligence',
      '- scan.quickscan.content.classify',
      '- scan.quickscan.migration.analyzeAI',
      '- scan.quickscan.recommendBusinessLine',
      ...(mode === 'qualification' ? [] : ['- research.decisionMakers', '- research.contacts.quick']),
      'Use Bid ID for scan.quickscan.playwright.audit when available.',
      'Tool results follow { success, data, error }.',
      'Record references by calling storeFinding or storeFindingsBatch when available.',
    ].join('\n'),
    tools,
    stopWhen: [stepCountIs(25), hasToolCall('completeQuickScan')],
  });

  logActivity('QuickScan agent started', `URL: ${input.websiteUrl}`);

  const prompt = [
    `Website URL: ${input.websiteUrl}`,
    input.bidId ? `Bid ID: ${input.bidId}` : 'Bid ID: none',
    input.extractedRequirements
      ? `Extracted requirements: ${JSON.stringify(input.extractedRequirements)}`
      : 'Extracted requirements: none',
    '',
    'Use listTools to discover tools. Run tools to gather data. Then call completeQuickScan.',
    '',
    contextSection ? `Context:\n${contextSection}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await agent.generate({
    prompt,
    maxOutputTokens: defaultSettings.deterministic.maxTokens,
  });

  const completion = result.steps
    .flatMap(step => step.toolCalls)
    .find(call => call.toolName === 'completeQuickScan');

  if (!completion || !('input' in completion)) {
    throw new Error('QuickScan agent did not call completeQuickScan');
  }

  const payload = completion.input as QuickScanCompletion;

  const output: QuickScanResult = {
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
    multiPageAnalysis: payload.multiPageAnalysis as QuickScanResult['multiPageAnalysis'],
    activityLog,
  };

  logActivity('QuickScan agent completed');
  return output;
}
