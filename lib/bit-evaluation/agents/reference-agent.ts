import { referenceMatchSchema, type ReferenceMatch } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface ReferenceAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean;
}

export async function runReferenceAgent(input: ReferenceAgentInput): Promise<ReferenceMatch> {
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

          adessoReferences = `\n\n### adesso Referenzen in ${industry}\n${wrapUserContent(rawRefData, 'web')}`;
          console.log(`[Reference Agent] ${referenceSearch.length} adesso Referenzen gefunden`);
        }
      }

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

          industryProjects = `\n\n### adesso ${cms} Projekte\n${wrapUserContent(rawTechData, 'web')}`;
          console.log(`[Reference Agent] ${techProjectSearch.length} Tech-Projekte gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Reference Agent] Research fehlgeschlagen:', error);
    }
  }

  const systemPrompt = `Du bist ein Reference Project Matcher bei adesso SE.

## Deine Aufgabe
Bewerte, wie gut diese Opportunity zu unseren bestehenden Referenzprojekten und Erfahrungen passt.

## adesso Referenz-Portfolio

### CMS & Portal Projekte
- 200+ Drupal-Projekte (Enterprise-Portale, Government, Corporate)
- Large-Scale Content Migrations (TYPO3, WordPress → Drupal)
- Headless CMS mit React/Next.js Frontends
- Multi-Language, Multi-Site Implementierungen

### E-Commerce Projekte
- SAP Commerce für Retail-Kunden
- Shopware für Mittelstand
- Custom E-Commerce mit Payment-Integration

### Enterprise Integration
- SAP-Integration in Manufacturing
- Salesforce in Insurance
- Microsoft Dynamics in Public Sector

### Cloud & DevOps
- AWS Migrationen für Banking
- Azure in Insurance
- Kubernetes/Container Transformationen

### Branchen-Erfahrung

| Branche | Erfahrung |
|---------|-----------|
| Banking & Insurance | 30+ Major Clients (extensive) |
| Automotive | Major OEMs und Supplier (extensive) |
| Retail & E-Commerce | 50+ Implementierungen (extensive) |
| Public Sector | Government, Kommunen (moderate) |
| Energy & Utilities | Grid Operators, Provider (moderate) |
| Manufacturing | Discrete + Process (moderate) |
| Healthcare | Wachsend (limited) |

## Industry Experience Levels
- none: Keine Erfahrung
- limited: 1-5 Projekte
- moderate: 5-20 Projekte
- extensive: 20+ Projekte

## Ausgabesprache
Alle Texte auf Deutsch.`;

  const userPrompt = `Bewerte die Referenz-Passung für diese Opportunity.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.quickScanResults
    ? `## Quick Scan Ergebnisse
${JSON.stringify(input.quickScanResults, null, 2)}`
    : ''
}
${adessoReferences}
${industryProjects}

## Deine Bewertung
Analysiere und bewerte:
1. Ähnliche Projekte (similarProjectsAnalysis: hasRelevantReferences, similarProjects, projectTypeMatchScore)
2. Branchen-Match (industryMatchAnalysis: industryMatchScore, industryExperience, industryInsights)
3. Technologie-Match (technologyMatchAnalysis: technologyMatchScore, matchingTechnologies, missingExperience)
4. Erfolgsrate (successRateAnalysis: estimatedSuccessRate, successFactors, riskFactors)
5. Gesamtbewertung (overallReferenceScore, confidence, reasoning, criticalBlockers)`;

  return generateStructuredOutput({
    model: 'quality',
    schema: referenceMatchSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
