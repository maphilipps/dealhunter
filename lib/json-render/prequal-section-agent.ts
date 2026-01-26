import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import { createBatchRagWriteTool, createVisualizationWriteTool } from '@/lib/agent-tools';
import { modelNames, defaultSettings } from '@/lib/ai/config';
import { getOpenAIProvider } from '@/lib/ai/providers';
import { webSearchTool, fetchUrlTool } from '@/lib/agent-tools/tools/web-search';
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';
import { getPreQualSectionQueryTemplate } from '@/lib/pre-qualifications/section-queries';

const jsonRenderTreeSchema = z.object({
  root: z.string().nullable(),
  elements: z.record(
    z.string(),
    z.object({
      key: z.string(),
      type: z.string(),
      props: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
    })
  ),
});

const SECTION_UI_SYSTEM_PROMPT = `You generate JsonRenderTree UI for a pre-qualification section.
Only use these components: Grid, ResultCard, Section, BulletList, Paragraph, KeyValue, Metric, ProgressBar, ScoreCard.

Rules:
- Root must be a Grid.
- Only Grid, ResultCard, Section can have children.
- Always include a Document-based answer section with clear source labeling ("Quelle: Dokumente").
- If web enrichment is used, include a separate section labeled "Quelle: Websuche" with URLs.
- Do NOT mix web-enriched content into the document answer.
- Be explicit about missing data.
`; 

export async function runPreQualSectionAgent(input: {
  preQualificationId: string;
  sectionId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, sectionId, allowWebEnrichment } = input;

  const sectionQuery = getPreQualSectionQueryTemplate(sectionId);
  if (!sectionQuery) {
    return { success: false, error: `No query template for section ${sectionId}` };
  }

  const queryDocuments = tool({
    description: 'Query only the provided documents (raw chunks) for relevant information.',
    inputSchema: z.object({
      query: z.string(),
      topK: z.number().min(1).max(20).default(8),
    }),
    execute: async ({ query, topK }: { query: string; topK: number }) => {
      const chunks = await queryRawChunks(preQualificationId, query, topK);
      if (chunks.length === 0) {
        return {
          found: false,
          context: 'Keine relevanten Informationen in den Dokumenten gefunden.',
          chunks: [],
        };
      }
      return {
        found: true,
        context: formatRAGContext(chunks),
        chunks: chunks.map(c => ({ text: c.text, score: c.score })),
      };
    },
  });

  const storeVisualization = createVisualizationWriteTool({
    preQualificationId,
    agentName: 'prequal_section_agent',
  });

  const storeFindingsBatch = createBatchRagWriteTool({
    preQualificationId,
    agentName: 'prequal_section_agent',
  });

  const complete = tool({
    description: 'Finalize the section generation.',
    inputSchema: z.object({ success: z.boolean() }),
    execute: async ({ success }: { success: boolean }) => ({ success }),
  });

  const agent = new ToolLoopAgent({
    model: getOpenAIProvider()(modelNames.default),
    instructions: [
      SECTION_UI_SYSTEM_PROMPT,
      'Use queryDocuments first to gather document-only context.',
      allowWebEnrichment
        ? 'Web enrichment is allowed. If you use webSearch/fetchUrl, keep it in a separate section with source URLs.'
        : 'Do NOT use webSearch or fetchUrl. Only use document context.',
      'Persist findings via storeFindingsBatch with chunkType matching the sectionId.',
      'Finally call storeVisualization with a JsonRenderTree.',
    ].join('\n'),
    tools: {
      queryDocuments,
      webSearch: webSearchTool,
      fetchUrl: fetchUrlTool,
      storeFindingsBatch,
      storeVisualization,
      complete,
    },
    stopWhen: [stepCountIs(20), hasToolCall('storeVisualization')],
  });

  const prompt = `Section: ${sectionId}
Question focus: ${sectionQuery}

Generate a visualization answering the question set. Use only documents unless enrichment is explicitly used.
`;

  try {
    await agent.generate({
      prompt,
      maxOutputTokens: defaultSettings.deterministic.maxTokens,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
