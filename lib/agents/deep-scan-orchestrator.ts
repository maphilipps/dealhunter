/**
 * Deep Scan Orchestrator (DEA-145)
 *
 * Orchestrates parallel execution of all 13 section analysis agents.
 * Each agent performs deep analysis for their respective section and stores results in RAG.
 *
 * Features:
 * - Parallel agent execution with Promise.allSettled for error isolation
 * - Progress tracking (X/13 agents completed)
 * - Status updates on Lead entity
 * - Results stored in RAG embeddings for later retrieval
 * - Web research integration for data enrichment
 */

import { eq } from 'drizzle-orm';

import { analyzeComponents } from '@/lib/agents/component-library-agent';
import { runCostsAgent } from '@/lib/agents/costs-agent';
import { runCustomerResearchAgent } from '@/lib/agents/customer-research-agent';
import { runDecisionAgent } from '@/lib/agents/decision-agent';
import { runHostingAgent } from '@/lib/agents/hosting-agent';
import { runIntegrationsAgent } from '@/lib/agents/integrations-agent';
import { runLegalCheckAgent } from '@/lib/agents/legal-check-agent';
import { runReferencesAgent } from '@/lib/agents/references-agent';
import { db } from '@/lib/db';
import { qualifications, qualificationSectionData, dealEmbeddings } from '@/lib/db/schema';
import { QUALIFICATION_NAVIGATION_SECTIONS } from '@/lib/qualifications/navigation-config';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

/**
 * Agent execution result
 */
export interface AgentResult {
  sectionId: string;
  sectionLabel: string;
  status: 'success' | 'error';
  content?: unknown; // Agent-specific structured data
  confidence?: number; // 0-100
  sources?: string[]; // Source URLs or references
  error?: string;
  executionTimeMs: number;
}

/**
 * Deep scan progress tracking
 */
export interface DeepScanProgress {
  leadId: string;
  totalAgents: number;
  completedAgents: number;
  successfulAgents: number;
  failedAgents: number;
  results: AgentResult[];
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
}

/**
 * Individual section agent interface
 * Each agent analyzes one section and returns structured data
 */
export type SectionAgent = (
  leadId: string,
  preQualificationId: string
) => Promise<{
  content: unknown;
  confidence: number;
  sources?: string[];
}>;

/**
 * Agent Registry - Maps section IDs to their analysis agents
 *
 * NOTE: Agents are stubs for now - will be implemented incrementally
 * Each agent should:
 * 1. Query RAG for existing Pre-Qualification data
 * 2. Perform section-specific analysis
 * 3. Optionally trigger web research if confidence is low
 * 4. Return structured data for the section
 */
