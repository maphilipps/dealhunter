import { generateObject } from 'ai';
import { extractedRequirementsSchema, type ExtractedRequirements } from './schema';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Use Claude Haiku 4.5 via adesso AI Hub (OpenAI-compatible endpoint)
const model = 'openai/claude-haiku-4.5';

export interface ExtractionInput {
  rawText: string;
  inputType: 'pdf' | 'email' | 'freetext';
  metadata?: {
    from?: string;
    subject?: string;
    date?: string;
  };
}

export interface ExtractionOutput {
  requirements: ExtractedRequirements;
  success: boolean;
  error?: string;
}

/**
 * AI Agent for extracting structured requirements from bid documents
 * Uses Vercel AI SDK with generateObject for type-safe extraction
 */
export async function extractRequirements(input: ExtractionInput): Promise<ExtractionOutput> {
  try {
    const prompt = buildExtractionPrompt(input);

    const result = await generateObject({
      model,
      schema: extractedRequirementsSchema,
      system: `You are a business development analyst at adesso SE, a leading IT consulting company.
Extract structured requirements from bid/project inquiries with high accuracy.

IMPORTANT: Actively search for website URLs in the document!
- Look for any URLs mentioned (http/https links, www. domains)
- Look for domain names even without http (e.g., "customer.com", "example.de")
- Consider the customer name and try to identify their likely website
- For sports organizations, look for official league/team websites
- For companies, look for corporate websites, product sites, regional sites

Provide accurate extractions and a confidence score (0-1) based on how complete and clear the information is.`,
      prompt,
      temperature: 0.3,
    });

    const requirements: ExtractedRequirements = {
      ...result.object,
      extractedAt: new Date().toISOString(),
    };

    return {
      requirements,
      success: true,
    };
  } catch (error) {
    console.error('Extraction error:', error);
    return {
      requirements: getEmptyRequirements(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}

/**
 * Build extraction prompt based on input type
 */
function buildExtractionPrompt(input: ExtractionInput): string {
  const basePrompt = `You are an expert business development analyst at adesso SE, a leading IT consulting company.
Your task is to extract structured requirements from a bid/project inquiry.

Extract the following information accurately:
- Customer name, industry, and company details
- Company size, employee count, revenue range (if mentioned or can be inferred)
- Procurement type (public, private, or semi-public)
- Company location and headquarters
- Project description and name
- Technologies, frameworks, and platforms mentioned
- Project scope, budget, timeline, and team size (if mentioned)
- Key functional and non-functional requirements
- Any constraints or limitations

Be thorough but precise. If information is not mentioned, omit it or mark as unknown.
Provide a confidence score (0-1) based on how complete and clear the information is.

---

INPUT TYPE: ${input.inputType.toUpperCase()}
`;

  if (input.inputType === 'email' && input.metadata) {
    return `${basePrompt}

EMAIL METADATA:
From: ${input.metadata.from || 'Unknown'}
Subject: ${input.metadata.subject || 'Unknown'}
Date: ${input.metadata.date || 'Unknown'}

EMAIL CONTENT:
${input.rawText}
`;
  }

  return `${basePrompt}

DOCUMENT CONTENT:
${input.rawText}
`;
}

/**
 * Get empty requirements structure for error cases
 */
function getEmptyRequirements(): ExtractedRequirements {
  return {
    customerName: '',
    projectDescription: '',
    technologies: [],
    keyRequirements: [],
    confidenceScore: 0,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * AI Agent for extracting structured requirements with streaming support
 * Emits progress events during extraction for real-time UI updates
 */
export async function runExtractionWithStreaming(
  input: ExtractionInput,
  emit: EventEmitter
): Promise<ExtractionOutput> {
  try {
    // Step 1: Analyzing document
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `Analysiere ${input.inputType === 'pdf' ? 'PDF-Dokument' : input.inputType === 'email' ? 'E-Mail' : 'Freitext'}...`,
      },
    });

    const prompt = buildExtractionPrompt(input);

    // Step 2: Starting AI extraction
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: 'Starte AI-Extraktion der Anforderungen...',
      },
    });

    const result = await generateObject({
      model,
      schema: extractedRequirementsSchema,
      system: `You are a business development analyst at adesso SE, a leading IT consulting company.
Extract structured requirements from bid/project inquiries with high accuracy.

IMPORTANT: Actively search for website URLs in the document!
- Look for any URLs mentioned (http/https links, www. domains)
- Look for domain names even without http (e.g., "customer.com", "example.de")
- Consider the customer name and try to identify their likely website
- For sports organizations, look for official league/team websites
- For companies, look for corporate websites, product sites, regional sites

IMPORTANT: Look for submission deadlines and required deliverables!
- Search for submission deadlines (Abgabefrist, Einreichungsfrist, deadline)
- Look for exact times for submission
- Find required documents/deliverables that must be submitted
- Note any format requirements (PDF, hardcopy, number of copies)

Provide accurate extractions and a confidence score (0-1) based on how complete and clear the information is.`,
      prompt,
      temperature: 0.3,
    });

    // Step 3: Validating extracted data
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: 'Validiere extrahierte Daten...',
      },
    });

    const parsedResult: ExtractedRequirements = {
      ...result.object,
      extractedAt: new Date().toISOString(),
    };

    // Step 4: Extraction complete - report what was found
    const foundItems: string[] = [];
    if (parsedResult.customerName) foundItems.push('Kunde');
    if (parsedResult.technologies.length > 0)
      foundItems.push(`${parsedResult.technologies.length} Technologien`);
    if (parsedResult.keyRequirements.length > 0)
      foundItems.push(`${parsedResult.keyRequirements.length} Anforderungen`);
    if (parsedResult.submissionDeadline) foundItems.push('Abgabefrist');
    if (parsedResult.requiredDeliverables && parsedResult.requiredDeliverables.length > 0) {
      foundItems.push(`${parsedResult.requiredDeliverables.length} Unterlagen`);
    }
    if (parsedResult.websiteUrls && parsedResult.websiteUrls.length > 0) {
      foundItems.push(`${parsedResult.websiteUrls.length} Website-URLs`);
    }

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `Extraktion erfolgreich: ${foundItems.join(', ')}`,
        confidence: parsedResult.confidenceScore,
      },
    });

    return {
      requirements: parsedResult,
      success: true,
    };
  } catch (error) {
    console.error('Extraction error:', error);
    emit({
      type: AgentEventType.ERROR,
      data: {
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
        code: 'EXTRACTION_ERROR',
      },
    });
    return {
      requirements: getEmptyRequirements(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}
