/**
 * Section Visualization Agent
 *
 * Agent-native visualization generator that creates JsonRenderTree
 * from RAG chunks for a specific section, considering project context.
 */
import { and, eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';

import { QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT } from './quick-scan-catalog';

import { AI_HUB_API_KEY, AI_HUB_BASE_URL } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

const openai = new OpenAI({
  apiKey: AI_HUB_API_KEY,
  baseURL: AI_HUB_BASE_URL,
});

interface JsonRenderTree {
  root: string | null;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
}

interface RagChunk {
  content: string;
  confidence: number;
  chunkType: string;
  agentName: string;
}

interface ProjectContext {
  customerName: string;
  websiteUrl?: string | null;
  industry?: string | null;
  projectDescription?: string | null;
}

interface GenerateVisualizationInput {
  pitchId: string;
  sectionId: string;
  ragChunks: RagChunk[];
  projectContext: ProjectContext;
  refinementPrompt?: string;
}

interface GenerateVisualizationResult {
  success: boolean;
  visualizationTree?: JsonRenderTree;
  confidence?: number;
  error?: string;
}

function parseJsonlPatches(jsonl: string): JsonRenderTree {
  const tree: JsonRenderTree = {
    root: null,
    elements: {},
  };

  const lines = jsonl.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const patch = JSON.parse(line);

      if (patch.op === 'set' && patch.path === '/root') {
        tree.root = patch.value;
      } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
        const key = patch.path.replace('/elements/', '');
        tree.elements[key] = patch.value;
      }
    } catch (_e) {
      console.warn('[SectionVizAgent] Failed to parse JSONL line:', line.substring(0, 100));
    }
  }

  return tree;
}

/**
 * Generate a visualization for a section based on RAG data and project context
 */
export async function generateSectionVisualization(
  input: GenerateVisualizationInput
): Promise<GenerateVisualizationResult> {
  const { pitchId, sectionId, ragChunks, projectContext, refinementPrompt } = input;

  console.log(
    `[SectionVizAgent] Generating visualization for ${sectionId}, chunks: ${ragChunks.length}`
  );

  // Build RAG context summary
  const ragSummary = ragChunks
    .map(chunk => {
      const parsed = tryParseJson(chunk.content);
      if (parsed) {
        return `[${chunk.agentName}/${chunk.chunkType}] (${chunk.confidence}% confidence):\n${JSON.stringify(parsed, null, 2)}`;
      }
      return `[${chunk.agentName}/${chunk.chunkType}] (${chunk.confidence}% confidence):\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  // Build project context string
  const projectContextStr = `
PROJECT CONTEXT:
- Customer: ${projectContext.customerName}
- Website: ${projectContext.websiteUrl || 'N/A'}
- Industry: ${projectContext.industry || 'N/A'}
- Project Goal: ${projectContext.projectDescription || 'Not specified'}
`.trim();

  // Build user prompt
  let userPrompt = `Generate a comprehensive visualization for the "${sectionId}" section.

${projectContextStr}

RAG DATA FOR THIS SECTION:
${ragSummary}

Create a well-organized visualization that:
1. Highlights the most important findings for this section
2. Uses appropriate components for the data types
3. Groups related information logically
4. Shows confidence levels where relevant

IMPORTANT: Create MULTIPLE Sections or ResultCards (NOT one giant Section wrapping everything):
- Separate Section for each topic (e.g., "Tech Stack", "Features", "Content Analysis")
- Example: Grid → [Section "Tech Stack", Section "Features", Section "Content"]
- Do NOT put everything inside a single Section/ResultCard`;

  // Add refinement prompt if provided
  if (refinementPrompt) {
    userPrompt += `

USER REFINEMENT REQUEST:
${refinementPrompt}

Please adjust the visualization according to the user's request while maintaining data accuracy.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse JSONL response
    const tree = parseJsonlPatches(responseText);

    if (!tree.root || Object.keys(tree.elements).length === 0) {
      console.error('[SectionVizAgent] Invalid tree generated, response:', responseText);
      return {
        success: false,
        error: 'Die KI konnte keine gültige Visualisierung generieren',
      };
    }

    // Calculate average confidence from RAG chunks
    const avgConfidence = Math.round(
      ragChunks.reduce((sum, c) => sum + c.confidence, 0) / ragChunks.length
    );

    // Store the visualization in the database
    await storeVisualization(pitchId, sectionId, tree, avgConfidence);

    console.log(
      `[SectionVizAgent] Generated visualization with ${Object.keys(tree.elements).length} elements`
    );

    return {
      success: true,
      visualizationTree: tree,
      confidence: avgConfidence,
    };
  } catch (error) {
    console.error('[SectionVizAgent] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Store visualization in the database, replacing any existing one
 */
async function storeVisualization(
  pitchId: string,
  sectionId: string,
  tree: JsonRenderTree,
  confidence: number
): Promise<void> {
  // Delete existing visualization for this section
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.pitchId, pitchId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      )
    );

  // Insert new visualization
  await db.insert(dealEmbeddings).values({
    pitchId,
    preQualificationId: null,
    agentName: 'section_visualization_agent',
    chunkType: 'visualization',
    chunkIndex: 0,
    chunkCategory: 'elaboration',
    content: JSON.stringify(tree),
    confidence,
    embedding: null,
    metadata: JSON.stringify({
      sectionId,
      isVisualization: true,
      elementCount: Object.keys(tree.elements).length,
      generatedAt: new Date().toISOString(),
    }),
  });
}

function tryParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
