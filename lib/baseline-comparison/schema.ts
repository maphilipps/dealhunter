import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Sanitized string schema (XSS prevention)
const sanitizedString = z.string().transform(val => {
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
});

/**
 * Baseline Item Categories
 * Maps to adessoCMS baseline entity types
 */
export const baselineCategorySchema = z
  .enum([
    'content_types',
    'paragraphs',
    'navigation',
    'features',
    'integrations',
    'media',
    'taxonomies',
    'forms',
  ])
  .describe('Kategorie des Baseline-Items');

/**
 * Single Baseline Item
 * Represents a feature/entity that may or may not be in the baseline
 */
export const baselineItemSchema = z.object({
  name: sanitizedString.describe('Name des Features/Entities'),
  category: baselineCategorySchema,
  inBaseline: z.boolean().describe('Ist dieses Item in der adesso-Baseline enthalten?'),
  baselineMatch: sanitizedString
    .optional()
    .describe('Name des entsprechenden Baseline-Items (wenn vorhanden)'),
  estimatedHours: z
    .number()
    .nonnegative()
    .optional()
    .describe('Geschätzte Stunden für Neuentwicklung (wenn nicht in Baseline)'),
  confidence: z.number().min(0).max(100).describe('Konfidenz der Zuordnung (0-100)'),
  reasoning: sanitizedString.optional().describe('Begründung für die Zuordnung'),
});

/**
 * Baseline Comparison Result
 * Complete result of comparing detected features with adesso baseline
 */
export const baselineComparisonResultSchema = z.object({
  // Summary
  totalItems: z.number().int().nonnegative().describe('Gesamtzahl analysierter Items'),
  baselineCoverage: z.number().min(0).max(100).describe('Prozentsatz der Baseline-Abdeckung'),

  // Categorized Items
  availableFromBaseline: z.array(baselineItemSchema).describe('Items die aus der Baseline kommen'),
  newDevelopment: z.array(baselineItemSchema).describe('Items die neu entwickelt werden müssen'),

  // Category Breakdown
  categoryBreakdown: z
    .array(
      z.object({
        category: baselineCategorySchema,
        totalCount: z.number().int().nonnegative(),
        fromBaseline: z.number().int().nonnegative(),
        newDevelopment: z.number().int().nonnegative(),
        coveragePercent: z.number().min(0).max(100),
      })
    )
    .describe('Aufschlüsselung nach Kategorien'),

  // Effort Estimation
  estimatedSavings: z.object({
    hoursFromBaseline: z
      .number()
      .nonnegative()
      .describe('Stunden die durch Baseline gespart werden'),
    hoursNewDevelopment: z.number().nonnegative().describe('Stunden für Neuentwicklung'),
    savingsPercent: z.number().min(0).max(100).describe('Prozentuale Ersparnis durch Baseline'),
  }),

  // Metadata
  baselineName: sanitizedString.describe('Name der verwendeten Baseline (z.B. "adessoCMS 2.0")'),
  baselineVersion: sanitizedString.optional().describe('Version der Baseline'),
  analysisTimestamp: z.string().datetime().describe('Zeitstempel der Analyse'),
});

export type BaselineCategory = z.infer<typeof baselineCategorySchema>;
export type BaselineItem = z.infer<typeof baselineItemSchema>;
export type BaselineComparisonResult = z.infer<typeof baselineComparisonResultSchema>;
