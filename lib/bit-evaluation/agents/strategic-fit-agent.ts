import OpenAI from 'openai';
import { strategicFitSchema, type StrategicFit } from '../schema';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface StrategicFitAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // BL recommendation, industry
}

/**
 * BIT-004: Strategic Fit Agent
 * Evaluates alignment with adesso strategy and target customer profile
 */
export async function runStrategicFitAgent(input: StrategicFitAgentInput): Promise<StrategicFit> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Strategic Business Assessor bei adesso SE.
Bewerte GRÜNDLICH, wie gut diese Opportunity zur strategischen Ausrichtung und dem Zielkundenprofil von adesso passt.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Einschätzung ab. Alle Begründungen und Texte auf Deutsch.`,
      },
      {
        role: 'user',
        content: `Evaluate how well this opportunity aligns with adesso's strategic direction and target customer profile.

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

Respond with JSON containing:
- customerTypeAssessment (object):
  - customerType (string): Type of customer (enterprise, mid-market, startup, etc.)
  - isTargetCustomer (boolean): Is this our target customer profile?
  - customerFitScore (number 0-100): How well customer fits our profile
- industryAlignment (object):
  - industry (string): Customer industry
  - isTargetIndustry (boolean): Is this a target industry for adesso?
  - industryExperience (string: "none", "limited", "moderate", or "extensive"): Our experience
  - industryFitScore (number 0-100): Industry alignment score
- strategicValue (object):
  - isReferenceProject (boolean): Could this become a reference project?
  - enablesNewMarket (boolean): Opens doors to new markets?
  - expandsExistingRelationship (boolean): Expands relationship with existing customer?
  - longTermPotential (string: "low", "medium", or "high"): Long-term potential
- overallStrategicFitScore (number 0-100): Gesamt Strategic Fit Score
- confidence (number 0-100): Confidence der Bewertung
- reasoning (string): Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- criticalBlockers (array of strings): Strategische Blocker auf Deutsch`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
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

  return strategicFitSchema.parse(cleanedResult);
}
