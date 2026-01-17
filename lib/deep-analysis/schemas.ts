import { z } from 'zod';

// Sanitized string schema that rejects HTML/script tags (XSS prevention)
const sanitizedString = z.string().refine(
  (val) => {
    // Reject strings containing HTML tags or script content
    const dangerousPatterns = [
      /<script/i,
      /<\/script/i,
      /javascript:/i,
      /on\w+=/i, // Event handlers like onclick=, onload=, etc.
      /<iframe/i,
      /<embed/i,
      /<object/i,
    ];
    return !dangerousPatterns.some(pattern => pattern.test(val));
  },
  { message: 'String contains potentially malicious content' }
);

// URL schema with additional validation
const sanitizedUrl = z.string().url().refine(
  (val) => {
    // Only allow http/https protocols
    return val.startsWith('http://') || val.startsWith('https://');
  },
  { message: 'URL must use http or https protocol' }
);

export const ContentArchitectureSchema = z.object({
  pageTypes: z.array(z.object({
    type: sanitizedString, // 'homepage', 'product', 'blog', etc.
    count: z.number().int().nonnegative(),
    sampleUrls: z.array(sanitizedUrl),
  })),
  contentTypeMapping: z.array(z.object({
    pageType: sanitizedString,
    drupalContentType: sanitizedString,
    confidence: z.number().min(0).max(100),
    reasoning: sanitizedString,
  })),
  paragraphEstimate: z.number().int().nonnegative(), // Estimated Paragraph types needed
  totalPages: z.number().int().nonnegative(),
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
    id: sanitizedString, // e.g., 'color-contrast'
    impact: z.enum(['minor', 'moderate', 'serious', 'critical']),
    count: z.number().int().nonnegative(),
    description: sanitizedString,
    helpUrl: sanitizedUrl,
  })),
  pagesAudited: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
});

export const PTEstimationSchema = z.object({
  totalHours: z.number().nonnegative(),
  confidence: z.number().min(0).max(100),
  breakdown: z.object({
    baselineHours: z.number().nonnegative(),
    contentTypeHours: z.number().nonnegative(),
    paragraphHours: z.number().nonnegative(),
    complexityMultiplier: z.number().min(0),
    bufferHours: z.number().nonnegative(),
  }),
  assumptions: z.array(sanitizedString),
});

export type ContentArchitecture = z.infer<typeof ContentArchitectureSchema>;
export type MigrationComplexity = z.infer<typeof MigrationComplexitySchema>;
export type AccessibilityAudit = z.infer<typeof AccessibilityAuditSchema>;
export type PTEstimation = z.infer<typeof PTEstimationSchema>;
