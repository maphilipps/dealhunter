import { eq, and, like, isNotNull } from 'drizzle-orm';

import type { AuditAgentOutput, AuditSection } from './types';
import {
  techExpertToVisualization,
  websiteExpertToVisualization,
  decisionExpertToVisualization,
  architectureExpertToVisualization,
  hostingExpertToVisualization,
  migrationExpertToVisualization,
  costsExpertToVisualization,
  integrationsExpertToVisualization,
  projectExpertToVisualization,
  genericSectionToVisualization,
} from '../output-to-json-render';

import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { dealEmbeddings, qualificationSectionData } from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

/**
 * Generate visualization for a section based on agent type and content
 */
function generateVisualizationForSection(
  agentName: string,
  section: AuditSection,
  allSections: AuditSection[]
): unknown {
  try {
    // Skip if visualization already exists
    if (section.visualization) {
      return section.visualization;
    }

    const content = section.content;

    // Tech Expert
    if (agentName === 'audit_tech_expert') {
      if (section.slug === 'tech-stack') {
        // Find CMS deep dive if it exists
        const cmsDeepDive = allSections.find(s => s.slug === 'cms-deepdive');
        return techExpertToVisualization(content as any, cmsDeepDive?.content as any);
      }
      if (section.slug === 'cms-deepdive') {
        // CMS deep dive is included in tech-stack visualization
        return null;
      }
    }

    // Website Expert
    if (agentName === 'audit_website_expert') {
      return websiteExpertToVisualization(content as any);
    }

    // Architecture Expert
    if (agentName === 'audit_architecture_expert') {
      return architectureExpertToVisualization(content as any);
    }

    // Hosting Expert
    if (agentName === 'audit_hosting_expert') {
      return hostingExpertToVisualization(content as any);
    }

    // Integrations Expert
    if (agentName === 'audit_integrations_expert') {
      return integrationsExpertToVisualization(content as any);
    }

    // Migration Expert
    if (agentName === 'audit_migration_expert') {
      return migrationExpertToVisualization(content as any);
    }

    // Project Expert
    if (agentName === 'audit_project_expert') {
      return projectExpertToVisualization(content as any);
    }

    // Costs Expert
    if (agentName === 'audit_costs_expert') {
      return costsExpertToVisualization(content as any);
    }

    // Decision Expert - handle specific sections
    if (agentName === 'audit_decision_expert') {
      if (section.slug === 'recommendation') {
        const decisionContent = content as {
          recommendation?: string;
          confidence?: number;
          reasoning?: string;
        };
        // Find pros and cons sections
        const prosSection = allSections.find(s => s.slug === 'pros');
        const consSection = allSections.find(s => s.slug === 'cons');
        const nextStepsSection = allSections.find(s => s.slug === 'next-steps');

        const pros = Array.isArray(prosSection?.content)
          ? (prosSection.content as Array<{ point: string }>).map(p => p.point)
          : [];
        const cons = Array.isArray(consSection?.content)
          ? (consSection.content as Array<{ point: string }>).map(c => c.point)
          : [];
        const nextSteps = Array.isArray(nextStepsSection?.content)
          ? (nextStepsSection.content as Array<{ action: string }>).map(s => s.action)
          : [];

        return decisionExpertToVisualization({
          recommendation:
            (decisionContent.recommendation as 'BID' | 'NO-BID' | 'CONDITIONAL') || 'CONDITIONAL',
          confidence: decisionContent.confidence || 50,
          reasoning: decisionContent.reasoning || '',
          pros,
          cons,
          nextSteps,
        });
      }
      // Other decision sections don't need separate visualizations
      return null;
    }

    // Fallback: generic visualization
    return genericSectionToVisualization(section.title, content);
  } catch (error) {
    console.error(`[Visualization] Error generating for ${agentName}/${section.slug}:`, error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// Query RAG for lead data using vector similarity search
export async function queryLeadRag(
  qualificationId: string,
  query: string,
  agentFilter?: string,
  maxResults = 10
): Promise<{ content: string; metadata: unknown; similarity?: number }[]> {
  console.log(
    `[RAG] queryLeadRag called: qualificationId=${qualificationId}, query="${query.slice(0, 50)}...", filter=${agentFilter || 'none'}`
  );

  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);

  if (!queryEmbedding) {
    console.log('[RAG] WARNING: No query embedding generated - check OPENAI_EMBEDDING_API_KEY');
  }

  // Build where condition
  const baseCondition = agentFilter
    ? and(
        eq(dealEmbeddings.qualificationId, qualificationId),
        like(dealEmbeddings.agentName, `%${agentFilter}%`)
      )
    : eq(dealEmbeddings.qualificationId, qualificationId);

  // If we have a query embedding, do vector search
  if (queryEmbedding) {
    // Fetch all candidates with embeddings
    const candidates = await db
      .select({
        content: dealEmbeddings.content,
        metadata: dealEmbeddings.metadata,
        embedding: dealEmbeddings.embedding,
      })
      .from(dealEmbeddings)
      .where(and(baseCondition, isNotNull(dealEmbeddings.embedding)));

    console.log(
      `[RAG] Found ${candidates.length} candidates with embeddings for lead ${qualificationId}`
    );

    // Calculate similarity scores and sort
    const scored = candidates
      .map(r => {
        let similarity = 0;
        if (r.embedding) {
          similarity = cosineSimilarity(queryEmbedding, r.embedding);
        }
        return {
          content: r.content,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
          similarity,
        };
      })
      .filter(r => r.similarity > 0.2) // Minimum similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    // If we found good matches, return them
    if (scored.length > 0) {
      console.log(
        `[RAG] Vector search found ${scored.length} results for "${query.slice(0, 50)}..." (best: ${scored[0].similarity.toFixed(3)})`
      );
      return scored;
    }

    // Fallback: no good matches, return top results anyway (lower threshold)
    console.log(`[RAG] No high-confidence matches, falling back to lower threshold`);
    const fallback = candidates
      .map(r => {
        let similarity = 0;
        if (r.embedding) {
          similarity = cosineSimilarity(queryEmbedding, r.embedding);
        }
        return {
          content: r.content,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
          similarity,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    return fallback;
  }

  // Fallback: no embedding available, return recent entries
  console.log(`[RAG] No query embedding available, falling back to non-vector search`);
  const results = await db
    .select({
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
    })
    .from(dealEmbeddings)
    .where(baseCondition)
    .limit(maxResults);

  return results.map(r => ({
    content: r.content,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }));
}

// Convert structured data to human-readable text for RAG
function convertToReadableText(data: unknown, indent = 0): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);

  const prefix = '  '.repeat(indent);

  if (Array.isArray(data)) {
    return data
      .map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          return `${prefix}${i + 1}. ${convertToReadableText(item, indent + 1)}`;
        }
        return `${prefix}- ${convertToReadableText(item, indent)}`;
      })
      .join('\n');
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const lines: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();
      const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

      if (typeof value === 'object' && value !== null) {
        lines.push(`${prefix}${capitalizedLabel}:`);
        lines.push(convertToReadableText(value, indent + 1));
      } else {
        lines.push(`${prefix}${capitalizedLabel}: ${convertToReadableText(value, indent)}`);
      }
    }
    return lines.join('\n');
  }

  return typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data);
}

