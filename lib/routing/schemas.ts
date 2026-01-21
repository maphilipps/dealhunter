import { z } from 'zod';

/**
 * Business Line Routing Result Schema
 * Defines the structured output from the routing agent
 */
export const BusinessLineRoutingSchema = z.object({
  recommendedBU: z.string().describe('Name of the recommended business unit'),
  confidence: z.number().min(0).max(100).describe('Confidence score (0-100)'),
  reasoning: z.string().describe('Explanation of why this business unit was recommended'),
  alternativeBUs: z
    .array(
      z.object({
        name: z.string(),
        confidence: z.number().min(0).max(100),
        reasoning: z.string(),
      })
    )
    .describe('Alternative business units with lower confidence scores'),
  matchedKeywords: z.array(z.string()).describe('Keywords from BU that matched'),
  matchedTechnologies: z.array(z.string()).describe('Technologies from BU that matched'),
});

export type BusinessLineRoutingResult = z.infer<typeof BusinessLineRoutingSchema>;

/**
 * Input for the routing agent
 */
export interface RouteBusinessUnitInput {
  customerName?: string;
  projectDescription?: string;
  technologies?: string[];
  requirements?: string;
  websiteUrl?: string;
  industry?: string;
}
