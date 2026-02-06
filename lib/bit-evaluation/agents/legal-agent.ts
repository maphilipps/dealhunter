import {
  legalAssessmentSchema,
  type LegalAssessment,
  legalQuickCheckSchema,
  type LegalQuickCheck,
} from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface LegalAgentInput {
  extractedRequirements: any;
  qualificationScanResults?: any;
  useWebSearch?: boolean;
  level?: 'quick' | 'full';
}

const legalQuickCheckSystemPrompt = `Du bist ein Legal Risk Assessor bei adesso SE.

## Deine Aufgabe
Führe einen SCHNELLEN Legal Quick Check durch - fokussiere auf KRITISCHE Red Flags.

## Red Flag Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| liability | Unbegrenzte Haftung, unfaire Haftungsklauseln |
| penalty | Unrealistische Pönalen (>10% Budget) |
| ip | Problematische IP-Übertragungsklauseln |
| warranty | Überzogene Gewährleistungsanforderungen |
| termination | Unfaire Kündigungsklauseln |
| jurisdiction | Problematische Gerichtsstände |

## Risiko-Score (1-10)
- 1-3: Niedriges Risiko, Standard-Vertrag
- 4-6: Mittleres Risiko, Verhandlung empfohlen
- 7-8: Hohes Risiko, detaillierte Prüfung nötig
- 9-10: Kritisches Risiko, potentieller Deal-Breaker

## Ausgabesprache
Alle Texte auf Deutsch.`;

