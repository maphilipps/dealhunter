// ═══════════════════════════════════════════════════════════════════════════════
// QUICK SCAN WORKFLOW AGENT - Powered by WorkflowEngine
// New implementation using the Workflow 2.0 architecture
// ═══════════════════════════════════════════════════════════════════════════════

import type { QuickScanResult } from './agent';
import type {
  TechStack,
  ContentVolume,
  Features,
  BLRecommendation,
  NavigationStructure,
  AccessibilityAudit,
  SEOAudit,
  LegalCompliance,
  PerformanceIndicators,
  Screenshots,
  CompanyIntelligence,
  ContentTypeDistribution,
  MigrationComplexity,
  DecisionMakersResearch,
} from './schema';
import { checkAndSuggestUrl } from './tools/url-suggestion-agent';
import { WorkflowEngine } from './workflow/engine';
import { quickScanSteps } from './workflow/steps';
import type { QuickScanInput } from './workflow/types';

import { buildAgentContext, formatContextForPrompt } from '@/lib/agent-tools/context-builder';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Re-export for backwards compatibility
export type { QuickScanInput, QuickScanResult };

/**
 * Quick Scan using the new Workflow 2.0 Engine
 *
 * This is the new implementation that uses:
 * - DAG-based dependency resolution for maximum parallelization
 * - Automatic STEP_START/STEP_COMPLETE events for all tools
 * - Consistent error handling with optional step support
 *
 * @example
 * ```ts
 * const result = await runQuickScanWorkflow(
 *   { bidId: '123', websiteUrl: 'https://example.com' },
 *   (event) => console.log(event)
 * );
 * ```
 */
