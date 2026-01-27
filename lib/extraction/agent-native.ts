/**
 * Agent-Native Extraction
 *
 * Uses ToolLoopAgent to extract structured requirements from documents.
 * The agent decides which fields to extract and in which order.
 *
 * Key principle: Extract projectGoal FIRST as it guides all other extraction.
 */

import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { generateText } from 'ai';
import { z } from 'zod';

import { registry } from '../agent-tools';
import type { ToolContext } from '../agent-tools';
import type { ExtractedRequirements } from './schema';
import { generateSchemaDescription, initExtractionSession } from '../agent-tools/tools/extraction';
import { modelNames } from '../ai/config';
import { getProviderForSlot } from '../ai/providers';
import { embedAgentOutput } from '../rag/embedding-service';
import { embedRawText } from '../rag/raw-embedding-service';
import type { EventEmitter } from '../streaming/event-emitter';
import { AgentEventType } from '../streaming/event-types';

export interface ExtractionAgentInput {
  preQualificationId: string;
  rawText: string;
  inputType: 'pdf' | 'email' | 'freetext';
  metadata?: {
    from?: string;
    subject?: string;
    date?: string;
  };
}

export interface ExtractionAgentOutput {
  requirements: ExtractedRequirements;
  success: boolean;
  error?: string;
  activityLog: Array<{ timestamp: string; action: string; details?: string }>;
}

const completionSchema = z.object({
  requirements: z.record(z.string(), z.any()).optional(),
  fieldsExtracted: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).default(0.5),
});

/**
 * Build the system prompt with schema description
 */
function buildSystemPrompt(inputType: string, metadata?: ExtractionAgentInput['metadata']): string {
  const schemaDesc = generateSchemaDescription();

  return `Du bist der Extraction Agent. Deine Aufgabe ist es, strukturierte Anforderungen aus Dokumenten zu extrahieren.

## WICHTIG: Extraktions-Reihenfolge

1. **projectGoal ZUERST** - Das Projektziel ist der "Nordstern" für alle weiteren Analysen
2. Dann: customerName, projectName, projectDescription
3. Dann: Technische Details (technologies, cmsConstraints)
4. Dann: Business Details (budgetRange, timeline, submissionDeadline)
5. Dann: Kontakte und Deliverables
6. Zuletzt: prequal.complete aufrufen

## Verfügbare Tools

- **prequal.query**: Suche im Dokument nach spezifischen Informationen
- **prequal.set**: Setze ein Feld mit dem extrahierten Wert
- **prequal.get**: Prüfe den aktuellen Extraktionsstand
- **prequal.complete**: Schließe die Extraktion ab

## Schema

${schemaDesc}

## Regeln

1. Nutze prequal.query BEVOR du prequal.set aufrufst
2. Setze nur Felder, für die du Evidenz im Dokument findest
3. Bei projectGoal: Extrahiere objective, businessDrivers, successCriteria
4. Confidence-Werte: 0-100 für Objekt-Felder, wie sicher bist du?
5. Rufe prequal.complete auf wenn alle relevanten Felder extrahiert sind

## Dokument-Typ: ${inputType}
${metadata?.subject ? `Betreff: ${metadata.subject}` : ''}
${metadata?.from ? `Von: ${metadata.from}` : ''}
${metadata?.date ? `Datum: ${metadata.date}` : ''}
`;
}

async function inferSubmissionDeadline(rawText: string): Promise<{
  submissionDeadline?: string;
  submissionTime?: string;
  rawText?: string;
}> {
  const prompt = `Extract the bid submission deadline from this document.
Return JSON ONLY with keys: submissionDeadline (YYYY-MM-DD), submissionTime (HH:MM, optional), rawText (snippet).
If no deadline is present, return {}.

Document:
${rawText.slice(0, 9000)}`.trim();

  const { text } = await generateText({
    model: getProviderForSlot('fast')(modelNames.fast),
    prompt,
  });

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return {};
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      submissionDeadline?: string;
      submissionTime?: string;
      rawText?: string;
    };
    return parsed;
  } catch {
    return {};
  }
}

/**
 * Run the Agent-Native Extraction
 */