export function buildAuditSectionId(category: string, slug: string): string {
  return `audit:${category}:${slug}`;
}

async function upsertAuditSectionCache(params: {
  qualificationId: string;
  sectionId: string;
  content: string;
  confidence?: number | null;
  sources?: string[] | null;
}) {
  const { qualificationId, sectionId, content, confidence, sources } = params;

  const [existing] = await db
    .select({ id: qualificationSectionData.id })
    .from(qualificationSectionData)
    .where(
      and(
        eq(qualificationSectionData.qualificationId, qualificationId),
        eq(qualificationSectionData.sectionId, sectionId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(qualificationSectionData)
      .set({
        content,
        confidence: confidence ?? null,
        sources: sources ? JSON.stringify(sources) : null,
        updatedAt: new Date(),
      })
      .where(eq(qualificationSectionData.id, existing.id));
    return;
  }

  await db.insert(qualificationSectionData).values({
    qualificationId,
    sectionId,
    content,
    confidence: confidence ?? null,
    sources: sources ? JSON.stringify(sources) : null,
  });
}

// Store agent output with sections - stores BOTH JSON and readable text
export async function storeAuditAgentOutput(
  qualificationId: string,
  agentName: string,
  output: AuditAgentOutput
): Promise<void> {
  // Generate visualizations for sections that don't have one
  const sectionsWithVisualizations = output.sections.map(section => ({
    ...section,
    visualization:
      section.visualization || generateVisualizationForSection(agentName, section, output.sections),
  }));

  // Update output with visualizations
  const outputWithVisualizations: AuditAgentOutput = {
    ...output,
    sections: sectionsWithVisualizations,
  };

  // Cache audit sections for UI rendering (qualificationSectionData)
  for (const section of sectionsWithVisualizations) {
    const sectionId = buildAuditSectionId(outputWithVisualizations.category, section.slug);
    const cachedPayload = JSON.stringify({
      category: outputWithVisualizations.category,
      slug: section.slug,
      title: section.title,
      content: section.content,
      visualization: section.visualization,
      analyzedAt: outputWithVisualizations.analyzedAt,
      confidence: outputWithVisualizations.confidence,
    });

    await upsertAuditSectionCache({
      qualificationId,
      sectionId,
      content: cachedPayload,
      confidence: outputWithVisualizations.confidence,
      sources: [],
    });
  }

  // Build comprehensive readable text from all sections
  const textParts: string[] = [
    `=== ${outputWithVisualizations.navigation.title} ===`,
    `Kategorie: ${outputWithVisualizations.category}`,
    `Confidence: ${outputWithVisualizations.confidence}%`,
    `Analysiert am: ${outputWithVisualizations.analyzedAt}`,
    '',
  ];

  for (const section of sectionsWithVisualizations) {
    textParts.push(`--- ${section.title} ---`);
    textParts.push(convertToReadableText(section.content));
    textParts.push('');
  }

  const fullTextContent = textParts.join('\n');

  // Store FULL TEXT version with embedding for semantic search
  const chunks = [
    {
      chunkIndex: 0,
      content: fullTextContent,
      tokenCount: Math.ceil(fullTextContent.length / 4),
      metadata: {
        type: 'section' as const,
        startPosition: 0,
        endPosition: fullTextContent.length,
      },
    },
  ];

  const withEmbeddings = await generateRawChunkEmbeddings(chunks);

  // Store main output as FULL TEXT (for RAG search)
  await db.insert(dealEmbeddings).values({
    qualificationId,
    agentName,
    chunkType: 'audit_output_text',
    content: fullTextContent,
    embedding: withEmbeddings?.[0]?.embedding ?? null,
    metadata: JSON.stringify({
      category: output.category,
      confidence: output.confidence,
      analyzedAt: output.analyzedAt,
    }),
  });

  // Store main output as JSON (for structured access) - includes visualizations
  await db.insert(dealEmbeddings).values({
    qualificationId,
    agentName,
    chunkType: 'audit_output_json',
    content: JSON.stringify(outputWithVisualizations, null, 2),
    metadata: JSON.stringify({
      category: outputWithVisualizations.category,
      navigation: outputWithVisualizations.navigation,
      confidence: outputWithVisualizations.confidence,
      analyzedAt: outputWithVisualizations.analyzedAt,
    }),
  });

  // Store each section separately - BOTH as text AND as JSON
  for (let i = 0; i < sectionsWithVisualizations.length; i++) {
    const section = sectionsWithVisualizations[i];

    // Readable text version with embedding
    const sectionText = `${section.title}\n\n${convertToReadableText(section.content)}`;

    const sectionChunks = [
      {
        chunkIndex: i,
        content: sectionText,
        tokenCount: Math.ceil(sectionText.length / 4),
        metadata: {
          type: 'section' as const,
          startPosition: 0,
          endPosition: sectionText.length,
        },
      },
    ];

    const sectionEmbeddings = await generateRawChunkEmbeddings(sectionChunks);

    // Store section as TEXT
    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName,
      chunkType: 'audit_section_text',
      chunkIndex: i,
      content: sectionText,
      embedding: sectionEmbeddings?.[0]?.embedding ?? null,
      metadata: JSON.stringify({
        category: output.category,
        slug: section.slug,
        title: section.title,
      }),
    });

    // Store section as JSON (for UI rendering)
    const sectionJson =
      typeof section.content === 'string'
        ? section.content
        : JSON.stringify(section.content, null, 2);

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName,
      chunkType: 'audit_section_json',
      chunkIndex: i,
      content: sectionJson,
      metadata: JSON.stringify({
        category: output.category,
        slug: section.slug,
        title: section.title,
        visualization: section.visualization,
      }),
    });
  }
}

