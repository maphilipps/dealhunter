import { eq, and, desc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

export type ExpertAgentName =
  | 'timing_expert'
  | 'deliverables_expert'
  | 'techstack_expert'
  | 'legal_rfp_expert'
  | 'summary_expert';

export interface AgentResultRow {
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date | null;
}

/**
 * Get the latest result from a specific expert agent
 */
export async function getAgentResult(
  preQualificationId: string,
  agentName: ExpertAgentName
): Promise<AgentResultRow | null> {
  const results = await db
    .select({
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
      createdAt: dealEmbeddings.createdAt,
    })
    .from(dealEmbeddings)
    .where(
      and(eq(dealEmbeddings.preQualificationId, preQualificationId), eq(dealEmbeddings.agentName, agentName))
    )
    .orderBy(desc(dealEmbeddings.createdAt))
    .limit(1);

  if (results.length === 0) return null;

  const row = results[0];
  let metadata: Record<string, unknown> | null = null;

  if (row.metadata) {
    try {
      metadata =
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : (row.metadata as Record<string, unknown>);
    } catch {
      metadata = null;
    }
  }

  return {
    content: row.content,
    metadata,
    createdAt: row.createdAt,
  };
}

/**
 * Check if expert agents have been run for an Pre-Qualification
 */
export async function hasExpertAgentResults(preQualificationId: string): Promise<boolean> {
  const result = await getAgentResult(preQualificationId, 'summary_expert');
  return result !== null;
}

/**
 * Get all expert agent results for an Pre-Qualification
 */
export async function getAllAgentResults(
  preQualificationId: string
): Promise<Record<ExpertAgentName, AgentResultRow | null>> {
  const agents: ExpertAgentName[] = [
    'timing_expert',
    'deliverables_expert',
    'techstack_expert',
    'legal_rfp_expert',
    'summary_expert',
  ];

  const results = await Promise.all(
    agents.map(async name => [name, await getAgentResult(preQualificationId, name)] as const)
  );

  return Object.fromEntries(results) as Record<ExpertAgentName, AgentResultRow | null>;
}
