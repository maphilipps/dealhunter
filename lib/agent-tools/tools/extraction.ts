/**
 * Agent-Native Extraction Tools
 *
 * Tools for the Extraction Agent to extract structured requirements from documents.
 * Uses a generic set/get pattern with schema validation.
 */

import { z } from 'zod';

import { extractedRequirementsSchema, type ExtractedRequirements } from '../../extraction/schema';
import { queryRawChunks, formatRAGContext } from '../../rag/raw-retrieval-service';
import { registry } from '../registry';
import type { ToolContext } from '../types';

/**
 * In-memory state for extraction sessions
 * Key: preQualificationId, Value: partial ExtractedRequirements
 */
const extractionSessions = new Map<string, Partial<ExtractedRequirements>>();

/**
 * Get the list of valid field names from the schema
 */
const VALID_FIELDS = Object.keys(extractedRequirementsSchema.shape) as Array<
  keyof ExtractedRequirements
>;

/**
 * Generate a human-readable schema description for the system prompt
 */
export function generateSchemaDescription(): string {
  const lines: string[] = ['Available fields for extraction:'];

  // Manually describe key fields for the agent
  const fieldDescriptions: Record<string, string> = {
    customerName: 'string - Name of the customer company',
    industry: 'string - Industry sector',
    projectGoal:
      'object { objective, successCriteria[], businessDrivers[], strategicContext, mustNotFail[], confidence } - The North Star for all analysis',
    projectName: 'string - Project title',
    projectDescription: 'string - Detailed project description',
    technologies: 'string[] - List of technologies mentioned',
    scope: 'string - Project scope (development, migration, consulting)',
    cmsConstraints:
      'object { required[], preferred[], excluded[], flexibility, confidence, rawText } - CMS requirements',
    budgetRange: 'object { min, max, currency, confidence, rawText } - Budget information',
    timeline: 'string - Project timeline',
    submissionDeadline: 'string (YYYY-MM-DD) - Deadline for bid submission',
    submissionTime: 'string (HH:MM) - Exact submission time',
    projectStartDate: 'string (YYYY-MM-DD) - Expected start date',
    projectEndDate: 'string (YYYY-MM-DD) - Expected end date',
    requiredDeliverables: 'array of { name, description, deadline, format, mandatory, confidence }',
    contacts: 'array of { name, role, email, phone, category, confidence }',
    keyRequirements: 'string[] - Key functional/non-functional requirements',
    constraints: 'string[] - Constraints or limitations',
    websiteUrls: 'array of { url, type, description, extractedFromDocument }',
  };

  for (const [key, desc] of Object.entries(fieldDescriptions)) {
    lines.push(`- ${key}: ${desc}`);
  }

  return lines.join('\n');
}

/**
 * Get field schema for validation
 */
function getFieldSchema(field: string): z.ZodTypeAny | undefined {
  return (extractedRequirementsSchema.shape as Record<string, z.ZodTypeAny>)[field];
}

// ===== Tool: prequal.query =====

const queryInputSchema = z.object({
  preQualificationId: z.string().describe('The qualification ID to query'),
  query: z.string().describe('Natural language query to search in the document'),
  language: z.enum(['de', 'en']).default('de').describe('Query language'),
  topK: z.number().min(1).max(20).default(5).describe('Number of chunks to retrieve'),
});

