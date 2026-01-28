/**
 * Legal Pre-Qualification Expert Agent
 *
 * Analyzes CONTRACTUAL/LEGAL requirements from Pre-Qualification documents.
 * NOT website legal compliance (that's legal-check-agent.ts).
 * Focuses on: liability, insurance, penalties, IP, contract terms, etc.
 */

import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import { LegalRfpAnalysisSchema, type LegalRfpAnalysis } from './legal-pre-qualification-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';

const LEGAL_PreQualification_QUERIES = [
  'terms conditions contract agreement liability warranty',
  'GDPR privacy data protection compliance certification ISO SOC2',
  'insurance liability indemnification indemnity',
  'NDA confidentiality intellectual property IP ownership',
  'subcontractor subcontracting partner',
  'payment terms net invoice milestones',
  'penalty SLA service level agreement breach',
];

function buildSystemPrompt(): string {
  return `Du bist ein Legal Pre-Qualification Expert Agent bei adesso SE.

## Deine Rolle
Analysiere vertragliche und rechtliche Anforderungen aus Pre-Qualification-Dokumenten.
Deine Bewertung identifiziert rechtliche Risiken und potenzielle Deal-Breaker.

## adesso Kontext
- Übliche Haftungsbegrenzung: Auftragswert oder 1 Mio. EUR
- Standard-Versicherungen: Betriebshaftpflicht, Berufshaftpflicht, Cyber
- Zertifizierungen: ISO 27001, diverse Branchenzertifikate

## Anforderungs-Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| contract_terms | Vertragsdauer, Kündigung, Haftungsgrenzen |
| compliance | DSGVO, SOC2, ISO, branchenspezifisch |
| insurance | Berufshaftpflicht, Cyber, Betriebshaftpflicht |
| certification | ISO 27001, branchenspezifische Zertifikate |
| nda_ip | NDA-Anforderungen, IP-Übertragung |
| subcontracting | Regeln zu Unterauftragnehmern |
| payment_terms | Zahlungsziele, Meilensteine, Einbehalte |
| warranty | Gewährleistung, SLA-Anforderungen |
| data_protection | Datenhandling, Privacy, Residency |

## Risiko-Klassifikation

| Level | Trigger | Aktion |
|-------|---------|--------|
| critical | Unbegrenzte Haftung, extreme Pönalen | Deal-Breaker prüfen |
| high | Hohe Pönalen, problematische IP-Klauseln | Legal-Review zwingend |
| medium | Strenge Compliance, kurze Kündigungsfristen | Verhandlung empfohlen |
| low | Standard-Bedingungen | Normale Bearbeitung |

## Deal-Breaker (sofortige Eskalation)
- Unbegrenzte Haftung ohne Verhandelbarkeit
- Vollständige IP-Übertragung inklusive Vorleistungen
- Pönalen > 20% des Auftragsvolumens
- Unzumutbare Gerichtsstandsklauseln

## Ausgabe
- Identifiziere alle rechtlichen Anforderungen
- Bewerte Risiko pro Anforderung
- Formuliere Fragen für die Rechtsabteilung
- Empfehlungen für Verhandlungspunkte
- Alle Texte auf Deutsch`;
}