export async function runExtractionAgentNative(
  input: ExtractionAgentInput,
  emit?: EventEmitter
): Promise<ExtractionAgentOutput> {
  const activityLog: Array<{ timestamp: string; action: string; details?: string }> = [];

  const logActivity = (action: string, details?: string) => {
    const entry = { timestamp: new Date().toISOString(), action, details };
    activityLog.push(entry);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Extraktion', message: details || action },
    });
  };

  try {
    logActivity('Start', `Starte Agent-Native Extraktion für ${input.inputType}`);

    // Step 1: Embed the raw text into RAG
    logActivity('Embedding', 'Erstelle Dokument-Embeddings für semantische Suche...');
    const embedResult = await embedRawText(input.preQualificationId, input.rawText);

    if (!embedResult.success) {
      throw new Error(`Embedding failed: ${embedResult.error}`);
    }

    logActivity('Embedding', `${embedResult.chunkCount} Chunks erstellt`);

    // Step 2: Initialize extraction session
    initExtractionSession(input.preQualificationId);

    // Step 3: Build tool context
    const toolContext: ToolContext = {
      userId: 'system',
      userRole: 'admin',
      userEmail: 'system@dealhunter.local',
      userName: 'Extraction Agent',
    };

    // Step 4: Create tools for the agent using AI SDK tool() helper
    let hasQueriedDocument = false;

    const runTool = tool({
      description: 'Execute a registered tool by name',
      inputSchema: z.object({
        name: z.string().describe('Tool name (e.g., prequal.query, prequal.set)'),
        input: z
          .record(z.string(), z.any())
          .describe('Tool input parameters'),
      }),
      execute: async ({ name, input: toolInput }) => {
        if (name === 'prequal.query') {
          hasQueriedDocument = true;
        }

        if (name === 'prequal.set' && !hasQueriedDocument) {
          const error = 'prequal.set requires prior prequal.query in this session.';
          logActivity(`Tool Error: ${name}`, error);
          return { success: false, error };
        }

        logActivity(`Tool: ${name}`, JSON.stringify(toolInput).slice(0, 100));

        const result = await registry.execute(name, toolInput, toolContext);

        if (!result.success) {
          logActivity(`Tool Error: ${name}`, result.error);
        }

        return result;
      },
    });

    const completeExtraction = tool({
      description: 'Finalize the extraction after all fields are set',
      inputSchema: completionSchema,
      execute: async (payload) => {
        logActivity('Complete', `Extracted ${payload.fieldsExtracted.length} fields`);
        return { success: true, payload };
      },
    });

    // Step 5: Create and run the agent
    const systemPrompt = buildSystemPrompt(input.inputType, input.metadata);

    const agent = new ToolLoopAgent({
      model: getProviderForSlot('default')(modelNames.default),
      instructions: systemPrompt,
      tools: { runTool, completeExtraction },
      stopWhen: [stepCountIs(50), hasToolCall('completeExtraction')],
    });

    logActivity('Agent', 'Starte Extraktion...');

    // Build initial prompt
    const prompt = `
Pre-Qualification ID: ${input.preQualificationId}
Dokument-Typ: ${input.inputType}

Beginne mit der Extraktion. Starte mit prequal.query um das Projektziel zu finden, dann setze projectGoal.

Nutze die Tools um alle relevanten Felder zu extrahieren.
`.trim();

    const result = await agent.generate({ prompt });

    // Step 6: Get final extraction result
    const completionCall = result.steps
      .flatMap((step) => step.toolCalls)
      .find((call) => call.toolName === 'completeExtraction');

    // Call prequal.complete to get validated requirements
    const completeResult = await registry.execute<{ requirements: ExtractedRequirements }>(
      'prequal.complete',
      {
        preQualificationId: input.preQualificationId,
        confidenceScore:
          (completionCall?.input as { confidenceScore?: number })?.confidenceScore ?? 0.5,
      },
      toolContext
    );

    if (!completeResult.success || !completeResult.data) {
      throw new Error(completeResult.error || 'Failed to complete extraction');
    }

    const requirements = completeResult.data.requirements;

    if (!requirements.submissionDeadline && input.rawText?.length) {
      const inferred = await inferSubmissionDeadline(input.rawText);
      if (inferred.submissionDeadline) {
        requirements.submissionDeadline = inferred.submissionDeadline;
      }
      if (inferred.submissionTime) {
        requirements.submissionTime = inferred.submissionTime;
      }
    }

    // Step 7: Embed structured requirements into RAG
    logActivity('RAG', 'Speichere extrahierte Daten in Knowledge Base...');
    embedAgentOutput(
      input.preQualificationId,
      'extract',
      requirements as unknown as Record<string, unknown>
    ).catch((err) => {
      console.error('Failed to embed extraction results:', err);
    });

    // Report what was found
    const foundItems: string[] = [];
    if (requirements.customerName) foundItems.push('Kunde');
    if (requirements.projectGoal) foundItems.push('Projektziel');
    if (requirements.projectName) foundItems.push('Projektname');
    if (requirements.projectDescription) foundItems.push('Beschreibung');
    if (requirements.technologies?.length) foundItems.push(`${requirements.technologies.length} Technologien`);
    if (requirements.budgetRange) foundItems.push('Budget');
    if (requirements.contacts?.length) foundItems.push(`${requirements.contacts.length} Kontakte`);
    if (requirements.submissionDeadline) foundItems.push('Abgabefrist');

    logActivity('Fertig', `Extrahiert: ${foundItems.join(', ') || 'keine Daten'}`);

    return {
      requirements,
      success: true,
      activityLog,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logActivity('Fehler', errorMessage);
    console.error('[Extraction Agent] Failed:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    emit?.({
      type: AgentEventType.ERROR,
      data: { message: errorMessage, code: 'EXTRACTION_FAILED' },
    });

    return {
      requirements: {
        technologies: [],
        keyRequirements: [],
        confidenceScore: 0,
        extractedAt: new Date().toISOString(),
      },
      success: false,
      error: errorMessage,
      activityLog,
    };
  }
}

/**
 * Legacy wrapper for backwards compatibility
 * Maps to the new agent-native implementation
 */
export async function extractRequirements(
  input: ExtractionAgentInput,
  emit?: EventEmitter
): Promise<ExtractionAgentOutput> {
  return runExtractionAgentNative(input, emit);
}
