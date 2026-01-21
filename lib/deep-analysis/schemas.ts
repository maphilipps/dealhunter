import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Sanitized string schema using DOMPurify (XSS prevention)
// Strips ALL HTML tags, entities, and malicious content
const sanitizedString = z.string().transform(val => {
  // Remove all HTML tags and entities, keeping only text content
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
  });
});

// URL schema with DOMPurify sanitization and protocol validation
const sanitizedUrl = z
  .string()
  .url()
  .refine(
    val => {
      // Only allow http/https protocols
      if (!val.startsWith('http://') && !val.startsWith('https://')) {
        return false;
      }

      // Sanitize and check if URL is still valid
      const sanitized = DOMPurify.sanitize(val, { ALLOWED_TAGS: [] });
      try {
        new URL(sanitized);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'URL must use http or https protocol and cannot contain malicious content' }
  );

export const ContentArchitectureSchema = z.object({
  pageTypes: z.array(
    z.object({
      type: sanitizedString, // 'homepage', 'product', 'blog', etc.
      count: z.number().int().nonnegative(),
      sampleUrls: z.array(sanitizedUrl),
    })
  ),
  contentTypeMapping: z.array(
    z.object({
      pageType: sanitizedString,
      drupalContentType: sanitizedString,
      confidence: z.number().min(0).max(100),
      reasoning: sanitizedString,
    })
  ),
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
  violations: z.array(
    z.object({
      id: sanitizedString, // e.g., 'color-contrast'
      impact: z.enum(['minor', 'moderate', 'serious', 'critical']),
      count: z.number().int().nonnegative(),
      description: sanitizedString,
      helpUrl: sanitizedUrl,
    })
  ),
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
