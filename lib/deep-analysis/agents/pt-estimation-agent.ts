/**
 * PT (Person-Time) Estimation Agent
 * Calculates project hours using baseline + multipliers + buffer
 * Expected duration: 1-3 minutes
 */

import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PTEstimationSchema, type PTEstimation } from '../schemas';

export interface PTEstimationInput {
  targetCMS: string;
  businessLineId?: string;
  contentTypeCount: number;
  paragraphCount: number;
  complexityScore: number;
  pageCount: number;
}

/**
 * Estimates Person-Time hours for migration project
 *
 * Formula:
 * PT = (Baseline + ContentTypes×50h + Paragraphs×30h) × ComplexityMultiplier × PageCountFactor + 20% Buffer
 *
 * Where:
 * - Baseline: Technology-specific baseline hours (e.g., 693h for Drupal)
 * - ContentTypes: Extra hours per Content Type beyond baseline (baseline assumes 10 CTs)
 * - Paragraphs: Extra hours per Paragraph type beyond baseline (baseline assumes 15 Paragraphs)
 * - ComplexityMultiplier: 0.8 to 1.5 based on migration complexity score (0-100)
 * - PageCountFactor: 1.0 for <1000 pages, 1.2 for 1000+ pages
 * - Buffer: 20% safety margin for unknowns
 */
export async function estimatePT(input: PTEstimationInput): Promise<PTEstimation> {
  // Step 1: Load baseline hours from database
  const [tech] = await db
    .select()
    .from(technologies)
    .where(eq(technologies.name, input.targetCMS))
    .limit(1);

  if (!tech) {
    throw new Error(`No baseline data found for target CMS: ${input.targetCMS}`);
  }

  const baselineHours = tech.baselineHours || 693; // Default to Drupal baseline if not set

  // Step 2: Calculate Content Type hours
  // Baseline assumes 10 Content Types, charge 50h for each additional one
  const baselineContentTypes = 10;
  const contentTypeHours = Math.max(0, input.contentTypeCount - baselineContentTypes) * 50;

  // Step 3: Calculate Paragraph hours
  // Baseline assumes 15 Paragraph types, charge 30h for each additional one
  const baselineParagraphs = 15;
  const paragraphHours = Math.max(0, input.paragraphCount - baselineParagraphs) * 30;

  // Step 4: Calculate complexity multiplier (0.8 to 1.5)
  // Score 0 = 0.8x (simple), Score 50 = 1.15x (medium), Score 100 = 1.5x (complex)
  const complexityMultiplier = 0.8 + (input.complexityScore / 100) * 0.7;

  // Step 5: Page count factor
  // Large sites (1000+ pages) get 1.2x multiplier for additional QA and edge cases
  const pageCountFactor = input.pageCount > 1000 ? 1.2 : 1.0;

  // Step 6: Calculate subtotal
  const subtotal = (baselineHours + contentTypeHours + paragraphHours)
    * complexityMultiplier
    * pageCountFactor;

  // Step 7: Add 20% buffer for unknowns
  const bufferHours = subtotal * 0.2;
  const totalHours = Math.round(subtotal + bufferHours);

  // Step 8: Calculate confidence score
  // Higher complexity = lower confidence
  // Score 0-30 = 85-90% confidence
  // Score 31-60 = 70-84% confidence
  // Score 61-100 = 40-69% confidence
  const confidence = Math.max(40, 90 - Math.round(input.complexityScore * 0.5));

  // Step 9: Build assumptions list
  const assumptions: string[] = [
    `Baseline hours for ${input.targetCMS}: ${baselineHours}h`,
    `Content Types: ${input.contentTypeCount} (baseline assumes ${baselineContentTypes}, +${contentTypeHours}h for extras)`,
    `Paragraphs: ${input.paragraphCount} (baseline assumes ${baselineParagraphs}, +${paragraphHours}h for extras)`,
    `Complexity multiplier: ${complexityMultiplier.toFixed(2)}x (score: ${input.complexityScore}/100)`,
    `Page count factor: ${pageCountFactor}x (${input.pageCount} pages)`,
    `Buffer (20%): +${bufferHours}h for unknowns and edge cases`,
  ];

  // Step 10: Validate and return
  return PTEstimationSchema.parse({
    totalHours,
    confidence,
    breakdown: {
      baselineHours,
      contentTypeHours,
      paragraphHours,
      complexityMultiplier,
      bufferHours,
    },
    assumptions,
  });
}
