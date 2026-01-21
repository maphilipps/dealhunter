import { z } from 'zod';

/**
 * Valid team roles for a project
 */
export const teamRoleSchema = z.enum([
  'project_manager',
  'technical_lead',
  'senior_developer',
  'developer',
  'frontend_developer',
  'backend_developer',
  'ux_designer',
  'qa_engineer',
  'devops_engineer',
  'business_analyst',
]);

export type TeamRole = z.infer<typeof teamRoleSchema>;

/**
 * Skill gap warning
 */
export const skillGapSchema = z.object({
  skill: z.string().describe('Missing or weak skill'),
  severity: z.enum(['critical', 'important', 'nice-to-have']).describe('Impact of the gap'),
  recommendation: z.string().describe('How to address the gap (training, hire, partner, etc.)'),
});

export type SkillGap = z.infer<typeof skillGapSchema>;

/**
 * Individual team member suggestion with reasoning
 */
export const teamMemberSuggestionSchema = z.object({
  employeeId: z.string().describe('Employee ID (if existing) or "new_hire" placeholder'),
  name: z.string().describe('Employee name or role placeholder'),
  role: teamRoleSchema.describe('Assigned role in this project'),

  // Skill matching
  skillMatchScore: z
    .number()
    .min(0)
    .max(100)
    .describe('How well skills match requirements (0-100)'),
  matchingSkills: z.array(z.string()).describe('Skills that match requirements'),
  missingSkills: z.array(z.string()).describe('Required skills this person lacks'),

  // Availability
  availabilityStatus: z
    .enum(['available', 'on_project', 'unavailable'])
    .describe('Current availability'),
  availabilityNote: z.string().optional().describe('Additional availability context'),

  // Experience
  similarProjectExperience: z.string().optional().describe('Description of relevant past projects'),

  // AI reasoning
  reasoning: z.string().describe('Why this person was suggested for this role'),
  confidence: z.number().min(0).max(100).describe('Confidence in this suggestion (0-100)'),
});

export type TeamMemberSuggestion = z.infer<typeof teamMemberSuggestionSchema>;

/**
 * Complete AI team suggestion
 */
export const teamSuggestionSchema = z.object({
  // Suggested team composition
  members: z.array(teamMemberSuggestionSchema).describe('Suggested team members with roles'),

  // Skill gaps
  skillGaps: z.array(skillGapSchema).describe('Identified skill gaps in suggested team'),

  // Overall assessment
  overallConfidence: z.number().min(0).max(100).describe('Overall confidence in team suggestion'),
  reasoning: z.string().describe('Overall reasoning for team composition'),

  // Required roles check
  hasProjectManager: z.boolean().describe('Team includes a project manager'),
  hasTechnicalLead: z.boolean().describe('Team includes a technical lead'),
  hasMinimumDevelopers: z.boolean().describe('Team has at least 2 developers'),

  // Warnings
  warnings: z.array(z.string()).describe('Any warnings about team composition'),
});

export type TeamSuggestion = z.infer<typeof teamSuggestionSchema>;

/**
 * Final team assignment after BL confirmation/modification
 */
export const teamAssignmentSchema = z.object({
  members: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      role: teamRoleSchema,
      email: z.string().email().optional(),
    })
  ),
  assignedBy: z.string().describe('User ID who assigned the team'),
  assignedAt: z.string().describe('ISO timestamp of assignment'),
  notes: z.string().optional().describe('Additional notes from BL'),
  acknowledgedGaps: z.array(z.string()).optional().describe('Skill gaps BL acknowledged'),
});

export type TeamAssignment = z.infer<typeof teamAssignmentSchema>;
