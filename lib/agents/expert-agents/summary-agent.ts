/**
 * Summary Expert Agent
 *
 * Creates a management-level summary by synthesizing outputs from other expert agents.
 * Runs AFTER the other 4 agents (timing, deliverables, techstack, legal) complete.
 */

import { eq, and, inArray } from 'drizzle-orm';

import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import { ManagementSummarySchema, type ManagementSummary } from './summary-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

const EXPERT_AGENT_NAMES = [
  'timing_expert',
  'deliverables_expert',
  'techstack_expert',
  'legal_rfp_expert',
  'extract',
];

const SUMMARY_RAG_QUERY = 'executive summary introduction scope objectives project overview';

function buildSystemPrompt(): string {
  return `You are a Summary Expert Agent creating C-Level management summaries for IT consulting bid decisions.

## Context
adesso is a leading German IT consultancy specializing in:
- CMS & Web Development (Drupal, headless architectures)
- Digital Transformation & Process Optimization
- Enterprise Software Development
- Cloud & Infrastructure Solutions

## Your Task
Synthesize the outputs from other expert agents into a concise, decision-focused management summary.

## Guidelines

1. **Headline**: One punchy line capturing the opportunity (max 100 chars)

2. **Executive Summary**: 2-3 sentences for C-Level. Focus on:
   - What is this opportunity?
   - Why should adesso care?
   - What's the recommendation?

3. **Key Facts**: Extract from expert analyses:
   - Customer name and industry
   - Project type (CMS, Web, Migration, etc.)
   - Estimated value if mentioned
   - Submission deadline and days remaining

4. **Top Deliverables**: List the 3-5 most important deliverables, mark if mandatory

5. **Timeline Highlights**: Key milestones with dates (max 5)

6. **Assessment**:
   - fitScore (1-10): How well does this match adesso's capabilities?
   - complexityScore (1-10): Technical/organizational complexity
   - urgencyLevel: Based on days until submission
   - recommendation: pursue/consider/decline with clear reasoning

7. **Top Risks**: Max 3 critical risks that could impact success

8. **Top Opportunities**: Max 3 reasons why this opportunity is valuable

## Tone
- Direct, no fluff
- Decision-focused
- Numbers and facts over adjectives
- German business culture (thorough but efficient)

Return valid JSON matching the schema.`;
}

async function getExpertAgentOutputs(preQualificationId: string): Promise<string> {
  const results = await db
    .select({
      agentName: dealEmbeddings.agentName,
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
    })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        inArray(dealEmbeddings.agentName, EXPERT_AGENT_NAMES)
      )
    );

  if (results.length === 0) {
    return '';
  }

  const grouped = results.reduce(
    (acc, row) => {
      if (!acc[row.agentName]) {
        acc[row.agentName] = [];
      }
      acc[row.agentName].push(row.content);
      return acc;
    },
    {} as Record<string, string[]>
  );

  const sections = Object.entries(grouped).map(([agent, contents]) => {
    const label = agent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `### ${label}\n\n${contents.join('\n\n')}`;
  });

  return sections.join('\n\n---\n\n');
}

export async function runSummaryAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<ManagementSummary>> {
  const { preQualificationId } = input;

  try {
    const [expertOutputs, ragResults] = await Promise.all([
      getExpertAgentOutputs(preQualificationId),
      queryRfpDocument(preQualificationId, SUMMARY_RAG_QUERY, 10),
    ]);

    if (!expertOutputs && ragResults.length === 0) {
      return createAgentOutput<ManagementSummary>(
        null,
        0,
        'No expert agent outputs or document context found'
      );
    }

    const ragContext = formatContextFromRAG(ragResults, 'Raw Document Context');

    const context = [
      expertOutputs ? `## Expert Agent Analyses\n\n${expertOutputs}` : '',
      ragContext ? `\n\n## Original Document Excerpts\n\n${ragContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const analysis = await generateStructuredOutput({
      model: 'quality',
      schema: ManagementSummarySchema,
      system: buildSystemPrompt(),
      prompt: `Create a management summary from the following expert analyses and document context:\n\n${context}`,
      temperature: 0.3,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    // Store full ManagementSummary in metadata so the UI can parse it directly
    await storeAgentResult(preQualificationId, 'summary_expert', summaryContent, analysis);

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[SummaryAgent] Error:', error);
    return createAgentOutput<ManagementSummary>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Summary Agent'
    );
  }
}

function buildSummaryForStorage(analysis: ManagementSummary): string {
  const parts: string[] = [
    `# ${analysis.headline}`,
    '',
    analysis.executiveSummary,
    '',
    '## Key Facts',
    `- Customer: ${analysis.keyFacts.customer}`,
  ];

  if (analysis.keyFacts.industry) {
    parts.push(`- Industry: ${analysis.keyFacts.industry}`);
  }
  parts.push(`- Project Type: ${analysis.keyFacts.projectType}`);

  if (analysis.keyFacts.estimatedValue) {
    parts.push(`- Estimated Value: ${analysis.keyFacts.estimatedValue}`);
  }
  if (analysis.keyFacts.submissionDeadline) {
    parts.push(`- Submission Deadline: ${analysis.keyFacts.submissionDeadline}`);
  }
  if (analysis.keyFacts.daysRemaining !== undefined) {
    parts.push(`- Days Remaining: ${analysis.keyFacts.daysRemaining}`);
  }

  parts.push('', '## Assessment');
  parts.push(`- Fit Score: ${analysis.assessment.fitScore}/10`);
  parts.push(`- Complexity: ${analysis.assessment.complexityScore}/10`);
  parts.push(`- Urgency: ${analysis.assessment.urgencyLevel.toUpperCase()}`);
  parts.push(`- Recommendation: ${analysis.assessment.recommendation.toUpperCase()}`);
  parts.push(`- Reasoning: ${analysis.assessment.reasoning}`);

  if (analysis.topDeliverables.length > 0) {
    parts.push('', '## Top Deliverables');
    analysis.topDeliverables.forEach(d => {
      parts.push(`- ${d.name}${d.mandatory ? ' (mandatory)' : ''}`);
    });
  }

  if (analysis.timelineHighlights.length > 0) {
    parts.push('', '## Timeline');
    analysis.timelineHighlights.forEach(t => {
      parts.push(`- ${t.milestone}: ${t.date}`);
    });
  }

  if (analysis.topRisks.length > 0) {
    parts.push('', '## Top Risks');
    analysis.topRisks.forEach(r => parts.push(`- ${r}`));
  }

  if (analysis.topOpportunities.length > 0) {
    parts.push('', '## Top Opportunities');
    analysis.topOpportunities.forEach(o => parts.push(`- ${o}`));
  }

  parts.push('', `Confidence: ${analysis.confidence}%`);

  return parts.join('\n');
}
