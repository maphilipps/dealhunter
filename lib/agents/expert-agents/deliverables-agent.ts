/**
 * Deliverables Expert Agent
 *
 * Extracts all required submission documents from RFP documents via RAG.
 */

import { createId } from '@paralleldrive/cuid2';

import { generateStructuredOutput } from '@/lib/ai/config';

import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import {
  DeliverablesAnalysisSchema,
  type DeliverablesAnalysis,
  type Deliverable,
} from './deliverables-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

const DELIVERABLES_QUERIES = [
  'submission requirements mandatory components proposal shall include vendor must provide',
  'executive summary technical proposal commercial proposal pricing',
  'required documents certificates references case studies',
  'submission format PDF copies email portal physical',
  'page limit maximum pages word count',
];

// Schema without IDs for LLM generation
const DeliverableWithoutIdSchema = DeliverablesAnalysisSchema.extend({
  deliverables: DeliverablesAnalysisSchema.shape.deliverables.element.omit({ id: true }).array(),
});

function buildSystemPrompt(): string {
  return `You are a Deliverables Expert Agent analyzing RFP documents for submission requirements.

Your task is to extract ALL required deliverables and submission documents from the provided RFP context.

## Instructions

1. **Identify All Deliverables**:
   - Extract every document, artifact, or material that must be submitted
   - Include both explicit requirements and implied deliverables
   - Capture format requirements (PDF, Word, hard copy, etc.)

2. **Categorize Each Deliverable**:
   - proposal_document: Executive Summary, Technical Proposal, Approach documents
   - commercial: Pricing sheets, Cost breakdowns, Rate cards, Payment terms
   - legal: Signed contracts, NDAs, Compliance certificates, Insurance certificates
   - technical: Architecture diagrams, Technical specifications, Security documentation
   - reference: Case studies, Customer references, Past performance examples
   - administrative: Company profile, Team CVs, Organizational charts
   - presentation: Demo materials, Pitch decks, Presentation slides

3. **Extract Requirements**:
   - format: File format requirements (PDF, Word, Excel, etc.)
   - pageLimit: Maximum pages if specified
   - mandatory: true if required, false if optional/nice-to-have
   - deadline: Only if different from main submission deadline
   - copies: Number of copies required
   - submissionMethod: email, portal, physical, or unknown

4. **Submission Method**:
   - Identify the PRIMARY submission method
   - Extract email address if email submission
   - Extract portal URL if online portal submission

5. **Effort Estimation**:
   - Estimate total hours to prepare all deliverables
   - Consider complexity, page counts, and document types

6. **Confidence Scoring**:
   - Set confidence per deliverable based on how clearly it was specified
   - Set overall confidence based on completeness of extraction

7. **Raw Text**:
   - Include the exact text from the RFP that describes each deliverable

Return valid JSON matching the schema. Be thorough - missing a mandatory deliverable could disqualify a proposal.`;
}

export async function runDeliverablesAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<DeliverablesAnalysis>> {
  const { rfpId } = input;

  try {
    const ragResults = await Promise.all(
      DELIVERABLES_QUERIES.map(query => queryRfpDocument(rfpId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<DeliverablesAnalysis>(
        {
          deliverables: [],
          totalCount: 0,
          mandatoryCount: 0,
          optionalCount: 0,
          primarySubmissionMethod: 'unknown',
          confidence: 0,
        },
        0,
        'No deliverables information found in RFP document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(
      uniqueResults.slice(0, 15),
      'RFP Deliverables & Submission Requirements'
    );

    const rawAnalysis = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: DeliverableWithoutIdSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following RFP content and extract all required deliverables and submission requirements:\n\n${context}`,
      temperature: 0.2,
    });

    // Add IDs to each deliverable
    const deliverablesWithIds: Deliverable[] = rawAnalysis.deliverables.map(d => ({
      ...d,
      id: createId(),
    }));

    const analysis: DeliverablesAnalysis = {
      ...rawAnalysis,
      deliverables: deliverablesWithIds,
    };

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(rfpId, 'deliverables_expert', summaryContent, {
      totalCount: analysis.totalCount,
      mandatoryCount: analysis.mandatoryCount,
      primarySubmissionMethod: analysis.primarySubmissionMethod,
    });

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[DeliverablesAgent] Error:', error);
    return createAgentOutput<DeliverablesAnalysis>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Deliverables Agent'
    );
  }
}

function buildSummaryForStorage(analysis: DeliverablesAnalysis): string {
  const parts: string[] = ['Deliverables Analysis Summary:'];

  parts.push(`- Total Deliverables: ${analysis.totalCount}`);
  parts.push(`- Mandatory: ${analysis.mandatoryCount}`);
  parts.push(`- Optional: ${analysis.optionalCount}`);
  parts.push(`- Submission Method: ${analysis.primarySubmissionMethod}`);

  if (analysis.submissionEmail) {
    parts.push(`- Submission Email: ${analysis.submissionEmail}`);
  }

  if (analysis.portalUrl) {
    parts.push(`- Portal URL: ${analysis.portalUrl}`);
  }

  if (analysis.estimatedEffortHours) {
    parts.push(`- Estimated Effort: ${analysis.estimatedEffortHours} hours`);
  }

  if (analysis.deliverables.length > 0) {
    parts.push(`\nDeliverables by Category:`);

    const byCategory = analysis.deliverables.reduce(
      (acc, d) => {
        if (!acc[d.category]) acc[d.category] = [];
        acc[d.category].push(d);
        return acc;
      },
      {} as Record<string, typeof analysis.deliverables>
    );

    for (const [category, items] of Object.entries(byCategory)) {
      parts.push(`\n${category.toUpperCase()}:`);
      items.forEach(d => {
        const flags = [
          d.mandatory ? 'MANDATORY' : 'optional',
          d.format,
          d.pageLimit ? `max ${d.pageLimit} pages` : null,
        ]
          .filter(Boolean)
          .join(', ');
        parts.push(`  • ${d.name} (${flags})`);
      });
    }
  }

  return parts.join('\n');
}