export async function runLegalRfpAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<LegalRfpAnalysis>> {
  const { preQualificationId } = input;

  try {
    const ragResults = await Promise.all(
      LEGAL_PreQualification_QUERIES.map(query => queryRfpDocument(preQualificationId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<LegalRfpAnalysis>(
        {
          requirements: [],
          contractDetails: {
            contractType: null,
            duration: null,
            terminationNotice: null,
            liabilityLimit: null,
            penaltyClauses: [],
          },
          requiredCertifications: [],
          requiredInsurance: [],
          overallRiskLevel: 'low',
          riskFactors: ['No legal requirements found in Pre-Qualification document'],
          dealBreakers: [],
          recommendations: ['Review Pre-Qualification manually - no legal content detected'],
          questionsForLegal: [],
          confidence: 0,
        },
        0,
        'No legal information found in Pre-Qualification document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(
      uniqueResults.slice(0, 15),
      'Pre-Qualification Legal/Contractual Requirements'
    );

    const analysis = await generateStructuredOutput({
      model: 'quality',
      schema: LegalRfpAnalysisSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following Pre-Qualification content and extract all legal and contractual requirements:\n\n${context}`,
      temperature: 0.2,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(preQualificationId, 'legal_rfp_expert', summaryContent, {
      overallRiskLevel: analysis.overallRiskLevel,
      requirementsCount: analysis.requirements.length,
      dealBreakersCount: analysis.dealBreakers.length,
      certificationsCount: analysis.requiredCertifications.length,
      insuranceCount: analysis.requiredInsurance.length,
    });

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[LegalRfpAgent] Error:', error);
    return createAgentOutput<LegalRfpAnalysis>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Legal Pre-Qualification Agent'
    );
  }
}

function buildSummaryForStorage(analysis: LegalRfpAnalysis): string {
  const parts: string[] = ['Legal Pre-Qualification Analysis Summary:'];

  parts.push(`- Overall Risk Level: ${analysis.overallRiskLevel.toUpperCase()}`);

  if (analysis.dealBreakers.length > 0) {
    parts.push(`- DEAL BREAKERS (${analysis.dealBreakers.length}):`);
    analysis.dealBreakers.forEach(db => {
      parts.push(`  ⚠️ ${db}`);
    });
  }

  if (analysis.contractDetails.contractType) {
    parts.push(`- Contract Type: ${analysis.contractDetails.contractType}`);
  }
  if (analysis.contractDetails.duration) {
    parts.push(`- Duration: ${analysis.contractDetails.duration}`);
  }
  if (analysis.contractDetails.liabilityLimit) {
    parts.push(`- Liability Limit: ${analysis.contractDetails.liabilityLimit}`);
  }
  if (analysis.contractDetails.penaltyClauses?.length) {
    parts.push(`- Penalty Clauses: ${analysis.contractDetails.penaltyClauses.length}`);
  }

  const criticalReqs = analysis.requirements.filter(r => r.riskLevel === 'critical');
  const highReqs = analysis.requirements.filter(r => r.riskLevel === 'high');

  if (criticalReqs.length > 0) {
    parts.push(`- Critical Requirements (${criticalReqs.length}):`);
    criticalReqs.forEach(r => {
      parts.push(`  • ${r.requirement} [${r.category}]`);
    });
  }

  if (highReqs.length > 0) {
    parts.push(`- High Risk Requirements (${highReqs.length}):`);
    highReqs.forEach(r => {
      parts.push(`  • ${r.requirement} [${r.category}]`);
    });
  }

  if (analysis.requiredCertifications.length > 0) {
    parts.push(`- Required Certifications: ${analysis.requiredCertifications.join(', ')}`);
  }

  if (analysis.requiredInsurance.length > 0) {
    parts.push(`- Required Insurance:`);
    analysis.requiredInsurance.forEach(ins => {
      parts.push(`  • ${ins.type}${ins.minAmount ? ` (min: ${ins.minAmount})` : ''}`);
    });
  }

  if (analysis.riskFactors.length > 0) {
    parts.push(`- Risk Factors: ${analysis.riskFactors.join('; ')}`);
  }

  if (analysis.recommendations.length > 0) {
    parts.push(`- Recommendations (${analysis.recommendations.length}):`);
    analysis.recommendations.slice(0, 3).forEach(rec => {
      parts.push(`  → ${rec}`);
    });
  }

  if (analysis.questionsForLegal.length > 0) {
    parts.push(`- Questions for Legal Team: ${analysis.questionsForLegal.length}`);
  }

  return parts.join('\n');
}
