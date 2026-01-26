import OpenAI from 'openai';

import { teamSuggestionSchema, type TeamSuggestion } from './schema';

import { AI_HUB_API_KEY, AI_HUB_BASE_URL } from '@/lib/ai/config';
import type { Employee } from '@/lib/db/schema';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: AI_HUB_API_KEY,
  baseURL: AI_HUB_BASE_URL,
});

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
  const { extractedRequirements, quickScanResults, assignedBusinessLine, availableEmployees } =
    input;

  // Format employee data for AI
  const employeesList = availableEmployees.map(emp => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
    skills: JSON.parse(emp.skills),
    roles: JSON.parse(emp.roles),
    availability: emp.availabilityStatus,
  }));

  // Extract technical requirements from Quick Scan for enhanced matching
  const technicalRequirements = {
    cms: quickScanResults?.cms || extractedRequirements.cms || null,
    framework: quickScanResults?.framework || extractedRequirements.framework || null,
    techStack: quickScanResults?.techStack || extractedRequirements.technologies || [],
    integrations: quickScanResults?.integrations || [],
    features: quickScanResults?.features || [],
    complexity: {
      hasAnimations:
        quickScanResults?.features?.some((f: string) => f.toLowerCase().includes('animation')) ||
        false,
      hasI18n:
        quickScanResults?.features?.some(
          (f: string) =>
            f.toLowerCase().includes('multilingual') || f.toLowerCase().includes('i18n')
        ) || false,
      hasComplexComponents: quickScanResults?.features?.length > 10 || false,
    },
  };

  const completion = await openai.chat.completions.create({
    model: 'gemini-3-flash-preview',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert team builder for software development projects at adesso SE. Always respond with valid JSON. Do not include markdown code blocks.',
      },
      {
        role: 'user',
        content: `You are an expert team builder for software development projects at adesso SE, a German IT consulting company.

Your task is to suggest an optimal team composition for this bid opportunity.

## Project Requirements

**Customer:** ${extractedRequirements.customerName || 'Unknown'}
**Project Description:** ${extractedRequirements.projectDescription || 'Not provided'}
**Technologies:** ${extractedRequirements.technologies?.join(', ') || 'Not specified'}
**Timeline:** ${extractedRequirements.timeline || 'Not specified'}
**Budget:** ${extractedRequirements.budget || 'Not specified'}

**Technical Requirements (Enhanced Matching):**
- CMS: ${technicalRequirements.cms || 'Unknown'}
- Framework: ${technicalRequirements.framework || 'Unknown'}
- Tech Stack: ${Array.isArray(technicalRequirements.techStack) ? technicalRequirements.techStack.join(', ') : 'Unknown'}
- Integrations: ${technicalRequirements.integrations.length > 0 ? technicalRequirements.integrations.join(', ') : 'None specified'}
- Detected Features: ${technicalRequirements.features.length > 0 ? technicalRequirements.features.join(', ') : 'None detected'}
- Complexity Indicators:
  * Animations: ${technicalRequirements.complexity.hasAnimations ? 'Yes (GSAP, animations skills needed)' : 'No'}
  * Multilingual/i18n: ${technicalRequirements.complexity.hasI18n ? 'Yes (i18n, translation-mgmt skills needed)' : 'No'}
  * Complex Components: ${technicalRequirements.complexity.hasComplexComponents ? 'Yes (advanced frontend skills needed)' : 'No'}

**Assigned Business Line:** ${assignedBusinessLine}

## Available Employees (from ${assignedBusinessLine})

${
  employeesList.length === 0
    ? 'No employees found in this business line. Suggest placeholder roles for new hires.'
    : employeesList
        .map(
          (emp, idx) => `
Employee ${idx + 1}:
- Name: ${emp.name}
- Skills: ${emp.skills.join(', ')}
- Roles: ${emp.roles.join(', ')}
- Availability: ${emp.availability}
`
        )
        .join('\n')
}

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

**Skill Matching (Enhanced Algorithm):**
- **Exact CMS/Framework Match (Critical):** +30 points if employee has exact CMS (e.g., "drupal" or "drupal-10" for Drupal 10)
- **Component Framework Match:** +20 points if employee has framework skills (React, Vue, Angular) matching detected tech
- **Integration Experience:** +15 points for each matching integration skill (Elasticsearch, APIs, third-party services)
- **Complexity Skills:** +10 points each for:
  * Animation skills (GSAP, framer-motion) if animations detected
  * i18n/translation-mgmt skills if multilingual site
  * Advanced component architecture if complex features detected
- **Similar Technology Stack:** +5 points for each matching tech in the stack
- **General Skills:** +5 points for relevant general skills (TypeScript, Git, CI/CD, etc.)
- **Consider similar project experience**
- **Balance seniority levels** (mix of senior and junior)
- **Identify skill gaps** and suggest mitigation

**Availability:**
- Prefer "available" employees
- Flag "on_project" employees (may need coordination)
- Avoid "unavailable" employees unless critical match

**Confidence Scoring (0-100 Scale):**
- **90-100:** Perfect match
  * Has exact CMS/Framework match
  * All critical integrations and complexity skills covered
  * Available immediately
  * Proven experience in similar projects
- **70-89:** Good match
  * Has CMS/Framework match OR most required skills
  * Minor skill gaps (can be closed with training)
  * Available within project timeline
- **50-69:** Acceptable match
  * Some core skills present, significant gaps exist
  * Trainable in missing areas
  * Availability may need coordination
- **<50:** Weak match
  * Missing critical CMS/Framework skills
  * Significant skill gaps that are hard to close
  * Limited availability

**Match Score Calculation Formula:**
1. Start with base score of 0
2. Add points based on skill matching algorithm above
3. Apply availability modifier:
   - available: +10 points
   - on_project: +5 points
   - unavailable: -10 points
4. Add experience bonus: +10 points for similar project experience
5. Cap at 100 points maximum

## Your Task

1. **Analyze the project requirements and technologies:**
   - Identify CMS/Framework requirements (exact match is CRITICAL)
   - List required component frameworks (React, Vue, etc.)
   - Note integration requirements (APIs, Elasticsearch, etc.)
   - Assess complexity indicators (animations, i18n, complex components)

2. **Match available employees to required roles using the Enhanced Matching Algorithm:**
   - Prioritize exact CMS/Framework matches (+30 points)
   - Look for component framework experience (+20 points)
   - Check for integration skills (+15 points each)
   - Verify complexity skills (animations, i18n, etc., +10 points each)
   - Consider general tech stack matches (+5 points each)
   - Apply availability modifiers

3. **Build a team that:**
   - Covers all required roles (PM, Tech Lead, 2+ Developers)
   - Maximizes skill match scores using the formula above
   - Balances availability and experience
   - Minimizes critical skill gaps
   - Has strong CMS/Framework coverage

4. **For each suggested team member:**
   - Calculate skillMatchScore (0-100) using the formula
   - List matchingSkills (especially CMS, framework, integrations)
   - List missingSkills (critical gaps to address)
   - Explain reasoning (why this person, what they bring)
   - Assess confidence (0-100) in this suggestion

5. **If no suitable employees exist for a role:**
   - Use "new_hire" as employeeId
   - Describe the required profile (emphasize CMS/framework needs)
   - Explain the gap and why it can't be filled internally

Respond with JSON containing:
- members (array of objects): Suggested team members with:
  - employeeId (string): Employee ID or "new_hire"
  - name (string): Employee name or role placeholder
  - role (string: "project_manager", "technical_lead", "senior_developer", "developer", "frontend_developer", "backend_developer", "ux_designer", "qa_engineer", "devops_engineer", "business_analyst"): Assigned role
  - skillMatchScore (number 0-100): How well skills match
  - matchingSkills (array of strings): Matching skills
  - missingSkills (array of strings): Missing skills
  - availabilityStatus (string: "available", "on_project", or "unavailable"): Availability
  - availabilityNote (string, optional): Additional context
  - similarProjectExperience (string, optional): Relevant past projects
  - reasoning (string): Why this person was suggested
  - confidence (number 0-100): Confidence in suggestion
- skillGaps (array of objects with skill, severity ["critical", "important", "nice-to-have"], recommendation): Skill gaps
- overallConfidence (number 0-100): Overall team confidence
- reasoning (string): Overall reasoning
- hasProjectManager (boolean): Team has PM
- hasTechnicalLead (boolean): Team has Tech Lead
- hasMinimumDevelopers (boolean): Team has 2+ devs
- warnings (array of strings): Warnings about composition`,
      },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);
  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return teamSuggestionSchema.parse(cleanedResult);
}
