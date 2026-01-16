import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { teamSuggestionSchema, type TeamSuggestion } from './schema';
import type { Employee } from '@/lib/db/schema';

export interface TeamSuggestionInput {
  bidId: string;
  extractedRequirements: any; // JSON from bid.extractedRequirements
  quickScanResults?: any; // Optional Quick Scan data
  assignedBusinessLine: string; // BL name
  availableEmployees: Employee[]; // Employees from the assigned BL
}

/**
 * AI-powered team suggestion agent
 * Analyzes requirements and suggests optimal team composition
 */
export async function suggestTeam(input: TeamSuggestionInput): Promise<TeamSuggestion> {
  const { extractedRequirements, quickScanResults, assignedBusinessLine, availableEmployees } = input;

  // Format employee data for AI
  const employeesList = availableEmployees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
    skills: JSON.parse(emp.skills),
    roles: JSON.parse(emp.roles),
    availability: emp.availabilityStatus,
  }));

  const result = await generateObject({
    // @ts-expect-error - AI SDK v5 type mismatch between LanguageModelV3 and LanguageModel
    model: openai('gpt-4o-mini'),
    schema: teamSuggestionSchema,
    prompt: `You are an expert team builder for software development projects at adesso SE, a German IT consulting company.

Your task is to suggest an optimal team composition for this bid opportunity.

## Project Requirements

**Customer:** ${extractedRequirements.customerName || 'Unknown'}
**Project Description:** ${extractedRequirements.projectDescription || 'Not provided'}
**Technologies:** ${extractedRequirements.technologies?.join(', ') || 'Not specified'}
**Timeline:** ${extractedRequirements.timeline || 'Not specified'}
**Budget:** ${extractedRequirements.budget || 'Not specified'}

${quickScanResults ? `
**Tech Stack (from Quick Scan):**
- CMS: ${quickScanResults.cms || 'Unknown'}
- Framework: ${quickScanResults.framework || 'Unknown'}
- Backend: ${quickScanResults.backend || 'Unknown'}
` : ''}

**Assigned Business Line:** ${assignedBusinessLine}

## Available Employees (from ${assignedBusinessLine})

${employeesList.length === 0 ? 'No employees found in this business line. Suggest placeholder roles for new hires.' : employeesList.map((emp, idx) => `
Employee ${idx + 1}:
- Name: ${emp.name}
- Skills: ${emp.skills.join(', ')}
- Roles: ${emp.roles.join(', ')}
- Availability: ${emp.availability}
`).join('\n')}

## Team Building Guidelines

**Required Roles (Minimum):**
1. Project Manager (1) - leads the project, client communication
2. Technical Lead (1) - technical decisions, architecture
3. Developers (2+) - implementation, coding

**Common Additional Roles:**
- Frontend Developer - for UI/UX implementation
- Backend Developer - for server-side logic
- UX Designer - for design and user experience
- QA Engineer - for testing and quality assurance
- DevOps Engineer - for CI/CD and infrastructure
- Business Analyst - for requirements and process

**Team Size Guidelines:**
- Small projects (€50k-€150k): 3-5 people
- Medium projects (€150k-€500k): 5-8 people
- Large projects (€500k+): 8-12 people

**Skill Matching:**
- Match employee skills to required technologies
- Consider similar project experience
- Balance seniority levels (mix of senior and junior)
- Identify skill gaps and suggest mitigation

**Availability:**
- Prefer "available" employees
- Flag "on_project" employees (may need coordination)
- Avoid "unavailable" employees unless critical match

**Confidence Scoring:**
- 90-100: Perfect match (all skills, available, proven experience)
- 70-89: Good match (most skills, minor gaps)
- 50-69: Acceptable match (skill gaps but trainable)
- <50: Weak match (significant gaps)

## Your Task

1. Analyze the project requirements and technologies
2. Match available employees to required roles
3. Build a team that:
   - Covers all required roles (PM, Tech Lead, 2+ Developers)
   - Matches required technologies/skills
   - Balances availability and experience
   - Minimizes skill gaps
4. For each suggested team member:
   - Explain why they fit (skill match, experience)
   - Note any skill gaps
   - Assess confidence (0-100)
5. If no suitable employees exist for a role:
   - Use "new_hire" as employeeId
   - Describe the required profile
   - Explain the gap

Return a complete team suggestion with:
- Suggested team members with roles and reasoning
- Identified skill gaps with severity
- Overall confidence score
- Required roles coverage check
- Any warnings about team composition`,
    temperature: 0.3,
  });

  return result.object;
}
