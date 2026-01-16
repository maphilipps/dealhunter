import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { extractedRequirementsSchema, type ExtractedRequirements } from './schema';

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
 * Uses generateObject with Zod schema for type-safe extraction
 */
export async function extractRequirements(
  input: ExtractionInput
): Promise<ExtractionOutput> {
  try {
    const prompt = buildExtractionPrompt(input);

    const result = await generateObject({
      model: openai('gpt-4o-mini'), // Using gpt-4o-mini for faster extraction
      schema: extractedRequirementsSchema,
      prompt,
      temperature: 0.3, // Lower temperature for more consistent extraction
    });

    return {
      requirements: result.object,
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
- Customer name and industry
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
