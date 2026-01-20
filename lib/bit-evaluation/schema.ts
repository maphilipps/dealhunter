import { z } from 'zod';

/**
 * BIT-002: Capability Match Schema
 * Evaluates if adesso has the technical capabilities to deliver this project
 */
export const capabilityMatchSchema = z.object({
  hasRequiredTechnologies: z.boolean().describe('Does adesso have expertise in the required technologies?'),
  technologyMatchScore: z.number().min(0).max(100).describe('Score for technology match (0-100)'),
  missingCapabilities: z.array(z.string()).describe('List of capabilities adesso does not have'),

  hasRequiredScale: z.boolean().describe('Can adesso handle the project scale (team size, timeline)?'),
  scaleMatchScore: z.number().min(0).max(100).describe('Score for scale match (0-100)'),
  scaleGaps: z.array(z.string()).describe('List of scale-related gaps'),

  overallCapabilityScore: z.number().min(0).max(100).describe('Overall capability match score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of capability assessment'),
  criticalBlockers: z.array(z.string()).describe('Critical capability blockers that would prevent success'),
});

export type CapabilityMatch = z.infer<typeof capabilityMatchSchema>;

/**
 * BIT-003: Deal Quality Schema
 * Evaluates budget, timeline, margin potential, and answers the 10 critical BIT questions
 */
export const dealQualitySchema = z.object({
  // Budget Assessment
  budgetAdequacy: z.enum(['adequate', 'tight', 'inadequate']).describe('Budget adequacy assessment'),
  estimatedBudget: z.string().optional().describe('Estimated budget based on scope (e.g., "€150k-€300k")'),
  estimatedMargin: z.number().min(0).max(100).describe('Estimated margin percentage (0-100)'),
  budgetRisks: z.array(z.string()).describe('Budget-related risks'),

  // Timeline Assessment
  timelineRealism: z.enum(['realistic', 'tight', 'unrealistic']).describe('Timeline realism assessment'),
  projectStart: z.string().optional().describe('Estimated project start date'),
  shortlistingDate: z.string().optional().describe('Estimated shortlisting/presentation date'),
  timelineRisks: z.array(z.string()).describe('Timeline-related risks'),

  // Contract Assessment
  contractType: z.string().optional().describe('Contract type (EVB-IT, service contract, SLA, framework, etc.)'),
  contractRisks: z.array(z.string()).optional().default([]).describe('Contract-related risks'),

  // Customer Relationship
  customerRelationship: z.enum(['existing', 'known', 'anonymous']).optional().describe('Customer relationship type'),
  relationshipDetails: z.string().optional().describe('Details about customer relationship'),

  // Services and Requirements
  requiredServices: z.array(z.string()).optional().default([]).describe('Required services'),
  requiredReferences: z.array(z.string()).optional().default([]).describe('Required references'),
  canFulfillReferences: z.boolean().optional().describe('Can we fulfill reference requirements?'),

  // Award Criteria
  awardCriteria: z.string().optional().describe('Description of award criteria'),

  // Team Requirements
  teamRequirements: z.string().optional().describe('Team requirements for bid/presentation'),

  // Challenges
  challenges: z.array(z.string()).optional().default([]).describe('Identified challenges'),

  // Commercial Viability
  expectedRevenueRange: z.string().describe('Expected revenue range (e.g., "€100k-€500k")'),
  profitabilityRating: z.enum(['low', 'medium', 'high']).describe('Expected profitability'),
  commercialRisks: z.array(z.string()).describe('Commercial risks'),

  // Overall Assessment
  overallDealQualityScore: z.number().min(0).max(100).describe('Overall deal quality score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of deal quality assessment'),
  criticalBlockers: z.array(z.string()).describe('Critical deal quality blockers'),
});

export type DealQuality = z.infer<typeof dealQualitySchema>;

/**
 * BIT-004: Strategic Fit Schema
 * Evaluates alignment with adesso strategy and customer type
 */
