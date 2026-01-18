import OpenAI from 'openai';
import { dealQualitySchema, type DealQuality } from '../schema';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface DealQualityAgentInput {
  extractedRequirements: any; // From extraction phase
  quickScanResults?: any; // Content volume, complexity
}

/**
 * BIT-003: Deal Quality Agent
 * Evaluates budget adequacy, timeline realism, margin potential, and bid-specific factors
 * Answers the 10 critical questions for BIT/NO BIT decisions
 */
export async function runDealQualityAgent(input: DealQualityAgentInput): Promise<DealQuality> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Business Development Experte bei adesso SE.
Analysiere die Ausschreibung GRÜNDLICH und beantworte alle kritischen Fragen für die BIT/NO BIT Entscheidung.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Du musst eine fundierte Einschätzung geben, auch wenn nicht alle Informationen explizit verfügbar sind. Nutze dein Expertenwissen, um realistische Annahmen zu treffen.`,
      },
      {
        role: 'user',
        content: `Analysiere diese Ausschreibung für die BIT/NO BIT Entscheidung.

**Extrahierte Anforderungen:**
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
**Quick Scan Ergebnisse (Website-Analyse):**
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}

**adesso Kommerzieller Kontext:**
- Stundensätze: €80-€150 pro Stunde (Senior: €120+)
- Ziel-Margen: 25-35% Bruttomarge
- Mindest-Dealgrößen: €50k+ (präferiert: €150k+)
- Zahlungsziele: 30-60 Tage Standard

**KRITISCHE FRAGEN FÜR DIE BEWERTUNG:**

1. **Kundenbeziehung:** Haben wir bekannte Ansprechpartner beim Kunden, oder ist es ein anonymes Vergabeportal?
2. **Budget:** Welches Budget steckt hinter der Ausschreibung? Ist es angemessen für den Scope?
3. **Timeline:** Wie ist der zeitliche Ablauf? Wann ist die Shortlisting-Phase? Wann der geplante Projektstart?
4. **Vertragsform:** Ist es ein EVB-IT Vertrag, Dienstleistungsvertrag oder SLA? Welche Risiken birgt die Vertragsform?
5. **Leistungsumfang:** Welche konkreten Leistungen werden abgefragt?
6. **Referenzen:** Welche Referenzen werden gefordert? Können wir diese erfüllen?
7. **Zuschlagskriterien:** Wie sind die Zuschlagskriterien aufgebaut? Was wird besonders gewichtet?
8. **Team-Anforderungen:** Wie viele Leute werden für das Angebot benötigt? Wie komplex ist die Präsentation?
9. **Herausforderungen:** Welche speziellen Herausforderungen sehen wir?
10. **BIT/NO BIT Einschätzung:** Wie schätzen wir die Gewinnchancen ein?

**Antworte mit JSON:**
- budgetAdequacy (string: "adequate", "tight", oder "inadequate"): Budget-Bewertung
- estimatedBudget (string): Geschätztes Budget basierend auf Scope (z.B. "€150k-€300k")
- estimatedMargin (number 0-100): Erwartete Marge in Prozent
- budgetRisks (array of strings): Budget-bezogene Risiken auf Deutsch
- timelineRealism (string: "realistic", "tight", oder "unrealistic"): Timeline-Bewertung
- projectStart (string): Geschätzter Projektstart
- shortlistingDate (string): Geschätztes Datum für Shortlisting/Präsentation
- timelineRisks (array of strings): Timeline-bezogene Risiken auf Deutsch
- contractType (string): Erkannter Vertragstyp (EVB-IT, Dienstleistung, SLA, Rahmenvertrag, etc.)
- contractRisks (array of strings): Vertrags-bezogene Risiken auf Deutsch
- customerRelationship (string: "existing", "known", oder "anonymous"): Kundenbeziehung
- relationshipDetails (string): Details zur Kundenbeziehung auf Deutsch
- requiredServices (array of strings): Geforderte Leistungen auf Deutsch
- requiredReferences (array of strings): Geforderte Referenzen auf Deutsch
- canFulfillReferences (boolean): Können wir die Referenzen erfüllen?
- awardCriteria (string): Beschreibung der Zuschlagskriterien auf Deutsch
- teamRequirements (string): Beschreibung der Team-Anforderungen für das Angebot auf Deutsch
- challenges (array of strings): Identifizierte Herausforderungen auf Deutsch
- expectedRevenueRange (string): Umsatzschätzung wie "€100k-€300k"
- profitabilityRating (string: "high", "medium", oder "low"): Profitabilitäts-Rating
- commercialRisks (array of strings): Kommerzielle Risiken auf Deutsch
- criticalBlockers (array of strings): Absolute Deal-Breaker auf Deutsch
- overallDealQualityScore (number 0-100): Gesamt Deal-Qualität
- confidence (number 0-100): Confidence der Bewertung
- reasoning (string): Ausführliche Begründung auf Deutsch (min. 3-4 Sätze)`,
      },
    ],
    temperature: 0.3,
    max_tokens: 6000,
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

  return dealQualitySchema.parse(cleanedResult);
}
