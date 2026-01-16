import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { competitionCheckSchema, type CompetitionCheck } from '../schema';

export interface CompetitionAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // Tech stack, industry insights
}

/**
 * BIT-005: Competition Check Agent
 * Analyzes competitive situation and estimates win probability
 */
export async function runCompetitionAgent(input: CompetitionAgentInput): Promise<CompetitionCheck> {
  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: competitionCheckSchema,
    prompt: `You are a competitive intelligence analyst for adesso SE, a leading German IT consulting company.

Evaluate the competitive landscape and estimate our probability of winning this opportunity.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

adesso's Competitive Position:

**Key Strengths:**
- **Drupal Leadership:** Market leader in Drupal in Germany (20+ years)
- **Industry Expertise:** Deep expertise in Banking, Insurance, Automotive
- **Quality & Reliability:** Known for delivering complex enterprise projects
- **Innovation:** Strong in digital transformation, cloud, AI integration
- **German Market:** Strong presence and network in Germany
- **Size & Scale:** Large enough for enterprise projects, agile enough to be responsive

**Typical Competitors by Segment:**
- **Global System Integrators:** Accenture, Capgemini, Deloitte (compete on very large deals)
- **German IT Consulting:** CGI, msg, Sopra Steria (direct competitors)
- **Specialized Drupal:** Drupalize.me partners (smaller, specialized)
- **Digital Agencies:** DEPT, SinnerSchrader (compete on digital/marketing projects)
- **Niche Players:** Industry-specific consultancies

**Win Factors:**
1. **Existing Relationship:** We're already working with the customer
2. **Incumbent Advantage:** We built/maintain the current system
3. **Technology Match:** Project requires Drupal or our core tech
4. **Industry Expertise:** Project in our strong industries (Banking, Insurance, Auto)
5. **Complexity:** High complexity favors us over smaller players
6. **German Market:** German customer + German requirements

Assessment Criteria:

1. **Competition Level**
   - none: Direct invitation, no competition expected
   - low: Limited competition, likely 1-2 competitors
   - medium: Open RFP, 3-5 competitors expected
   - high: Formal public tender, 5+ competitors
   - very_high: International tender, 10+ competitors, very competitive

2. **Known/Likely Competitors**
   - Based on project type, size, and industry
   - List 2-5 most likely competitors
   - Consider: Global SIs, German IT consulting, specialized agencies

3. **Our Differentiators**
   - What makes us stand out from competitors?
   - Examples: Drupal expertise, industry knowledge, existing relationship, quality reputation
   - List 3-5 key differentiators

4. **Competitive Weaknesses**
   - Where might competitors be stronger?
   - Examples: lower price, global reach, specific technology, faster delivery
   - Be honest - list 2-4 potential weaknesses

5. **Win Probability Factors**
   - **hasIncumbentAdvantage:** Are we the current vendor/maintainer?
   - **hasExistingRelationship:** Do we already work with this customer (even on different projects)?
   - **hasUniqueCapability:** Do we have unique capabilities competitors lack (e.g., Drupal leadership)?
   - **pricingPosition:** low (we'll be cheapest), competitive (mid-range), premium (higher priced but justified by quality)

6. **Estimated Win Probability (estimatedWinProbability)**
   - 80-100%: Very likely to win (incumbent, low competition, perfect fit)
   - 60-80%: Good chance (some advantages, manageable competition)
   - 40-60%: Moderate chance (balanced competition, no clear advantage)
   - 20-40%: Low chance (strong competition, we're underdog)
   - 0-20%: Very unlikely (major disadvantages, fierce competition)

7. **Critical Blockers**
   - Competitor has exclusive relationship/contract
   - Price expectation far below our cost structure
   - Customer explicitly prefers competitor technology/approach
   - We're legally excluded from bidding

8. **Confidence (confidence)**
   - How confident are you in this competitive assessment? (0-100)
   - Lower if limited information about competition
   - Higher if we have clear competitive intelligence

IMPORTANT:
- Base win probability on concrete factors, not wishful thinking
- Consider that even with 30% win probability, a strategic deal might be worth pursuing
- A "low" win probability doesn't mean automatic NO BIT - it means higher risk

Provide your assessment:`,
    temperature: 0.3,
  });

  return result.object;
}
