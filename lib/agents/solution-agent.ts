/**
 * Solution Agent (DEA-170 PA-011 onwards)
 *
 * Generates solution sketches for pitchdeck deliverables:
 * - Structured outline (PA-011)
 * - Full-text draft (PA-012)
 * - Talking points (PA-013)
 * - Visual ideas (PA-014)
 *
 * Uses RAG to pull in data from all Deep Scan agents (TECH, COMMERCIAL, RISK, etc.)
 * and optionally performs web research for best practices.
 */

import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { openai } from '../ai/providers';
import { queryRAG } from '../rag/retrieval-service';

// Security: Prompt Injection Protection
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SolutionInput {
  deliverableName: string;
  preQualificationId: string;
  leadId?: string; // Optional: for RAG queries scoped to Lead
  customerName?: string;
  projectDescription?: string;
  requirements?: string[]; // Key requirements from Pre-Qualification
}

export interface OutlineSection {
  heading: string;
  level: number; // 1 = ##, 2 = ###, etc.
  description?: string; // Brief description of what this section should cover
}

export interface SolutionOutline {
  deliverableName: string;
  outline: OutlineSection[];
  estimatedWordCount: number;
  generatedAt: string;
}

export interface SolutionDraft {
  deliverableName: string;
  draft: string; // Full markdown draft
  wordCount: number;
  generatedAt: string;
}

export interface TalkingPoint {
  topic: string;
  points: string[]; // Bullet points for this topic
}

export interface SolutionTalkingPoints {
  deliverableName: string;
  talkingPoints: TalkingPoint[];
  generatedAt: string;
}

export interface VisualIdea {
  type: 'diagram' | 'timeline' | 'architecture' | 'chart' | 'infographic';
  title: string;
  description: string;
  dataSource?: string; // Where to get data for this visual
}