registry.register({
  name: 'prequal.query',
  description:
    'Query the document using RAG to find relevant information. Use this to search for specific data before setting fields.',
  category: 'extraction',
  inputSchema: queryInputSchema,
  async execute(input) {
    try {
      const chunks = await queryRawChunks({
        preQualificationId: input.preQualificationId,
        question: input.query,
        maxResults: input.topK,
      });

      if (chunks.length === 0) {
        return {
          success: true,
          data: {
            found: false,
            context: 'No relevant information found in the document.',
            chunks: [],
          },
        };
      }

      const context = formatRAGContext(chunks);

      return {
        success: true,
        data: {
          found: true,
          context,
          chunks: chunks.map(c => ({
            text: c.content,
            score: c.similarity,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// ===== Tool: prequal.set =====

const setInputSchema = z.object({
  preQualificationId: z.string().describe('The qualification ID'),
  field: z.string().describe('The field name to set'),
  value: z.unknown().describe('The value to set for the field'),
});

registry.register({
  name: 'prequal.set',
  description: `Set a field value in the extraction. Validates against the schema. 
Use prequal.query first to find relevant information, then set the extracted value.
For complex objects (budgetRange, projectGoal, contacts), provide the full object structure.`,
  category: 'extraction',
  inputSchema: setInputSchema,
  async execute(input) {
    // Check if field is valid
    if (!VALID_FIELDS.includes(input.field as keyof ExtractedRequirements)) {
      return {
        success: false,
        error: `Unknown field '${input.field}'. Valid fields: ${VALID_FIELDS.join(', ')}`,
      };
    }

    // Get field schema and validate
    const fieldSchema = getFieldSchema(input.field);
    if (!fieldSchema) {
      return {
        success: false,
        error: `No schema found for field '${input.field}'`,
      };
    }

    // Validate the value
    const parseResult = fieldSchema.safeParse(input.value);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid value for field '${input.field}': ${parseResult.error.message}`,
      };
    }

    // Get or create session
    let session = extractionSessions.get(input.preQualificationId);
    if (!session) {
      session = { technologies: [], keyRequirements: [] };
      extractionSessions.set(input.preQualificationId, session);
    }

    // Set the value
    (session as Record<string, unknown>)[input.field] = parseResult.data;

    return {
      success: true,
      data: {
        field: input.field,
        value: parseResult.data,
        message: `Field '${input.field}' set successfully`,
      },
    };
  },
});

// ===== Tool: prequal.get =====

const getInputSchema = z.object({
  preQualificationId: z.string().describe('The qualification ID'),
  field: z.string().optional().describe('Specific field to get, or omit for all fields'),
});

registry.register({
  name: 'prequal.get',
  description: 'Get the current extraction state. Use to check what has been extracted so far.',
  category: 'extraction',
  inputSchema: getInputSchema,
  async execute(input): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const session = extractionSessions.get(input.preQualificationId);

    if (!session) {
      return {
        success: true,
        data: {
          exists: false,
          state: null,
          message: 'No extraction session found. Use prequal.set to start extracting.',
        },
      };
    }

    if (input.field) {
      const value = (session as Record<string, unknown>)[input.field];
      return {
        success: true,
        data: {
          exists: true,
          field: input.field,
          value: value ?? null,
          isSet: value !== undefined,
        },
      };
    }

    // Return summary of what's set
    const setFields = Object.entries(session)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k]) => k);

    const missingFields = VALID_FIELDS.filter(
      f => !setFields.includes(f) && f !== 'extractedAt' && f !== 'confidenceScore'
    );

    return {
      success: true,
      data: {
        exists: true,
        setFields,
        missingFields: missingFields.slice(0, 10), // Top 10 missing
        state: session,
      },
    };
  },
});

// ===== Tool: prequal.complete =====

const completeInputSchema = z.object({
  preQualificationId: z.string().describe('The qualification ID'),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe('Overall confidence in the extraction (0-1)'),
});

registry.register({
  name: 'prequal.complete',
  description:
    'Complete the extraction and validate against the full schema. Call this when all relevant fields have been extracted.',
  category: 'extraction',
  inputSchema: completeInputSchema,
  async execute(input): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const session = extractionSessions.get(input.preQualificationId);

    if (!session) {
      return {
        success: false,
        error: 'No extraction session found. Use prequal.set to extract fields first.',
      };
    }

    // Add metadata
    session.confidenceScore = input.confidenceScore;
    session.extractedAt = new Date().toISOString();

    // Ensure required arrays have defaults
    if (!session.technologies) session.technologies = [];
    if (!session.keyRequirements) session.keyRequirements = [];

    // Validate against full schema
    const parseResult = extractedRequirementsSchema.safeParse(session);

    if (!parseResult.success) {
      return {
        success: false,
        error: `Validation failed: ${parseResult.error.message}`,
        data: {
          validationErrors: parseResult.error.issues,
          currentState: session,
        },
      };
    }

    // Clean up session
    extractionSessions.delete(input.preQualificationId);

    return {
      success: true,
      data: {
        requirements: parseResult.data,
        message: 'Extraction completed and validated successfully',
      },
    };
  },
});

// ===== Tool: prequal.reset =====

const resetInputSchema = z.object({
  preQualificationId: z.string().describe('The qualification ID'),
});

registry.register({
  name: 'prequal.reset',
  description: 'Reset the extraction session and start fresh.',
  category: 'extraction',
  inputSchema: resetInputSchema,
  async execute(input) {
    extractionSessions.delete(input.preQualificationId);

    return {
      success: true,
      data: {
        message: 'Extraction session reset',
      },
    };
  },
});

/**
 * Get extraction session for external access (e.g., from agent)
 */
export function getExtractionSession(
  preQualificationId: string
): Partial<ExtractedRequirements> | undefined {
  return extractionSessions.get(preQualificationId);
}

/**
 * Initialize extraction session with existing data
 */
export function initExtractionSession(
  preQualificationId: string,
  initialData?: Partial<ExtractedRequirements>
): void {
  extractionSessions.set(
    preQualificationId,
    initialData ?? { technologies: [], keyRequirements: [] }
  );
}