export const strategicFitSchema = z.object({
  customerTypeAssessment: z.object({
    customerType: z.string().describe('Type of customer (enterprise, mid-market, startup, etc.)'),
    isTargetCustomer: z.boolean().describe('Is this our target customer profile?'),
    customerFitScore: z.number().min(0).max(100).describe('How well customer fits our profile'),
  }),

  industryAlignment: z.object({
    industry: z.string().describe('Customer industry'),
    isTargetIndustry: z.boolean().describe('Is this a target industry for adesso?'),
    industryExperience: z.enum(['none', 'limited', 'moderate', 'extensive']).describe('Our experience in this industry'),
    industryFitScore: z.number().min(0).max(100).describe('Industry alignment score'),
  }),

  strategicValue: z.object({
    isReferenceProject: z.boolean().describe('Could this become a reference project?'),
    enablesNewMarket: z.boolean().describe('Opens doors to new markets?'),
    expandsExistingRelationship: z.boolean().describe('Expands relationship with existing customer?'),
    longTermPotential: z.enum(['low', 'medium', 'high']).describe('Long-term relationship potential'),
  }),

  overallStrategicFitScore: z.number().min(0).max(100).describe('Overall strategic fit score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of strategic fit'),
  criticalBlockers: z.array(z.string()).describe('Strategic fit blockers'),
});

export type StrategicFit = z.infer<typeof strategicFitSchema>;

/**
 * BIT-005: Competition Check Schema
 * Analyzes competitive situation and win probability
 */
