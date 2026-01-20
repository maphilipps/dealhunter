import OpenAI from 'openai';
import { competitionCheckSchema, type CompetitionCheck } from '../schema';
// Intelligent Agent Framework - NEW
import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface CompetitionAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // Tech stack, industry insights
  useWebSearch?: boolean; // NEW: Web Search für aktuelle Wettbewerber-Infos
}

/**
 * BIT-005: Competition Check Agent
 * Analyzes competitive situation and estimates win probability
 * UPGRADED: Mit Web Search für aktuelle Wettbewerber-Infos
 */
export async function runCompetitionAgent(input: CompetitionAgentInput): Promise<CompetitionCheck> {
  // === Intelligent Research Phase (NEW) ===
  let competitorNews = '';
  let marketInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Competition Researcher' });

    try {
      // Extrahiere Industrie und Kunde für gezielte Recherche
      const industry = input.quickScanResults?.companyIntelligence?.basicInfo?.industry ||
                       input.extractedRequirements?.industry || '';
      const customerName = input.extractedRequirements?.customerName || '';

      // Web Search für aktuelle Wettbewerber-Aktivitäten im Markt
      if (industry) {
        const marketSearch = await intelligentTools.webSearch(
          `${industry} IT consulting competitors Germany 2024 digital transformation`,
          5
        );

        if (marketSearch && marketSearch.length > 0) {
          marketInsights = `\n\nAktuelle Markt-Insights (Web Search):\n${marketSearch
            .slice(0, 3)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n')}`;
          console.log(`[Competition Agent] ${marketSearch.length} Markt-Insights gefunden`);
        }
      }

      // Web Search für Kunden-spezifische IT-Projekte/Ausschreibungen
      if (customerName) {
        const customerSearch = await intelligentTools.webSearch(
          `"${customerName}" IT projekt ausschreibung tender 2024`,
          3
        );

        if (customerSearch && customerSearch.length > 0) {
          competitorNews = `\n\nKunden-spezifische Insights (Web Search):\n${customerSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n')}`;
          console.log(`[Competition Agent] ${customerSearch.length} Kunden-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Competition Agent] Web Search fehlgeschlagen:', error);
      // Non-critical: Continue without web search results
    }
  }

  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Competitive Intelligence Analyst bei adesso SE.
Analysiere GRÜNDLICH die Wettbewerbssituation und schätze die Gewinnwahrscheinlichkeit ein.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Einschätzung ab. Alle Begründungen und Texte auf Deutsch.`,
      },
      {
        role: 'user',
        content: `Evaluate the competitive landscape and estimate our probability of winning this opportunity.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}
${marketInsights}
${competitorNews}

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

Respond with JSON containing:
- competitiveAnalysis (object):
  - competitionLevel (string: "none", "low", "medium", "high", or "very_high"): Level of competition
  - knownCompetitors (array of strings): Known/likely competitors (2-5)
  - ourDifferentiators (array of strings): What differentiates adesso (3-5)
  - competitiveWeaknesses (array of strings): Areas where competitors might be stronger (2-4)
- winProbabilityFactors (object):
  - hasIncumbentAdvantage (boolean): Are we the current vendor?
  - hasExistingRelationship (boolean): Do we already work with this customer?
  - hasUniqueCapability (boolean): Do we have unique capabilities competitors lack?
  - pricingPosition (string: "low", "competitive", or "premium"): Our pricing position
- estimatedWinProbability (number 0-100): Geschätzte Gewinnwahrscheinlichkeit
- confidence (number 0-100): Confidence der Bewertung
- reasoning (string): Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- criticalBlockers (array of strings): Wettbewerbs-bezogene Blocker auf Deutsch`,
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

  return competitionCheckSchema.parse(cleanedResult);
}
