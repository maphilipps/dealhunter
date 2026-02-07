/**
 * Timing Expert Agent
 *
 * Extracts all timing and deadline information from Qualification documents via RAG.
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
  'submission deadline response due date Qualification closing proposal due',
  'project timeline milestones phases schedule go-live launch',
  'Q&A clarification questions vendor briefing',
  'contract award signing kick-off start date',
];

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];

  return `Du bist ein Timing Expert Agent bei adesso SE für die Analyse von Qualification-Dokumenten.

## Deine Rolle
Extrahiere ALLE zeitlichen Informationen aus Qualification-Unterlagen.
Deine Analyse ist kritisch für die Ressourcenplanung und Bid-Priorisierung.

## Heutiges Datum
${today}

## Extraktions-Prioritäten

| Priorität | Information | Bedeutung |
|-----------|-------------|-----------|
| 1 | Abgabefrist | Deadline für Angebotseinreichung |
| 2 | Projekt-Timeline | Start- und Enddatum des Projekts |
| 3 | Meilensteine | Phasen, Reviews, Go-Lives |
| 4 | Q&A-Fristen | Rückfragen- und Klärungsfristen |
| 5 | Vergabetermin | Erwarteter Zuschlagstermin |

## Dringlichkeits-Klassifikation

| Level | Tage bis Abgabe | Aktion |
|-------|-----------------|--------|
| critical | < 7 Tage | Sofortige Eskalation, Notfall-Team |
| high | < 14 Tage | Priorisierte Bearbeitung |
| medium | < 30 Tage | Normale Bearbeitung |
| low | ≥ 30 Tage | Planmäßige Bearbeitung |

## Meilenstein-Typen
- **exact**: Konkretes Datum angegeben (z.B. "15.03.2025")
- **estimated**: Geschätztes Datum (z.B. "voraussichtlich Q2 2025")
- **relative**: Relatives Datum (z.B. "6 Wochen nach Zuschlag")

## Ausgabe
- Verwende ISO-Datumsformat (YYYY-MM-DD) wo möglich
- Bei relativen Angaben (z.B. "Q2 2024") Originaltext beibehalten
- Confidence basiert auf Klarheit der gefundenen Zeitangaben
- Alle Texte auf Deutsch`;
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
          submissionDeadline: null,
          projectStart: null,
          projectEnd: null,
          projectDurationMonths: null,
          milestones: [],
          clarificationDeadline: null,
          qaSessionDates: [],
          awardDate: null,
          contractSigningDate: null,
          urgencyLevel: 'low',
          daysUntilSubmission: null,
          confidence: 0,
        },
        0,
        'No timing information found in Qualification document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(
      uniqueResults.slice(0, 15),
      'Qualification Timing Information'
    );

    const analysis = await generateStructuredOutput({
      model: 'quality',
      schema: TimingAnalysisSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following Qualification content and extract all timing/deadline information:\n\n${context}`,
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

  if (analysis.daysUntilSubmission !== null) {
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
