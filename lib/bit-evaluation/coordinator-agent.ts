import { z } from 'zod';

import {
  type CoordinatorOutput,
  type DecisionNode,
  type CapabilityMatch,
  type DealQuality,
  type StrategicFit,
  type CompetitionCheck,
  type LegalAssessment,
  type ContractAnalysis,
  type ReferenceMatch,
} from './schema';

import { generateStructuredOutput } from '@/lib/ai/config';
import { meetsBidThreshold } from '@/lib/config/business-rules';

/**
 * Decision Tree Builder
 * Generates a hierarchical decision tree from agent results
 */
export function buildDecisionTree(context: {
  scores: {
    capability: number;
    dealQuality: number;
    strategicFit: number;
    winProbability: number;
    legal: number;
    reference: number;
    overall: number;
  };
  capabilityMatch: CapabilityMatch;
  dealQuality: DealQuality;
  strategicFit: StrategicFit;
  competitionCheck: CompetitionCheck;
  legalAssessment: LegalAssessment;
  contractAnalysis: ContractAnalysis;
  referenceMatch: ReferenceMatch;
  allCriticalBlockers: string[];
  recommendation: 'bit' | 'no_bit';
}): DecisionNode {
  const { scores, allCriticalBlockers, recommendation } = context;

  // Root decision node
  const root: DecisionNode = {
    id: 'root',
    type: 'decision',
    label: 'Bid/No-Bid Decision',
    value: recommendation.toUpperCase(),
    score: scores.overall,
    sentiment: recommendation === 'bit' ? 'positive' : 'negative',
    children: [],
  };

  // Critical blockers branch (if any)
  if (allCriticalBlockers.length > 0) {
    const blockersNode: DecisionNode = {
      id: 'blockers',
      type: 'blocker',
      label: 'Critical Blockers',
      value: allCriticalBlockers.length,
      sentiment: 'critical',
      reasoning: `${allCriticalBlockers.length} critical blockers found`,
      children: allCriticalBlockers.map((blocker, idx) => ({
        id: `blocker-${idx}`,
        type: 'blocker' as const,
        label: blocker,
        sentiment: 'critical' as const,
      })),
    };
    root.children!.push(blockersNode);
  }

  // Capability assessment branch
  const capabilityNode: DecisionNode = {
    id: 'capability',
    type: 'criterion',
    label: 'Capability Match',
    score: scores.capability,
    weight: 0.25,
    sentiment:
      scores.capability >= 70 ? 'positive' : scores.capability >= 50 ? 'neutral' : 'negative',
    reasoning: context.capabilityMatch.reasoning,
    children: [
      {
        id: 'capability-tech',
        type: 'criterion',
        label: 'Technology Match',
        score: context.capabilityMatch.technologyMatchScore,
        value: context.capabilityMatch.hasRequiredTechnologies,
        sentiment: context.capabilityMatch.hasRequiredTechnologies ? 'positive' : 'negative',
      },
      {
        id: 'capability-scale',
        type: 'criterion',
        label: 'Scale Match',
        score: context.capabilityMatch.scaleMatchScore,
        value: context.capabilityMatch.hasRequiredScale,
        sentiment: context.capabilityMatch.hasRequiredScale ? 'positive' : 'negative',
      },
    ],
  };
  root.children!.push(capabilityNode);

  // Deal Quality assessment branch
  const dealQualityNode: DecisionNode = {
    id: 'deal-quality',
    type: 'criterion',
    label: 'Deal Quality',
    score: scores.dealQuality,
    weight: 0.2,
    sentiment:
      scores.dealQuality >= 70 ? 'positive' : scores.dealQuality >= 50 ? 'neutral' : 'negative',
    reasoning: context.dealQuality.reasoning,
    children: [
      {
        id: 'deal-budget',
        type: 'criterion',
        label: 'Budget Adequacy',
        value: context.dealQuality.budgetAdequacy,
        sentiment:
          context.dealQuality.budgetAdequacy === 'adequate'
            ? 'positive'
            : context.dealQuality.budgetAdequacy === 'tight'
              ? 'neutral'
              : 'negative',
      },
      {
        id: 'deal-timeline',
        type: 'criterion',
        label: 'Timeline Realism',
        value: context.dealQuality.timelineRealism,
        sentiment:
          context.dealQuality.timelineRealism === 'realistic'
            ? 'positive'
            : context.dealQuality.timelineRealism === 'tight'
              ? 'neutral'
              : 'negative',
      },
      {
        id: 'deal-margin',
        type: 'criterion',
        label: 'Expected Margin',
        score: context.dealQuality.estimatedMargin,
        value: `${context.dealQuality.estimatedMargin}%`,
        sentiment:
          context.dealQuality.estimatedMargin >= 20
            ? 'positive'
            : context.dealQuality.estimatedMargin >= 10
              ? 'neutral'
              : 'negative',
      },
    ],
  };
  root.children!.push(dealQualityNode);

  // Strategic Fit assessment branch
  const strategicFitNode: DecisionNode = {
    id: 'strategic-fit',
    type: 'criterion',
    label: 'Strategic Fit',
    score: scores.strategicFit,
    weight: 0.15,
    sentiment:
      scores.strategicFit >= 70 ? 'positive' : scores.strategicFit >= 50 ? 'neutral' : 'negative',
    reasoning: context.strategicFit.reasoning,
    children: [
      {
        id: 'strategic-customer',
        type: 'criterion',
        label: 'Customer Type Match',
        score: context.strategicFit.customerTypeAssessment.customerFitScore,
        value: context.strategicFit.customerTypeAssessment.isTargetCustomer,
        sentiment: context.strategicFit.customerTypeAssessment.isTargetCustomer
          ? 'positive'
          : 'negative',
      },
      {
        id: 'strategic-industry',
        type: 'criterion',
        label: 'Industry Alignment',
        score: context.strategicFit.industryAlignment.industryFitScore,
        value: context.strategicFit.industryAlignment.isTargetIndustry,
        sentiment: context.strategicFit.industryAlignment.isTargetIndustry
          ? 'positive'
          : 'negative',
      },
    ],
  };
  root.children!.push(strategicFitNode);

  // Competition analysis branch
  const competitionNode: DecisionNode = {
    id: 'competition',
    type: 'criterion',
    label: 'Win Probability',
    score: scores.winProbability,
    weight: 0.15,
    sentiment:
      scores.winProbability >= 70
        ? 'positive'
        : scores.winProbability >= 50
          ? 'neutral'
          : 'negative',
    reasoning: context.competitionCheck.reasoning,
    children: [
      {
        id: 'competition-level',
        type: 'criterion',
        label: 'Competition Level',
        value: context.competitionCheck.competitiveAnalysis.competitionLevel,
        sentiment:
          context.competitionCheck.competitiveAnalysis.competitionLevel === 'none' ||
          context.competitionCheck.competitiveAnalysis.competitionLevel === 'low'
            ? 'positive'
            : context.competitionCheck.competitiveAnalysis.competitionLevel === 'medium'
              ? 'neutral'
              : 'negative',
      },
      {
        id: 'competition-advantage',
        type: 'criterion',
        label: 'Incumbent Advantage',
        value: context.competitionCheck.winProbabilityFactors.hasIncumbentAdvantage,
        sentiment: context.competitionCheck.winProbabilityFactors.hasIncumbentAdvantage
          ? 'positive'
          : 'neutral',
      },
    ],
  };
  root.children!.push(competitionNode);

  // Legal assessment branch
  const legalNode: DecisionNode = {
    id: 'legal',
    type: 'criterion',
    label: 'Legal Assessment',
    score: scores.legal,
    weight: 0.15,
    sentiment: scores.legal >= 70 ? 'positive' : scores.legal >= 50 ? 'neutral' : 'negative',
    reasoning: context.legalAssessment.reasoning,
    children: [
      {
        id: 'legal-contract',
        type: 'criterion',
        label: 'Contract Type',
        value: context.legalAssessment.fullCheck?.contractTypeAssessment.isAcceptable ?? true,
        sentiment:
          (context.legalAssessment.fullCheck?.contractTypeAssessment.isAcceptable ?? true)
            ? 'positive'
            : 'negative',
      },
      {
        id: 'legal-liability',
        type: 'criterion',
        label: 'Liability Risk',
        value: !(
          context.legalAssessment.fullCheck?.liabilityAssessment.hasUnlimitedLiability ?? false
        ),
        sentiment: !(
          context.legalAssessment.fullCheck?.liabilityAssessment.hasUnlimitedLiability ?? false
        )
          ? 'positive'
          : 'critical',
      },
    ],
  };
  root.children!.push(legalNode);

  // Reference match branch
  const referenceNode: DecisionNode = {
    id: 'reference',
    type: 'criterion',
    label: 'Reference Match',
    score: scores.reference,
    weight: 0.1,
    sentiment:
      scores.reference >= 70 ? 'positive' : scores.reference >= 50 ? 'neutral' : 'negative',
    reasoning: context.referenceMatch.reasoning,
    children: [
      {
        id: 'reference-projects',
        type: 'criterion',
        label: 'Similar Projects',
        value: context.referenceMatch.similarProjectsAnalysis.hasRelevantReferences,
        score: context.referenceMatch.similarProjectsAnalysis.projectTypeMatchScore,
        sentiment: context.referenceMatch.similarProjectsAnalysis.hasRelevantReferences
          ? 'positive'
          : 'negative',
      },
      {
        id: 'reference-success',
        type: 'criterion',
        label: 'Success Rate',
        score: context.referenceMatch.successRateAnalysis.estimatedSuccessRate,
        sentiment:
          context.referenceMatch.successRateAnalysis.estimatedSuccessRate >= 70
            ? 'positive'
            : context.referenceMatch.successRateAnalysis.estimatedSuccessRate >= 50
              ? 'neutral'
              : 'negative',
      },
    ],
  };
  root.children!.push(referenceNode);

  // Final outcome node
  const outcomeNode: DecisionNode = {
    id: 'outcome',
    type: 'outcome',
    label: recommendation === 'bit' ? 'Proceed with BIT' : 'Recommend NO BIT',
    score: scores.overall,
    sentiment: recommendation === 'bit' ? 'positive' : 'negative',
    reasoning:
      recommendation === 'bit'
        ? `Overall score of ${scores.overall.toFixed(1)}/100 with no critical blockers supports proceeding with bid.`
        : `Overall score of ${scores.overall.toFixed(1)}/100 or critical blockers present recommend against bidding.`,
  };
  root.children!.push(outcomeNode);

  return root;
}

