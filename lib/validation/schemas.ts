/**
 * Zod Validation Schemas
 *
 * Input validation schemas for all API endpoints and forms.
 * Prevents injection attacks and ensures data integrity.
 */

import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Ungültige Email-Adresse')
  .max(255, 'Email zu lang')
  .toLowerCase()
  .trim();

/**
 * Password validation schema
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - Optional special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Passwort muss mindestens 8 Zeichen haben')
  .max(128, 'Passwort zu lang')
  .regex(/[a-z]/, 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
  .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
  .regex(/[0-9]/, 'Passwort muss mindestens eine Ziffer enthalten');

/**
 * Company name validation schema
 */
export const companyNameSchema = z
  .string()
  .min(2, 'Unternehmensname muss mindestens 2 Zeichen haben')
  .max(255, 'Unternehmensname zu lang')
  .trim();

/**
 * Location validation schema
 */
export const locationSchema = z
  .string()
  .max(255, 'Standort zu lang')
  .trim()
  .optional();

/**
 * Analysis type validation schema
 */
export const analysisTypeSchema = z.enum(['quick_scan', 'deep_dive', 'competitor', 'batch'], {
  errorMap: () => ({ message: 'Ungültiger Analyse-Typ' }),
});

/**
 * UUID validation schema
 */
export const uuidSchema = z
  .string()
  .uuid('Ungültige UUID')
  .refine(
    (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val),
    'Ungültige UUID v4 Format'
  );

/**
 * URL validation schema
 */
export const urlSchema = z
  .string()
  .url('Ungültige URL')
  .max(2048, 'URL zu lang')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL muss HTTP oder HTTPS Protokoll verwenden' }
  )
  .trim();

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Passwort erforderlich'),
});

/**
 * Register form schema
 */
export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    name: z.string().max(255).trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwörter stimmen nicht überein',
    path: ['confirmPassword'],
  });

/**
 * Create analysis form schema
 */
export const createAnalysisSchema = z.object({
  companyName: companyNameSchema,
  location: locationSchema,
  type: analysisTypeSchema.default('quick_scan'),
});

/**
 * Analysis ID parameter schema
 */
export const analysisIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Website type validation schema
 */
export const websiteTypeSchema = z.enum(['primary', 'subsidiary', 'blog', 'career', 'other'], {
  errorMap: () => ({ message: 'Ungültiger Website-Typ' }),
});

/**
 * Analysis status validation schema
 */
export const analysisStatusSchema = z.enum(
  [
    'pending',
    'discovering',
    'crawling',
    'detecting',
    'analyzing',
    'researching',
    'vetting',
    'valuing',
    'generating',
    'completed',
    'failed',
  ],
  {
    errorMap: () => ({ message: 'Ungültiger Analyse-Status' },
  );

/**
 * Phase validation schema
 */
export const phaseSchema = z.enum(
  [
    'discovery',
    'crawling',
    'tech_detection',
    'performance',
    'ux_analysis',
    'seo_analysis',
    'martech_detection',
    'company_research',
    'leadership_vetting',
    'news_analysis',
    'valuation',
    'loi_generation',
    'scoring',
    'report_generation',
  ],
  {
    errorMap: () => ({ message: 'Ungültige Phase' }),
  }
);

/**
 * Agent activity validation schema
 */
export const agentActivitySchema = z.object({
  agentName: z.string().min(1).max(100),
  phase: phaseSchema,
  action: z.enum(['searching', 'crawling', 'analyzing', 'completed', 'failed', 'retrying']),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Phase error validation schema
 */
export const phaseErrorSchema = z.object({
  phase: phaseSchema,
  agentName: z.string().max(100).optional(),
  errorType: z.enum(['timeout', '404', 'parse_error', 'api_error', 'validation_error', 'unknown']),
  errorMessage: z.string().min(1).max(5000),
  url: urlSchema.optional(),
  stackTrace: z.string().max(10000).optional(),
});

// Export type inference helpers
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
export type AgentActivityInput = z.infer<typeof agentActivitySchema>;
export type PhaseErrorInput = z.infer<typeof phaseErrorSchema>;
