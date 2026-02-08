/**
 * Agent-Native Extraction
 *
 * Uses ToolLoopAgent to extract structured requirements from documents.
 * The agent decides which fields to extract and in which order.
 *
 * Key principle: Extract projectGoal FIRST as it guides all other extraction.
 */

import * as Sentry from '@sentry/nextjs';
import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { registry, executeRegistryTool, wrapRegistryTools } from '../agent-tools';
import type { ToolContext } from '../agent-tools';
import type { WrapOptions } from '../agent-tools/ai-sdk-bridge';
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
  requirements: z.object({}).passthrough().optional(),
  fieldsExtracted: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).default(0.5),
});

/**
 * Build the system prompt with schema description
 */
function buildSystemPrompt(
  inputType: string,
  metadata?: ExtractionAgentInput['metadata'],
  options?: {
    language?: 'de' | 'en';
    prePopulatedFields?: string[];
  }
): string {
  const schemaDesc = generateSchemaDescription();
  const lang = options?.language || 'de';
  const prePopulated = options?.prePopulatedFields || [];

  // Language-specific query hints
  const queryHints =
    lang === 'en'
      ? `
## Query Language Hints (Document is in ENGLISH)
Use English terms for queries:
- Customer: "client", "organization", "agency", "company", "procuring entity"
- Budget: "budget", "cost", "price", "funding", "value"
- Deadline: "deadline", "due date", "submission date", "closing date"
- Requirements: "requirements", "specifications", "deliverables", "scope"
- Contact: "contact", "point of contact", "representative", "email"`
      : `
## Query-Hinweise (Dokument ist auf DEUTSCH)
Nutze deutsche Begriffe für Queries:
- Kunde: "Auftraggeber", "Vergabestelle", "Kunde", "Organisation"
- Budget: "Budget", "Kosten", "Auftragswert", "Vergütung"
- Deadline: "Abgabefrist", "Einreichungsfrist", "Deadline"
- Anforderungen: "Anforderungen", "Leistungen", "Pflichtenheft"
- Kontakt: "Ansprechpartner", "Kontakt", "E-Mail"`;

  const prePopulatedInfo =
    prePopulated.length > 0
      ? `\n\n## Bereits extrahierte Felder (aus Header-Scan)\nDiese Felder wurden bereits extrahiert: ${prePopulated.join(', ')}\nDu kannst diese überschreiben, wenn du bessere Informationen findest.\n`
      : '';

  return `Du bist der Extraction Agent. Deine Aufgabe ist es, strukturierte Anforderungen aus Dokumenten zu extrahieren.

## WICHTIG: Extraktions-Reihenfolge

1. **projectGoal ZUERST** - Das Projektziel ist der "Nordstern" für alle weiteren Analysen
2. Dann: customerName, projectName, projectDescription
3. Dann: Technische Details (technologies, cmsConstraints)
4. Dann: Business Details (budgetRange, timeline, submissionDeadline)
5. Dann: Kontakte und Deliverables
6. Zuletzt: prequal.complete aufrufen
${prePopulatedInfo}
## Verfügbare Tools

- **prequal.query**: Suche im Dokument nach spezifischen Informationen
- **prequal.set**: Setze ein Feld mit dem extrahierten Wert
- **prequal.get**: Prüfe den aktuellen Extraktionsstand
- **prequal.complete**: Schließe die Extraktion ab
${queryHints}

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

const deadlineSchema = z.object({
  submissionDeadline: z.string().describe('YYYY-MM-DD format').optional(),
  submissionTime: z.string().describe('HH:MM format').optional(),
  rawText: z.string().describe('Original text snippet').optional(),
});

async function inferSubmissionDeadline(rawText: string): Promise<{
  submissionDeadline?: string;
  submissionTime?: string;
  rawText?: string;
}> {
  try {
    const prompt = `Extract the bid submission deadline from this document.
Return JSON ONLY with keys: submissionDeadline (YYYY-MM-DD), submissionTime (HH:MM, optional), rawText (snippet).
If no deadline is present, return {}.

Document:
${rawText.slice(0, 9000)}`.trim();

    const { output } = await generateText({
      model: (await getProviderForSlot('fast'))(modelNames.fast),
      output: Output.object({ schema: deadlineSchema }),
      prompt,
    });

    return output ?? {};
  } catch {
    return {};
  }
}

/**
 * Header Scanner - extracts critical fields from the document header
 *
 * Problem: RAG queries in German don't match English documents.
 * Solution: Direct LLM analysis of the first ~1500 chars to extract:
 * - customerName (who issued the RFP)
 * - projectName (title of the project/RFP)
 * - language (de/en for subsequent queries)
 */
const headerSchema = z.object({
  customerName: z.string().nullable().describe('Full organization/company name'),
  projectName: z.string().nullable().describe('The project or RFP title'),
  projectDescription: z
    .string()
    .nullable()
    .describe('Brief description if visible (max 200 chars)'),
  language: z.enum(['de', 'en']).default('de').describe('Primary document language'),
});

async function extractHeaderFields(rawText: string): Promise<{
  customerName?: string;
  projectName?: string;
  projectDescription?: string;
  language: 'de' | 'en';
}> {
  const header = rawText.slice(0, 2000);

  const prompt = `Analyze this document header and extract key information.

CRITICAL: Extract the ACTUAL organization/company name, not random text fragments.
Look for: Company names, agency names, "Vergabestelle", "Auftraggeber", "Client:", "From:", letterhead, logo text.

IMPORTANT: Use FULL organization names, NOT abbreviations!
- "SPL" → "Saudi Pro League"
- "BaFin" → "Bundesanstalt für Finanzdienstleistungsaufsicht"
- "DB" → "Deutsche Bahn AG"
- If you only see an abbreviation, expand it to the full name if you know it.

Document Header:
---
${header}
---

Return JSON with these fields:
{
  "customerName": "Full organization/company name (e.g. 'Saudi Pro League', 'Bundesministerium für Verkehr', 'Deutsche Bahn AG')",
  "projectName": "The project or RFP title",
  "projectDescription": "Brief description if visible (max 200 chars)",
  "language": "de" or "en" (primary document language)
}

If a field cannot be determined, use null. DO NOT guess or use random text fragments.`;

  try {
    const { output } = await generateText({
      model: (await getProviderForSlot('fast'))(modelNames.fast),
      output: Output.object({ schema: headerSchema }),
      prompt,
      temperature: 0,
    });

    return {
      customerName: output?.customerName ?? undefined,
      projectName: output?.projectName ?? undefined,
      projectDescription: output?.projectDescription ?? undefined,
      language: output?.language === 'en' ? 'en' : 'de',
    };
  } catch (error) {
    console.error('[Header Scanner] Failed:', error);
    return { language: 'de' };
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

    // Step 0: Header Scanner - extract critical fields directly from document header
    logActivity('Header-Scan', 'Analysiere Dokument-Header für Kundenname und Titel...');
    const headerFields = await extractHeaderFields(input.rawText);

    if (headerFields.customerName) {
      logActivity('Header-Scan', `Kunde gefunden: ${headerFields.customerName}`);
    }
    if (headerFields.projectName) {
      logActivity('Header-Scan', `Projekt gefunden: ${headerFields.projectName}`);
    }
    logActivity(
      'Header-Scan',
      `Sprache: ${headerFields.language === 'en' ? 'Englisch' : 'Deutsch'}`
    );

    // Step 1: Embed the raw text into RAG
    logActivity('Embedding', 'Erstelle Dokument-Embeddings für semantische Suche...');
    const embedResult = await embedRawText(input.preQualificationId, input.rawText);

    // If embedding fails, log a warning but continue — embedding failure should not block extraction.
    if (!embedResult.success && !embedResult.skipped) {
      Sentry.captureException(new Error(`Embedding failed: ${embedResult.error}`), {
        tags: { component: 'extraction', preQualificationId: input.preQualificationId },
        level: 'warning',
      });
    }

    const ragAvailable = embedResult.success || embedResult.skipped;
    const embeddedChunks = embedResult.stats?.totalChunks ?? 0;
    logActivity('Embedding', `${embeddedChunks} Chunks erstellt`);
    logActivity(
      'Embedding',
      ragAvailable ? 'RAG verfügbar' : 'RAG nicht verfügbar — Ergebnisse ohne semantische Suche'
    );

    // Step 2: Initialize extraction session with header fields
    const initialData: Partial<ExtractedRequirements> = {
      technologies: [],
      keyRequirements: [],
    };

    // Pre-populate from header scan
    if (headerFields.customerName) {
      initialData.customerName = headerFields.customerName;
    }
    if (headerFields.projectName) {
      initialData.projectName = headerFields.projectName;
    }
    if (headerFields.projectDescription) {
      initialData.projectDescription = headerFields.projectDescription;
    }

    initExtractionSession(input.preQualificationId, initialData);

    // Step 3: Build tool context
    const toolContext: ToolContext = {
      userId: 'system',
      userRole: 'admin',
      userEmail: 'system@dealhunter.local',
      userName: 'Extraction Agent',
    };

    // Step 4: Create tools for the agent — direct registry tools + completion tool
    let hasQueriedDocument = false;

    const wrapOptions: WrapOptions = {
      onExecute: (toolName, toolInput) => {
        if (toolName === 'prequal.query') {
          hasQueriedDocument = true;
        }
        logActivity(`Tool: ${toolName}`, JSON.stringify(toolInput).slice(0, 100));
      },
      onResult: (toolName, result) => {
        const r = result as { success: boolean; error?: string };
        if (!r.success) {
          logActivity(`Tool Error: ${toolName}`, r.error);
        }
      },
    };

    // Direct tools with proper Zod schemas (replaces meta-tool "runTool")
    const registryTools = wrapRegistryTools(
      ['prequal.query', 'prequal.get'],
      toolContext,
      wrapOptions
    );

    // prequal.set with guard: requires prior prequal.query
    const setDef = registry.get('prequal.set')!;
    registryTools['prequal.set'] = tool({
      description: setDef.description,
      inputSchema: setDef.inputSchema,
      execute: async (toolInput: unknown) => {
        if (!hasQueriedDocument) {
          const error = 'prequal.set requires prior prequal.query in this session.';
          logActivity('Tool Error: prequal.set', error);
          return { success: false, error };
        }
        return executeRegistryTool('prequal.set', toolInput, toolContext, wrapOptions);
      },
    });

    const completeExtraction = tool({
      description: 'Finalize the extraction after all fields are set',
      inputSchema: completionSchema,
      execute: async payload => {
        logActivity('Complete', `Extracted ${payload.fieldsExtracted.length} fields`);
        return { success: true, payload };
      },
    });

    // Step 5: Create and run the agent
    const prePopulatedFields = Object.keys(initialData).filter(
      k =>
        k !== 'technologies' &&
        k !== 'keyRequirements' &&
        initialData[k as keyof typeof initialData]
    );

    const systemPrompt = buildSystemPrompt(input.inputType, input.metadata, {
      language: headerFields.language,
      prePopulatedFields,
    });

    const agent = new ToolLoopAgent({
      model: (await getProviderForSlot('default'))(modelNames.default),
      instructions: systemPrompt,
      tools: { ...registryTools, completeExtraction },
      stopWhen: [stepCountIs(25), hasToolCall('completeExtraction')],
    });

    logActivity('Agent', 'Starte Extraktion...');

    // Build initial prompt with pre-populated fields info
    const prePopulatedInfo =
      prePopulatedFields.length > 0
        ? `\n\nBereits aus Header extrahiert:\n${prePopulatedFields.map(f => `- ${f}: ${JSON.stringify(initialData[f as keyof typeof initialData])}`).join('\n')}`
        : '';

    const prompt = `
Qualification ID: ${input.preQualificationId}
Dokument-Typ: ${input.inputType}
Dokument-Sprache: ${headerFields.language === 'en' ? 'Englisch' : 'Deutsch'}
${prePopulatedInfo}

Beginne mit der Extraktion. Starte mit prequal.query um das Projektziel zu finden, dann setze projectGoal.

Nutze die Tools um alle relevanten Felder zu extrahieren.
`.trim();

    const result = await agent.generate({
      prompt,
      onStepFinish: stepResult => {
        const toolNames =
          stepResult.toolCalls
            ?.filter((t): t is NonNullable<typeof t> => t != null)
            .map(t => t.toolName)
            .join(', ') || 'none';
        logActivity('Step completed', `Tools: ${toolNames}`);
      },
    });

    // Step 6: Get final extraction result
    const completionCall = result.steps
      .flatMap(step => step.toolCalls)
      .find(call => call.toolName === 'completeExtraction');

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
    ).catch(err => {
      console.error('Failed to embed extraction results:', err);
    });

    // Report what was found
    const foundItems: string[] = [];
    if (requirements.customerName) foundItems.push('Kunde');
    if (requirements.projectGoal) foundItems.push('Projektziel');
    if (requirements.projectName) foundItems.push('Projektname');
    if (requirements.projectDescription) foundItems.push('Beschreibung');
    if (requirements.technologies?.length)
      foundItems.push(`${requirements.technologies.length} Technologien`);
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