export async function runLegalQuickCheck(input: LegalAgentInput): Promise<LegalQuickCheck> {
  const userPrompt = `Führe einen SCHNELLEN Legal Quick Check durch. Fokussiere auf KRITISCHE Red Flags.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.qualificationScanResults
    ? `## Qualification Scan Ergebnisse
${JSON.stringify(input.qualificationScanResults, null, 2)}`
    : ''
}

## Deine Bewertung
Identifiziere:
1. Kritische Red Flags (criticalFlags mit category, severity, description, clauseReference)
2. Compliance-Hinweise (complianceHints)
3. Braucht es eine detaillierte Prüfung? (requiresDetailedReview)
4. Schneller Risiko-Score 1-10 (quickRiskScore)
5. Confidence und kurze Begründung (reasoning)`;

  return generateStructuredOutput({
    model: 'fast',
    schema: legalQuickCheckSchema,
    system: legalQuickCheckSystemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}

const legalFullCheckSystemPrompt = `Du bist ein Legal Risk Assessor bei adesso SE.

## Deine Aufgabe
Führe eine VOLLSTÄNDIGE rechtliche und vertragliche Risikoanalyse durch.

## adesso Standard Legal Position
- **Vertragstypen**: Präferiert T&M oder Hybrid; Fixed Price nur bei klarem Scope
- **Zahlungsziele**: Standard 30 Tage netto; Meilenstein-basiert akzeptabel
- **Haftung**: Standard-Caps auf Vertragswert; KEINE unbegrenzte Haftung
- **IP**: Wir behalten IP für wiederverwendbare Komponenten
- **Compliance**: DSGVO-konform; SOC2/ISO27001 zertifiziert
- **Ausstieg**: Angemessene Kündigungsfristen (30-90 Tage)

## Prüfbereiche

### 1. Vertragstyp (contractTypeAssessment)
- Typ erkennen (Fixed Price, T&M, Outcome-based, etc.)
- Für adesso akzeptabel?
- Vertragsrisiken

### 2. Zahlungsrisiken (paymentRiskAssessment)
- Zahlungsbedingungen
- Risiko-Level (low/medium/high)
- Spezifische Risiken

### 3. Haftung (liabilityAssessment)
- Unbegrenzte Haftung? (KRITISCH!)
- Haftungs-Caps
- Haftungsrisiken

### 4. IP & Lizenzen (ipAndLicenseAssessment)
- IP-Transfer erforderlich?
- Lizenzanforderungen
- IP-Risiken

### 5. Compliance (complianceCheck)
- Vergaberecht (VOB, VGV, UVgO, EU-Schwellenwert)
- Rahmenvertrag?
- Subunternehmer-Regelungen

### 6. Ausstiegsklauseln (exitClauseAssessment)
- Angemessene Exit-Klauseln?
- Ausstiegsbedingungen
- Exit-Risiken

### 7. Red Flags (allRedFlags)
- Alle identifizierten Red Flags mit Kategorie, Severity, Beschreibung

## Ausgabesprache
Alle Texte auf Deutsch.`;

export async function runLegalAgent(input: LegalAgentInput): Promise<LegalAssessment> {
  const level = input.level || 'full';

  const quickCheck = level === 'quick' ? await runLegalQuickCheck(input) : undefined;

  let contractInsights = '';
  let complianceInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Legal Researcher' });

    try {
      const contractType = input.extractedRequirements?.contractType;
      const industry = input.qualificationScanResults?.companyIntelligence?.basicInfo?.industry;

      if (contractType && contractType.toLowerCase().includes('evb')) {
        const evbSearch = await intelligentTools.webSearch(
          `EVB-IT ${contractType} Vertrag Risiken Konditionen IT-Dienstleistung`,
          3
        );

        if (evbSearch && evbSearch.length > 0) {
          const rawEvbData = evbSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          contractInsights = `\n\n### EVB-IT Vertrags-Insights\n${wrapUserContent(rawEvbData, 'web')}`;
          console.log(`[Legal Agent] ${evbSearch.length} Vertrags-Insights gefunden`);
        }
      }

      if (industry) {
        const complianceSearch = await intelligentTools.webSearch(
          `${industry} IT compliance DSGVO Anforderungen Deutschland 2024`,
          3
        );

        if (complianceSearch && complianceSearch.length > 0) {
          const rawCompData = complianceSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          complianceInsights = `\n\n### Branchenspezifische Compliance\n${wrapUserContent(rawCompData, 'web')}`;
          console.log(`[Legal Agent] ${complianceSearch.length} Compliance-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Legal Agent] Research fehlgeschlagen:', error);
    }
  }

  let fullCheck = undefined;
  if (level === 'full') {
    const fullCheckSchema = legalAssessmentSchema.shape.fullCheck.unwrap();

    const userPrompt = `Führe eine VOLLSTÄNDIGE rechtliche Risikoanalyse durch.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.qualificationScanResults
    ? `## Qualification Scan Ergebnisse
${JSON.stringify(input.qualificationScanResults, null, 2)}`
    : ''
}
${contractInsights}
${complianceInsights}

## Deine vollständige Analyse
Analysiere alle 6 Bereiche und identifiziere alle Red Flags.`;

    fullCheck = await generateStructuredOutput({
      model: 'quality',
      schema: fullCheckSchema,
      system: legalFullCheckSystemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });
  }

  const legalRiskScore =
    quickCheck?.quickRiskScore || (fullCheck ? Math.round((100 - 50) / 10) : 5);
  const overallLegalScore = quickCheck ? Math.max(0, 100 - quickCheck.quickRiskScore * 10) : 50;

  const summarySystemPrompt = `Du bist Legal Risk Assessor. Erstelle eine finale Zusammenfassung auf Deutsch.`;

  const summaryUserPrompt = `Erstelle eine finale Legal-Bewertung basierend auf:

${
  quickCheck
    ? `## Quick Check
${JSON.stringify(quickCheck, null, 2)}`
    : ''
}

${
  fullCheck
    ? `## Full Check
${JSON.stringify(fullCheck, null, 2)}`
    : ''
}

## Zu liefern
- overallLegalScore: ${overallLegalScore}
- legalRiskScore: ${legalRiskScore}
- confidence (0-100)
- reasoning (ausführliche Begründung auf Deutsch, 3-4 Sätze)
- criticalBlockers (kritische Blocker auf Deutsch)`;

  const summarySchema = legalAssessmentSchema.pick({
    overallLegalScore: true,
    legalRiskScore: true,
    confidence: true,
    reasoning: true,
    criticalBlockers: true,
  });

  const summary = await generateStructuredOutput({
    model: 'fast',
    schema: summarySchema,
    system: summarySystemPrompt,
    prompt: summaryUserPrompt,
    temperature: 0.3,
  });

  return legalAssessmentSchema.parse({
    quickCheck,
    fullCheck,
    ...summary,
  });
}
