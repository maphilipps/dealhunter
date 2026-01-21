import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const sanitizedString = z.string().transform(val => {
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
});

/**
 * Projekt-Disziplinen bei adesso
 */
export const disciplineSchema = z
  .enum([
    'PL', // Projektleitung
    'CON', // Consulting / Business Analyst
    'UX', // UX/UI Design
    'DEV', // Development
    'SEO', // SEO / Content
    'QA', // Quality Assurance
    'OPS', // DevOps / Operations
  ])
  .describe('Projekt-Disziplin');

/**
 * Involvement Level pro Disziplin
 */
export const involvementLevelSchema = z
  .enum([
    'lead', // Hauptverantwortlich (100%)
    'major', // Stark beteiligt (50-80%)
    'support', // Unterstützend (20-50%)
    'review', // Nur Review/Abnahme (10-20%)
    'none', // Nicht beteiligt (0%)
  ])
  .describe('Beteiligungsgrad');

/**
 * Disziplin-Involvement in einer Phase
 */
export const disciplineInvolvementSchema = z.object({
  discipline: disciplineSchema,
  level: involvementLevelSchema,
  hoursEstimate: z.number().nonnegative().describe('Geschätzte Stunden für diese Disziplin'),
  responsibilities: z.array(sanitizedString).describe('Konkrete Aufgaben'),
});

/**
 * Projekt-Phase
 */
export const projectPhaseSchema = z.object({
  name: sanitizedString.describe('Name der Phase'),
  description: sanitizedString.describe('Beschreibung der Phase'),
  startWeek: z.number().int().nonnegative().describe('Startwoche (0-basiert)'),
  endWeek: z.number().int().nonnegative().describe('Endwoche (0-basiert)'),
  durationWeeks: z.number().int().positive().describe('Dauer in Wochen'),
  disciplines: z.array(disciplineInvolvementSchema).describe('Beteiligte Disziplinen'),
  deliverables: z.array(sanitizedString).describe('Erwartete Deliverables'),
  dependencies: z.array(sanitizedString).optional().describe('Abhängigkeiten von anderen Phasen'),
  milestones: z
    .array(
      z.object({
        name: sanitizedString,
        week: z.number().int().nonnegative(),
      })
    )
    .optional()
    .describe('Meilensteine in dieser Phase'),
});

/**
 * Vollständiger Projekt-Plan
 */
export const projectPlanSchema = z.object({
  // Summary
  projectName: sanitizedString.describe('Projektname'),
  totalWeeks: z.number().int().positive().describe('Gesamtdauer in Wochen'),
  totalHours: z.number().nonnegative().describe('Gesamtstunden'),

  // Phases
  phases: z.array(projectPhaseSchema).describe('Projekt-Phasen'),

  // Discipline Matrix (Aggregated)
  disciplineMatrix: z
    .array(
      z.object({
        discipline: disciplineSchema,
        totalHours: z.number().nonnegative(),
        peakPhase: sanitizedString.describe('Phase mit höchster Beteiligung'),
        phaseBreakdown: z.array(
          z.object({
            phaseName: sanitizedString,
            hours: z.number().nonnegative(),
            level: involvementLevelSchema,
          })
        ),
      })
    )
    .describe('Stunden pro Disziplin'),

  // Team Size Recommendation
  recommendedTeamSize: z
    .object({
      minimum: z.number().int().positive(),
      optimal: z.number().int().positive(),
      maximum: z.number().int().positive(),
    })
    .describe('Empfohlene Teamgröße'),

  // Risk & Assumptions
  assumptions: z.array(sanitizedString).describe('Annahmen für die Planung'),
  risks: z
    .array(
      z.object({
        description: sanitizedString,
        impact: z.enum(['low', 'medium', 'high']),
        mitigation: sanitizedString,
      })
    )
    .optional()
    .describe('Identifizierte Risiken'),

  // Metadata
  confidence: z.number().min(0).max(100).describe('Konfidenz der Planung'),
  basedOnPTEstimate: z.number().nonnegative().describe('Zugrundeliegende PT-Schätzung'),
  generatedAt: z.string().datetime().describe('Zeitstempel'),
});

export type Discipline = z.infer<typeof disciplineSchema>;
export type InvolvementLevel = z.infer<typeof involvementLevelSchema>;
export type DisciplineInvolvement = z.infer<typeof disciplineInvolvementSchema>;
export type ProjectPhase = z.infer<typeof projectPhaseSchema>;
export type ProjectPlan = z.infer<typeof projectPlanSchema>;
