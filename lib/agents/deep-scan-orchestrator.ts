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

import { db } from '@/lib/db';
import { leads, leadSectionData, rfpEmbeddings } from '@/lib/db/schema';
import { LEAD_NAVIGATION_SECTIONS } from '@/lib/leads/navigation-config';
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
  rfpId: string
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
 * 1. Query RAG for existing RFP data
 * 2. Perform section-specific analysis
 * 3. Optionally trigger web research if confidence is low
 * 4. Return structured data for the section
 */
const AGENT_REGISTRY: Record<string, SectionAgent> = {
  overview: async (leadId, rfpId) => {
    // TODO: Implement OverviewAgent (DEA-147+)
    return Promise.resolve({
      content: { summary: 'Overview analysis placeholder', leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  technology: async (leadId, rfpId) => {
    // TODO: Implement TechnologyAgent
    return Promise.resolve({
      content: { techStack: [], currentCMS: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  'website-analysis': async (leadId, rfpId) => {
    // TODO: Implement WebsiteAnalysisAgent
    return Promise.resolve({
      content: { performance: null, seo: null, accessibility: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  'cms-architecture': async (leadId, rfpId) => {
    // TODO: Implement CMSArchitectureAgent
    return Promise.resolve({
      content: { contentTypes: [], architecture: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  'cms-comparison': async (leadId, rfpId) => {
    // TODO: Implement CMSComparisonAgent
    return Promise.resolve({
      content: { options: [], recommendation: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  hosting: async (leadId, rfpId) => {
    // TODO: Implement HostingAgent
    return Promise.resolve({
      content: { currentInfra: null, recommendation: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  integrations: async (leadId, rfpId) => {
    // TODO: Implement IntegrationsAgent
    return Promise.resolve({
      content: { integrations: [], systemLandscape: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  migration: async (leadId, rfpId) => {
    // TODO: Implement MigrationAgent
    return Promise.resolve({
      content: { strategy: null, risks: [], mitigation: [], leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  staffing: async (leadId, rfpId) => {
    // TODO: Implement StaffingAgent
    return Promise.resolve({
      content: { timeline: null, resources: [], leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  references: async (leadId, rfpId) => {
    // TODO: Implement ReferencesAgent
    return Promise.resolve({
      content: { recommendations: [], reasoning: [], leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  legal: async (leadId, rfpId) => {
    // TODO: Implement LegalAgent
    return Promise.resolve({
      content: { compliance: [], risks: [], leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  costs: async (leadId, rfpId) => {
    // TODO: Implement CostAgent
    return Promise.resolve({
      content: { budget: null, features: [], roi: null, leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },

  decision: async (leadId, rfpId) => {
    // TODO: Implement DecisionAgent (aggregates all other sections)
    return Promise.resolve({
      content: { recommendation: null, pros: [], cons: [], leadId, rfpId },
      confidence: 50,
      sources: [],
    });
  },
};

/**
 * Execute a single section agent with error handling and timing
 */
async function executeSectionAgent(
  sectionId: string,
  sectionLabel: string,
  leadId: string,
  rfpId: string
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const agent = AGENT_REGISTRY[sectionId];
    if (!agent) {
      throw new Error(`No agent found for section: ${sectionId}`);
    }

    // Execute agent
    const result = await agent(leadId, rfpId);

    // Store result in leadSectionData for caching
    await db.insert(leadSectionData).values({
      leadId,
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
      await db.insert(rfpEmbeddings).values({
        rfpId,
        agentName: `deep-scan-${sectionId}`,
        chunkType: 'analysis',
        chunkIndex: 0,
        content: chunkText,
        embedding: JSON.stringify(chunksWithEmbeddings[0].embedding),
        metadata: JSON.stringify({
          sectionId,
          leadId,
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
    // 1. Get Lead and RFP ID
    const leadData = await db.select().from(leads).where(eq(leads.id, leadId));

    if (leadData.length === 0) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const lead = leadData[0];
    const rfpId = lead.rfpId;

    // 2. Update status to 'running'
    await db
      .update(leads)
      .set({
        deepScanStatus: 'running',
        deepScanStartedAt: startTime,
      })
      .where(eq(leads.id, leadId));

    // 3. Execute all agents in parallel
    const agentPromises = LEAD_NAVIGATION_SECTIONS.map(section =>
      executeSectionAgent(section.id, section.label, leadId, rfpId)
    );

    const results = await Promise.allSettled(agentPromises);

    // 4. Process results
    const agentResults: AgentResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Promise was rejected (shouldn't happen with our error handling, but just in case)
        const section = LEAD_NAVIGATION_SECTIONS[index];
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
      .update(leads)
      .set({
        deepScanStatus: finalStatus,
        deepScanCompletedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

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
      .update(leads)
      .set({
        deepScanStatus: 'failed',
        deepScanCompletedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

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
      deepScanStatus: leads.deepScanStatus,
      deepScanStartedAt: leads.deepScanStartedAt,
      deepScanCompletedAt: leads.deepScanCompletedAt,
    })
    .from(leads)
    .where(eq(leads.id, leadId));

  if (leadData.length === 0 || leadData[0].deepScanStatus === 'pending') {
    return null;
  }

  const lead = leadData[0];

  // Get all section data
  const sectionResults = await db
    .select()
    .from(leadSectionData)
    .where(eq(leadSectionData.leadId, leadId));

  const agentResults: AgentResult[] = sectionResults.map(section => {
    const parsedContent: unknown = JSON.parse(section.content);
    const parsedSources: string[] | undefined = section.sources
      ? (JSON.parse(section.sources) as string[])
      : undefined;

    return {
      sectionId: section.sectionId,
      sectionLabel:
        LEAD_NAVIGATION_SECTIONS.find(s => s.id === section.sectionId)?.label || section.sectionId,
      status: 'success' as const,
      content: parsedContent,
      confidence: section.confidence || undefined,
      sources: parsedSources,
      executionTimeMs: 0, // Not tracked retroactively
    };
  });

  return {
    leadId,
    totalAgents: LEAD_NAVIGATION_SECTIONS.length,
    completedAgents: agentResults.length,
    successfulAgents: agentResults.length,
    failedAgents: 0,
    results: agentResults,
    startedAt: lead.deepScanStartedAt || new Date(),
    completedAt: lead.deepScanCompletedAt || undefined,
    status: lead.deepScanStatus as 'running' | 'completed' | 'failed',
  };
}
