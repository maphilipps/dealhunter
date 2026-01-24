import OpenAI from 'openai';

import { referenceMatchSchema, type ReferenceMatch } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';

// Security: Prompt Injection Protection
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface ReferenceAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean; // Web Search für Referenz-Recherche
}

/**
 * BIT-007: Reference Match Agent
 * Evaluates matching with existing reference projects and experience
 * UPGRADED: Mit Web Search für adesso Referenz-Recherche
 */
export async function runReferenceAgent(input: ReferenceAgentInput): Promise<ReferenceMatch> {
  // === Intelligent Research Phase ===
  let adessoReferences = '';
  let industryProjects = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Reference Researcher' });

    try {
      const industry =
        input.quickScanResults?.companyIntelligence?.basicInfo?.industry ||
        input.extractedRequirements?.industry;
      const techStack = input.quickScanResults?.techStack;
      const cms = techStack?.cms;

      // Suche nach adesso Referenzen in der Branche
      if (industry) {
        const referenceSearch = await intelligentTools.webSearch(
          `adesso SE ${industry} Projekt Referenz Kunde case study`,
          3
        );

        if (referenceSearch && referenceSearch.length > 0) {
          const rawRefData = referenceSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          // Wrap web search results for prompt injection protection
          adessoReferences = `\n\n**adesso Referenzen in ${industry} (EXA):**\n${wrapUserContent(rawRefData, 'web')}`;
          console.log(`[Reference Agent] ${referenceSearch.length} adesso Referenzen gefunden`);
        }
      }

      // Suche nach ähnlichen Projekten mit der Technologie
      if (cms) {
        const techProjectSearch = await intelligentTools.webSearch(
          `adesso ${cms} Projekt Enterprise Implementation`,
          3
        );

        if (techProjectSearch && techProjectSearch.length > 0) {
          const rawTechData = techProjectSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          // Wrap web search results for prompt injection protection
          industryProjects = `\n\n**adesso ${cms} Projekte (EXA):**\n${wrapUserContent(rawTechData, 'web')}`;
          console.log(`[Reference Agent] ${techProjectSearch.length} Tech-Projekte gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Reference Agent] Research fehlgeschlagen:', error);
    }
  }

  const completion = await openai.chat.completions.create({
    model: 'gemini-3-flash-preview',
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

${
  input.quickScanResults
    ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
`
    : ''
}
${adessoReferences}
${industryProjects}

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
