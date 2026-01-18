import OpenAI from 'openai';
import { extractedRequirementsSchema, type ExtractedRequirements } from './schema';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

/**
 * Recursively remove null values from an object or array
 * Zod's .optional() accepts undefined but not null
 */
function removeNullValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return undefined as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeNullValues(item)) as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = removeNullValues(value);
      }
    }
    return result as T;
  }
  return obj;
}

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
 * Uses native OpenAI SDK with adesso AI Hub (gemini-3-pro-preview)
 */
export async function extractRequirements(
  input: ExtractionInput
): Promise<ExtractionOutput> {
  try {
    const prompt = buildExtractionPrompt(input);

    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: 'You are a business development analyst. Always respond with valid JSON matching the requested schema. Do not include markdown code blocks or any other formatting - just the raw JSON object.',
        },
        {
          role: 'user',
          content: prompt + `

IMPORTANT: Actively search for website URLs in the document!
- Look for any URLs mentioned (http/https links, www. domains)
- Look for domain names even without http (e.g., "customer.com", "example.de")
- Consider the customer name and try to identify their likely website
- For sports organizations, look for official league/team websites
- For companies, look for corporate websites, product sites, regional sites

Respond with a JSON object containing these fields:
- customerName (string, required): Name of the customer
- industry (string, optional): Industry sector
- companySize (string, optional): "startup", "small", "medium", "large", or "enterprise"
- employeeCountRange (string, optional): e.g., "100-500" or "1000+"
- revenueRange (string, optional): e.g., "10-50 Mio EUR"
- procurementType (string, optional): "public", "private", or "semi-public"
- industryVertical (string, optional): Specific industry sub-sector
- companyLocation (string, optional): Company headquarters or main location
- websiteUrls (array of objects, optional): Array of website URLs found or inferred:
  - url (string): The full URL (add https:// if missing)
  - type (string: "primary", "product", "regional", or "related"): Type of website
  - description (string, optional): Brief description
  - extractedFromDocument (boolean): true if found in document, false if inferred
- websiteUrl (string, optional): Primary customer website URL (deprecated, for backwards compatibility)
- projectDescription (string, required): Project description
- projectName (string, optional): Project name
- technologies (array of strings, required): Technologies mentioned
- scope (string, optional): Project scope
- budgetRange (string, optional): Budget if mentioned
- timeline (string, optional): Timeline if mentioned
- teamSize (number, optional): Team size if mentioned
- keyRequirements (array of strings, required): Key requirements
- constraints (array of strings, optional): Constraints
- confidenceScore (number 0-1, required): Your confidence in the extraction
- extractedAt (string, required): Current ISO timestamp`,
        },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse and validate response
    let parsedResult: ExtractedRequirements;
    try {
      // Clean up response (remove markdown code blocks if present)
      // Use robust regex to handle various whitespace patterns
      const cleanedResponse = responseText
        .replace(/^```json\s*/i, '')   // Remove opening ```json
        .replace(/\s*```\s*$/i, '')     // Remove closing ```
        .replace(/```json\s*/gi, '')    // Remove any remaining ```json
        .replace(/```\s*/g, '')         // Remove any remaining ```
        .trim();

      let rawResult;
      try {
        rawResult = JSON.parse(cleanedResponse);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        console.error('Cleaned response length:', cleanedResponse.length);
        console.error('First 300 chars:', cleanedResponse.substring(0, 300));
        console.error('Last 300 chars:', cleanedResponse.substring(cleanedResponse.length - 300));
        throw jsonError;
      }

      // Recursively remove null values (Zod .optional() doesn't accept null)
      const cleanedResult = removeNullValues(rawResult);

      // Validate with Zod schema
      parsedResult = extractedRequirementsSchema.parse({
        ...cleanedResult,
        extractedAt: cleanedResult.extractedAt || new Date().toISOString(),
        technologies: cleanedResult.technologies || [],
        keyRequirements: cleanedResult.keyRequirements || [],
        confidenceScore: cleanedResult.confidenceScore || 0.5,
        websiteUrls: cleanedResult.websiteUrls || [],
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      console.error('Parse error details:', parseError);
      return {
        requirements: getEmptyRequirements(),
        success: false,
        error: 'Failed to parse AI response',
      };
    }

    return {
      requirements: parsedResult,
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

    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: 'You are a business development analyst. Always respond with valid JSON matching the requested schema. Do not include markdown code blocks or any other formatting - just the raw JSON object.',
        },
        {
          role: 'user',
          content: prompt + `

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

Respond with a JSON object containing these fields:
- customerName (string, required): Name of the customer
- industry (string, optional): Industry sector
- websiteUrls (array of objects, optional): Array of website URLs found or inferred:
  - url (string): The full URL (add https:// if missing)
  - type (string: "primary", "product", "regional", or "related"): Type of website
  - description (string, optional): Brief description
  - extractedFromDocument (boolean): true if found in document, false if inferred
- websiteUrl (string, optional): Primary customer website URL (deprecated, for backwards compatibility)
- projectDescription (string, required): Project description
- projectName (string, optional): Project name
- technologies (array of strings, required): Technologies mentioned
- scope (string, optional): Project scope
- budgetRange (string, optional): Budget if mentioned
- timeline (string, optional): Timeline if mentioned
- teamSize (number, optional): Team size if mentioned
- submissionDeadline (string, optional): Deadline for bid submission in ISO format YYYY-MM-DD
- submissionTime (string, optional): Exact time for submission if specified (HH:MM)
- projectStartDate (string, optional): Expected project start date (YYYY-MM-DD)
- projectEndDate (string, optional): Expected project end date (YYYY-MM-DD)
- requiredDeliverables (array of objects, optional): Documents/deliverables to be submitted:
  - name (string): Name of the deliverable
  - description (string, optional): Description of what is required
  - format (string, optional): Required format (e.g., PDF, Word, hardcopy)
  - copies (number, optional): Number of copies required
  - mandatory (boolean): Whether this deliverable is mandatory
- contactPerson (string, optional): Name of contact person at customer
- contactEmail (string, optional): Email of contact person
- contactPhone (string, optional): Phone number of contact person
- keyRequirements (array of strings, required): Key requirements
- constraints (array of strings, optional): Constraints
- confidenceScore (number 0-1, required): Your confidence in the extraction
- extractedAt (string, required): Current ISO timestamp`,
        },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    // Step 3: Parsing response
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: 'Verarbeite AI-Antwort...',
      },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse and validate response
    let parsedResult: ExtractedRequirements;
    try {
      // Clean up response (remove markdown code blocks if present)
      // Use robust regex to handle various whitespace patterns
      const cleanedResponse = responseText
        .replace(/^```json\s*/i, '')   // Remove opening ```json
        .replace(/\s*```\s*$/i, '')     // Remove closing ```
        .replace(/```json\s*/gi, '')    // Remove any remaining ```json
        .replace(/```\s*/g, '')         // Remove any remaining ```
        .trim();

      let rawResult;
      try {
        rawResult = JSON.parse(cleanedResponse);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        console.error('Cleaned response length:', cleanedResponse.length);
        console.error('First 300 chars:', cleanedResponse.substring(0, 300));
        console.error('Last 300 chars:', cleanedResponse.substring(cleanedResponse.length - 300));
        throw jsonError;
      }

      // Recursively remove null values (Zod .optional() doesn't accept null)
      const cleanedResult = removeNullValues(rawResult);

      // Step 4: Validating extracted data
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Extraktion',
          message: 'Validiere extrahierte Daten...',
        },
      });

      // Validate with Zod schema
      parsedResult = extractedRequirementsSchema.parse({
        ...cleanedResult,
        extractedAt: cleanedResult.extractedAt || new Date().toISOString(),
        technologies: cleanedResult.technologies || [],
        keyRequirements: cleanedResult.keyRequirements || [],
        confidenceScore: cleanedResult.confidenceScore || 0.5,
        websiteUrls: cleanedResult.websiteUrls || [],
      });

      // Step 5: Extraction complete - report what was found
      const foundItems: string[] = [];
      if (parsedResult.customerName) foundItems.push('Kunde');
      if (parsedResult.technologies.length > 0) foundItems.push(`${parsedResult.technologies.length} Technologien`);
      if (parsedResult.keyRequirements.length > 0) foundItems.push(`${parsedResult.keyRequirements.length} Anforderungen`);
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

    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      console.error('Parse error details:', parseError);
      emit({
        type: AgentEventType.ERROR,
        data: {
          message: 'AI-Antwort konnte nicht verarbeitet werden',
          code: 'PARSE_ERROR',
        },
      });
      return {
        requirements: getEmptyRequirements(),
        success: false,
        error: 'Failed to parse AI response',
      };
    }

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