const AGENT_REGISTRY: Record<string, SectionAgent> = {
  overview: async (leadId, preQualificationId) => {
    // DEA-140 Phase 2.1: Customer Research Agent
    const result = await runCustomerResearchAgent(leadId, preQualificationId);
    return {
      content: {
        companyProfile: result.companyProfile,
        decisionMakers: result.decisionMakers,
        itLandscape: result.itLandscape,
        news: result.news,
        summary: result.summary,
        recommendedApproach: result.recommendedApproach,
        leadId,
        preQualificationId,
      },
      confidence: result.confidence,
      sources: result.dataSources,
    };
  },

  technology: async (leadId, preQualificationId) => {
    // TODO: Implement TechnologyAgent
    return Promise.resolve({
      content: { techStack: [], currentCMS: null, leadId, preQualificationId },
      confidence: 50,
      sources: [],
    });
  },

  'website-analysis': async (leadId, preQualificationId) => {
    // Fetch lead data to get website URL
    const leadData = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, leadId))
      .limit(1);

    if (!leadData[0]?.websiteUrl) {
      return {
        content: {
          error: 'No website URL available for analysis',
          leadId,
          preQualificationId,
        },
        confidence: 0,
        sources: [],
      };
    }

    const websiteUrl = leadData[0].websiteUrl;

    // Run component library analysis
    const componentAnalysis = await analyzeComponents({
      leadId,
      preQualificationId,
      websiteUrl,
      maxDepth: 2,
      maxPages: 10,
    });

    // TODO: Add other website analysis agents (performance, SEO, etc.)
    // For now, component library is the main analysis

    return {
      content: {
        components: componentAnalysis.components,
        totalComponents: componentAnalysis.totalComponents,
        pagesAnalyzed: componentAnalysis.pagesAnalyzed,
        leadId,
        preQualificationId,
      },
      confidence: componentAnalysis.confidence,
      sources: componentAnalysis.sources,
    };
  },

  'cms-architecture': async (leadId, preQualificationId) => {
    // TODO: Implement CMSArchitectureAgent
    return Promise.resolve({
      content: { contentTypes: [], architecture: null, leadId, preQualificationId },
      confidence: 50,
      sources: [],
    });
  },

  'cms-comparison': async (leadId, preQualificationId) => {
    // TODO: Implement CMSComparisonAgent
    return Promise.resolve({
      content: { options: [], recommendation: null, leadId, preQualificationId },
      confidence: 50,
      sources: [],
    });
  },

  hosting: async (leadId, preQualificationId) => {
    // Phase 2.4: Hosting Agent with Azure recommendations
    const result = await runHostingAgent(leadId, preQualificationId);
    return {
      content: {
        currentInfrastructure: result.currentInfrastructure,
        recommendation: result.recommendation,
        alternatives: result.alternatives,
        requirements: result.requirements,
        migrationRisk: result.migrationRisk,
        leadId,
        preQualificationId,
      },
      confidence: result.confidence,
      sources: [],
    };
  },

  integrations: async (leadId, preQualificationId) => {
    // Phase 2.5: Integrations Agent with system landscape
    const result = await runIntegrationsAgent(leadId, preQualificationId);
    return {
      content: {
        integrations: result.integrations,
        systemLandscape: result.systemLandscape,
        summary: result.summary,
        integrationRisks: result.integrationRisks,
        recommendations: result.recommendations,
        leadId,
        preQualificationId,
      },
      confidence: result.confidence,
      sources: [],
    };
  },

  migration: async (leadId, preQualificationId) => {
    // TODO: Implement MigrationAgent
    return Promise.resolve({
      content: { strategy: null, risks: [], mitigation: [], leadId, preQualificationId },
      confidence: 50,
      sources: [],
    });
  },

  staffing: async (leadId, preQualificationId) => {
    // TODO: Implement StaffingAgent
    return Promise.resolve({
      content: { timeline: null, resources: [], leadId, preQualificationId },
      confidence: 50,
      sources: [],
    });
  },

  references: async (leadId, preQualificationId) => {
    // DEA-150: References Agent with 2-factor scoring
    const result = await runReferencesAgent(leadId, preQualificationId);
    return {
      content: {
        recommendations: result.recommendations,
        summary: result.summary,
        selectionCriteria: result.selectionCriteria,
        totalReferencesScanned: result.totalReferencesScanned,
        topMatchesCount: result.topMatchesCount,
        avgMatchScore: result.avgMatchScore,
        leadId,
        preQualificationId,
      },
      confidence: result.avgMatchScore,
      sources: [],
    };
  },

  legal: async (leadId, preQualificationId) => {
    // DEA-149: Legal Check Agent with industry-specific compliance
    const result = await runLegalCheckAgent(leadId, preQualificationId);
    return {
      content: {
        gdprCompliance: result.gdprCompliance,
        germanLaw: result.germanLaw,
        industrySpecific: result.industrySpecific,
        overallRiskLevel: result.overallRiskLevel,
        complianceScore: result.complianceScore,
        criticalIssues: result.criticalIssues,
        recommendations: result.recommendations,
        leadId,
        preQualificationId,
      },
      confidence: result.complianceScore,
      sources: [],
    };
  },

  costs: async (leadId, preQualificationId) => {
    // Phase 2.3: Costs Agent with PT Calculator integration
    const result = await runCostsAgent(leadId, preQualificationId);
    return {
      content: {
        totalHours: result.totalHours,
        totalPT: result.totalPT,
        totalCost: result.totalCost,
        costBreakdown: result.costBreakdown,
        budgetFit: result.budgetFit,
        featureCosts: result.featureCosts,
        roi: result.roi,
        assumptions: result.assumptions,
        leadId,
        preQualificationId,
      },
      confidence: result.confidence,
      sources: [],
    };
  },

  decision: async (leadId, preQualificationId) => {
    // DEA-152 Phase 2.2: Decision Agent with BID/NO-BID aggregation
    const result = await runDecisionAgent(leadId, preQualificationId);
    return {
      content: {
        recommendation: result.recommendation,
        confidenceScore: result.confidenceScore,
        executiveSummary: result.executiveSummary,
        categories: result.categories,
        reasoning: result.reasoning,
        leadId,
        preQualificationId,
      },
      confidence: result.confidenceScore,
      sources: [],
    };
  },
};