export const competitionCheckSchema = z.object({
  competitiveAnalysis: z.object({
    competitionLevel: z.enum(['none', 'low', 'medium', 'high', 'very_high']).describe('Level of competition'),
    knownCompetitors: z.array(z.string()).describe('List of known/likely competitors'),
    ourDifferentiators: z.array(z.string()).describe('What differentiates adesso from competitors'),
    competitiveWeaknesses: z.array(z.string()).describe('Areas where competitors might be stronger'),
  }),

  winProbabilityFactors: z.object({
    hasIncumbentAdvantage: z.boolean().describe('Do we have incumbent advantage?'),
    hasExistingRelationship: z.boolean().describe('Do we have existing relationship with customer?'),
    hasUniqueCapability: z.boolean().describe('Do we have unique capabilities competitors lack?'),
    pricingPosition: z.enum(['low', 'competitive', 'premium']).describe('Our likely pricing position'),
  }),

  estimatedWinProbability: z.number().min(0).max(100).describe('Estimated win probability (0-100)'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of competition analysis'),
  criticalBlockers: z.array(z.string()).describe('Competition-related blockers'),
});

export type CompetitionCheck = z.infer<typeof competitionCheckSchema>;

/**
 * Legal Red Flag (DEA-8)
 * Critical legal issues categorized by type
 */
export const legalRedFlagSchema = z.object({
  category: z.enum(['liability', 'penalty', 'ip', 'warranty', 'termination', 'jurisdiction']).describe('Red flag category'),
  severity: z.enum(['critical', 'warning']).describe('Severity level'),
  description: z.string().describe('Description of the red flag in German'),
  clauseReference: z.string().optional().describe('Reference to document location/clause'),
});

export type LegalRedFlag = z.infer<typeof legalRedFlagSchema>;

/**
 * Legal Quick Check (DEA-8: BD-Level)
 * Fast risk assessment focusing on critical red flags
 */
export const legalQuickCheckSchema = z.object({
  criticalFlags: z.array(legalRedFlagSchema).describe('Critical red flags found'),
  complianceHints: z.array(z.string()).describe('Hints about relevant compliance topics'),
  requiresDetailedReview: z.boolean().describe('Whether detailed legal review is required'),
  quickRiskScore: z.number().min(1).max(10).describe('Quick risk score (1=low, 10=critical)'),
  confidence: z.number().min(0).max(100).describe('Confidence in quick check'),
  reasoning: z.string().describe('Quick assessment reasoning in German'),
});

export type LegalQuickCheck = z.infer<typeof legalQuickCheckSchema>;

/**
 * Compliance Check (DEA-8: Full Check)
 * Comprehensive compliance assessment
 */
export const complianceCheckSchema = z.object({
  procurementLaw: z.object({
    applicable: z.boolean().describe('Is procurement law applicable?'),
    type: z.enum(['vob', 'vgv', 'uvgo', 'eu_threshold', 'none']).optional().describe('Type of procurement law'),
    requirements: z.array(z.string()).describe('Procurement law requirements'),
    deadlines: z.array(z.object({
      name: z.string(),
      date: z.string().optional(),
    })).describe('Procurement deadlines'),
  }).describe('Procurement law assessment (Vergaberecht)'),

  frameworkAgreement: z.object({
    isFramework: z.boolean().describe('Is this a framework agreement?'),
    existingFramework: z.string().optional().describe('Existing framework name if applicable'),
    callOffRules: z.array(z.string()).describe('Call-off rules for framework'),
  }).describe('Framework agreement assessment (Rahmenvertrag)'),

  subcontractor: z.object({
    allowed: z.boolean().describe('Are subcontractors allowed?'),
    restrictions: z.array(z.string()).describe('Restrictions on subcontractors'),
    reportingRequirements: z.array(z.string()).describe('Reporting requirements for subcontractors'),
  }).describe('Subcontractor assessment'),
});

export type ComplianceCheck = z.infer<typeof complianceCheckSchema>;

/**
 * BIT-006: Legal Assessment Schema (DEA-8 Enhanced)
 * Evaluates legal and contractual risks with two-level analysis support
 */
export const legalAssessmentSchema = z.object({
  // Quick Check (BD-Level) - always present
  quickCheck: legalQuickCheckSchema.optional().describe('Quick BD-level risk assessment'),

  // Full Check (BL-Level) - only after routing
  fullCheck: z.object({
    contractTypeAssessment: z.object({
      contractType: z.string().describe('Type of contract (fixed price, T&M, outcome-based, etc.)'),
      isAcceptable: z.boolean().describe('Is this contract type acceptable for adesso?'),
      contractRisks: z.array(z.string()).describe('Risks related to contract type'),
    }),

    paymentRiskAssessment: z.object({
      paymentTerms: z.string().describe('Payment terms description (e.g., "30 days net", "milestone-based")'),
      paymentRiskLevel: z.enum(['low', 'medium', 'high']).describe('Risk level for payment'),
      paymentRisks: z.array(z.string()).describe('Payment-related risks'),
    }),

    liabilityAssessment: z.object({
      hasUnlimitedLiability: z.boolean().describe('Does contract require unlimited liability?'),
      liabilityCaps: z.string().describe('Description of liability caps if any'),
      liabilityRisks: z.array(z.string()).describe('Liability-related risks'),
    }),

    ipAndLicenseAssessment: z.object({
      ipTransferRequired: z.boolean().describe('Is IP transfer to customer required?'),
      licenseRequirements: z.array(z.string()).describe('License requirements or restrictions'),
      ipRisks: z.array(z.string()).describe('IP and licensing risks'),
    }),

    complianceCheck: complianceCheckSchema.describe('Comprehensive compliance check'),

    exitClauseAssessment: z.object({
      hasReasonableExit: z.boolean().describe('Are exit clauses reasonable?'),
      exitConditions: z.array(z.string()).describe('Exit conditions in contract'),
      exitRisks: z.array(z.string()).describe('Exit-related risks'),
    }),

    allRedFlags: z.array(legalRedFlagSchema).describe('All identified red flags with clause references'),
  }).optional().describe('Full BL-level legal review'),

  // Overall scores
  overallLegalScore: z.number().min(0).max(100).describe('Overall legal/contractual score (0-100)'),
  legalRiskScore: z.number().min(1).max(10).describe('Legal risk score (1=low, 10=critical)'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of legal assessment in German'),
  criticalBlockers: z.array(z.string()).describe('Critical legal blockers in German'),
});

export type LegalAssessment = z.infer<typeof legalAssessmentSchema>;

/**
 * BIT-006b: Contract Analysis Schema (DEA-7)
 * Dedicated contract type detection and risk assessment
 * Focuses on contract model, budget extraction, and risk flags
 */
export const contractAnalysisSchema = z.object({
  contractType: z.enum(['tm', 'fixed_price', 'framework', 'hybrid', 'sla', 'unknown']).describe('Detected contract type'),

  contractTypeIndicators: z.array(z.string()).describe('Text patterns/keywords that indicate the contract type'),

  budgetAnalysis: z.object({
    hasBudget: z.boolean().describe('Is budget information available?'),
    budgetValue: z.number().optional().describe('Budget amount if found'),
    currency: z.string().optional().describe('Currency (e.g., EUR, USD)'),
    budgetType: z.enum(['fixed', 'range', 'estimate', 'unknown']).optional().describe('Type of budget specification'),
    budgetRisks: z.array(z.string()).describe('Budget-related risks'),
  }),

  riskFlags: z.array(z.object({
    category: z.enum(['timeline', 'scope', 'budget', 'legal', 'technical']).describe('Risk category'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Risk severity'),
    description: z.string().describe('Risk description in German'),
    mitigation: z.string().optional().describe('Suggested mitigation strategy'),
  })).describe('Identified risk flags'),

  changeRequestProcess: z.object({
    hasProcess: z.boolean().describe('Is change request process defined?'),
    processDescription: z.string().optional().describe('Description of CR process if found'),
    isFlexible: z.boolean().describe('Is the process flexible/reasonable?'),
  }),

  penaltyClauses: z.object({
    hasPenalties: z.boolean().describe('Are penalty clauses present?'),
    penaltyDescription: z.array(z.string()).describe('List of penalty clauses found'),
    penaltyRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).describe('Overall penalty risk'),
  }),

  timelineAssessment: z.object({
    isRealistic: z.boolean().describe('Is the timeline realistic?'),
    timelineRisks: z.array(z.string()).describe('Timeline-related risks'),
    deadlines: z.array(z.string()).optional().describe('Key deadlines mentioned'),
  }),

  scopeClarity: z.object({
    isClear: z.boolean().describe('Is scope clearly defined?'),
    unclearAreas: z.array(z.string()).describe('Areas with unclear scope'),
    scopeRisks: z.array(z.string()).describe('Scope-related risks'),
  }),

  overallContractScore: z.number().min(0).max(100).describe('Overall contract quality score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this analysis'),
  reasoning: z.string().describe('Detailed explanation of contract analysis in German'),
  criticalBlockers: z.array(z.string()).describe('Critical contract-related blockers'),
});

export type ContractAnalysis = z.infer<typeof contractAnalysisSchema>;

/**
 * BIT-007: Reference Match Schema
 * Evaluates matching with existing reference projects and experience
 */
export const referenceMatchSchema = z.object({
  similarProjectsAnalysis: z.object({
    hasRelevantReferences: z.boolean().describe('Do we have relevant reference projects?'),
    similarProjects: z.array(z.object({
      projectType: z.string().describe('Type of similar project'),
      relevanceScore: z.number().min(0).max(100).describe('How relevant is this project type'),
      keyLearnings: z.string().describe('Key learnings from similar projects'),
    })).describe('List of similar project types we have done'),
    projectTypeMatchScore: z.number().min(0).max(100).describe('Overall project type match score'),
  }),

  industryMatchAnalysis: z.object({
    industryMatchScore: z.number().min(0).max(100).describe('How well do we know this industry'),
    industryExperience: z.enum(['none', 'limited', 'moderate', 'extensive']).describe('Our experience level in this industry'),
    industryInsights: z.array(z.string()).describe('Key industry insights we bring'),
  }),

  technologyMatchAnalysis: z.object({
    technologyMatchScore: z.number().min(0).max(100).describe('Technology experience score'),
    matchingTechnologies: z.array(z.string()).describe('Technologies we have strong experience with'),
    missingExperience: z.array(z.string()).describe('Technologies we lack experience with'),
  }),

  successRateAnalysis: z.object({
    estimatedSuccessRate: z.number().min(0).max(100).describe('Estimated success rate based on history'),
    successFactors: z.array(z.string()).describe('Factors that increase success probability'),
    riskFactors: z.array(z.string()).describe('Factors that decrease success probability'),
  }),

  overallReferenceScore: z.number().min(0).max(100).describe('Overall reference match score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of reference assessment'),
  criticalBlockers: z.array(z.string()).describe('Critical reference-related blockers'),
});

export type ReferenceMatch = z.infer<typeof referenceMatchSchema>;

/**
 * BIT-008: BIT Decision Schema
 * Final coordinated decision
 */
export const bitDecisionSchema = z.object({
  decision: z.enum(['bit', 'no_bit']).describe('Final BIT or NO BIT decision'),

  scores: z.object({
    capability: z.number().min(0).max(100).describe('Capability score (25% weight)'),
    dealQuality: z.number().min(0).max(100).describe('Deal quality score (20% weight)'),
    strategicFit: z.number().min(0).max(100).describe('Strategic fit score (15% weight)'),
    winProbability: z.number().min(0).max(100).describe('Win probability (15% weight)'),
    legal: z.number().min(0).max(100).describe('Legal assessment score (15% weight)'),
    reference: z.number().min(0).max(100).describe('Reference match score (10% weight)'),
    overall: z.number().min(0).max(100).describe('Weighted overall score'),
  }),

  overallConfidence: z.number().min(0).max(100).describe('Overall confidence in decision'),

  keyStrengths: z.array(z.string()).describe('Top 3-5 strengths for this opportunity'),
  keyRisks: z.array(z.string()).describe('Top 3-5 risks for this opportunity'),
  criticalBlockers: z.array(z.string()).describe('Any critical blockers found'),

  reasoning: z.string().describe('Executive summary of decision reasoning'),
  nextSteps: z.array(z.string()).describe('Recommended next steps'),
});

export type BitDecision = z.infer<typeof bitDecisionSchema>;

/**
 * BIT-007: Alternative Recommendation Schema
 * For NO BIT decisions - suggest alternatives
 */
export const alternativeRecSchema = z.object({
  recommendedAlternative: z.enum([
    'partner_collaboration',
    'partial_scope',
    'delay_and_reassess',
    'refer_to_competitor',
    'decline_gracefully',
  ]).describe('Recommended alternative approach'),

  partnerSuggestions: z.array(z.string()).describe('Potential partners if applicable'),

  reducedScopeOptions: z.array(z.object({
    scope: z.string().describe('Reduced scope description'),
    viability: z.enum(['low', 'medium', 'high']).describe('Viability of this reduced scope'),
  })).describe('Options for reduced scope if applicable'),

  reasoning: z.string().describe('Why this alternative is recommended'),

  customerCommunication: z.string().describe('Suggested communication to customer'),
});

export type AlternativeRec = z.infer<typeof alternativeRecSchema>;

/**
 * Decision Tree Node Schema
 * For visualizing the decision-making process
 */
export const decisionNodeSchema: z.ZodType<DecisionNode> = z.lazy(() => z.object({
  id: z.string().describe('Unique node ID'),
  type: z.enum(['decision', 'criterion', 'outcome', 'blocker']).describe('Node type'),
  label: z.string().describe('Node label/question'),
  value: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Node value/answer'),
  weight: z.number().min(0).max(1).optional().describe('Weight in decision (0-1)'),
  score: z.number().min(0).max(100).optional().describe('Score for this criterion'),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'critical']).optional().describe('Sentiment indicator'),
  children: z.array(decisionNodeSchema).optional().describe('Child nodes'),
  reasoning: z.string().optional().describe('Explanation for this decision point'),
}));

