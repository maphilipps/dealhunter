import { z } from 'zod';

/**
 * CMS Matching Schema
 *
 * Vorbereitet für die Entscheidungsmatrix im BL-Workflow.
 * Matched erkannte Anforderungen aus dem Quick Scan gegen verfügbare CMS/Technologien.
 */

// Einzelne Anforderung mit Matching-Score pro CMS
export const requirementMatchSchema = z.object({
  requirement: z.string().describe('Die erkannte Anforderung (z.B. "E-Commerce", "Mehrsprachigkeit")'),
  category: z.enum([
    'functional',    // Funktionale Anforderungen
    'technical',     // Technische Anforderungen
    'integration',   // Integrationsanforderungen
    'compliance',    // Compliance/Legal
    'performance',   // Performance
    'scalability',   // Skalierbarkeit
    'security',      // Sicherheit
    'ux',            // User Experience
    'maintenance',   // Wartbarkeit
    'other'
  ]).describe('Kategorie der Anforderung'),
  priority: z.enum(['must-have', 'should-have', 'nice-to-have']).describe('Priorität der Anforderung'),
  source: z.enum(['extracted', 'detected', 'inferred', 'researched']).describe('Woher stammt die Anforderung'),
  cmsScores: z.record(z.string(), z.object({
    score: z.number().min(0).max(100).describe('Match-Score 0-100'),
    confidence: z.number().min(0).max(100).describe('Confidence des Scores'),
    notes: z.string().optional().describe('Erläuterung zum Score'),
    webSearchUsed: z.boolean().optional().describe('Wurde Web Search für diese Bewertung genutzt'),
  })).describe('Scores pro CMS/Technologie'),
});

// Gesamte Matching-Matrix
export const cmsMatchingResultSchema = z.object({
  // Erkannte Anforderungen
  requirements: z.array(requirementMatchSchema),

  // Verglichene CMS/Technologien
  comparedTechnologies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string().optional(),
    isBaseline: z.boolean().describe('Ist dies eine adesso Baseline-Technologie'),
    overallScore: z.number().min(0).max(100),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  })),

  // Empfehlung
  recommendation: z.object({
    primaryCms: z.string().describe('Empfohlenes CMS'),
    reasoning: z.string().describe('Begründung'),
    alternativeCms: z.string().optional().describe('Alternative Option'),
    alternativeReasoning: z.string().optional(),
    confidence: z.number().min(0).max(100),
  }),

  // Metadata
  metadata: z.object({
    matchedAt: z.string(),
    webSearchUsed: z.boolean(),
    totalRequirements: z.number(),
    mustHaveCount: z.number(),
    averageMatchScore: z.number(),
  }),
});

export type RequirementMatch = z.infer<typeof requirementMatchSchema>;
export type CMSMatchingResult = z.infer<typeof cmsMatchingResultSchema>;

/**
 * Requirement-Kategorien für die Matrix-UI
 */
export const REQUIREMENT_CATEGORIES = {
  functional: {
    label: 'Funktional',
    icon: 'LayoutGrid',
    examples: ['E-Commerce', 'Mehrsprachigkeit', 'Suche', 'Blog', 'Formulare'],
  },
  technical: {
    label: 'Technisch',
    icon: 'Code',
    examples: ['API-First', 'Headless', 'SSR', 'GraphQL', 'REST'],
  },
  integration: {
    label: 'Integration',
    icon: 'Plug',
    examples: ['CRM', 'ERP', 'Payment', 'Analytics', 'Marketing Automation'],
  },
  compliance: {
    label: 'Compliance',
    icon: 'Shield',
    examples: ['DSGVO', 'WCAG', 'Barrierefreiheit', 'Datenschutz'],
  },
  performance: {
    label: 'Performance',
    icon: 'Gauge',
    examples: ['Page Speed', 'Caching', 'CDN', 'Lazy Loading'],
  },
  scalability: {
    label: 'Skalierbarkeit',
    icon: 'TrendingUp',
    examples: ['High Traffic', 'Multi-Site', 'Enterprise', 'Cloud-Native'],
  },
  security: {
    label: 'Sicherheit',
    icon: 'Lock',
    examples: ['SSO', '2FA', 'Audit Trail', 'Verschlüsselung'],
  },
  ux: {
    label: 'UX/Redaktion',
    icon: 'Users',
    examples: ['Drag & Drop Editor', 'Preview', 'Workflow', 'Versionierung'],
  },
  maintenance: {
    label: 'Wartbarkeit',
    icon: 'Wrench',
    examples: ['Updates', 'Hosting', 'Support', 'Dokumentation'],
  },
  other: {
    label: 'Sonstiges',
    icon: 'MoreHorizontal',
    examples: [],
  },
} as const;
