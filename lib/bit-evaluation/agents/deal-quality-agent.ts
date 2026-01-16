import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { dealQualitySchema, type DealQuality } from '../schema';

export interface DealQualityAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // Content volume, complexity
}

/**
 * BIT-003: Deal Quality Agent
 * Evaluates budget adequacy, timeline realism, and margin potential
 */
export async function runDealQualityAgent(input: DealQualityAgentInput): Promise<DealQuality> {
  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: dealQualitySchema,
    prompt: `You are a commercial assessor for adesso SE, a leading German IT consulting company.

Evaluate the commercial quality and viability of this deal.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

adesso's Commercial Context:
- **Hourly Rates:** €80-€150 per hour depending on seniority
- **Target Margins:** 25-35% gross margin
- **Minimum Deal Size:** Typically €50k+ (smaller deals only if strategic)
- **Payment Terms:** 30-60 days standard
- **Risk Appetite:** Medium (prefer fixed-price for well-defined scopes, T&M for complex/uncertain work)

Assessment Criteria:

1. **Budget Assessment**
   - Is the stated/implied budget adequate for the scope?
   - Consider: team size × duration × hourly rate
   - Example: 5 people × 6 months × €100/hr × 160hrs/month = €480k
   - Estimate realistic margin (25-35% is healthy, 15-25% is acceptable, <15% is risky)
   - Flag budget risks: unrealistic expectations, scope creep potential, payment terms

2. **Timeline Assessment**
   - Is the timeline realistic given the scope and complexity?
   - Red flags: "urgent", "ASAP", very tight deadlines (<3 months for complex work)
   - Consider: time for requirements, development, testing, deployment, training
   - Flag timeline risks: insufficient time, dependencies, resource availability

3. **Commercial Viability**
   - Expected revenue range (e.g., "€100k-€500k")
   - Profitability rating: high (30%+ margin), medium (20-30%), low (<20%)
   - Commercial risks: payment issues, scope uncertainty, contractual risks

4. **Overall Deal Quality Score (overallDealQualityScore)**
   - 80-100: Excellent deal (good budget, realistic timeline, high margin)
   - 60-80: Good deal (adequate budget, doable timeline, acceptable margin)
   - 40-60: Marginal deal (tight budget or timeline, low margin)
   - 0-40: Poor deal (inadequate budget, unrealistic timeline, or negative margin)

5. **Critical Blockers**
   - Budget impossibly low for scope (e.g., €50k for a €500k project)
   - Timeline impossible (e.g., 1 month for 12-month work)
   - Payment terms unacceptable (e.g., pay-on-completion for 2-year project)
   - Scope-budget mismatch that cannot be resolved

6. **Confidence (confidence)**
   - How confident are you in this assessment? (0-100)
   - Lower if budget/timeline not clearly stated
   - Higher if detailed requirements and clear numbers

IMPORTANT:
- If no budget is stated, make reasonable assumptions based on scope
- If timeline seems rushed, flag it as a risk
- A low-margin deal might still be acceptable if strategically valuable
- Focus on realistic commercial assessment, not just winning the deal

Provide your assessment:`,
    temperature: 0.3,
  });

  return result.object;
}
