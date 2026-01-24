/**
 * Project Organization Synthesizer
 *
 * Synthesizes project organization, team structure, and resource planning.
 * Based on PT estimations, tech stack, and project complexity.
 */

import { z } from 'zod';

import { SectionSynthesizerBase, type SectionResult } from '../section-synthesizer-base';

import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';

/**
 * Project Org Output Schema
 */
const projectOrgOutputSchema = z.object({
  teamStructure: z.object({
    projectManager: z.object({
      count: z.number(),
      totalPT: z.number(),
      skills: z.array(z.string()),
      responsibilities: z.array(z.string()),
    }),
    uxDesigner: z.object({
      count: z.number(),
      totalPT: z.number(),
      skills: z.array(z.string()),
      responsibilities: z.array(z.string()),
    }),
    frontendDev: z.object({
      count: z.number(),
      totalPT: z.number(),
      skills: z.array(z.string()),
      responsibilities: z.array(z.string()),
    }),
    backendDev: z.object({
      count: z.number(),
      totalPT: z.number(),
      skills: z.array(z.string()),
      responsibilities: z.array(z.string()),
    }),
    devOps: z.object({
      count: z.number(),
      totalPT: z.number(),
      skills: z.array(z.string()),
      responsibilities: z.array(z.string()),
    }),
    qa: z.object({
      count: z.number(),
      totalPT: z.number(),
      skills: z.array(z.string()),
      responsibilities: z.array(z.string()),
    }),
  }),
  projectPhases: z.array(
    z.object({
      phase: z.string(),
      duration: z.string(),
      milestones: z.array(z.string()),
      deliverables: z.array(z.string()),
    })
  ),
  organizationRecommendation: z.object({
    methodology: z.enum(['scrum', 'kanban', 'waterfall', 'hybrid']),
    sprintLength: z.string().optional(),
    teamSize: z.number(),
    totalDuration: z.string(),
    parallelWorkstreams: z.array(z.string()),
  }),
  resourcePlan: z.object({
    rampUpPhase: z.string(),
    peakTeamSize: z.number(),
    rampDownPhase: z.string(),
    criticalDependencies: z.array(z.string()),
  }),
  suggestedTeamMembers: z.array(
    z.object({
      role: z.string(),
      employeeName: z.string().optional(),
      skillMatch: z.number().optional(),
      availability: z.string().optional(),
      reasoning: z.string(),
    })
  ),
  risks: z.array(
    z.object({
      risk: z.string(),
      impact: z.enum(['low', 'medium', 'high']),
      mitigation: z.string(),
    })
  ),
});

type ProjectOrgOutput = z.infer<typeof projectOrgOutputSchema>;

/**
 * Project Org Synthesizer
 */
export class ProjectOrgSynthesizer extends SectionSynthesizerBase {
  sectionId = 'project-org';

  async synthesize(leadId: string): Promise<SectionResult> {
    // Query RAG for relevant context
    const ragResults = await this.queryRAG(
      leadId,
      'project organization team structure roles PT estimation resource planning methodology sprint organization agile scrum team size'
    );

    // Get available employees for team suggestions
    const availableEmployees = await db.select().from(employees);

    // Build context from RAG
    const ragContext = ragResults.map(r => r.content).join('\n\n');
    const employeeContext =
      availableEmployees.length > 0
        ? `Available employees:\n${availableEmployees.map(e => `- ${e.name} (${e.roles}): ${e.skills || 'No skills listed'}`).join('\n')}`
        : 'No employee data available.';

    // Build prompts
    const systemPrompt = `You are a project organization expert specializing in team structure and resource planning for CMS/DMS projects.

Based on PT estimations, tech stack, and project complexity, create a comprehensive project organization plan.

Output must be valid JSON matching the exact schema.`;

    const userPrompt = `Analyze the following context and create a project organization plan:

${ragContext}

${employeeContext}

Create a JSON output with:
1. Team structure with roles (PM, UX, Frontend, Backend, DevOps, QA) - count, PT, skills, responsibilities
2. Project phases with duration, milestones, deliverables
3. Organization recommendation (methodology, sprint length, team size, duration, parallel workstreams)
4. Resource plan (ramp-up, peak team size, ramp-down, dependencies)
5. Suggested team members (match employees to roles if available, otherwise describe ideal candidate)
6. Risks with impact and mitigation

Consider:
- PT estimations from previous sections
- Tech stack complexity
- Project size and scope
- Agile vs Waterfall suitability
- Skill requirements per role
- Realistic timelines`;

    // Generate content
    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    // Parse and validate
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse) as Record<string, unknown>;
    const output: ProjectOrgOutput = projectOrgOutputSchema.parse(rawResult);

    // Calculate confidence
    const confidence = this.calculateConfidence(ragResults);

    // Extract sources
    const sources = this.extractSources(ragResults);

    return {
      sectionId: this.sectionId,
      content: output,
      metadata: {
        generatedAt: new Date(),
        agentName: 'project-org-synthesizer',
        sources,
        confidence,
      },
    };
  }
}
