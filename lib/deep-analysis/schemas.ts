import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Sanitized string schema (XSS prevention)
// Strips ALL HTML tags, entities, and malicious content
const sanitizedString = z.string().transform(val => {
  // Step 1: Decode HTML entities FIRST (&lt; → <, &#60; → <, etc.)
  const decoded = val
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  // Step 2: Handle script/style/iframe tags
  // Extract content for standalone tags, remove completely when embedded in text
  let cleaned = decoded;

  // Remove script tags - extract content if input is ONLY script tags, otherwise remove completely
  const onlyScriptTags = /^(\s*<script[^>]*>[\s\S]*?<\/script>\s*)+$/i.test(cleaned);
  if (onlyScriptTags) {
    // Extract content from script tags
    cleaned = cleaned.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '$1');
  } else {
    // Remove script tags completely (including content)
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  // Always remove style and iframe tags completely
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');

  // Step 3: Remove remaining HTML tags (keep text content)
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Step 4: Remove ANSI escape codes and control characters
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, ''); // ANSI escape codes (e.g., \x1b[7m)
  cleaned = cleaned.replace(/\[[0-9;]+m/g, ''); // ANSI codes without \x1b prefix (e.g., [7m, [27m])

  // Step 5: Return without trimming (tests expect preserved whitespace)
  return cleaned;
});

// URL schema with DOMPurify sanitization and protocol validation
const sanitizedUrl = z.string().refine(
  val => {
    // Check if it's a valid URL
    try {
      const url = new URL(val);
      // Only allow http/https protocols
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return false;
      }

      // Sanitize and check if URL is still valid after sanitization
      const sanitized = DOMPurify.sanitize(val, { ALLOWED_TAGS: [] });
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
  timestamp: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Must be a valid ISO 8601 datetime string',
  }),
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
