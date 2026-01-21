/**
 * Agent Orchestrator & Background Jobs
 *
 * Orchestrates Deep-Scan Agents for Phase 2 Lead Analysis:
 * 1. Full-Scan Agent (tech stack detection) - runs first
 * 2. Content Architecture + Migration Complexity + Accessibility - run in parallel
 *
 * Implements:
 * - Agent sequencing (Full-Scan first, then parallel agents)
 * - Background job tracking in backgroundJobs table
 * - Progress updates (0-100%)
 * - Error handling with retry logic
 * - Lead status updates (routed → full_scanning → bl_reviewing)
 * - Graceful degradation on individual agent failures
 */

import { eq } from 'drizzle-orm';

import { db } from '../db';
import { analyzeAccessibility, type AccessibilityAuditResult } from './accessibility-audit-agent';
import {
  analyzeContentArchitecture,
  type ContentArchitectureResult,
} from './content-architecture-agent';
import {
  analyzeMigrationComplexity,
  type MigrationComplexityResult,
} from './migration-complexity-agent';
import { leads, backgroundJobs } from '../db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrchestrationInput {
  leadId: string;
  websiteUrl: string;
  userId: string;
}

export interface OrchestrationResult {
  success: boolean;
  leadId: string;
  backgroundJobId: string;
  contentArchitecture?: ContentArchitectureResult;
  migrationComplexity?: MigrationComplexityResult;
  accessibility?: AccessibilityAuditResult;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run Deep-Scan Agents in sequence with background job tracking
 *
 * Workflow:
 * 1. Create background job record
 * 2. Update lead status to 'full_scanning'
 * 3. Run Full-Scan Agent (tech stack detection)
 * 4. Run Content/Migration/A11y Agents in parallel
 * 5. Update lead status to 'bl_reviewing'
 * 6. Mark background job as completed
 *
 * Graceful degradation: If individual agents fail, continue with others
 *
 * @param input - Lead ID, website URL, user ID
 * @returns Orchestration result with all agent outputs
 */
export async function runDeepScanAgents(input: OrchestrationInput): Promise<OrchestrationResult> {
  console.error(`[Orchestrator] Starting deep scan for lead ${input.leadId}`);

  const errors: string[] = [];
  let backgroundJobId: string | null = null;

  try {
    // Step 1: Create background job record
    backgroundJobId = await createBackgroundJob(input.leadId, input.userId);
    console.error(`[Orchestrator] Created background job: ${backgroundJobId}`);

    // Step 2: Update lead status to 'full_scanning'
    await updateLeadStatus(input.leadId, 'full_scanning');
    await updateJobProgress(backgroundJobId, 10, 'Starting Full-Scan Agent');

    // Step 3: Run Full-Scan Agent (tech stack detection)
    const fullScanResult = runFullScanAgent(input.websiteUrl);
    await updateJobProgress(backgroundJobId, 40, 'Full-Scan complete, starting parallel agents');

    if (!fullScanResult.success) {
      errors.push(`Full-Scan Agent failed: ${fullScanResult.error || 'Unknown error'}`);
      await completeBackgroundJob(backgroundJobId, 'failed', {
        errors,
        fullScanError: fullScanResult.error,
      });
      return {
        success: false,
        leadId: input.leadId,
        backgroundJobId,
        errors,
      };
    }

    // Step 4: Run Content/Migration/A11y Agents in parallel
    const parallelResults = await runParallelAgents(
      input.leadId,
      input.websiteUrl,
      fullScanResult,
      backgroundJobId
    );

    // Collect results and errors
    const contentArchitecture = parallelResults.contentArchitecture?.success
      ? parallelResults.contentArchitecture
      : undefined;
    const migrationComplexity = parallelResults.migrationComplexity?.success
      ? parallelResults.migrationComplexity
      : undefined;
    const accessibility = parallelResults.accessibility?.success
      ? parallelResults.accessibility
      : undefined;

    if (!parallelResults.contentArchitecture?.success) {
      errors.push(
        `Content Architecture Agent failed: ${parallelResults.contentArchitecture?.error || 'Unknown error'}`
      );
    }
    if (!parallelResults.migrationComplexity?.success) {
      errors.push(
        `Migration Complexity Agent failed: ${parallelResults.migrationComplexity?.error || 'Unknown error'}`
      );
    }
    if (!parallelResults.accessibility?.success) {
      errors.push(
        `Accessibility Agent failed: ${parallelResults.accessibility?.error || 'Unknown error'}`
      );
    }

    await updateJobProgress(backgroundJobId, 90, 'All agents complete, updating lead status');

    // Step 5: Update lead status to 'bl_reviewing'
    await updateLeadStatus(input.leadId, 'bl_reviewing');

    // Step 6: Mark background job as completed
    await completeBackgroundJob(backgroundJobId, 'completed', {
      contentArchitecture,
      migrationComplexity,
      accessibility,
      errors: errors.length > 0 ? errors : undefined,
    });

    await updateJobProgress(backgroundJobId, 100, 'Deep scan completed');

    console.error(`[Orchestrator] Deep scan completed for lead ${input.leadId}`);
    console.error(
      `[Orchestrator] Success: ${errors.length === 0}, Partial Success: ${errors.length > 0 && errors.length < 3}`
    );

    return {
      success: errors.length === 0,
      leadId: input.leadId,
      backgroundJobId,
      contentArchitecture,
      migrationComplexity,
      accessibility,
      errors,
    };
  } catch (error) {
    console.error('[Orchestrator] Fatal error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Orchestrator fatal error: ${errorMessage}`);

    if (backgroundJobId) {
      await completeBackgroundJob(backgroundJobId, 'failed', { errors });
    }

    return {
      success: false,
      leadId: input.leadId,
      backgroundJobId: backgroundJobId || 'unknown',
      errors,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run Full-Scan Agent (tech stack detection)
 *
 * This is a placeholder - the actual Full-Scan Agent will be implemented separately.
 * For now, we return mock data to test the orchestration flow.
 */
function runFullScanAgent(websiteUrl: string): {
  success: boolean;
  error?: string;
  homepage?: { url: string; title: string; description: string };
  samplePages?: string[];
  crawledAt: string;
  techStack?: {
    cms: string | null;
    cmsVersion: string | null;
    framework: string | null;
    backend: string | null;
    database: string | null;
    hosting: string | null;
    server: string | null;
    technologies: string[];
  };
} {
  console.error(`[Full-Scan Agent] Scanning ${websiteUrl}...`);

  try {
    // TODO: Implement actual Full-Scan Agent with Playwright
    // For now, return mock data
    return {
      success: true,
      homepage: {
        url: websiteUrl,
        title: 'Homepage',
        description: 'Homepage description',
      },
      samplePages: [
        websiteUrl,
        `${websiteUrl}/about`,
        `${websiteUrl}/contact`,
        `${websiteUrl}/services`,
      ],
      crawledAt: new Date().toISOString(),
      techStack: {
        cms: null,
        cmsVersion: null,
        framework: null,
        backend: null,
        database: null,
        hosting: null,
        server: null,
        technologies: [],
      },
    };
  } catch (error) {
    console.error('[Full-Scan Agent] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      crawledAt: new Date().toISOString(),
    };
  }
}

/**
 * Run Content Architecture, Migration Complexity, and Accessibility Agents in parallel
 *
 * Uses Promise.allSettled to ensure all agents run even if some fail.
 */
async function runParallelAgents(
  leadId: string,
  websiteUrl: string,
  fullScanResult: Awaited<ReturnType<typeof runFullScanAgent>>,
  backgroundJobId: string
): Promise<{
  contentArchitecture: ContentArchitectureResult;
  migrationComplexity: MigrationComplexityResult;
  accessibility: AccessibilityAuditResult;
}> {
  console.error('[Orchestrator] Running parallel agents...');

  // Run all agents in parallel
  const results = await Promise.allSettled([
    // Content Architecture Agent
    (async () => {
      await updateJobProgress(backgroundJobId, 50, 'Running Content Architecture Agent');
      return analyzeContentArchitecture({
        websiteUrl,
        crawlData: {
          homepage: fullScanResult.homepage,
          samplePages: fullScanResult.samplePages || [],
          crawledAt: fullScanResult.crawledAt,
        },
      });
    })(),

    // Migration Complexity Agent
    (async () => {
      await updateJobProgress(backgroundJobId, 60, 'Running Migration Complexity Agent');
      // First get content architecture result
      const contentArchResult = await analyzeContentArchitecture({
        websiteUrl,
        crawlData: {
          homepage: fullScanResult.homepage,
          samplePages: fullScanResult.samplePages || [],
          crawledAt: fullScanResult.crawledAt,
        },
      });

      return analyzeMigrationComplexity({
        websiteUrl,
        techStack: fullScanResult.techStack || {
          cms: null,
          cmsVersion: null,
          framework: null,
          backend: null,
          database: null,
          hosting: null,
          server: null,
          technologies: [],
        },
        contentArchitecture: contentArchResult,
      });
    })(),

    // Accessibility Agent
    (async () => {
      await updateJobProgress(backgroundJobId, 70, 'Running Accessibility Agent');
      return analyzeAccessibility({
        leadId,
        websiteUrl,
        sampleUrls: fullScanResult.samplePages || [websiteUrl],
      });
    })(),
  ]);

  // Extract results (fallback to error results if failed)
  const contentArchitecture: ContentArchitectureResult =
    results[0].status === 'fulfilled'
      ? results[0].value
      : {
          success: false,
          pageCount: 0,
          pageCountConfidence: 'low' as const,
          pageCountMethod: 'Agent failed',
          contentTypes: [],
          navigationStructure: { depth: 0, breadth: 0, mainNavItems: [] },
          siteTree: [],
          contentVolume: { images: 0, videos: 0, documents: 0, totalAssets: 0 },
          analyzedAt: new Date().toISOString(),
          error: results[0].status === 'rejected' ? String(results[0].reason) : 'Unknown error',
        };

  const migrationComplexity: MigrationComplexityResult =
    results[1].status === 'fulfilled'
      ? results[1].value
      : {
          success: false,
          complexityScore: 0,
          complexityCategory: 'low' as const,
          factors: [],
          risks: [],
          recommendations: [],
          analyzedAt: new Date().toISOString(),
          error: results[1].status === 'rejected' ? String(results[1].reason) : 'Unknown error',
        };

  const accessibility: AccessibilityAuditResult =
    results[2].status === 'fulfilled'
      ? results[2].value
      : {
          success: false,
          wcagLevel: 'AA' as const,
          accessibilityScore: 0,
          violations: [],
          issueCount: 0,
          estimatedFixHours: 0,
          pagesAudited: 0,
          analyzedAt: new Date().toISOString(),
          error: results[2].status === 'rejected' ? String(results[2].reason) : 'Unknown error',
        };

  return {
    contentArchitecture,
    migrationComplexity,
    accessibility,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create background job record
 */
async function createBackgroundJob(leadId: string, userId: string): Promise<string> {
  const [job] = await db
    .insert(backgroundJobs)
    .values({
      jobType: 'deep-analysis',
      rfpId: null, // This is a lead-based job, not RFP
      userId,
      status: 'running',
      progress: 0,
      currentStep: 'Initializing deep scan',
      startedAt: new Date(),
    })
    .returning();

  return job.id;
}

/**
 * Update background job progress
 */
async function updateJobProgress(
  jobId: string,
  progress: number,
  currentStep: string
): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({
      progress,
      currentStep,
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, jobId));

  console.error(`[Orchestrator] Progress ${progress}%: ${currentStep}`);
}

/**
 * Mark background job as completed or failed
 */
async function completeBackgroundJob(
  jobId: string,
  status: 'completed' | 'failed',
  result: {
    contentArchitecture?: ContentArchitectureResult;
    migrationComplexity?: MigrationComplexityResult;
    accessibility?: AccessibilityAuditResult;
    errors?: string[];
    fullScanError?: string;
  }
): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({
      status,
      progress: status === 'completed' ? 100 : undefined,
      result: JSON.stringify(result),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, jobId));

  console.error(`[Orchestrator] Background job ${status}: ${jobId}`);
}

/**
 * Update lead status
 */
async function updateLeadStatus(
  leadId: string,
  status: 'full_scanning' | 'bl_reviewing'
): Promise<void> {
  await db
    .update(leads)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  console.error(`[Orchestrator] Lead status updated to: ${status}`);
}
