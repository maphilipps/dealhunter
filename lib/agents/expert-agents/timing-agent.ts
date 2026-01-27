/**
 * Timing Expert Agent
 *
 * Extracts all timing and deadline information from Pre-Qualification documents via RAG.
 */


import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import { TimingAnalysisSchema, type TimingAnalysis } from './timing-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';

const TIMING_QUERIES = [
  'submission deadline response due date Pre-Qualification closing proposal due',
  'project timeline milestones phases schedule go-live launch',
  'Q&A clarification questions vendor briefing',
  'contract award signing kick-off start date',
];

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];

  return `You are a Timing Expert Agent analyzing Pre-Qualification documents for deadline and timeline information.

Today's date: ${today}

Your task is to extract ALL timing-related information from the provided Pre-Qualification context.

## Instructions

1. **Submission Deadline** (highest priority):
   - Extract the exact submission deadline with date, time, and timezone if available
   - Include the raw text exactly as it appears in the document
   - Set confidence based on clarity (100% for explicit dates, lower for ambiguous)

2. **Project Timeline**:
   - Extract project start and end dates if mentioned
   - Calculate projectDurationMonths if both dates are available

3. **Milestones**:
   - Extract ALL milestones mentioned (phases, deliverables, reviews, etc.)
   - For each milestone, determine if the date is exact, estimated, or relative
   - Mark whether each milestone is mandatory

4. **Q&A and Clarification**:
   - Extract clarification deadline if mentioned
   - Extract any Q&A session dates

5. **Contract/Award**:
   - Extract expected award date if mentioned
   - Extract contract signing date if mentioned

6. **Urgency Assessment**:
   - Calculate daysUntilSubmission from today (${today}) to submission deadline
   - Set urgencyLevel:
     - critical: < 7 days
     - high: < 14 days
     - medium: < 30 days
     - low: >= 30 days or no deadline found

7. **Overall Confidence**:
   - Set based on completeness and clarity of timing information found

Return valid JSON matching the schema. Use ISO date format (YYYY-MM-DD) where possible.
If a date is relative (e.g., "Q2 2024", "within 6 months"), preserve it as-is.`;
}

export async function runTimingAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<TimingAnalysis>> {
  const { preQualificationId } = input;

  try {
    const ragResults = await Promise.all(
      TIMING_QUERIES.map(query => queryRfpDocument(preQualificationId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<TimingAnalysis>(
        {
          milestones: [],
          urgencyLevel: 'low',
          confidence: 0,
        },
        0,
        'No timing information found in Pre-Qualification document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(uniqueResults.slice(0, 15), 'Pre-Qualification Timing Information');

    const analysis = await generateStructuredOutput({
      model: 'quality',
      schema: TimingAnalysisSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following Pre-Qualification content and extract all timing/deadline information:\n\n${context}`,
      temperature: 0.2,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(preQualificationId, 'timing_expert', summaryContent, {
      submissionDeadline: analysis.submissionDeadline?.date,
      urgencyLevel: analysis.urgencyLevel,
      milestonesCount: analysis.milestones.length,
    });

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[TimingAgent] Error:', error);
    return createAgentOutput<TimingAnalysis>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Timing Agent'
    );
  }
}

function buildSummaryForStorage(analysis: TimingAnalysis): string {
  const parts: string[] = ['Timing Analysis Summary:'];

  if (analysis.submissionDeadline) {
    parts.push(
      `- Submission Deadline: ${analysis.submissionDeadline.date}${analysis.submissionDeadline.time ? ` at ${analysis.submissionDeadline.time}` : ''}`
    );
  }

  if (analysis.daysUntilSubmission !== undefined) {
    parts.push(`- Days Until Submission: ${analysis.daysUntilSubmission}`);
  }

  parts.push(`- Urgency Level: ${analysis.urgencyLevel.toUpperCase()}`);

  if (analysis.projectStart || analysis.projectEnd) {
    parts.push(
      `- Project Timeline: ${analysis.projectStart || '?'} to ${analysis.projectEnd || '?'}`
    );
  }

  if (analysis.milestones.length > 0) {
    parts.push(`- Milestones (${analysis.milestones.length}):`);
    analysis.milestones.forEach(m => {
      parts.push(`  • ${m.name}${m.date ? `: ${m.date}` : ''}`);
    });
  }

  if (analysis.clarificationDeadline) {
    parts.push(`- Clarification Deadline: ${analysis.clarificationDeadline}`);
  }

  if (analysis.awardDate) {
    parts.push(`- Expected Award Date: ${analysis.awardDate}`);
  }

  return parts.join('\n');
}
