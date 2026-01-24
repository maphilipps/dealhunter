/**
 * RAG Tool for AI SDK (DEA-107)
 *
 * Allows agents to query the knowledge base for this RFP
 * via semantic search.
 */

import { tool } from 'ai';
import { z } from 'zod';

import { queryRAG } from '@/lib/rag/retrieval-service';

/**
 * Create a RAG tool scoped to a specific RFP
 *
 * Usage in agent:
 * ```typescript
 * const result = await streamText({
 *   model: 'claude-sonnet-4.5',
 *   tools: {
 *     queryRAG: createRagTool(rfpId),
 *   },
 *   prompt: 'Evaluate technical feasibility...'
 * });
 * ```
 */
export function createRagTool(rfpId: string) {
  return tool({
    description: `Search the knowledge base for information about this RFP.
    Use this tool to find:
    - Performance metrics (LCP, FID, CLS) from Quick Scan
    - Tech stack details (CMS, framework, libraries)
    - Content volume data (page count, content types)
    - Accessibility audit results
    - SEO audit findings
    - Navigation structure
    - Timeline estimates from other agents
    - Risk factors identified by other agents

    Examples:
    - "What is the website performance?" → Finds Quick Scan performance data
    - "How many content types exist?" → Finds Content Architecture data
    - "What are security risks?" → Finds RISK Agent findings
    - "What CMS is currently used?" → Finds Tech Stack data`,

    inputSchema: z.object({
      question: z
        .string()
        .describe('Natural language question about the RFP (e.g., "What is the current CMS?")'),
      techStackFilter: z
        .string()
        .optional()
        .describe('Optional: Filter by tech stack (e.g., "Drupal", "WordPress")'),
    }),

    execute: async ({
      question,
      techStackFilter,
    }: {
      question: string;
      techStackFilter?: string;
    }) => {
      const results = await queryRAG({
        preQualificationId: rfpId,
        question,
        techStackFilter,
        maxResults: 5,
      });

      if (results.length === 0) {
        return 'No relevant information found in knowledge base.';
      }

      // Format results for agent consumption
      return results
        .map(
          r =>
            `[${r.agentName}/${r.chunkType}] (${Math.round(r.similarity * 100)}% relevant)\n${r.content}`
        )
        .join('\n\n---\n\n');
    },
  });
}
