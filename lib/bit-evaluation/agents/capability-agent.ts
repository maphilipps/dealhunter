import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { capabilityMatchSchema, type CapabilityMatch } from '../schema';

export interface CapabilityAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // Tech stack detection
}

/**
 * BIT-002: Capability Match Agent
 * Evaluates if adesso has the technical capabilities to deliver this project
 */
export async function runCapabilityAgent(input: CapabilityAgentInput): Promise<CapabilityMatch> {
  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: capabilityMatchSchema,
    prompt: `You are a technical capability assessor for adesso SE, a leading German IT consulting company.

Evaluate if adesso has the capabilities to successfully deliver this project.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

adesso's Core Capabilities:
- **CMS & Portals:** Drupal (20+ years experience), WordPress, Typo3, Magnolia, Liferay
- **Frontend:** React, Vue, Angular, Next.js, TypeScript, modern JavaScript
- **Backend:** Java/Spring, .NET, Node.js, Python, PHP
- **Cloud:** AWS, Azure, GCP (certified partners)
- **E-Commerce:** SAP Commerce, Shopware, Magento, custom solutions
- **Enterprise:** SAP, Salesforce, Microsoft Dynamics
- **Mobile:** React Native, Flutter, native iOS/Android
- **DevOps:** CI/CD, Kubernetes, Docker, Infrastructure as Code
- **Data:** Data Engineering, Analytics, AI/ML integration
- **Industry Expertise:** Banking, Insurance, Automotive, Energy, Retail, Public Sector

Typical Team Sizes: 3-50 people
Typical Project Durations: 3-24 months
Geographic Reach: Germany (headquarters), Europe, global delivery

Assessment Criteria:

1. **Technology Match (technologyMatchScore)**
   - Do we have deep expertise in the required technologies?
   - Can we staff a team with the right skills within 4-6 weeks?
   - Rate 0-100 (100 = perfect match, 0 = no match at all)

2. **Scale Match (scaleMatchScore)**
   - Can we handle the project scale (team size, timeline, complexity)?
   - Do we have enough available resources?
   - Rate 0-100

3. **Critical Blockers (criticalBlockers)**
   - Technologies we CANNOT deliver (e.g., proprietary systems we don't support)
   - Scale beyond our capacity (e.g., >100 person teams)
   - Compliance requirements we cannot meet
   - Geographic constraints we cannot fulfill

4. **Overall Capability Score (overallCapabilityScore)**
   - Weighted average of technology and scale scores
   - Reduced if there are missing capabilities
   - Should be 0 if there are critical blockers

5. **Confidence (confidence)**
   - How confident are you in this assessment? (0-100)
   - Lower if requirements are vague
   - Higher if we have similar reference projects

IMPORTANT:
- Be realistic but not overly conservative
- A score of 70+ means we can definitely deliver
- A score of 50-70 means we can deliver with some partnerships/training
- A score below 50 means significant gaps
- Identify critical blockers that would prevent success

Provide your assessment:`,
    temperature: 0.3,
  });

  return result.object;
}