export type DecisionNode = {
  id: string;
  type: 'decision' | 'criterion' | 'outcome' | 'blocker';
  label: string;
  value?: string | number | boolean;
  weight?: number;
  score?: number;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'critical';
  children?: DecisionNode[];
  reasoning?: string;
};

/**
 * Enhanced Coordinator Output Schema
 * Includes decision tree and synthesis
 */
export const coordinatorOutputSchema = z.object({
  recommendation: z.enum(['bit', 'no_bit']).describe('Final recommendation'),
  confidence: z.number().min(0).max(100).describe('Confidence in recommendation'),
  decisionTree: decisionNodeSchema.describe('Decision tree for visualization'),
  synthesis: z.object({
    executiveSummary: z.string().describe('Executive summary in German'),
    keyStrengths: z.array(z.string()).describe('Top strengths'),
    keyRisks: z.array(z.string()).describe('Top risks'),
    criticalBlockers: z.array(z.string()).describe('Critical blockers'),
    proArguments: z.array(z.string()).describe('Arguments for BIT'),
    contraArguments: z.array(z.string()).describe('Arguments against BIT'),
  }).describe('Synthesized analysis'),
  agentResults: z.object({
    capability: z.number().min(0).max(100),
    dealQuality: z.number().min(0).max(100),
    strategicFit: z.number().min(0).max(100),
    winProbability: z.number().min(0).max(100),
    legal: z.number().min(0).max(100),
    reference: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }).describe('Agent result scores'),
  nextSteps: z.array(z.string()).describe('Recommended next steps'),
  escalationRequired: z.boolean().describe('Whether human review is required (confidence <70%)'),
});

export type CoordinatorOutput = z.infer<typeof coordinatorOutputSchema>;

/**
 * Complete BIT Evaluation Result
 * Combines all agent outputs
 */
export const bitEvaluationResultSchema = z.object({
  // Individual agent results
  capabilityMatch: capabilityMatchSchema,
  dealQuality: dealQualitySchema,
  strategicFit: strategicFitSchema,
  competitionCheck: competitionCheckSchema,
  legalAssessment: legalAssessmentSchema,
  contractAnalysis: contractAnalysisSchema, // DEA-7: Contract Agent
  referenceMatch: referenceMatchSchema,

  // Coordinated decision
  decision: bitDecisionSchema,

  // Alternative (if NO BIT)
  alternative: alternativeRecSchema.optional(),

  // Coordinator output (NEW)
  coordinatorOutput: coordinatorOutputSchema.optional(),

  // Metadata
  evaluatedAt: z.string().describe('ISO timestamp of evaluation'),
  evaluationDuration: z.number().describe('Duration in milliseconds'),
});

export type BitEvaluationResult = z.infer<typeof bitEvaluationResultSchema>;
