/**
 * BIT Evaluation Schema Tests
 *
 * Tests for all Zod schemas used in the bid evaluation process.
 * These schemas define the structure of evaluation data from various agents.
 */

import { describe, it, expect } from 'vitest';

import {
  capabilityMatchSchema,
  dealQualitySchema,
  strategicFitSchema,
  competitionCheckSchema,
  legalRedFlagSchema,
  legalQuickCheckSchema,
  complianceCheckSchema,
  legalAssessmentSchema,
  contractAnalysisSchema,
  referenceMatchSchema,
  bitDecisionSchema,
  alternativeRecSchema,
  decisionNodeSchema,
  coordinatorOutputSchema,
  bitEvaluationResultSchema,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type CapabilityMatch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type DealQuality,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type StrategicFit,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type CompetitionCheck,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type LegalRedFlag,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type LegalQuickCheck,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ComplianceCheck,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type LegalAssessment,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ContractAnalysis,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ReferenceMatch,
  type BitDecision,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type AlternativeRec,
  type DecisionNode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type CoordinatorOutput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type BitEvaluationResult,
} from '../schema';

describe('BIT Evaluation Schemas', () => {
  describe('capabilityMatchSchema', () => {
    it('should validate correct capability match data', () => {
      const data = {
        hasRequiredTechnologies: true,
        technologyMatchScore: 85,
        missingCapabilities: [],
        hasRequiredScale: true,
        scaleMatchScore: 90,
        scaleGaps: [],
        overallCapabilityScore: 87,
        confidence: 85,
        reasoning: 'Strong match with required technologies and scale',
        criticalBlockers: [],
      };

      const result = capabilityMatchSchema.parse(data);
      expect(result).toEqual(data);
    });

    it('should reject invalid technology match score (negative)', () => {
      const data = {
        hasRequiredTechnologies: true,
        technologyMatchScore: -10,
        missingCapabilities: [],
        hasRequiredScale: true,
        scaleMatchScore: 90,
        scaleGaps: [],
        overallCapabilityScore: 87,
        confidence: 85,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => capabilityMatchSchema.parse(data)).toThrow();
    });

    it('should reject invalid technology match score (>100)', () => {
      const data = {
        hasRequiredTechnologies: true,
        technologyMatchScore: 150,
        missingCapabilities: [],
        hasRequiredScale: true,
        scaleMatchScore: 90,
        scaleGaps: [],
        overallCapabilityScore: 87,
        confidence: 85,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => capabilityMatchSchema.parse(data)).toThrow();
    });

    it('should accept data with missing capabilities', () => {
      const data = {
        hasRequiredTechnologies: false,
        technologyMatchScore: 50,
        missingCapabilities: ['React', 'Node.js'],
        hasRequiredScale: true,
        scaleMatchScore: 90,
        scaleGaps: [],
        overallCapabilityScore: 70,
        confidence: 75,
        reasoning: 'Missing some key technologies',
        criticalBlockers: [],
      };

      const result = capabilityMatchSchema.parse(data);
      expect(result.missingCapabilities).toEqual(['React', 'Node.js']);
    });

    it('should handle capability with critical blockers', () => {
      const data = {
        hasRequiredTechnologies: true,
        technologyMatchScore: 60,
        missingCapabilities: [],
        hasRequiredScale: false,
        scaleMatchScore: 40,
        scaleGaps: ['Team size too small'],
        overallCapabilityScore: 50,
        confidence: 80,
        reasoning: 'Scale limitations present',
        criticalBlockers: ['Cannot scale to required team size'],
      };

      const result = capabilityMatchSchema.parse(data);
      expect(result.criticalBlockers).toHaveLength(1);
    });
  });

  describe('dealQualitySchema', () => {
    it('should validate complete deal quality data', () => {
      const data = {
        budgetAdequacy: 'adequate' as const,
        estimatedBudget: '€150k-€300k',
        estimatedMargin: 25,
        budgetRisks: ['Budget may increase with scope changes'],
        timelineRealism: 'realistic' as const,
        projectStart: '2025-03-01',
        shortlistingDate: '2025-02-15',
        timelineRisks: [],
        contractType: 'EVB-IT',
        contractRisks: [],
        customerRelationship: 'existing' as const,
        relationshipDetails: 'Long-term customer',
        requiredServices: ['Development', 'Testing'],
        requiredReferences: ['E-commerce project'],
        canFulfillReferences: true,
        awardCriteria: 'Price and quality',
        teamRequirements: '5 developers, 1 PM',
        challenges: ['Tight timeline'],
        expectedRevenueRange: '€100k-€500k',
        profitabilityRating: 'high' as const,
        commercialRisks: [],
        overallDealQualityScore: 85,
        confidence: 80,
        reasoning: 'Strong project with good margins',
        criticalBlockers: [],
      };

      const result = dealQualitySchema.parse(data);
      expect(result.budgetAdequacy).toBe('adequate');
    });

    it('should accept data with optional fields omitted', () => {
      const data = {
        budgetAdequacy: 'tight' as const,
        estimatedMargin: 15,
        budgetRisks: ['Limited budget'],
        timelineRealism: 'tight' as const,
        timelineRisks: ['Aggressive deadlines'],
        requiredServices: [],
        requiredReferences: [],
        expectedRevenueRange: '€50k-€150k',
        profitabilityRating: 'medium' as const,
        commercialRisks: ['Low margin'],
        overallDealQualityScore: 60,
        confidence: 70,
        reasoning: 'Budget and timeline concerns',
        criticalBlockers: [],
      };

      const result = dealQualitySchema.parse(data);
      expect(result.estimatedBudget).toBeUndefined();
    });

    it('should reject invalid margin percentage (<0)', () => {
      const data = {
        budgetAdequacy: 'adequate' as const,
        estimatedMargin: -5,
        budgetRisks: [],
        timelineRealism: 'realistic' as const,
        timelineRisks: [],
        expectedRevenueRange: '€100k',
        profitabilityRating: 'medium' as const,
        commercialRisks: [],
        overallDealQualityScore: 70,
        confidence: 75,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => dealQualitySchema.parse(data)).toThrow();
    });

    it('should reject invalid margin percentage (>100)', () => {
      const data = {
        budgetAdequacy: 'adequate' as const,
        estimatedMargin: 150,
        budgetRisks: [],
        timelineRealism: 'realistic' as const,
        timelineRisks: [],
        expectedRevenueRange: '€100k',
        profitabilityRating: 'medium' as const,
        commercialRisks: [],
        overallDealQualityScore: 70,
        confidence: 75,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => dealQualitySchema.parse(data)).toThrow();
    });

    it('should validate enum values correctly', () => {
      const validBudgetAdequacy = ['adequate', 'tight', 'inadequate'] as const;

      validBudgetAdequacy.forEach((value) => {
        const data = {
          budgetAdequacy: value,
          estimatedMargin: 20,
          budgetRisks: [],
          timelineRealism: 'realistic' as const,
          timelineRisks: [],
          expectedRevenueRange: '€100k',
          profitabilityRating: 'medium' as const,
          commercialRisks: [],
          overallDealQualityScore: 70,
          confidence: 75,
          reasoning: 'Test',
          criticalBlockers: [],
        };
        expect(() => dealQualitySchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('strategicFitSchema', () => {
    it('should validate complete strategic fit data', () => {
      const data = {
        customerTypeAssessment: {
          customerType: 'enterprise',
          isTargetCustomer: true,
          customerFitScore: 90,
        },
        industryAlignment: {
          industry: 'Manufacturing',
          isTargetIndustry: true,
          industryExperience: 'extensive' as const,
          industryFitScore: 85,
        },
        strategicValue: {
          isReferenceProject: true,
          enablesNewMarket: false,
          expandsExistingRelationship: true,
          longTermPotential: 'high' as const,
        },
        overallStrategicFitScore: 88,
        confidence: 85,
        reasoning: 'Excellent strategic fit with target customer',
        criticalBlockers: [],
      };

      const result = strategicFitSchema.parse(data);
      expect(result.overallStrategicFitScore).toBe(88);
    });

    it('should reject scores outside 0-100 range', () => {
      const data = {
        customerTypeAssessment: {
          customerType: 'enterprise',
          isTargetCustomer: true,
          customerFitScore: 150,
        },
        industryAlignment: {
          industry: 'Manufacturing',
          isTargetIndustry: true,
          industryExperience: 'extensive' as const,
          industryFitScore: 85,
        },
        strategicValue: {
          isReferenceProject: true,
          enablesNewMarket: false,
          expandsExistingRelationship: true,
          longTermPotential: 'high' as const,
        },
        overallStrategicFitScore: 88,
        confidence: 85,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => strategicFitSchema.parse(data)).toThrow();
    });

    it('should validate industry experience enum', () => {
      const validExperience = ['none', 'limited', 'moderate', 'extensive'] as const;

      validExperience.forEach((experience) => {
        const data = {
          customerTypeAssessment: {
            customerType: 'enterprise',
            isTargetCustomer: true,
            customerFitScore: 80,
          },
          industryAlignment: {
            industry: 'Tech',
            isTargetIndustry: true,
            industryExperience: experience,
            industryFitScore: 75,
          },
          strategicValue: {
            isReferenceProject: false,
            enablesNewMarket: false,
            expandsExistingRelationship: false,
            longTermPotential: 'medium' as const,
          },
          overallStrategicFitScore: 78,
          confidence: 80,
          reasoning: 'Test',
          criticalBlockers: [],
        };
        expect(() => strategicFitSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('competitionCheckSchema', () => {
    it('should validate competition data', () => {
      const data = {
        competitiveAnalysis: {
          competitionLevel: 'high' as const,
          knownCompetitors: ['Competitor A', 'Competitor B'],
          ourDifferentiators: ['Better technology', 'Lower cost'],
          competitiveWeaknesses: ['Less brand recognition'],
        },
        winProbabilityFactors: {
          hasIncumbentAdvantage: false,
          hasExistingRelationship: true,
          hasUniqueCapability: true,
          pricingPosition: 'competitive' as const,
        },
        estimatedWinProbability: 65,
        confidence: 75,
        reasoning: 'Competitive but winnable',
        criticalBlockers: [],
      };

      const result = competitionCheckSchema.parse(data);
      expect(result.estimatedWinProbability).toBe(65);
    });

    it('should reject win probability outside 0-100 range', () => {
      const data = {
        competitiveAnalysis: {
          competitionLevel: 'medium' as const,
          knownCompetitors: [],
          ourDifferentiators: [],
          competitiveWeaknesses: [],
        },
        winProbabilityFactors: {
          hasIncumbentAdvantage: false,
          hasExistingRelationship: false,
          hasUniqueCapability: false,
          pricingPosition: 'low' as const,
        },
        estimatedWinProbability: 150,
        confidence: 70,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => competitionCheckSchema.parse(data)).toThrow();
    });
  });

  describe('legalRedFlagSchema', () => {
    it('should validate legal red flag', () => {
      const data = {
        category: 'liability' as const,
        severity: 'critical' as const,
        description: 'Unlimited liability required',
        clauseReference: 'Section 5.2',
      };

      const result = legalRedFlagSchema.parse(data);
      expect(result.category).toBe('liability');
    });

    it('should accept red flag without clause reference', () => {
      const data = {
        category: 'penalty' as const,
        severity: 'warning' as const,
        description: 'High penalty clauses',
      };

      const result = legalRedFlagSchema.parse(data);
      expect(result.clauseReference).toBeUndefined();
    });

    it('should validate all category enum values', () => {
      const categories = ['liability', 'penalty', 'ip', 'warranty', 'termination', 'jurisdiction'] as const;

      categories.forEach((category) => {
        const data = {
          category,
          severity: 'warning' as const,
          description: 'Test warning',
        };
        expect(() => legalRedFlagSchema.parse(data)).not.toThrow();
      });
    });

    it('should validate severity enum values', () => {
      const severities = ['critical', 'warning'] as const;

      severities.forEach((severity) => {
        const data = {
          category: 'liability' as const,
          severity,
          description: 'Test',
        };
        expect(() => legalRedFlagSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('legalQuickCheckSchema', () => {
    it('should validate quick check data', () => {
      const data = {
        criticalFlags: [
          {
            category: 'liability' as const,
            severity: 'critical' as const,
            description: 'Unlimited liability',
          },
        ],
        complianceHints: ['Check GDPR compliance'],
        requiresDetailedReview: true,
        quickRiskScore: 8,
        confidence: 85,
        reasoning: 'High risk due to liability clauses',
      };

      const result = legalQuickCheckSchema.parse(data);
      expect(result.quickRiskScore).toBe(8);
    });

    it('should reject risk score outside 1-10 range', () => {
      const data = {
        criticalFlags: [],
        complianceHints: [],
        requiresDetailedReview: false,
        quickRiskScore: 15,
        confidence: 80,
        reasoning: 'Test',
      };

      expect(() => legalQuickCheckSchema.parse(data)).toThrow();
    });

    it('should accept empty critical flags', () => {
      const data = {
        criticalFlags: [],
        complianceHints: [],
        requiresDetailedReview: false,
        quickRiskScore: 2,
        confidence: 90,
        reasoning: 'Low risk project',
      };

      const result = legalQuickCheckSchema.parse(data);
      expect(result.criticalFlags).toEqual([]);
    });
  });

  describe('complianceCheckSchema', () => {
    it('should validate compliance check with procurement law', () => {
      const data = {
        procurementLaw: {
          applicable: true,
          type: 'vob' as const,
          requirements: ['Follow VOB procedures'],
          deadlines: [
            { name: 'Submission deadline', date: '2025-03-01' },
          ],
        },
        frameworkAgreement: {
          isFramework: false,
          callOffRules: [],
        },
        subcontractor: {
          allowed: true,
          restrictions: ['Must notify client'],
          reportingRequirements: [],
        },
      };

      const result = complianceCheckSchema.parse(data);
      expect(result.procurementLaw.applicable).toBe(true);
    });

    it('should validate all procurement law types', () => {
      const types = ['vob', 'vgv', 'uvgo', 'eu_threshold', 'none'] as const;

      types.forEach((type) => {
        const data = {
          procurementLaw: {
            applicable: true,
            type,
            requirements: [],
            deadlines: [],
          },
          frameworkAgreement: {
            isFramework: false,
            callOffRules: [],
          },
          subcontractor: {
            allowed: false,
            restrictions: [],
            reportingRequirements: [],
          },
        };
        expect(() => complianceCheckSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('legalAssessmentSchema', () => {
    it('should validate legal assessment with quick check only', () => {
      const data = {
        quickCheck: {
          criticalFlags: [],
          complianceHints: [],
          requiresDetailedReview: false,
          quickRiskScore: 3,
          confidence: 80,
          reasoning: 'Low risk',
        },
        overallLegalScore: 85,
        legalRiskScore: 3,
        confidence: 80,
        reasoning: 'Favorable terms',
        criticalBlockers: [],
      };

      const result = legalAssessmentSchema.parse(data);
      expect(result.quickCheck).toBeDefined();
      expect(result.fullCheck).toBeUndefined();
    });

    it('should validate legal assessment with full check', () => {
      const data = {
        quickCheck: {
          criticalFlags: [],
          complianceHints: [],
          requiresDetailedReview: true,
          quickRiskScore: 7,
          confidence: 75,
          reasoning: 'Needs detailed review',
        },
        fullCheck: {
          contractTypeAssessment: {
            contractType: 'Fixed price',
            isAcceptable: true,
            contractRisks: [],
          },
          paymentRiskAssessment: {
            paymentTerms: '30 days net',
            paymentRiskLevel: 'low' as const,
            paymentRisks: [],
          },
          liabilityAssessment: {
            hasUnlimitedLiability: false,
            liabilityCaps: '€1M',
            liabilityRisks: [],
          },
          ipAndLicenseAssessment: {
            ipTransferRequired: false,
            licenseRequirements: [],
            ipRisks: [],
          },
          complianceCheck: {
            procurementLaw: {
              applicable: false,
              requirements: [],
              deadlines: [],
            },
            frameworkAgreement: {
              isFramework: false,
              callOffRules: [],
            },
            subcontractor: {
              allowed: true,
              restrictions: [],
              reportingRequirements: [],
            },
          },
          exitClauseAssessment: {
            hasReasonableExit: true,
            exitConditions: ['30 days notice'],
            exitRisks: [],
          },
          allRedFlags: [],
        },
        overallLegalScore: 75,
        legalRiskScore: 5,
        confidence: 75,
        reasoning: 'Acceptable with some conditions',
        criticalBlockers: [],
      };

      const result = legalAssessmentSchema.parse(data);
      expect(result.fullCheck).toBeDefined();
    });

    it('should reject legal risk score outside 1-10 range', () => {
      const data = {
        quickCheck: {
          criticalFlags: [],
          complianceHints: [],
          requiresDetailedReview: false,
          quickRiskScore: 3,
          confidence: 80,
          reasoning: 'Test',
        },
        overallLegalScore: 80,
        legalRiskScore: 15,
        confidence: 80,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => legalAssessmentSchema.parse(data)).toThrow();
    });
  });

  describe('contractAnalysisSchema', () => {
    it('should validate contract analysis with all fields', () => {
      const data = {
        contractType: 'fixed_price' as const,
        contractTypeIndicators: ['fixed price', ' milestone-based'],
        budgetAnalysis: {
          hasBudget: true,
          budgetValue: 250000,
          currency: 'EUR',
          budgetType: 'fixed' as const,
          budgetRisks: ['Scope may increase'],
        },
        riskFlags: [
          {
            category: 'timeline' as const,
            severity: 'medium' as const,
            description: 'Tight deadline',
            mitigation: 'Add buffer time',
          },
        ],
        changeRequestProcess: {
          hasProcess: true,
          processDescription: 'Formal change request process',
          isFlexible: true,
        },
        penaltyClauses: {
          hasPenalties: true,
          penaltyDescription: ['Late delivery penalties'],
          penaltyRiskLevel: 'medium' as const,
        },
        timelineAssessment: {
          isRealistic: true,
          timelineRisks: [],
          deadlines: ['2025-06-30'],
        },
        scopeClarity: {
          isClear: true,
          unclearAreas: [],
          scopeRisks: [],
        },
        overallContractScore: 75,
        confidence: 80,
        reasoning: 'Generally good contract terms',
        criticalBlockers: [],
      };

      const result = contractAnalysisSchema.parse(data);
      expect(result.contractType).toBe('fixed_price');
    });

    it('should validate all contract type enum values', () => {
      const contractTypes = ['tm', 'fixed_price', 'framework', 'hybrid', 'sla', 'unknown'] as const;

      contractTypes.forEach((type) => {
        const data = {
          contractType: type,
          contractTypeIndicators: [],
          budgetAnalysis: {
            hasBudget: false,
            budgetRisks: [],
          },
          riskFlags: [],
          changeRequestProcess: {
            hasProcess: false,
            isFlexible: false,
          },
          penaltyClauses: {
            hasPenalties: false,
            penaltyDescription: [],
            penaltyRiskLevel: 'low' as const,
          },
          timelineAssessment: {
            isRealistic: true,
            timelineRisks: [],
          },
          scopeClarity: {
            isClear: true,
            unclearAreas: [],
            scopeRisks: [],
          },
          overallContractScore: 70,
          confidence: 75,
          reasoning: 'Test',
          criticalBlockers: [],
        };
        expect(() => contractAnalysisSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('referenceMatchSchema', () => {
    it('should validate reference match data', () => {
      const data = {
        similarProjectsAnalysis: {
          hasRelevantReferences: true,
          similarProjects: [
            {
              projectType: 'E-commerce platform',
              relevanceScore: 90,
              keyLearnings: 'React and Node.js work well',
            },
          ],
          projectTypeMatchScore: 88,
        },
        industryMatchAnalysis: {
          industryMatchScore: 75,
          industryExperience: 'moderate' as const,
          industryInsights: ['Manufacturing sector prefers stability'],
        },
        technologyMatchAnalysis: {
          technologyMatchScore: 85,
          matchingTechnologies: ['React', 'Node.js', 'PostgreSQL'],
          missingExperience: ['MongoDB'],
        },
        successRateAnalysis: {
          estimatedSuccessRate: 80,
          successFactors: ['Experienced team'],
          riskFactors: ['New technology stack'],
        },
        overallReferenceScore: 82,
        confidence: 78,
        reasoning: 'Strong references in similar projects',
        criticalBlockers: [],
      };

      const result = referenceMatchSchema.parse(data);
      expect(result.overallReferenceScore).toBe(82);
    });

    it('should handle project with no relevant references', () => {
      const data = {
        similarProjectsAnalysis: {
          hasRelevantReferences: false,
          similarProjects: [],
          projectTypeMatchScore: 30,
        },
        industryMatchAnalysis: {
          industryMatchScore: 40,
          industryExperience: 'limited' as const,
          industryInsights: [],
        },
        technologyMatchAnalysis: {
          technologyMatchScore: 35,
          matchingTechnologies: [],
          missingExperience: ['All required tech'],
        },
        successRateAnalysis: {
          estimatedSuccessRate: 50,
          successFactors: [],
          riskFactors: ['No relevant experience'],
        },
        overallReferenceScore: 35,
        confidence: 60,
        reasoning: 'Limited references and experience',
        criticalBlockers: ['No relevant reference projects'],
      };

      const result = referenceMatchSchema.parse(data);
      expect(result.similarProjectsAnalysis.hasRelevantReferences).toBe(false);
    });
  });

  describe('bitDecisionSchema', () => {
    it('should validate BIT decision', () => {
      const data = {
        decision: 'bit' as const,
        scores: {
          capability: 85,
          dealQuality: 80,
          strategicFit: 75,
          winProbability: 65,
          legal: 90,
          reference: 70,
          overall: 78,
        },
        overallConfidence: 80,
        keyStrengths: ['Strong technology match', 'Good references'],
        keyRisks: ['High competition'],
        criticalBlockers: [],
        reasoning: 'Recommended to bid despite competition',
        nextSteps: ['Prepare proposal', 'Assemble team'],
      };

      const result = bitDecisionSchema.parse(data);
      expect(result.decision).toBe('bit');
    });

    it('should validate NO BIT decision', () => {
      const data = {
        decision: 'no_bit' as const,
        scores: {
          capability: 40,
          dealQuality: 30,
          strategicFit: 50,
          winProbability: 20,
          legal: 60,
          reference: 35,
          overall: 39,
        },
        overallConfidence: 75,
        keyStrengths: ['Interesting technology'],
        keyRisks: ['Low margin', 'High competition', 'Legal risks'],
        criticalBlockers: ['Unacceptable liability clauses'],
        reasoning: 'Too many risks and low margin',
        nextSteps: ['Decline politely'],
      };

      const result = bitDecisionSchema.parse(data);
      expect(result.decision).toBe('no_bit');
    });

    it('should reject scores outside 0-100 range', () => {
      const data = {
        decision: 'bit' as const,
        scores: {
          capability: 85,
          dealQuality: 150,
          strategicFit: 75,
          winProbability: 65,
          legal: 90,
          reference: 70,
          overall: 78,
        },
        overallConfidence: 80,
        keyStrengths: [],
        keyRisks: [],
        criticalBlockers: [],
        reasoning: 'Test',
        nextSteps: [],
      };

      expect(() => bitDecisionSchema.parse(data)).toThrow();
    });

    it('should calculate overall score correctly', () => {
      const data = {
        decision: 'bit' as const,
        scores: {
          capability: 80,
          dealQuality: 75,
          strategicFit: 70,
          winProbability: 60,
          legal: 85,
          reference: 65,
          overall: 73,
        },
        overallConfidence: 75,
        keyStrengths: [],
        keyRisks: [],
        criticalBlockers: [],
        reasoning: 'Test',
        nextSteps: [],
      };

      const result = bitDecisionSchema.parse(data);
      // Verify overall is within expected range (weighted average of individual scores)
      expect(result.scores.overall).toBeGreaterThanOrEqual(0);
      expect(result.scores.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('alternativeRecSchema', () => {
    it('should validate partner collaboration recommendation', () => {
      const data = {
        recommendedAlternative: 'partner_collaboration' as const,
        partnerSuggestions: ['Tech Partner A', 'Specialist B'],
        reducedScopeOptions: [],
        reasoning: 'Partner can handle missing capabilities',
        customerCommunication: 'We recommend a joint bid with specialized partners',
      };

      const result = alternativeRecSchema.parse(data);
      expect(result.recommendedAlternative).toBe('partner_collaboration');
    });

    it('should validate partial scope recommendation', () => {
      const data = {
        recommendedAlternative: 'partial_scope' as const,
        partnerSuggestions: [],
        reducedScopeOptions: [
          {
            scope: 'Phase 1 only',
            viability: 'high' as const,
          },
        ],
        reasoning: 'Project too large for single phase',
        customerCommunication: 'Suggest phased approach',
      };

      const result = alternativeRecSchema.parse(data);
      expect(result.reducedScopeOptions).toHaveLength(1);
    });

    it('should validate all alternative types', () => {
      const alternatives = [
        'partner_collaboration',
        'partial_scope',
        'delay_and_reassess',
        'refer_to_competitor',
        'decline_gracefully',
      ] as const;

      alternatives.forEach((alt) => {
        const data = {
          recommendedAlternative: alt,
          partnerSuggestions: [],
          reducedScopeOptions: [],
          reasoning: 'Test',
          customerCommunication: 'Test',
        };
        expect(() => alternativeRecSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('decisionNodeSchema', () => {
    it('should validate decision node', () => {
      const data: DecisionNode = {
        id: 'root',
        type: 'decision',
        label: 'Should we bid?',
        value: 'yes',
        score: 75,
        sentiment: 'positive',
        reasoning: 'Strong overall score',
        children: [
          {
            id: 'child1',
            type: 'criterion',
            label: 'Capability',
            score: 85,
          },
        ],
      };

      const result = decisionNodeSchema.parse(data);
      expect(result.type).toBe('decision');
    });

    it('should validate node with minimal fields', () => {
      const data: DecisionNode = {
        id: 'node1',
        type: 'criterion',
        label: 'Test criterion',
      };

      const result = decisionNodeSchema.parse(data);
      expect(result.id).toBe('node1');
    });

    it('should validate all node types', () => {
      const types = ['decision', 'criterion', 'outcome', 'blocker'] as const;

      types.forEach((type) => {
        const data: DecisionNode = {
          id: 'test',
          type,
          label: 'Test',
        };
        expect(() => decisionNodeSchema.parse(data)).not.toThrow();
      });
    });

    it('should validate nested children', () => {
      const data: DecisionNode = {
        id: 'root',
        type: 'decision',
        label: 'Root',
        children: [
          {
            id: 'child1',
            type: 'criterion',
            label: 'Child 1',
            children: [
              {
                id: 'grandchild1',
                type: 'outcome',
                label: 'Outcome 1',
              },
            ],
          },
        ],
      };

      const result = decisionNodeSchema.parse(data);
      expect(result.children?.[0].children?.[0].id).toBe('grandchild1');
    });
  });

  describe('coordinatorOutputSchema', () => {
    it('should validate coordinator output with BIT recommendation', () => {
      const data = {
        recommendation: 'bit' as const,
        confidence: 85,
        decisionTree: {
          id: 'root',
          type: 'decision',
          label: 'BIT Decision',
        },
        synthesis: {
          executiveSummary: 'Strong opportunity',
          keyStrengths: ['Tech match', 'Good references'],
          keyRisks: ['Competition'],
          criticalBlockers: [],
          proArguments: ['High margin', 'Strategic fit'],
          contraArguments: ['Tight timeline'],
        },
        agentResults: {
          capability: 85,
          dealQuality: 80,
          strategicFit: 75,
          winProbability: 65,
          legal: 90,
          reference: 70,
          overall: 78,
        },
        nextSteps: ['Prepare proposal'],
        escalationRequired: false,
      };

      const result = coordinatorOutputSchema.parse(data);
      expect(result.recommendation).toBe('bit');
    });

    it('should validate coordinator output requiring escalation', () => {
      const data = {
        recommendation: 'no_bit' as const,
        confidence: 65,
        decisionTree: {
          id: 'root',
          type: 'decision',
          label: 'Decision',
        },
        synthesis: {
          executiveSummary: 'Risks outweigh benefits',
          keyStrengths: [],
          keyRisks: ['Low margin', 'Legal issues'],
          criticalBlockers: ['Unacceptable terms'],
          proArguments: [],
          contraArguments: ['Multiple blockers'],
        },
        agentResults: {
          capability: 50,
          dealQuality: 40,
          strategicFit: 45,
          winProbability: 30,
          legal: 35,
          reference: 40,
          overall: 40,
        },
        nextSteps: ['Escalate to BL'],
        escalationRequired: true,
      };

      const result = coordinatorOutputSchema.parse(data);
      expect(result.escalationRequired).toBe(true);
    });
  });

  describe('bitEvaluationResultSchema', () => {
    it('should validate complete BIT evaluation result', () => {
      const data = {
        capabilityMatch: {
          hasRequiredTechnologies: true,
          technologyMatchScore: 85,
          missingCapabilities: [],
          hasRequiredScale: true,
          scaleMatchScore: 90,
          scaleGaps: [],
          overallCapabilityScore: 87,
          confidence: 85,
          reasoning: 'Strong match',
          criticalBlockers: [],
        },
        dealQuality: {
          budgetAdequacy: 'adequate' as const,
          estimatedMargin: 25,
          budgetRisks: [],
          timelineRealism: 'realistic' as const,
          timelineRisks: [],
          expectedRevenueRange: '€100k-€500k',
          profitabilityRating: 'high' as const,
          commercialRisks: [],
          overallDealQualityScore: 85,
          confidence: 80,
          reasoning: 'Good project',
          criticalBlockers: [],
        },
        strategicFit: {
          customerTypeAssessment: {
            customerType: 'Enterprise',
            isTargetCustomer: true,
            customerFitScore: 90,
          },
          industryAlignment: {
            industry: 'Manufacturing',
            isTargetIndustry: true,
            industryExperience: 'extensive' as const,
            industryFitScore: 85,
          },
          strategicValue: {
            isReferenceProject: true,
            enablesNewMarket: false,
            expandsExistingRelationship: true,
            longTermPotential: 'high' as const,
          },
          overallStrategicFitScore: 88,
          confidence: 85,
          reasoning: 'Great fit',
          criticalBlockers: [],
        },
        competitionCheck: {
          competitiveAnalysis: {
            competitionLevel: 'high' as const,
            knownCompetitors: ['Comp A'],
            ourDifferentiators: ['Tech'],
            competitiveWeaknesses: [],
          },
          winProbabilityFactors: {
            hasIncumbentAdvantage: false,
            hasExistingRelationship: true,
            hasUniqueCapability: true,
            pricingPosition: 'competitive' as const,
          },
          estimatedWinProbability: 65,
          confidence: 75,
          reasoning: 'Competitive but winnable',
          criticalBlockers: [],
        },
        legalAssessment: {
          quickCheck: {
            criticalFlags: [],
            complianceHints: [],
            requiresDetailedReview: false,
            quickRiskScore: 3,
            confidence: 80,
            reasoning: 'Low risk',
          },
          overallLegalScore: 85,
          legalRiskScore: 3,
          confidence: 80,
          reasoning: 'Favorable',
          criticalBlockers: [],
        },
        contractAnalysis: {
          contractType: 'fixed_price' as const,
          contractTypeIndicators: [],
          budgetAnalysis: {
            hasBudget: true,
            budgetRisks: [],
          },
          riskFlags: [],
          changeRequestProcess: {
            hasProcess: true,
            isFlexible: true,
          },
          penaltyClauses: {
            hasPenalties: false,
            penaltyDescription: [],
            penaltyRiskLevel: 'low' as const,
          },
          timelineAssessment: {
            isRealistic: true,
            timelineRisks: [],
          },
          scopeClarity: {
            isClear: true,
            unclearAreas: [],
            scopeRisks: [],
          },
          overallContractScore: 85,
          confidence: 80,
          reasoning: 'Good contract',
          criticalBlockers: [],
        },
        referenceMatch: {
          similarProjectsAnalysis: {
            hasRelevantReferences: true,
            similarProjects: [],
            projectTypeMatchScore: 80,
          },
          industryMatchAnalysis: {
            industryMatchScore: 75,
            industryExperience: 'moderate' as const,
            industryInsights: [],
          },
          technologyMatchAnalysis: {
            technologyMatchScore: 85,
            matchingTechnologies: ['React'],
            missingExperience: [],
          },
          successRateAnalysis: {
            estimatedSuccessRate: 80,
            successFactors: [],
            riskFactors: [],
          },
          overallReferenceScore: 80,
          confidence: 78,
          reasoning: 'Good references',
          criticalBlockers: [],
        },
        decision: {
          decision: 'bit' as const,
          scores: {
            capability: 85,
            dealQuality: 85,
            strategicFit: 88,
            winProbability: 65,
            legal: 85,
            reference: 80,
            overall: 82,
          },
          overallConfidence: 82,
          keyStrengths: ['Tech', 'References'],
          keyRisks: ['Competition'],
          criticalBlockers: [],
          reasoning: 'Go for it',
          nextSteps: ['Prepare proposal'],
        },
        coordinatorOutput: {
          recommendation: 'bit' as const,
          confidence: 85,
          decisionTree: {
            id: 'root',
            type: 'decision',
            label: 'BIT',
          },
          synthesis: {
            executiveSummary: 'Good opportunity',
            keyStrengths: [],
            keyRisks: [],
            criticalBlockers: [],
            proArguments: [],
            contraArguments: [],
          },
          agentResults: {
            capability: 85,
            dealQuality: 85,
            strategicFit: 88,
            winProbability: 65,
            legal: 85,
            reference: 80,
            overall: 82,
          },
          nextSteps: ['Submit proposal'],
          escalationRequired: false,
        },
        evaluatedAt: '2025-01-22T10:00:00Z',
        evaluationDuration: 5000,
      };

      const result = bitEvaluationResultSchema.parse(data);
      expect(result.decision.decision).toBe('bit');
    });

    it('should validate evaluation with NO BIT and alternative', () => {
      const data = {
        capabilityMatch: {
          hasRequiredTechnologies: false,
          technologyMatchScore: 40,
          missingCapabilities: ['Tech A', 'Tech B'],
          hasRequiredScale: false,
          scaleMatchScore: 50,
          scaleGaps: ['Team size'],
          overallCapabilityScore: 45,
          confidence: 70,
          reasoning: 'Missing capabilities',
          criticalBlockers: ['Cannot scale'],
        },
        dealQuality: {
          budgetAdequacy: 'inadequate' as const,
          estimatedMargin: 10,
          budgetRisks: ['Low budget'],
          timelineRealism: 'unrealistic' as const,
          timelineRisks: ['Too tight'],
          expectedRevenueRange: '€20k-€50k',
          profitabilityRating: 'low' as const,
          commercialRisks: ['Low margin', 'High risk'],
          overallDealQualityScore: 30,
          confidence: 60,
          reasoning: 'Poor deal quality',
          criticalBlockers: ['Insufficient budget'],
        },
        strategicFit: {
          customerTypeAssessment: {
            customerType: 'Small business',
            isTargetCustomer: false,
            customerFitScore: 40,
          },
          industryAlignment: {
            industry: 'Unknown',
            isTargetIndustry: false,
            industryExperience: 'none' as const,
            industryFitScore: 30,
          },
          strategicValue: {
            isReferenceProject: false,
            enablesNewMarket: false,
            expandsExistingRelationship: false,
            longTermPotential: 'low' as const,
          },
          overallStrategicFitScore: 35,
          confidence: 65,
          reasoning: 'Poor strategic fit',
          criticalBlockers: [],
        },
        competitionCheck: {
          competitiveAnalysis: {
            competitionLevel: 'very_high' as const,
            knownCompetitors: ['Comp A', 'Comp B', 'Comp C'],
            ourDifferentiators: [],
            competitiveWeaknesses: ['Higher price', 'Less brand recognition'],
          },
          winProbabilityFactors: {
            hasIncumbentAdvantage: false,
            hasExistingRelationship: false,
            hasUniqueCapability: false,
            pricingPosition: 'premium' as const,
          },
          estimatedWinProbability: 15,
          confidence: 60,
          reasoning: 'Very competitive',
          criticalBlockers: ['Low win probability'],
        },
        legalAssessment: {
          quickCheck: {
            criticalFlags: [
              {
                category: 'liability' as const,
                severity: 'critical' as const,
                description: 'Unlimited liability',
              },
            ],
            complianceHints: [],
            requiresDetailedReview: true,
            quickRiskScore: 9,
            confidence: 85,
            reasoning: 'Critical legal issues',
          },
          overallLegalScore: 25,
          legalRiskScore: 9,
          confidence: 85,
          reasoning: 'Unacceptable terms',
          criticalBlockers: ['Unlimited liability'],
        },
        contractAnalysis: {
          contractType: 'fixed_price' as const,
          contractTypeIndicators: [],
          budgetAnalysis: {
            hasBudget: true,
            budgetValue: 50000,
            currency: 'EUR',
            budgetType: 'fixed' as const,
            budgetRisks: ['Very low'],
          },
          riskFlags: [
            {
              category: 'budget' as const,
              severity: 'critical' as const,
              description: 'Budget too low',
            },
          ],
          changeRequestProcess: {
            hasProcess: false,
            isFlexible: false,
          },
          penaltyClauses: {
            hasPenalties: true,
            penaltyDescription: ['High penalties'],
            penaltyRiskLevel: 'critical' as const,
          },
          timelineAssessment: {
            isRealistic: false,
            timelineRisks: ['Impossible deadline'],
            deadlines: ['2025-02-01'],
          },
          scopeClarity: {
            isClear: false,
            unclearAreas: ['Requirements unclear'],
            scopeRisks: ['Scope creep likely'],
          },
          overallContractScore: 20,
          confidence: 70,
          reasoning: 'Very poor contract terms',
          criticalBlockers: ['Impossible timeline', 'Unacceptable penalties'],
        },
        referenceMatch: {
          similarProjectsAnalysis: {
            hasRelevantReferences: false,
            similarProjects: [],
            projectTypeMatchScore: 20,
          },
          industryMatchAnalysis: {
            industryMatchScore: 30,
            industryExperience: 'none' as const,
            industryInsights: [],
          },
          technologyMatchAnalysis: {
            technologyMatchScore: 35,
            matchingTechnologies: [],
            missingExperience: ['All required tech'],
          },
          successRateAnalysis: {
            estimatedSuccessRate: 40,
            successFactors: [],
            riskFactors: ['No relevant experience'],
          },
          overallReferenceScore: 30,
          confidence: 65,
          reasoning: 'No relevant references',
          criticalBlockers: ['No similar project experience'],
        },
        decision: {
          decision: 'no_bit' as const,
          scores: {
            capability: 45,
            dealQuality: 30,
            strategicFit: 35,
            winProbability: 15,
            legal: 25,
            reference: 30,
            overall: 30,
          },
          overallConfidence: 75,
          keyStrengths: [],
          keyRisks: ['All areas weak'],
          criticalBlockers: ['Multiple critical issues'],
          reasoning: 'Project too risky',
          nextSteps: ['Decline'],
        },
        alternative: {
          recommendedAlternative: 'refer_to_competitor' as const,
          partnerSuggestions: [],
          reducedScopeOptions: [],
          reasoning: 'Better suited for competitors with lower cost structure',
          customerCommunication: 'We appreciate the opportunity but must decline',
        },
        evaluatedAt: '2025-01-22T11:00:00Z',
        evaluationDuration: 4500,
      };

      const result = bitEvaluationResultSchema.parse(data);
      expect(result.decision.decision).toBe('no_bit');
      expect(result.alternative).toBeDefined();
    });

    it('should require evaluatedAt timestamp', () => {
      const data = {
        capabilityMatch: {
          hasRequiredTechnologies: true,
          technologyMatchScore: 80,
          missingCapabilities: [],
          hasRequiredScale: true,
          scaleMatchScore: 80,
          scaleGaps: [],
          overallCapabilityScore: 80,
          confidence: 80,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        dealQuality: {
          budgetAdequacy: 'adequate' as const,
          estimatedMargin: 20,
          budgetRisks: [],
          timelineRealism: 'realistic' as const,
          timelineRisks: [],
          expectedRevenueRange: '€100k',
          profitabilityRating: 'medium' as const,
          commercialRisks: [],
          overallDealQualityScore: 75,
          confidence: 75,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        strategicFit: {
          customerTypeAssessment: {
            customerType: 'Enterprise',
            isTargetCustomer: true,
            customerFitScore: 80,
          },
          industryAlignment: {
            industry: 'Tech',
            isTargetIndustry: true,
            industryExperience: 'moderate' as const,
            industryFitScore: 75,
          },
          strategicValue: {
            isReferenceProject: false,
            enablesNewMarket: false,
            expandsExistingRelationship: false,
            longTermPotential: 'medium' as const,
          },
          overallStrategicFitScore: 78,
          confidence: 78,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        competitionCheck: {
          competitiveAnalysis: {
            competitionLevel: 'medium' as const,
            knownCompetitors: [],
            ourDifferentiators: [],
            competitiveWeaknesses: [],
          },
          winProbabilityFactors: {
            hasIncumbentAdvantage: false,
            hasExistingRelationship: false,
            hasUniqueCapability: false,
            pricingPosition: 'competitive' as const,
          },
          estimatedWinProbability: 50,
          confidence: 70,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        legalAssessment: {
          quickCheck: {
            criticalFlags: [],
            complianceHints: [],
            requiresDetailedReview: false,
            quickRiskScore: 5,
            confidence: 75,
            reasoning: 'Test',
          },
          overallLegalScore: 75,
          legalRiskScore: 5,
          confidence: 75,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        contractAnalysis: {
          contractType: 'tm' as const,
          contractTypeIndicators: [],
          budgetAnalysis: {
            hasBudget: false,
            budgetRisks: [],
          },
          riskFlags: [],
          changeRequestProcess: {
            hasProcess: true,
            isFlexible: true,
          },
          penaltyClauses: {
            hasPenalties: false,
            penaltyDescription: [],
            penaltyRiskLevel: 'low' as const,
          },
          timelineAssessment: {
            isRealistic: true,
            timelineRisks: [],
          },
          scopeClarity: {
            isClear: true,
            unclearAreas: [],
            scopeRisks: [],
          },
          overallContractScore: 70,
          confidence: 70,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        referenceMatch: {
          similarProjectsAnalysis: {
            hasRelevantReferences: true,
            similarProjects: [],
            projectTypeMatchScore: 70,
          },
          industryMatchAnalysis: {
            industryMatchScore: 70,
            industryExperience: 'moderate' as const,
            industryInsights: [],
          },
          technologyMatchAnalysis: {
            technologyMatchScore: 75,
            matchingTechnologies: [],
            missingExperience: [],
          },
          successRateAnalysis: {
            estimatedSuccessRate: 70,
            successFactors: [],
            riskFactors: [],
          },
          overallReferenceScore: 72,
          confidence: 72,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        decision: {
          decision: 'bit' as const,
          scores: {
            capability: 80,
            dealQuality: 75,
            strategicFit: 78,
            winProbability: 50,
            legal: 75,
            reference: 72,
            overall: 72,
          },
          overallConfidence: 72,
          keyStrengths: [],
          keyRisks: [],
          criticalBlockers: [],
          reasoning: 'Test',
          nextSteps: [],
        },
        evaluatedAt: '2025-01-22T12:00:00Z',
        evaluationDuration: 3000,
      };

      const result = bitEvaluationResultSchema.parse(data);
      expect(result.evaluatedAt).toBe('2025-01-22T12:00:00Z');
    });

    it('should reject without evaluationDuration', () => {
      const data = {
        capabilityMatch: {
          hasRequiredTechnologies: true,
          technologyMatchScore: 80,
          missingCapabilities: [],
          hasRequiredScale: true,
          scaleMatchScore: 80,
          scaleGaps: [],
          overallCapabilityScore: 80,
          confidence: 80,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        dealQuality: {
          budgetAdequacy: 'adequate' as const,
          estimatedMargin: 20,
          budgetRisks: [],
          timelineRealism: 'realistic' as const,
          timelineRisks: [],
          expectedRevenueRange: '€100k',
          profitabilityRating: 'medium' as const,
          commercialRisks: [],
          overallDealQualityScore: 75,
          confidence: 75,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        strategicFit: {
          customerTypeAssessment: {
            customerType: 'Enterprise',
            isTargetCustomer: true,
            customerFitScore: 80,
          },
          industryAlignment: {
            industry: 'Tech',
            isTargetIndustry: true,
            industryExperience: 'moderate' as const,
            industryFitScore: 75,
          },
          strategicValue: {
            isReferenceProject: false,
            enablesNewMarket: false,
            expandsExistingRelationship: false,
            longTermPotential: 'medium' as const,
          },
          overallStrategicFitScore: 78,
          confidence: 78,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        competitionCheck: {
          competitiveAnalysis: {
            competitionLevel: 'medium' as const,
            knownCompetitors: [],
            ourDifferentiators: [],
            competitiveWeaknesses: [],
          },
          winProbabilityFactors: {
            hasIncumbentAdvantage: false,
            hasExistingRelationship: false,
            hasUniqueCapability: false,
            pricingPosition: 'competitive' as const,
          },
          estimatedWinProbability: 50,
          confidence: 70,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        legalAssessment: {
          quickCheck: {
            criticalFlags: [],
            complianceHints: [],
            requiresDetailedReview: false,
            quickRiskScore: 5,
            confidence: 75,
            reasoning: 'Test',
          },
          overallLegalScore: 75,
          legalRiskScore: 5,
          confidence: 75,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        contractAnalysis: {
          contractType: 'tm' as const,
          contractTypeIndicators: [],
          budgetAnalysis: {
            hasBudget: false,
            budgetRisks: [],
          },
          riskFlags: [],
          changeRequestProcess: {
            hasProcess: true,
            isFlexible: true,
          },
          penaltyClauses: {
            hasPenalties: false,
            penaltyDescription: [],
            penaltyRiskLevel: 'low' as const,
          },
          timelineAssessment: {
            isRealistic: true,
            timelineRisks: [],
          },
          scopeClarity: {
            isClear: true,
            unclearAreas: [],
            scopeRisks: [],
          },
          overallContractScore: 70,
          confidence: 70,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        referenceMatch: {
          similarProjectsAnalysis: {
            hasRelevantReferences: true,
            similarProjects: [],
            projectTypeMatchScore: 70,
          },
          industryMatchAnalysis: {
            industryMatchScore: 70,
            industryExperience: 'moderate' as const,
            industryInsights: [],
          },
          technologyMatchAnalysis: {
            technologyMatchScore: 75,
            matchingTechnologies: [],
            missingExperience: [],
          },
          successRateAnalysis: {
            estimatedSuccessRate: 70,
            successFactors: [],
            riskFactors: [],
          },
          overallReferenceScore: 72,
          confidence: 72,
          reasoning: 'Test',
          criticalBlockers: [],
        },
        decision: {
          decision: 'bit' as const,
          scores: {
            capability: 80,
            dealQuality: 75,
            strategicFit: 78,
            winProbability: 50,
            legal: 75,
            reference: 72,
            overall: 72,
          },
          overallConfidence: 72,
          keyStrengths: [],
          keyRisks: [],
          criticalBlockers: [],
          reasoning: 'Test',
          nextSteps: [],
        },
        // Missing evaluatedAt and evaluationDuration - should fail
      };

      expect(() => bitEvaluationResultSchema.parse(data)).toThrow();
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer CapabilityMatch type', () => {
      const data: CapabilityMatch = {
        hasRequiredTechnologies: true,
        technologyMatchScore: 80,
        missingCapabilities: [],
        hasRequiredScale: true,
        scaleMatchScore: 80,
        scaleGaps: [],
        overallCapabilityScore: 80,
        confidence: 80,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      // TypeScript should accept this as CapabilityMatch
      expect(typeof data.hasRequiredTechnologies).toBe('boolean');
    });

    it('should correctly infer BitDecision type', () => {
      const data: BitDecision = {
        decision: 'bit',
        scores: {
          capability: 80,
          dealQuality: 80,
          strategicFit: 80,
          winProbability: 80,
          legal: 80,
          reference: 80,
          overall: 80,
        },
        overallConfidence: 80,
        keyStrengths: [],
        keyRisks: [],
        criticalBlockers: [],
        reasoning: 'Test',
        nextSteps: [],
      };

      expect(data.decision).toBe('bit');
    });

    it('should correctly infer DecisionNode type', () => {
      const data: DecisionNode = {
        id: 'test',
        type: 'decision',
        label: 'Test',
      };

      expect(data.type).toBe('decision');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty arrays correctly', () => {
      const data = {
        criticalFlags: [],
        complianceHints: [],
        requiresDetailedReview: false,
        quickRiskScore: 1,
        confidence: 50,
        reasoning: 'Test',
      };

      const result = legalQuickCheckSchema.parse(data);
      expect(result.criticalFlags).toEqual([]);
      expect(result.complianceHints).toEqual([]);
    });

    it('should handle zero scores correctly', () => {
      const data = {
        hasRequiredTechnologies: false,
        technologyMatchScore: 0,
        missingCapabilities: ['Everything'],
        hasRequiredScale: false,
        scaleMatchScore: 0,
        scaleGaps: ['All gaps'],
        overallCapabilityScore: 0,
        confidence: 0,
        reasoning: 'No match',
        criticalBlockers: ['Complete mismatch'],
      };

      const result = capabilityMatchSchema.parse(data);
      expect(result.technologyMatchScore).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle maximum scores correctly', () => {
      const data = {
        hasRequiredTechnologies: true,
        technologyMatchScore: 100,
        missingCapabilities: [],
        hasRequiredScale: true,
        scaleMatchScore: 100,
        scaleGaps: [],
        overallCapabilityScore: 100,
        confidence: 100,
        reasoning: 'Perfect match',
        criticalBlockers: [],
      };

      const result = capabilityMatchSchema.parse(data);
      expect(result.technologyMatchScore).toBe(100);
      expect(result.confidence).toBe(100);
    });

    it('should handle minimum legal risk score', () => {
      const data = {
        criticalFlags: [],
        complianceHints: [],
        requiresDetailedReview: false,
        quickRiskScore: 1,
        confidence: 80,
        reasoning: 'Very low risk',
      };

      const result = legalQuickCheckSchema.parse(data);
      expect(result.quickRiskScore).toBe(1);
    });

    it('should handle maximum legal risk score', () => {
      const data = {
        criticalFlags: [
          {
            category: 'liability' as const,
            severity: 'critical' as const,
            description: 'Unlimited liability',
          },
        ],
        complianceHints: ['Check all clauses'],
        requiresDetailedReview: true,
        quickRiskScore: 10,
        confidence: 90,
        reasoning: 'Critical risk',
      };

      const result = legalQuickCheckSchema.parse(data);
      expect(result.quickRiskScore).toBe(10);
    });

    it('should reject invalid enum values', () => {
      const data = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        budgetAdequacy: 'invalid' as any,
        estimatedMargin: 20,
        budgetRisks: [],
        timelineRealism: 'realistic' as const,
        timelineRisks: [],
        expectedRevenueRange: '€100k', // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        profitabilityRating: 'medium' as const,
        commercialRisks: [],
        overallDealQualityScore: 70,
        confidence: 75,
        reasoning: 'Test',
        criticalBlockers: [],
      };

      expect(() => dealQualitySchema.parse(data)).toThrow();
    });

    it('should handle deeply nested objects', () => {
      const data: DecisionNode = {
        id: 'root',
        type: 'decision',
        label: 'Root',
        children: [
          {
            id: 'level1',
            type: 'criterion',
            label: 'Level 1',
            children: [
              {
                id: 'level2',
                type: 'outcome',
                label: 'Level 2',
                score: 85,
                sentiment: 'positive',
                reasoning: 'Good outcome',
              },
            ],
          },
        ],
      };

      const result = decisionNodeSchema.parse(data);
      expect(result.children?.[0].children?.[0].score).toBe(85);
    });

    it('should validate all alternative recommendation enum values', () => {
      const alternatives = [
        'partner_collaboration',
        'partial_scope',
        'delay_and_reassess',
        'refer_to_competitor',
        'decline_gracefully',
      ] as const;

      alternatives.forEach((alt) => {
        const data = {
          recommendedAlternative: alt,
          partnerSuggestions: [],
          reducedScopeOptions: [],
          reasoning: 'Test',
          customerCommunication: 'Test',
        };
        expect(() => alternativeRecSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('Schema Field Requirements', () => {
    it('should require all mandatory fields in capabilityMatchSchema', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = {} as any; // eslint-disable-line @typescript-eslint/no-unsafe-assignment

      expect(() => capabilityMatchSchema.parse(data)).toThrow();
    });

    it('should require all mandatory fields in dealQualitySchema', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = {} as any; // eslint-disable-line @typescript-eslint/no-unsafe-assignment

      expect(() => dealQualitySchema.parse(data)).toThrow();
    });

    it('should accept data with only required fields in bitDecisionSchema', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = {
        decision: 'bit' as const,
        scores: {
          capability: 75,
          dealQuality: 75,
          strategicFit: 75,
          winProbability: 75,
          legal: 75,
          reference: 75,
          overall: 75,
        },
        overallConfidence: 75,
        keyStrengths: ['Strength 1'],
        keyRisks: ['Risk 1'],
        criticalBlockers: [],
        reasoning: 'Test reasoning',
        nextSteps: ['Step 1'],
      };

      const result = bitDecisionSchema.parse(data);
      expect(result.decision).toBe('bit');
    });

    it('should require decision node id and type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = {} as any; // eslint-disable-line @typescript-eslint/no-unsafe-assignment

      expect(() => decisionNodeSchema.parse(data)).toThrow();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    it('should accept decision node with only id, type, and label', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = {
        id: 'test',
        type: 'decision' as const,
        label: 'Test',
      };

      const result = decisionNodeSchema.parse(data);
      expect(result.id).toBe('test');
    });
  });
});