/**
 * Calculate Confidence Score
 * Based on agent confidence levels and data completeness
 */
export function calculateConfidence(context: {
  capabilityMatch: CapabilityMatch;
  dealQuality: DealQuality;
  strategicFit: StrategicFit;
  competitionCheck: CompetitionCheck;
  legalAssessment: LegalAssessment;
  referenceMatch: ReferenceMatch;
}): number {
  // Average confidence across all agents
  const confidences = [
    context.capabilityMatch.confidence,
    context.dealQuality.confidence,
    context.strategicFit.confidence,
    context.competitionCheck.confidence,
    context.legalAssessment.confidence,
    context.referenceMatch.confidence,
  ];

  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

  // Penalize if variance is high (inconsistent confidence levels)
  const variance =
    confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
  const stdDev = Math.sqrt(variance);

  // Reduce confidence if standard deviation is high
  const consistencyPenalty = Math.min(stdDev / 2, 20); // max 20 point penalty

  return Math.max(0, Math.min(100, avgConfidence - consistencyPenalty));
}

/**
 * Coordinator Agent
 * Synthesizes all agent results and creates final decision with tree
 */
export async function runCoordinatorAgent(context: {
  capabilityMatch: CapabilityMatch;
  dealQuality: DealQuality;
  strategicFit: StrategicFit;
  competitionCheck: CompetitionCheck;
  legalAssessment: LegalAssessment;
  contractAnalysis: ContractAnalysis;
  referenceMatch: ReferenceMatch;
  scores: {
    capability: number;
    dealQuality: number;
    strategicFit: number;
    winProbability: number;
    legal: number;
    reference: number;
    overall: number;
  };
  allCriticalBlockers: string[];
}): Promise<CoordinatorOutput> {
  // Calculate initial recommendation using centralized config
  const hasCriticalBlockers = context.allCriticalBlockers.length > 0;
  const shouldBit = meetsBidThreshold(context.scores.overall, hasCriticalBlockers);
  const recommendation = shouldBit ? 'bit' : 'no_bit';

  // Build decision tree
  const decisionTree = buildDecisionTree({
    ...context,
    recommendation,
  });

  // Calculate confidence
  const confidence = calculateConfidence(context);

  // Determine if escalation is required
  const escalationRequired = confidence < 70;

  // Use AI to generate synthesis
  const systemPrompt = `Du bist der Coordinator Agent für BIT/NO BIT Entscheidungen bei adesso SE.

## Deine Rolle
Als zentraler Entscheider synthetisierst du alle Teil-Analysen zu einem kohärenten Gesamtbild
für das Management. Deine Synthese bildet die Grundlage für die finale Bid-Entscheidung.

## adesso Kontext
adesso SE ist Deutschlands größter unabhängiger IT-Dienstleister mit:
- 10.000+ Mitarbeitenden
- Starke Expertise in Banking, Insurance, Automotive, Public Sector
- Führend bei CMS/Web (Drupal, TYPO3, AEM) und Enterprise-Lösungen
- Hohe Qualitätsstandards und Projekterfolgsquote

## Agent-Gewichtungen

| Agent | Gewicht | Fokus |
|-------|---------|-------|
| Capability | 25% | Technische Fähigkeiten, Team-Verfügbarkeit |
| Deal Quality | 20% | Budget, Timeline, Commercial Viability |
| Strategic Fit | 15% | Kunde, Branche, Wachstumspotenzial |
| Competition | 15% | Wettbewerb, Win Probability |
| Legal | 15% | Vertragsrisiken, Compliance |
| Reference | 10% | Erfahrung mit ähnlichen Projekten |

## Synthese-Anweisungen
1. Identifiziere die 3-5 stärksten Pro-Argumente (auch bei NO BIT)
2. Identifiziere die 3-5 stärksten Contra-Argumente (auch bei BIT)
3. Priorisiere kritische Blocker als Deal-Breaker
4. Formuliere 3-5 konkrete Next Steps

## Ausgabesprache
Alle Texte auf Deutsch. Professioneller Business-Ton.`;

  const userPrompt = `Synthetisiere die folgenden Agent-Bewertungen zu einer Management-Entscheidungsvorlage.

## Gewichtete Scores

| Dimension | Score | Gewicht |
|-----------|-------|---------|
| Capability Match | ${context.scores.capability}/100 | 25% |
| Deal Quality | ${context.scores.dealQuality}/100 | 20% |
| Strategic Fit | ${context.scores.strategicFit}/100 | 15% |
| Win Probability | ${context.scores.winProbability}/100 | 15% |
| Legal Assessment | ${context.scores.legal}/100 | 15% |
| Reference Match | ${context.scores.reference}/100 | 10% |
| **GESAMT** | **${context.scores.overall.toFixed(1)}/100** | |

## Kritische Blocker (${context.allCriticalBlockers.length})
${context.allCriticalBlockers.length > 0 ? context.allCriticalBlockers.map(b => `- ⚠️ ${b}`).join('\n') : '✅ Keine kritischen Blocker identifiziert'}

## Vorläufige Empfehlung
**${recommendation.toUpperCase()}** (Confidence: ${confidence.toFixed(1)}%)

## Agent-Begründungen

### Capability Agent
${context.capabilityMatch.reasoning}

### Deal Quality Agent
${context.dealQuality.reasoning}

### Strategic Fit Agent
${context.strategicFit.reasoning}

### Competition Agent
${context.competitionCheck.reasoning}

### Legal Agent
${context.legalAssessment.reasoning}

### Reference Agent
${context.referenceMatch.reasoning}

## Deine Aufgabe
Erstelle eine strukturierte Synthese:
1. **executiveSummary**: 2-3 Sätze Executive Summary für C-Level
2. **keyStrengths**: Top 3-5 Stärken dieser Opportunity
3. **keyRisks**: Top 3-5 Risiken und Schwächen
4. **criticalBlockers**: Deal-Breaker (falls vorhanden)
5. **proArguments**: Argumente FÜR BIT (auch bei NO BIT Empfehlung)
6. **contraArguments**: Argumente GEGEN BIT (auch bei BIT Empfehlung)
7. **nextSteps**: 3-5 konkrete nächste Schritte`;

  try {
    const synthesisSchema = z.object({
      executiveSummary: z.string().describe('Executive summary in German (2-3 sentences)'),
      keyStrengths: z.array(z.string()).describe('Top 3-5 strengths'),
      keyRisks: z.array(z.string()).describe('Top 3-5 risks'),
      criticalBlockers: z.array(z.string()).describe('Critical blockers'),
      proArguments: z.array(z.string()).describe('Arguments for BIT'),
      contraArguments: z.array(z.string()).describe('Arguments against BIT'),
      nextSteps: z.array(z.string()).describe('Recommended next steps (3-5 items)'),
    });

    const synthesis = await generateStructuredOutput({
      model: 'premium',
      schema: synthesisSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    });

    return {
      recommendation,
      confidence,
      decisionTree,
      synthesis: {
        executiveSummary: synthesis.executiveSummary,
        keyStrengths: synthesis.keyStrengths,
        keyRisks: synthesis.keyRisks,
        criticalBlockers: synthesis.criticalBlockers,
        proArguments: synthesis.proArguments,
        contraArguments: synthesis.contraArguments,
      },
      agentResults: context.scores,
      nextSteps: synthesis.nextSteps,
      escalationRequired,
    };
  } catch (error) {
    // Fallback if AI synthesis fails
    console.error('Coordinator AI synthesis failed:', error);

    return {
      recommendation,
      confidence,
      decisionTree,
      synthesis: {
        executiveSummary: `Basierend auf den Bewertungen aller Agenten wird ${recommendation === 'bit' ? 'BIT' : 'NO BIT'} empfohlen. Gesamtscore: ${context.scores.overall.toFixed(1)}/100, Confidence: ${confidence.toFixed(1)}%.`,
        keyStrengths: [],
        keyRisks: [],
        criticalBlockers: context.allCriticalBlockers,
        proArguments: [],
        contraArguments: [],
      },
      agentResults: context.scores,
      nextSteps:
        recommendation === 'bit'
          ? [
              'Routing an zuständigen Bereichsleiter',
              'Deep Analysis durchführen',
              'Team-Staffing vorbereiten',
            ]
          : ['Alternative Optionen prüfen', 'Kundenkommunikation vorbereiten'],
      escalationRequired,
    };
  }
}