export interface SolutionVisualIdeas {
  deliverableName: string;
  visualIdeas: VisualIdea[];
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT: GENERATE OUTLINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query all Deep Scan agents for comprehensive context
 * PA-016: Enhanced RAG integration with all agent outputs
 */
async function queryAllAgents(preQualificationId: string, deliverableName: string) {
  // Define targeted queries for each agent type
  const agentQueries = [
    {
      name: 'TECH',
      query: `Technical details, architecture, and technology stack relevant to "${deliverableName}"`,
    },
    {
      name: 'COMMERCIAL',
      query: `Budget, cost estimates, and commercial considerations for "${deliverableName}"`,
    },
    {
      name: 'RISK',
      query: `Potential risks, challenges, and mitigation strategies for "${deliverableName}"`,
    },
    {
      name: 'LEGAL',
      query: `Legal requirements, compliance needs, and regulatory considerations for "${deliverableName}"`,
    },
    {
      name: 'TEAM',
      query: `Team composition, roles, and resource requirements for "${deliverableName}"`,
    },
    {
      name: 'GENERAL',
      query: `Overall project requirements and key details for "${deliverableName}"`,
    },
  ];

  // Query each agent type in parallel
  const results = await Promise.all(
    agentQueries.map(async ({ name, query }) => {
      const chunks = await queryRAG({
        preQualificationId: preQualificationId,
        question: query,
        maxResults: 5, // Get top 5 chunks per agent type
      });
      return { agentType: name, chunks };
    })
  );

  // Combine all results with source attribution
  const allChunks = results.flatMap(r => r.chunks);

  // Group by agent for structured context
  const contextByAgent = results.reduce(
    (acc, r) => {
      if (r.chunks.length > 0) {
        acc[r.agentType] = r.chunks.map(c => c.content).join('\n');
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return { allChunks, contextByAgent };
}

/**
 * PA-011: Generate structured outline for a deliverable
 *
 * Uses RAG to retrieve relevant data from all Deep Scan agents and creates
 * a logical outline structure with main chapters and subchapters.
 *
 * @param input - Deliverable context
 * @returns Structured outline with markdown headings
 */
export async function generateOutline(input: SolutionInput): Promise<SolutionOutline> {
  console.error(`[Solution Agent] Generating outline for "${input.deliverableName}"`);

  try {
    // 1. RAG Query: Retrieve comprehensive context from ALL Deep Scan agents
    const { allChunks, contextByAgent } = await queryAllAgents(input.preQualificationId, input.deliverableName);

    // Build structured context string with agent attribution
    const rawRagContext = Object.entries(contextByAgent)
      .map(([agent, content]) => `## Context from ${agent} Agent:\n${content}`)
      .join('\n\n');

    // Wrap RAG context for prompt injection protection
    const ragContext = wrapUserContent(rawRagContext, 'rag');

    // 2. Zod schema for AI-generated outline
    const OutlineSchema = z.object({
      sections: z.array(
        z.object({
          heading: z.string(),
          level: z.number().min(1).max(3),
          description: z.string().optional(),
        })
      ),
      estimatedWordCount: z.number(),
    });

    // 3. Generate outline using AI
    const { object: outlineData } = await generateObject({
      model: openai('gemini-3-flash-preview') as unknown as LanguageModel,
      schema: OutlineSchema,
      prompt: `You are a technical solution architect creating a structured outline for a pitchdeck deliverable.

**Deliverable:** ${input.deliverableName}
**Customer:** ${input.customerName || 'Unknown Customer'}
**Project:** ${input.projectDescription || 'No description available'}

**Key Requirements:**
${input.requirements?.map(r => `- ${r}`).join('\n') || 'No specific requirements'}

**Context from Deep Scan Analysis:**
${ragContext || 'No Deep Scan data available yet'}

Create a professional, structured outline for this deliverable with the following guidelines:

1. **Minimum 3 main chapters** (level 1 headings, ##)
2. **Logical structure** - Introduction → Analysis → Solution → Conclusion
3. **Descriptive headings** - Clear, meaningful titles (not generic)
4. **Subchapters where appropriate** (level 2-3 headings, ###, ####)
5. **Relevant to deliverable type** - Tailor structure to the specific deliverable

For example, for a "Technical Offer" deliverable:
- Executive Summary (##)
- Current Situation Analysis (##)
  - Existing Technology Stack (###)
  - Pain Points and Challenges (###)
- Proposed Solution (##)
  - Solution Architecture (###)
  - Technology Stack (###)
  - Implementation Approach (###)
- Timeline and Resources (##)
- Cost Estimation (##)

Provide the outline structure with level numbers (1, 2, 3) and brief descriptions of what each section should cover.

Estimate the total word count for the final document based on the outline complexity (typically 500-2000 words).`,
    });

    console.error('[Solution Agent] Outline generated', {
      sections: outlineData.sections.length,
      estimatedWords: outlineData.estimatedWordCount,
      agentSources: Object.keys(contextByAgent),
      totalChunks: allChunks.length,
    });

    return {
      deliverableName: input.deliverableName,
      outline: outlineData.sections,
      estimatedWordCount: outlineData.estimatedWordCount,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Solution Agent] Error generating outline:', error);
    // Return fallback outline
    return {
      deliverableName: input.deliverableName,
      outline: [
        { heading: 'Executive Summary', level: 1 },
        { heading: 'Current Situation', level: 1 },
        { heading: 'Proposed Solution', level: 1 },
        { heading: 'Timeline and Next Steps', level: 1 },
      ],
      estimatedWordCount: 800,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT: GENERATE DRAFT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PA-012: Generate full-text draft for a deliverable
 *
 * Uses the outline and RAG data to create a complete, professional markdown draft.
 *
 * @param input - Deliverable context
 * @param outline - Previously generated outline (optional, will generate if not provided)
 * @returns Full markdown draft (minimum 500 words)
 */
export async function generateDraft(
  input: SolutionInput,
  outline?: SolutionOutline
): Promise<SolutionDraft> {
  console.error(`[Solution Agent] Generating draft for "${input.deliverableName}"`);

  try {
    // Generate outline if not provided
    if (!outline) {
      outline = await generateOutline(input);
    }

    // 1. RAG Query: Retrieve comprehensive context from ALL Deep Scan agents
    const { allChunks, contextByAgent } = await queryAllAgents(input.preQualificationId, input.deliverableName);

    // Build structured context string with agent attribution and more details
    const rawRagContext = Object.entries(contextByAgent)
      .map(([agent, content]) => `## Context from ${agent} Agent:\n${content}`)
      .join('\n\n');

    // Wrap RAG context for prompt injection protection
    const ragContext = wrapUserContent(rawRagContext, 'rag');

    // Also track sources for reference generation
    const sources = allChunks
      .map(c => `${c.agentName} (${c.chunkType})`)
      .filter((v, i, a) => a.indexOf(v) === i);

    // 2. Zod schema for AI-generated draft
    const DraftSchema = z.object({
      draft: z.string().min(500).describe('Full markdown draft with minimum 500 words'),
      wordCount: z.number(),
    });

    // 3. Generate draft using AI
    const { object: draftData } = await generateObject({
      model: openai('gemini-3-flash-preview') as unknown as LanguageModel,
      schema: DraftSchema,
      prompt: `You are a technical solution architect creating a professional pitchdeck deliverable.

**Deliverable:** ${input.deliverableName}
**Customer:** ${input.customerName || 'Unknown Customer'}
**Project:** ${input.projectDescription || 'No description available'}

**Outline to Follow:**
${outline.outline.map(s => `${'#'.repeat(s.level + 1)} ${s.heading}${s.description ? `\n${s.description}` : ''}`).join('\n\n')}

**Context from Deep Scan Analysis:**
${ragContext || 'No Deep Scan data available yet'}

Write a complete, professional markdown document following the outline above.

**Requirements:**
- Minimum 500 words
- Professional business writing style
- Reference specific technical details from the Deep Scan agents context
- **Include source references** where appropriate (e.g., "According to the TECH Agent analysis...")
- Integrate insights from TECH, COMMERCIAL, RISK, LEGAL, and TEAM agents
- Include concrete recommendations and next steps
- Use markdown formatting (headings, lists, bold for emphasis)
- Write in German if the customer context suggests it, otherwise English

**Structure:**
Follow the provided outline exactly. Fill each section with relevant, detailed content based on the Deep Scan analysis context.

**Available Context Sources:**
${Object.keys(contextByAgent).join(', ')}

Provide a comprehensive, ready-to-present draft that demonstrates deep understanding of the project requirements and technical solution. Where relevant, mention which agent analysis informed your recommendations.`,
    });

    console.error('[Solution Agent] Draft generated', {
      wordCount: draftData.wordCount,
      agentSources: Object.keys(contextByAgent),
      sourcesReferenced: sources.length,
    });

    return {
      deliverableName: input.deliverableName,
      draft: draftData.draft,
      wordCount: draftData.wordCount,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Solution Agent] Error generating draft:', error);
    // Return fallback draft
    return {
      deliverableName: input.deliverableName,
      draft: `# ${input.deliverableName}

## Executive Summary

[Draft generation failed. Please regenerate or edit manually.]

## Current Situation

${input.projectDescription || 'Project description not available.'}

## Proposed Solution

Based on the requirements, we recommend the following approach:

1. **Analysis Phase**: Detailed analysis of current situation
2. **Solution Design**: Technical architecture and implementation plan
3. **Implementation**: Step-by-step execution
4. **Testing and Validation**: Quality assurance
5. **Deployment**: Production rollout

## Next Steps

1. Detailed requirements workshop
2. Technical architecture design
3. Resource planning
4. Timeline definition

---

**Note:** This draft was automatically generated and should be reviewed and customized.`,
      wordCount: 100,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT: GENERATE TALKING POINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PA-013: Generate talking points for presentations
 *
 * Creates concise, bullet-pointed talking points for each section of the deliverable.
 *
 * @param input - Deliverable context
 * @param outline - Previously generated outline (optional)
 * @returns Talking points organized by topic
 */
export async function generateTalkingPoints(
  input: SolutionInput,
  outline?: SolutionOutline
): Promise<SolutionTalkingPoints> {
  console.error(`[Solution Agent] Generating talking points for "${input.deliverableName}"`);

  try {
    // Generate outline if not provided
    if (!outline) {
      outline = await generateOutline(input);
    }

    // 1. RAG Query: Retrieve comprehensive insights from ALL agents
    const { contextByAgent } = await queryAllAgents(input.preQualificationId, input.deliverableName);

    // Build structured context focusing on key insights
    const rawRagContext = Object.entries(contextByAgent)
      .map(([agent, content]) => `## Key Points from ${agent} Agent:\n${content}`)
      .join('\n\n');

    // Wrap RAG context for prompt injection protection
    const ragContext = wrapUserContent(rawRagContext, 'rag');

    // 2. Zod schema for AI-generated talking points
    const TalkingPointsSchema = z.object({
      topics: z.array(
        z.object({
          topic: z.string(),
          points: z.array(z.string()).max(10),
        })
      ),
    });

    // 3. Generate talking points using AI
    const { object: talkingPointsData } = await generateObject({
      model: openai('gemini-3-flash-preview') as unknown as LanguageModel,
      schema: TalkingPointsSchema,
      prompt: `You are a presentation coach creating talking points for a technical pitch.

**Deliverable:** ${input.deliverableName}
**Outline:**
${outline.outline.map(s => `${'#'.repeat(s.level + 1)} ${s.heading}`).join('\n')}

**Context from Deep Scan Agents:**
${ragContext || 'No context available'}

Create concise, impactful talking points for a presentation of this deliverable.

**Guidelines:**
- Maximum 10 bullet points per topic
- Clear, concise statements (one line each)
- Focus on benefits, not just features
- Include concrete numbers/facts from agent analyses where available
- Integrate insights from TECH, COMMERCIAL, RISK, LEGAL, and TEAM agents
- Anticipate and address potential concerns raised by the agents
- Where relevant, reference specific findings (e.g., "Budget aligned with COMMERCIAL analysis")

Organize talking points by the main chapters from the outline. Each topic should have 3-7 bullet points.`,
    });

    console.error('[Solution Agent] Talking points generated', {
      topics: talkingPointsData.topics.length,
      agentSources: Object.keys(contextByAgent),
    });

    return {
      deliverableName: input.deliverableName,
      talkingPoints: talkingPointsData.topics,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Solution Agent] Error generating talking points:', error);
    // Return fallback talking points
    return {
      deliverableName: input.deliverableName,
      talkingPoints: [
        {
          topic: 'Key Messages',
          points: [
            'Comprehensive solution addressing all requirements',
            'Proven technology stack with strong track record',
            'Realistic timeline and resource planning',
            'Clear ROI and business value',
          ],
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT: GENERATE VISUAL IDEAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PA-014: Generate visual ideas for presentations
 *
 * Suggests diagrams, charts, and other visualizations to support the deliverable.
 *
 * @param input - Deliverable context
 * @returns Visual ideas with descriptions and data sources
 */
export async function generateVisualIdeas(input: SolutionInput): Promise<SolutionVisualIdeas> {
  console.error(`[Solution Agent] Generating visual ideas for "${input.deliverableName}"`);

  try {
    // 1. RAG Query: Retrieve data from ALL agents that could be visualized
    const { contextByAgent } = await queryAllAgents(input.preQualificationId, input.deliverableName);

    // Build context focusing on visualizable data
    const rawRagContext = Object.entries(contextByAgent)
      .map(([agent, content]) => `## Visualizable Data from ${agent} Agent:\n${content}`)
      .join('\n\n');

    // Wrap RAG context for prompt injection protection
    const ragContext = wrapUserContent(rawRagContext, 'rag');

    // 2. Zod schema for AI-generated visual ideas
    const VisualIdeasSchema = z.object({
      visuals: z.array(
        z.object({
          type: z.enum(['diagram', 'timeline', 'architecture', 'chart', 'infographic']),
          title: z.string(),
          description: z.string(),
          dataSource: z.string().optional(),
        })
      ),
    });

    // 3. Generate visual ideas using AI
    const { object: visualData } = await generateObject({
      model: openai('gemini-3-flash-preview') as unknown as LanguageModel,
      schema: VisualIdeasSchema,
      prompt: `You are a presentation designer suggesting visuals for a technical deliverable.

**Deliverable:** ${input.deliverableName}

**Available Context from Deep Scan Agents:**
${ragContext || 'No context available'}

Suggest minimum 3 impactful visualizations that would enhance this deliverable based on the agent analyses.

**Visual Types:**
- **diagram**: Flowcharts, process diagrams, decision trees
- **timeline**: Project timelines, roadmaps, Gantt charts
- **architecture**: System architecture, component diagrams, infrastructure
- **chart**: Bar charts, pie charts, line graphs (for metrics/data)
- **infographic**: Visual summaries, comparison tables, key facts

For each visual:
1. Choose the most appropriate type
2. Give it a descriptive title
3. Explain what it should show and why it's valuable
4. Suggest where to get the data - reference specific agent findings:
   - "From TECH Agent: Technology Stack Analysis"
   - "From COMMERCIAL Agent: Budget Breakdown"
   - "From RISK Agent: Risk Matrix"
   - "From TEAM Agent: Team Composition"
   - "From PT Estimation based on requirements"

Focus on visuals that tell a story, support key messages, and leverage the comprehensive agent data.`,
    });

    console.error('[Solution Agent] Visual ideas generated', {
      count: visualData.visuals.length,
      agentSources: Object.keys(contextByAgent),
    });

    return {
      deliverableName: input.deliverableName,
      visualIdeas: visualData.visuals,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Solution Agent] Error generating visual ideas:', error);
    // Return fallback visual ideas
    return {
      deliverableName: input.deliverableName,
      visualIdeas: [
        {
          type: 'architecture',
          title: 'Solution Architecture Overview',
          description:
            'High-level system architecture showing main components and their interactions',
          dataSource: 'From Tech Stack Analysis',
        },
        {
          type: 'timeline',
          title: 'Implementation Timeline',
          description: 'Project timeline with key milestones and deliverables',
          dataSource: 'From PT Estimation',
        },
        {
          type: 'chart',
          title: 'Resource Allocation',
          description: 'Breakdown of hours by role and project phase',
          dataSource: 'From PT Estimation - Disciplines',
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE: GENERATE ALL SOLUTION SKETCHES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompleteSolutionSketches {
  outline: SolutionOutline;
  draft: SolutionDraft;
  talkingPoints: SolutionTalkingPoints;
  visualIdeas: SolutionVisualIdeas;
}

/**
 * Generate all solution sketches for a deliverable in one call
 *
 * This is a convenience function that generates all four types of sketches:
 * outline, draft, talking points, and visual ideas.
 *
 * @param input - Deliverable context
 * @returns Complete solution sketches
 */
export async function generateCompleteSolution(
  input: SolutionInput
): Promise<CompleteSolutionSketches> {
  console.error(`[Solution Agent] Generating complete solution for "${input.deliverableName}"`);

  // Generate outline first (reused by other generators)
  const outline = await generateOutline(input);

  // Generate all sketches in parallel (except draft which needs outline)
  const [draft, talkingPoints, visualIdeas] = await Promise.all([
    generateDraft(input, outline),
    generateTalkingPoints(input, outline),
    generateVisualIdeas(input),
  ]);

  return {
    outline,
    draft,
    talkingPoints,
    visualIdeas,
  };
}
