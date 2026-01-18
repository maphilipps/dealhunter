import OpenAI from 'openai';
import { referenceMatchSchema, type ReferenceMatch } from '../schema';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface ReferenceAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
}

/**
 * BIT-007: Reference Match Agent
 * Evaluates matching with existing reference projects and experience
 */
export async function runReferenceAgent(input: ReferenceAgentInput): Promise<ReferenceMatch> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Reference Project Matcher bei adesso SE.
Bewerte GRÜNDLICH, wie gut diese Opportunity zu unseren bestehenden Referenzprojekten und Erfahrungen passt.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Einschätzung ab. Alle Begründungen und Texte auf Deutsch.`,
      },
      {
        role: 'user',
        content: `Evaluate how well this opportunity matches our existing experience and reference projects.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

adesso's Reference Project Portfolio:

**CMS & Portal Projects:**
- 200+ Drupal projects (enterprise portals, government sites, corporate websites)
- Large-scale content migrations (TYPO3, WordPress to Drupal)
- Headless CMS implementations with React/Next.js frontends
- Multi-language, multi-site implementations

**E-Commerce Projects:**
- SAP Commerce implementations for retail clients
- Shopware projects for mid-market
- Custom e-commerce with payment integrations

**Enterprise Integration:**
- SAP integration projects in manufacturing
- Salesforce implementations in insurance
- Microsoft Dynamics in public sector

**Cloud & DevOps:**
- AWS migrations for banking clients
- Azure implementations for insurance
- Kubernetes/container transformations

**Industry Experience:**
- Banking & Insurance: 30+ major clients
- Automotive: Major OEMs and suppliers
- Retail & E-Commerce: 50+ implementations
- Public Sector: Government agencies, municipalities
- Energy & Utilities: Grid operators, energy providers
- Manufacturing: Discrete and process manufacturing

Respond with JSON containing:
- similarProjectsAnalysis (object):
  - hasRelevantReferences (boolean): Do we have relevant reference projects?
  - similarProjects (array of objects with projectType, relevanceScore 0-100, keyLearnings): Similar projects
  - projectTypeMatchScore (number 0-100): Overall project type match score
- industryMatchAnalysis (object):
  - industryMatchScore (number 0-100): How well do we know this industry
  - industryExperience (string: "none", "limited", "moderate", or "extensive"): Experience level
  - industryInsights (array of strings): Key industry insights we bring
- technologyMatchAnalysis (object):
  - technologyMatchScore (number 0-100): Technology experience score
  - matchingTechnologies (array of strings): Technologies with strong experience
  - missingExperience (array of strings): Technologies we lack experience with
- successRateAnalysis (object):
  - estimatedSuccessRate (number 0-100): Estimated success rate based on history
  - successFactors (array of strings): Factors that increase success probability
  - riskFactors (array of strings): Factors that decrease success probability
- overallReferenceScore (number 0-100): Gesamt Reference Match Score
- confidence (number 0-100): Confidence der Bewertung
- reasoning (string): Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- criticalBlockers (array of strings): Kritische Referenz-bezogene Blocker auf Deutsch`,
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

  return referenceMatchSchema.parse(cleanedResult);
}
