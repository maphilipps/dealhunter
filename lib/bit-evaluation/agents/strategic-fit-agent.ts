import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { strategicFitSchema, type StrategicFit } from '../schema';

export interface StrategicFitAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // BL recommendation, industry
}

/**
 * BIT-004: Strategic Fit Agent
 * Evaluates alignment with adesso strategy and target customer profile
 */
export async function runStrategicFitAgent(input: StrategicFitAgentInput): Promise<StrategicFit> {
  const result = await generateObject({
    // @ts-expect-error - AI SDK v5 type mismatch between LanguageModelV3 and LanguageModel
    model: openai('gpt-4o-mini'),
    schema: strategicFitSchema,
    prompt: `You are a strategic business assessor for adesso SE, a leading German IT consulting company.

Evaluate how well this opportunity aligns with adesso's strategic direction and target customer profile.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

adesso's Strategic Focus:

**Target Customer Profile:**
- Large enterprises (1000+ employees) - BEST FIT
- Mid-market (250-1000 employees) - GOOD FIT
- DAX/MDAX companies in Germany - BEST FIT
- Public sector / Government - GOOD FIT for German public sector
- Startups / Small businesses - USUALLY NOT A FIT (unless strategic)

**Target Industries (Priority Order):**
1. Banking & Financial Services (core strength)
2. Insurance (core strength)
3. Automotive (strong presence)
4. Energy & Utilities (growing)
5. Retail & E-Commerce (established)
6. Public Sector (strong in Germany)
7. Healthcare (growing)
8. Manufacturing & Industry 4.0
9. Telecommunications

**Strategic Priorities:**
- Digital transformation projects
- Cloud migration and modernization
- Drupal CMS expertise (market leader in Germany)
- Enterprise architecture and system integration
- Data & Analytics / AI integration
- Sustainable, long-term client relationships

**Strategic Value Indicators:**
- **Reference Project Potential:** Can showcase our expertise, good for marketing
- **New Market Entry:** Opens doors to new industries or customer segments
- **Relationship Expansion:** Deepens relationship with existing customer
- **Technology Leadership:** Cutting-edge tech that positions us as innovators
- **Recurring Revenue:** Potential for managed services, retainers, or follow-on work

Assessment Criteria:

1. **Customer Type Assessment**
   - What type of customer is this? (enterprise, mid-market, SMB, startup, public sector)
   - Is this our target customer profile?
   - Customer fit score (0-100): How well do they match our ideal customer?

2. **Industry Alignment**
   - What industry are they in?
   - Is this a target industry for us?
   - What's our experience level? (none, limited, moderate, extensive)
   - Industry fit score (0-100)

3. **Strategic Value**
   - Could this become a reference project? (based on company prominence, project visibility)
   - Does it enable entry to new markets/industries?
   - Does it expand an existing relationship?
   - Long-term potential: high (multi-year relationship likely), medium (possible extensions), low (one-off project)

4. **Overall Strategic Fit Score (overallStrategicFitScore)**
   - 80-100: Perfect fit (target customer, target industry, high strategic value)
   - 60-80: Good fit (mostly aligned with our strategy)
   - 40-60: Moderate fit (some strategic value but not ideal)
   - 0-40: Poor fit (outside our target profile)

5. **Critical Blockers**
   - Customer type completely mismatched (e.g., small startup)
   - Industry where we have zero expertise and cannot quickly develop it
   - Project type inconsistent with our strategy (e.g., body shopping)
   - Geographic market we don't serve

6. **Confidence (confidence)**
   - How confident are you in this assessment? (0-100)
   - Lower if customer/industry details are unclear
   - Higher if this clearly matches/mismatches our profile

IMPORTANT:
- A lower score doesn't mean automatic NO BIT - strategic value can outweigh fit
- A first project with a target customer might score lower on "experience" but higher on strategic value
- Consider both current fit AND future potential

Provide your assessment:`,
    temperature: 0.3,
  });

  return result.object;
}