export async function runQuickScanWorkflow(
  input: QuickScanInput,
  emit: EventEmitter
): Promise<QuickScanResult> {
  const activityLog: QuickScanResult['activityLog'] = [];

  const logActivity = (action: string, details?: string) => {
    activityLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  };

  // Load user context if available
  let contextSection: string | undefined;
  if (input.userId) {
    try {
      const context = await buildAgentContext(input.userId);
      contextSection = formatContextForPrompt(context);
    } catch {
      // Context loading is optional
    }
  }

  // Helper to emit progress
  const emitThought = (agent: string, thought: string, details?: string) => {
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent,
        message: thought,
        details,
      },
    });
    logActivity(thought, details);
  };

  try {
    emitThought('Quick Scan Workflow', `Starte Quick Scan Analyse...`, `URL: ${input.websiteUrl}`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRE-CHECK: URL Reachability (Fast-Fail before expensive operations)
    // ═══════════════════════════════════════════════════════════════════════════════
    emitThought('Website Crawler', `Prüfe URL-Erreichbarkeit...`);
    const urlCheck = await checkAndSuggestUrl(input.websiteUrl);

    // Emit URL check result
    emit({
      type: AgentEventType.URL_CHECK,
      data: {
        originalUrl: input.websiteUrl,
        finalUrl: urlCheck.finalUrl,
        reachable: urlCheck.reachable,
        statusCode: urlCheck.statusCode,
        redirectChain: urlCheck.redirectChain,
      },
    });

    if (!urlCheck.reachable) {
      if (urlCheck.suggestedUrl) {
        emit({
          type: AgentEventType.URL_SUGGESTION,
          data: {
            originalUrl: input.websiteUrl,
            suggestedUrl: urlCheck.suggestedUrl,
            reason: urlCheck.reason || 'URL nicht erreichbar',
          },
        });
        throw new Error(
          `Website nicht erreichbar: ${urlCheck.reason}. Vorgeschlagene URL: ${urlCheck.suggestedUrl}`
        );
      }
      throw new Error(`Website nicht erreichbar: ${urlCheck.reason}`);
    }

    // Use the final URL (after redirects)
    const fullUrl = urlCheck.finalUrl;

    if (urlCheck.redirectChain && urlCheck.redirectChain.length > 1) {
      emitThought(
        'Website Crawler',
        `URL wurde weitergeleitet`,
        `${input.websiteUrl} → ${fullUrl}`
      );
    } else {
      emitThought('Website Crawler', `URL erreichbar (${urlCheck.statusCode || 'OK'})`, fullUrl);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXECUTE WORKFLOW ENGINE
    // ═══════════════════════════════════════════════════════════════════════════════
    const engine = new WorkflowEngine({
      steps: quickScanSteps,
      emit,
      contextSection,
    });

    const workflowResult = await engine.execute(input, fullUrl);

    // ═══════════════════════════════════════════════════════════════════════════════
    // BUILD RESULT FROM WORKFLOW OUTPUT
    // ═══════════════════════════════════════════════════════════════════════════════
    const getResult = <T>(stepId: string): T | undefined => {
      const result = workflowResult.results.get(stepId);
      return result?.success ? (result.output as T) : undefined;
    };

    // Extract results from workflow
    const techStack = getResult<TechStack>('techStack');
    const contentVolume = getResult<ContentVolume>('contentVolume');
    const features = getResult<Features>('features');
    const blRecommendation = getResult<BLRecommendation>('recommendBusinessLine');

    // Validate required fields
    if (!techStack || !contentVolume || !features || !blRecommendation) {
      const missing: string[] = [];
      if (!techStack) missing.push('techStack');
      if (!contentVolume) missing.push('contentVolume');
      if (!features) missing.push('features');
      if (!blRecommendation) missing.push('blRecommendation');
      throw new Error(`Workflow fehlgeschlagen: Fehlende Ergebnisse: ${missing.join(', ')}`);
    }

    // Extract optional results
    const playwrightResult = getResult<{
      screenshots: Screenshots | null;
      accessibility: AccessibilityAudit | null;
      navigation: NavigationStructure | null;
      performance: PerformanceIndicators | null;
    }>('playwrightAudit');

    const companyIntelligence = getResult<CompanyIntelligence>('companyIntelligence');
    const seoAudit = getResult<SEOAudit>('seoAudit');
    const legalCompliance = getResult<LegalCompliance>('legalCompliance');
    const contentTypes = getResult<ContentTypeDistribution>('contentClassification');
    const migrationComplexity = getResult<MigrationComplexity>('migrationComplexity');
    const decisionMakers = getResult<DecisionMakersResearch>('decisionMakers');

    // Emit completion
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Quick Scan Workflow',
        result: { status: 'completed', duration: workflowResult.duration },
      },
    });

    emitThought(
      'Quick Scan Workflow',
      `Analyse abgeschlossen in ${Math.round(workflowResult.duration / 1000)}s`,
      `Business Line: ${blRecommendation.primaryBusinessLine}`
    );

    return {
      techStack,
      contentVolume,
      features,
      blRecommendation,
      // Optional playwright results
      navigationStructure: playwrightResult?.navigation ?? undefined,
      accessibilityAudit: playwrightResult?.accessibility ?? undefined,
      performanceIndicators: playwrightResult?.performance ?? undefined,
      screenshots: playwrightResult?.screenshots ?? undefined,
      // Optional analysis results
      seoAudit: seoAudit ?? undefined,
      legalCompliance: legalCompliance ?? undefined,
      companyIntelligence: companyIntelligence ?? undefined,
      // QuickScan 2.0 fields
      contentTypes: contentTypes ?? undefined,
      migrationComplexity: migrationComplexity ?? undefined,
      decisionMakers: decisionMakers ?? undefined,
      // Multi-Page Analysis placeholder (not yet in workflow)
      multiPageAnalysis: {
        pagesAnalyzed: 1,
        analyzedUrls: [fullUrl],
        detectionMethod: 'wappalyzer' as const,
        analysisTimestamp: new Date().toISOString(),
      },
      activityLog,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    logActivity('Quick Scan Workflow fehlgeschlagen', errorMsg);

    emitThought('Error', 'Quick Scan Workflow Fehler aufgetreten', errorMsg);

    emit({
      type: AgentEventType.ERROR,
      data: {
        message: errorMsg,
        code: 'QUICK_SCAN_WORKFLOW_ERROR',
      },
    });
    throw error;
  }
}
