import { capabilityMatchSchema, type CapabilityMatch } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface CapabilityAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean;
}

/**
 * BIT-002: Capability Match Agent
 *
 * Bewertet, ob adesso die technischen Fähigkeiten hat, das Projekt erfolgreich zu liefern.
 * Nutzt AI SDK generateStructuredOutput für zuverlässige, typsichere Outputs.
 */
export async function runCapabilityAgent(input: CapabilityAgentInput): Promise<CapabilityMatch> {
  // === Research Phase ===
  let githubInsights = '';
  let technologyInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Capability Researcher' });

    try {
      const techStack = input.quickScanResults?.techStack;
      const cms = techStack?.cms || input.extractedRequirements?.technologies?.cms;
      const frameworks = techStack?.frameworks || [];

      // GitHub-Recherche für CMS/Framework Versionen
      if (cms) {
        const githubInfo = await intelligentTools.githubRepo(cms);
        if (githubInfo && !githubInfo.error) {
          const rawGithubData = `- Aktuelle Version: ${githubInfo.latestVersion || 'N/A'}
- GitHub Stars: ${githubInfo.githubStars || 'N/A'}
- Letztes Release: ${githubInfo.lastRelease || 'N/A'}
- Lizenz: ${githubInfo.license || 'N/A'}`;

          githubInsights = `\n\n### GitHub Intelligence für ${cms}\n${wrapUserContent(rawGithubData, 'web')}`;
          console.log(`[Capability Agent] GitHub Info für ${cms}: v${githubInfo.latestVersion}`);
        }
      }

      // Web Search für Technologie-Trends
      const primaryTech = cms || frameworks[0] || 'enterprise web development';
      const techSearch = await intelligentTools.webSearch(
        `${primaryTech} enterprise best practices 2024 capabilities requirements`,
        3
      );

      if (techSearch && techSearch.length > 0) {
        const rawTechData = techSearch
          .slice(0, 2)
          .map(r => `- ${r.title}: ${r.snippet}`)
          .join('\n');

        technologyInsights = `\n\n### Aktuelle Technologie-Insights\n${wrapUserContent(rawTechData, 'web')}`;
        console.log(`[Capability Agent] ${techSearch.length} Tech-Insights gefunden`);
      }
    } catch (error) {
      console.warn('[Capability Agent] Research fehlgeschlagen:', error);
    }
  }

  // === System Prompt ===
  const systemPrompt = `Du bist ein Technical Capability Assessor bei adesso SE.

## Deine Aufgabe
Bewerte, ob adesso die technischen Fähigkeiten hat, dieses Projekt erfolgreich zu liefern.

## adesso Kernkompetenzen

### CMS & Web (Kernkompetenz)
- Drupal: 20+ Jahre Expertise, Marktführer in Deutschland
- WordPress, TYPO3, Magnolia, Sitecore, Contentful
- Headless CMS mit React/Next.js Frontend

### Frontend
- React, Vue, Angular, Next.js, TypeScript, Tailwind

### Backend
- Java/Spring Boot, .NET Core, Node.js, Python, PHP

### Cloud (Zertifizierte Partner)
- AWS (Advanced Partner), Azure, GCP

### E-Commerce
- SAP Commerce, Shopware, Magento, Spryker

### Enterprise
- SAP S/4HANA, Salesforce, Microsoft Dynamics 365

### Mobile
- React Native, Flutter, native iOS/Android

### DevOps
- CI/CD, Kubernetes, Docker, GitOps

### Data & AI
- Machine Learning, Data Engineering, BI

## Bewertungskriterien

1. **Technologie-Match (0-100)**
   - 90-100: Kernkompetenz (z.B. Drupal)
   - 70-89: Starke Erfahrung
   - 50-69: Moderate Erfahrung
   - 30-49: Begrenzte Erfahrung
   - 0-29: Keine/kaum Erfahrung

2. **Skalierung (0-100)**
   - Teamgröße verfügbar?
   - Timeline realistisch für unsere Kapazitäten?

3. **Kritische Blocker**
   - Technologien die wir nicht beherrschen
   - Skalierungsprobleme die nicht lösbar sind

## Ausgabesprache
Alle Texte auf Deutsch.`;

  // === User Prompt ===
  const userPrompt = `Bewerte die technische Kapazität von adesso für dieses Projekt.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.quickScanResults
    ? `## Quick Scan Ergebnisse (Tech Stack des Kunden)
${JSON.stringify(input.quickScanResults, null, 2)}`
    : ''
}
${githubInsights}
${technologyInsights}

## Deine Bewertung
Analysiere die Anforderungen und bewerte:
1. Haben wir die benötigten Technologien? (hasRequiredTechnologies, technologyMatchScore)
2. Können wir die Projektgröße stemmen? (hasRequiredScale, scaleMatchScore)
3. Was fehlt uns? (missingCapabilities, scaleGaps)
4. Gibt es kritische Blocker? (criticalBlockers)
5. Gesamtbewertung mit Begründung (overallCapabilityScore, reasoning, confidence)`;

  // === AI SDK Call ===
  return generateStructuredOutput({
    model: 'quality',
    schema: capabilityMatchSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