// Get all audit navigation for a lead (deprecated - use navigation.ts)
async function getAuditNavigationLegacy(qualificationId: string): Promise<
  {
    category: string;
    title: string;
    items: { slug: string; title: string }[];
  }[]
> {
  const results = await db
    .select({ metadata: dealEmbeddings.metadata })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.qualificationId, qualificationId),
        eq(dealEmbeddings.chunkType, 'audit_output_json')
      )
    );

  const navigation: Map<string, { title: string; items: { slug: string; title: string }[] }> =
    new Map();

  for (const row of results) {
    if (!row.metadata) continue;
    const meta = JSON.parse(row.metadata);
    if (meta.navigation && meta.category) {
      navigation.set(meta.category, meta.navigation);
    }
  }

  return Array.from(navigation.entries()).map(([category, nav]) => ({
    category,
    ...nav,
  }));
}

// Get a specific section (returns JSON for UI rendering)
export async function getAuditSection(
  qualificationId: string,
  category: string,
  slug: string
): Promise<AuditSection | null> {
  const cachedSectionId = buildAuditSectionId(category, slug);
  const [cached] = await db
    .select({ content: qualificationSectionData.content })
    .from(qualificationSectionData)
    .where(
      and(
        eq(qualificationSectionData.qualificationId, qualificationId),
        eq(qualificationSectionData.sectionId, cachedSectionId)
      )
    )
    .limit(1);

  if (cached?.content) {
    try {
      const parsed = JSON.parse(cached.content) as {
        slug: string;
        title: string;
        content: unknown;
        visualization?: unknown;
      };
      return {
        slug: parsed.slug,
        title: parsed.title,
        content: parsed.content,
        visualization: parsed.visualization,
      };
    } catch {
      // Fallback to legacy storage
    }
  }

  const results = await db
    .select({
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
    })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.qualificationId, qualificationId),
        eq(dealEmbeddings.chunkType, 'audit_section_json')
      )
    );

  for (const row of results) {
    if (!row.metadata) continue;
    const meta = JSON.parse(row.metadata);
    if (meta.category === category && meta.slug === slug) {
      return {
        slug: meta.slug,
        title: meta.title,
        content: row.content,
        visualization: meta.visualization,
      };
    }
  }

  return null;
}

// Get all text content for RAG queries (for LLM context)
export async function getAllAuditText(qualificationId: string): Promise<string[]> {
  const results = await db
    .select({ content: dealEmbeddings.content })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.qualificationId, qualificationId),
        like(dealEmbeddings.chunkType, 'audit_%_text')
      )
    );

  return results.map(r => r.content);
}

// Format RAG results for LLM context
export function formatAuditContext(results: { content: string; metadata: unknown }[]): string {
  return results.map((r, i) => `--- Source ${i + 1} ---\n${r.content}`).join('\n\n');
}
