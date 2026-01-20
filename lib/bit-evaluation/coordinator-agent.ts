import { z } from 'zod';
import { generateStructuredOutput } from '@/lib/ai/config';
import {
  coordinatorOutputSchema,
  decisionNodeSchema,
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
    sentiment: scores.capability >= 70 ? 'positive' : scores.capability >= 50 ? 'neutral' : 'negative',
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
    weight: 0.20,
    sentiment: scores.dealQuality >= 70 ? 'positive' : scores.dealQuality >= 50 ? 'neutral' : 'negative',
    reasoning: context.dealQuality.reasoning,
    children: [
      {
        id: 'deal-budget',
        type: 'criterion',
        label: 'Budget Adequacy',
        value: context.dealQuality.budgetAdequacy,
        sentiment: context.dealQuality.budgetAdequacy === 'adequate' ? 'positive' :
                   context.dealQuality.budgetAdequacy === 'tight' ? 'neutral' : 'negative',
      },
      {
        id: 'deal-timeline',
        type: 'criterion',
        label: 'Timeline Realism',
        value: context.dealQuality.timelineRealism,
        sentiment: context.dealQuality.timelineRealism === 'realistic' ? 'positive' :
                   context.dealQuality.timelineRealism === 'tight' ? 'neutral' : 'negative',
      },
      {
        id: 'deal-margin',
        type: 'criterion',
        label: 'Expected Margin',
        score: context.dealQuality.estimatedMargin,
        value: `${context.dealQuality.estimatedMargin}%`,
        sentiment: context.dealQuality.estimatedMargin >= 20 ? 'positive' :
                   context.dealQuality.estimatedMargin >= 10 ? 'neutral' : 'negative',
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
    sentiment: scores.strategicFit >= 70 ? 'positive' : scores.strategicFit >= 50 ? 'neutral' : 'negative',
    reasoning: context.strategicFit.reasoning,
    children: [
      {
        id: 'strategic-customer',
        type: 'criterion',
        label: 'Customer Type Match',
        score: context.strategicFit.customerTypeAssessment.customerFitScore,
        value: context.strategicFit.customerTypeAssessment.isTargetCustomer,
        sentiment: context.strategicFit.customerTypeAssessment.isTargetCustomer ? 'positive' : 'negative',
      },
      {
        id: 'strategic-industry',
        type: 'criterion',
        label: 'Industry Alignment',
        score: context.strategicFit.industryAlignment.industryFitScore,
        value: context.strategicFit.industryAlignment.isTargetIndustry,
        sentiment: context.strategicFit.industryAlignment.isTargetIndustry ? 'positive' : 'negative',
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
    sentiment: scores.winProbability >= 70 ? 'positive' : scores.winProbability >= 50 ? 'neutral' : 'negative',
    reasoning: context.competitionCheck.reasoning,
    children: [
      {
        id: 'competition-level',
        type: 'criterion',
        label: 'Competition Level',
        value: context.competitionCheck.competitiveAnalysis.competitionLevel,
        sentiment: context.competitionCheck.competitiveAnalysis.competitionLevel === 'none' ||
                   context.competitionCheck.competitiveAnalysis.competitionLevel === 'low' ? 'positive' :
                   context.competitionCheck.competitiveAnalysis.competitionLevel === 'medium' ? 'neutral' : 'negative',
      },
      {
        id: 'competition-advantage',
        type: 'criterion',
        label: 'Incumbent Advantage',
        value: context.competitionCheck.winProbabilityFactors.hasIncumbentAdvantage,
        sentiment: context.competitionCheck.winProbabilityFactors.hasIncumbentAdvantage ? 'positive' : 'neutral',
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
        value: context.legalAssessment.contractTypeAssessment.isAcceptable,
        sentiment: context.legalAssessment.contractTypeAssessment.isAcceptable ? 'positive' : 'negative',
      },
      {
        id: 'legal-liability',
        type: 'criterion',
        label: 'Liability Risk',
        value: !context.legalAssessment.liabilityAssessment.hasUnlimitedLiability,
        sentiment: !context.legalAssessment.liabilityAssessment.hasUnlimitedLiability ? 'positive' : 'critical',
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
    weight: 0.10,
    sentiment: scores.reference >= 70 ? 'positive' : scores.reference >= 50 ? 'neutral' : 'negative',
    reasoning: context.referenceMatch.reasoning,
    children: [
      {
        id: 'reference-projects',
        type: 'criterion',
        label: 'Similar Projects',
        value: context.referenceMatch.similarProjectsAnalysis.hasRelevantReferences,
        score: context.referenceMatch.similarProjectsAnalysis.projectTypeMatchScore,
        sentiment: context.referenceMatch.similarProjectsAnalysis.hasRelevantReferences ? 'positive' : 'negative',
      },
      {
        id: 'reference-success',
        type: 'criterion',
        label: 'Success Rate',
        score: context.referenceMatch.successRateAnalysis.estimatedSuccessRate,
        sentiment: context.referenceMatch.successRateAnalysis.estimatedSuccessRate >= 70 ? 'positive' :
                   context.referenceMatch.successRateAnalysis.estimatedSuccessRate >= 50 ? 'neutral' : 'negative',
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
    reasoning: recommendation === 'bit'
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
  const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
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
  // Calculate initial recommendation
  const shouldBit = context.scores.overall >= 55 && context.allCriticalBlockers.length === 0;
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
  const systemPrompt = `Du bist der Coordinator Agent für Bid/No-Bid Entscheidungen bei adesso SE.
Deine Aufgabe ist es, alle Teil-Analysen zu einem kohärenten Gesamtbild zu synthetisieren.

WICHTIG: Alle Texte müssen auf Deutsch sein.

Du erhältst die Bewertungen von 6 Spezial-Agenten:
1. Capability Agent (25% Gewicht) - Technische Fähigkeiten
2. Deal Quality Agent (20% Gewicht) - Budget, Timeline, Commercial Viability
3. Strategic Fit Agent (15% Gewicht) - Strategische Passung
4. Competition Agent (15% Gewicht) - Wettbewerb und Win Probability
5. Legal Agent (15% Gewicht) - Rechtliche Risiken
6. Reference Agent (10% Gewicht) - Erfahrung mit ähnlichen Projekten

Erstelle eine ausgewogene Synthese mit Pro- und Contra-Argumenten.`;

  const userPrompt = `Analysiere die folgenden Agent-Ergebnisse und erstelle eine Synthese:

**Scores:**
- Capability: ${context.scores.capability}/100 (Gewicht: 25%)
- Deal Quality: ${context.scores.dealQuality}/100 (Gewicht: 20%)
- Strategic Fit: ${context.scores.strategicFit}/100 (Gewicht: 15%)
- Win Probability: ${context.scores.winProbability}/100 (Gewicht: 15%)
- Legal: ${context.scores.legal}/100 (Gewicht: 15%)
- Reference: ${context.scores.reference}/100 (Gewicht: 10%)
- **Gesamt: ${context.scores.overall.toFixed(1)}/100**

**Kritische Blocker:** ${context.allCriticalBlockers.length}
${context.allCriticalBlockers.map(b => `- ${b}`).join('\n')}

**Empfehlung:** ${recommendation.toUpperCase()}
**Confidence:** ${confidence.toFixed(1)}%

**Agent Details:**

Capability: ${context.capabilityMatch.reasoning}

Deal Quality: ${context.dealQuality.reasoning}

Strategic Fit: ${context.strategicFit.reasoning}

Competition: ${context.competitionCheck.reasoning}

Legal: ${context.legalAssessment.reasoning}

Reference: ${context.referenceMatch.reasoning}

Erstelle eine strukturierte Synthese mit:
1. Executive Summary (2-3 Sätze)
2. Top 3-5 Stärken (keyStrengths)
3. Top 3-5 Risiken (keyRisks)
4. Kritische Blocker falls vorhanden (criticalBlockers)
5. Pro-Argumente für BIT (proArguments) - auch bei NO BIT
6. Contra-Argumente gegen BIT (contraArguments) - auch bei BIT`;

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
      nextSteps: recommendation === 'bit'
        ? ['Routing an zuständigen Bereichsleiter', 'Deep Analysis durchführen', 'Team-Staffing vorbereiten']
        : ['Alternative Optionen prüfen', 'Kundenkommunikation vorbereiten'],
      escalationRequired,
    };
  }
}
