import { z } from 'zod';

export const ContentArchitectureSchema = z.object({
  pageTypes: z.array(z.object({
    type: z.string(), // 'homepage', 'product', 'blog', etc.
    count: z.number(),
    sampleUrls: z.array(z.string()),
  })),
  contentTypeMapping: z.array(z.object({
    pageType: z.string(),
    drupalContentType: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
  })),
  paragraphEstimate: z.number(), // Estimated Paragraph types needed
  totalPages: z.number(),
});

export const MigrationComplexitySchema = z.object({
  score: z.number().min(0).max(100),
  factors: z.object({
    sourceCMSType: z.enum(['wordpress', 'drupal', 'typo3', 'custom']),
    hasStandardExport: z.boolean(),
    apiAvailable: z.boolean(),
    contentTypeCount: z.number(),
    customPlugins: z.number(),
    thirdPartyIntegrations: z.number(),
  }),
  exportCapabilities: z.object({
    restAPI: z.boolean(),
    xmlExport: z.boolean(),
    cliTool: z.boolean(),
    databaseAccess: z.boolean(),
  }),
  dataQuality: z.object({
    brokenLinks: z.number(),
    duplicateContent: z.boolean(),
    inconsistentStructure: z.boolean(),
  }),
});

export const AccessibilityAuditSchema = z.object({
  wcagLevel: z.enum(['A', 'AA', 'AAA']),
  overallScore: z.number().min(0).max(100), // 0 = many violations, 100 = perfect
  violations: z.array(z.object({
    id: z.string(), // e.g., 'color-contrast'
    impact: z.enum(['minor', 'moderate', 'serious', 'critical']),
    count: z.number(),
    description: z.string(),
    helpUrl: z.string(),
  })),
  pagesAudited: z.number(),
  timestamp: z.string(),
});

export const PTEstimationSchema = z.object({
  totalHours: z.number(),
  confidence: z.number().min(0).max(100),
  breakdown: z.object({
    baselineHours: z.number(),
    contentTypeHours: z.number(),
    paragraphHours: z.number(),
    complexityMultiplier: z.number(),
    bufferHours: z.number(),
  }),
  assumptions: z.array(z.string()),
});

export type ContentArchitecture = z.infer<typeof ContentArchitectureSchema>;
export type MigrationComplexity = z.infer<typeof MigrationComplexitySchema>;
export type AccessibilityAudit = z.infer<typeof AccessibilityAuditSchema>;
export type PTEstimation = z.infer<typeof PTEstimationSchema>;
