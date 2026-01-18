import OpenAI from 'openai';
import { capabilityMatchSchema, type CapabilityMatch } from '../schema';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface CapabilityAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // Tech stack detection
}

/**
 * BIT-002: Capability Match Agent
 * Evaluates if adesso has the technical capabilities to deliver this project
 */
export async function runCapabilityAgent(input: CapabilityAgentInput): Promise<CapabilityMatch> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Technical Capability Assessor bei adesso SE.
Bewerte GRÜNDLICH, ob adesso die technischen Fähigkeiten hat, dieses Projekt erfolgreich zu liefern.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Einschätzung ab, auch wenn nicht alle technischen Details explizit genannt sind. Nutze dein Expertenwissen über typische Projektanforderungen.`,
      },
      {
        role: 'user',
        content: `Bewerte die technische Kapazität von adesso für dieses Projekt.

**Extrahierte Anforderungen:**
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
**Quick Scan Ergebnisse (Tech Stack des Kunden):**
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

**adesso Kernkompetenzen:**
- **CMS & Portale:** Drupal (20+ Jahre Expertise), WordPress, Typo3, Magnolia, Sitecore
- **Frontend:** React, Vue, Angular, Next.js, TypeScript, Tailwind
- **Backend:** Java/Spring Boot, .NET Core, Node.js, Python, PHP
- **Cloud:** AWS (Advanced Partner), Azure, GCP (zertifizierte Partner)
- **E-Commerce:** SAP Commerce, Shopware, Magento, Spryker
- **Enterprise:** SAP S/4HANA, Salesforce, Microsoft Dynamics 365
- **Mobile:** React Native, Flutter, native iOS/Android
- **DevOps:** CI/CD, Kubernetes, Docker, GitOps
- **Data & AI:** Machine Learning, Data Engineering, Business Intelligence
- **Integration:** API Management, Microservices, Event-Driven Architecture

**BEWERTUNGSKRITERIEN:**
1. **Technologie-Match:** Haben wir Expertise in den benötigten Technologien?
2. **Skalierung:** Können wir das Projekt in der gewünschten Größe stemmen?
3. **Fehlende Kapazitäten:** Was fehlt uns und wie kritisch ist es?
4. **Kritische Blocker:** Gibt es absolute Deal-Breaker?

**Antworte mit JSON:**
- hasRequiredTechnologies (boolean): Haben wir die benötigten Technologien?
- technologyMatchScore (number 0-100): Technologie-Match-Score
- missingCapabilities (array of strings): Fehlende Kapazitäten auf Deutsch
- hasRequiredScale (boolean): Können wir die Projektgröße stemmen?
- scaleMatchScore (number 0-100): Skalierungs-Score
- scaleGaps (array of strings): Skalierungs-Lücken auf Deutsch
- overallCapabilityScore (number 0-100): Gewichteter Gesamt-Score
- confidence (number 0-100): Confidence der Bewertung
- reasoning (string): Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- criticalBlockers (array of strings): Kritische Blocker auf Deutsch`,
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

  return capabilityMatchSchema.parse(cleanedResult);
}