/**
 * Execute a single section agent with error handling and timing
 */
async function executeSectionAgent(
  sectionId: string,
  sectionLabel: string,
  leadId: string,
  preQualificationId: string
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const agent = AGENT_REGISTRY[sectionId];
    if (!agent) {
      throw new Error(`No agent found for section: ${sectionId}`);
    }

    // Execute agent
    const result = await agent(leadId, preQualificationId);

    // Store result in qualificationSectionData for caching
    await db.insert(qualificationSectionData).values({
      qualificationId: leadId,
      sectionId,
      content: JSON.stringify(result.content),
      confidence: result.confidence,
      sources: result.sources ? JSON.stringify(result.sources) : null,
    });

    // Store in RAG for semantic retrieval
    const chunkText = `Section: ${sectionLabel}\n\n${JSON.stringify(result.content, null, 2)}`;

    // Generate embedding using the batch function (for single item)
    const chunks = [
      {
        chunkIndex: 0,
        content: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
        metadata: {
          startPosition: 0,
          endPosition: chunkText.length,
          type: 'section' as const,
        },
      },
    ];
    const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

    if (chunksWithEmbeddings && chunksWithEmbeddings.length > 0) {
      await db.insert(dealEmbeddings).values({
        preQualificationId: preQualificationId,
        agentName: `deep-scan-${sectionId}`,
        chunkType: 'analysis',
        chunkIndex: 0,
        content: chunkText,
        embedding: chunksWithEmbeddings[0].embedding,
        metadata: JSON.stringify({
          sectionId,
          qualificationId: leadId,
          confidence: result.confidence,
          sources: result.sources,
        }),
      });
    }

    return {
      sectionId,
      sectionLabel,
      status: 'success',
      content: result.content,
      confidence: result.confidence,
      sources: result.sources,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[Deep Scan] Agent ${sectionId} failed:`, error);

    return {
      sectionId,
      sectionLabel,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Run deep scan for a lead
 *
 * Executes all 13 section agents in parallel and tracks progress.
 * Updates lead.deepScanStatus throughout execution.
 *
 * @param leadId - Lead ID to analyze
 * @returns Deep scan progress with all agent results
 */
export async function runDeepScan(leadId: string): Promise<DeepScanProgress> {
  const startTime = new Date();

  try {
    // 1. Get Lead and Pre-Qualification ID
    const leadData = await db.select().from(qualifications).where(eq(qualifications.id, leadId));

    if (leadData.length === 0) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const lead = leadData[0];
    const preQualificationId = lead.preQualificationId;

    // 2. Update status to 'running'
    await db
      .update(qualifications)
      .set({
        deepScanStatus: 'running',
        deepScanStartedAt: startTime,
      })
      .where(eq(qualifications.id, leadId));

    // 3. Execute all agents in parallel
    const agentPromises = QUALIFICATION_NAVIGATION_SECTIONS.map(section =>
      executeSectionAgent(section.id, section.label, leadId, preQualificationId)
    );

    const results = await Promise.allSettled(agentPromises);

    // 4. Process results
    const agentResults: AgentResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Promise was rejected (shouldn't happen with our error handling, but just in case)
        const section = QUALIFICATION_NAVIGATION_SECTIONS[index];
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason || 'Promise rejected');
        return {
          sectionId: section.id,
          sectionLabel: section.label,
          status: 'error',
          error: errorMessage,
          executionTimeMs: 0,
        };
      }
    });

    const successfulAgents = agentResults.filter(r => r.status === 'success').length;
    const failedAgents = agentResults.filter(r => r.status === 'error').length;

    // 5. Determine final status
    const finalStatus =
      failedAgents === 0
        ? 'completed'
        : failedAgents < agentResults.length
          ? 'completed'
          : 'failed';

    // 6. Update lead with final status
    await db
      .update(qualifications)
      .set({
        deepScanStatus: finalStatus,
        deepScanCompletedAt: new Date(),
      })
      .where(eq(qualifications.id, leadId));

    // 7. Return progress
    const progress: DeepScanProgress = {
      leadId,
      totalAgents: agentResults.length,
      completedAgents: agentResults.length,
      successfulAgents,
      failedAgents,
      results: agentResults,
      startedAt: startTime,
      completedAt: new Date(),
      status: finalStatus,
    };

    // Log completion summary (allowed: warn/error)
    if (failedAgents > 0) {
      console.warn(
        `[Deep Scan] Completed for lead ${leadId}: ${successfulAgents}/${agentResults.length} agents successful, ${failedAgents} failed`
      );
    }

    return progress;
  } catch (error) {
    console.error(`[Deep Scan] Fatal error for lead ${leadId}:`, error);

    // Update lead status to failed
    await db
      .update(qualifications)
      .set({
        deepScanStatus: 'failed',
        deepScanCompletedAt: new Date(),
      })
      .where(eq(qualifications.id, leadId));

    throw error;
  }
}

/**
 * Get deep scan progress for a lead
 *
 * Checks current deepScanStatus and returns progress information
 *
 * @param leadId - Lead ID
 * @returns Current progress or null if not started
 */
export async function getDeepScanProgress(leadId: string): Promise<DeepScanProgress | null> {
  const leadData = await db
    .select({
      deepScanStatus: qualifications.deepScanStatus,
      deepScanStartedAt: qualifications.deepScanStartedAt,
      deepScanCompletedAt: qualifications.deepScanCompletedAt,
    })
    .from(qualifications)
    .where(eq(qualifications.id, leadId));

  if (leadData.length === 0 || leadData[0].deepScanStatus === 'pending') {
    return null;
  }

  const lead = leadData[0];

  // Get all section data
  const sectionResults = await db
    .select()
    .from(qualificationSectionData)
    .where(eq(qualificationSectionData.qualificationId, leadId));

  const agentResults: AgentResult[] = sectionResults.map(section => {
    const parsedContent: unknown = JSON.parse(section.content);
    const parsedSources: string[] | undefined = section.sources
      ? (JSON.parse(section.sources) as string[])
      : undefined;

    return {
      sectionId: section.sectionId,
      sectionLabel:
        QUALIFICATION_NAVIGATION_SECTIONS.find(s => s.id === section.sectionId)?.label ||
        section.sectionId,
      status: 'success' as const,
      content: parsedContent,
      confidence: section.confidence || undefined,
      sources: parsedSources,
      executionTimeMs: 0, // Not tracked retroactively
    };
  });

  return {
    leadId,
    totalAgents: QUALIFICATION_NAVIGATION_SECTIONS.length,
    completedAgents: agentResults.length,
    successfulAgents: agentResults.length,
    failedAgents: 0,
    results: agentResults,
    startedAt: lead.deepScanStartedAt || new Date(),
    completedAt: lead.deepScanCompletedAt || undefined,
    status: lead.deepScanStatus as 'running' | 'completed' | 'failed',
  };
}
