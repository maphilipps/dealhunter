import { extractedRequirementsSchema, type ExtractedRequirements } from './schema';

import { openai } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

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

    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: `You are a business development analyst at adesso SE, a leading IT consulting company.
Extract structured requirements from bid/project inquiries with high accuracy.

CRITICAL: Extract ALL of the following data with confidence scores:

1. BUDGET RANGE:
   - Parse budget from text (e.g., "50-100k EUR", "bis 200.000€", "ca. 75k")
   - Extract min/max as numbers (50000, 100000)
   - Identify currency (EUR, USD, GBP, CHF)
   - If range unclear, estimate from context
   - Single values: add ±10% buffer (e.g., "75k" → min: 67500, max: 82500)
   - Upper bound only ("bis 200k"): min: 0, max: 200000
   - Lower bound only ("ab 50k"): min: 50000, max: null
   - "ca./ungefähr": add ±20% buffer
   - Confidence: 0-100 based on clarity

2. CMS CONSTRAINTS:
   - Identify REQUIRED CMS: "Drupal only", "muss Typo3 sein" → required: ["Drupal"], flexibility: "rigid"
   - Identify PREFERRED CMS: "WordPress bevorzugt", "idealerweise Drupal" → preferred: ["WordPress"], flexibility: "preferred"
   - Identify EXCLUDED CMS: "kein WordPress", "nicht Joomla" → excluded: ["Joomla"]
   - No mention: flexibility: "unknown"
   - Confidence: 0-100 based on clarity

3. DELIVERABLES TIMELINE:
   - Extract submission deadlines per deliverable
   - Parse dates to ISO format YYYY-MM-DD
   - Parse exact times if mentioned (HH:MM)
   - Mark mandatory vs. optional deliverables
   - Confidence: 0-100 per deliverable

4. CONTACT CATEGORIZATION:
   - Decision Makers: CTO, IT-Leiter, Geschäftsführer, Vorstand, CEO, Director
   - Influencers: Projektleiter, Fachbereichsleiter, Team Lead, Manager
   - Coordinators: Sachbearbeiter, Assistenz, Einkauf, Administrator
   - Unknown: Role unclear
   - Confidence: 0-100 per contact

5. WEBSITE URLs:
   - Look for any URLs mentioned (http/https links, www. domains)
   - Look for domain names even without http (e.g., "customer.com", "example.de")
   - Consider the customer name and try to identify their likely website
   - For sports organizations, look for official league/team websites
   - For companies, look for corporate websites, product sites, regional sites

Provide accurate extractions and a confidence score (0-1) based on how complete and clear the information is.

Return a valid JSON object that matches this schema.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedResponse) as unknown;
    const validated = extractedRequirementsSchema.parse(parsed);

    const requirements: ExtractedRequirements = {
      ...validated,
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

    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: `You are a business development analyst at adesso SE, a leading IT consulting company.
Extract structured requirements from bid/project inquiries with high accuracy.

CRITICAL: Extract ALL of the following data with confidence scores:

1. BUDGET RANGE:
   - Parse budget from text (e.g., "50-100k EUR", "bis 200.000€", "ca. 75k")
   - Extract min/max as numbers (50000, 100000)
   - Identify currency (EUR, USD, GBP, CHF)
   - If range unclear, estimate from context
   - Single values: add ±10% buffer (e.g., "75k" → min: 67500, max: 82500)
   - Upper bound only ("bis 200k"): min: 0, max: 200000
   - Lower bound only ("ab 50k"): min: 50000, max: null
   - "ca./ungefähr": add ±20% buffer
   - Confidence: 0-100 based on clarity

2. CMS CONSTRAINTS:
   - Identify REQUIRED CMS: "Drupal only", "muss Typo3 sein" → required: ["Drupal"], flexibility: "rigid"
   - Identify PREFERRED CMS: "WordPress bevorzugt", "idealerweise Drupal" → preferred: ["WordPress"], flexibility: "preferred"
   - Identify EXCLUDED CMS: "kein WordPress", "nicht Joomla" → excluded: ["Joomla"]
   - No mention: flexibility: "unknown"
   - Confidence: 0-100 based on clarity

3. DELIVERABLES TIMELINE:
   - Extract submission deadlines per deliverable
   - Parse dates to ISO format YYYY-MM-DD
   - Parse exact times if mentioned (HH:MM)
   - Mark mandatory vs. optional deliverables
   - Confidence: 0-100 per deliverable

4. CONTACT CATEGORIZATION:
   - Decision Makers: CTO, IT-Leiter, Geschäftsführer, Vorstand, CEO, Director
   - Influencers: Projektleiter, Fachbereichsleiter, Team Lead, Manager
   - Coordinators: Sachbearbeiter, Assistenz, Einkauf, Administrator
   - Unknown: Role unclear
   - Confidence: 0-100 per contact

5. WEBSITE URLs:
   - Look for any URLs mentioned (http/https links, www. domains)
   - Look for domain names even without http (e.g., "customer.com", "example.de")
   - Consider the customer name and try to identify their likely website
   - For sports organizations, look for official league/team websites
   - For companies, look for corporate websites, product sites, regional sites

Provide accurate extractions and a confidence score (0-1) based on how complete and clear the information is.

Return a valid JSON object that matches this schema.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedResponse) as unknown;
    const result = { object: extractedRequirementsSchema.parse(parsed) };

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
    if (parsedResult.budgetRange) foundItems.push('Budget');
    if (parsedResult.cmsConstraints) foundItems.push('CMS-Vorgaben');
    if (parsedResult.contacts && parsedResult.contacts.length > 0) {
      foundItems.push(`${parsedResult.contacts.length} Kontakte`);
    }
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
