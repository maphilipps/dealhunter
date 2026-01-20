import { createId } from '@paralleldrive/cuid2';

/**
 * Test data factories for creating mock database records
 */

export const factories = {
  user: (overrides?: Partial<any>) => ({
    id: createId(),
    email: `test-${Date.now()}@example.com`,
    password: 'hashed-password',
    name: 'Test User',
    role: 'bd' as const,
    businessUnitId: null,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  }),

  rfp: (overrides?: Partial<any>) => ({
    id: createId(),
    userId: createId(),
    source: 'reactive' as const,
    stage: 'rfp' as const,
    inputType: 'pdf' as const,
    rawInput: 'Test RFP content',
    metadata: null,
    extractedRequirements: null,
    status: 'draft' as const,
    decision: 'pending' as const,
    decisionData: null,
    alternativeRecommendation: null,
    accountId: null,
    assignedBusinessUnitId: null,
    assignedBLNotifiedAt: null,
    extendedEvaluation: null,
    assignedTeam: null,
    teamNotifiedAt: null,
    baselineComparisonResult: null,
    baselineComparisonCompletedAt: null,
    projectPlanningResult: null,
    projectPlanningCompletedAt: null,
    teamNotifications: null,
    websiteUrl: 'https://example.com',
    duplicateCheckResult: null,
    descriptionEmbedding: null,
    quickScanResults: null,
    createdAt: new Date(),
    ...overrides,
  }),

  businessUnit: (overrides?: Partial<any>) => ({
    id: createId(),
    name: 'Test Business Unit',
    code: 'TBU',
    description: null,
    createdAt: new Date(),
    ...overrides,
  }),

  account: (overrides?: Partial<any>) => ({
    id: createId(),
    name: 'Test Account',
    industry: 'Technology',
    website: 'https://example.com',
    parentAccountId: null,
    lastContactDate: new Date(),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  extractedRequirements: () => ({
    clientName: 'Test Client',
    projectDescription: 'Test project description',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    techStack: ['React', 'Node.js'],
    budget: '100000',
    websiteUrl: 'https://example.com',
  }),

  quickScanResults: () => ({
    recommendation: 'bid' as const,
    confidence: 0.85,
    reasoning: 'Strong technical fit and reasonable timeline',
    techStack: {
      detected: ['WordPress', 'PHP'],
      complexity: 'medium' as const,
    },
    estimatedEffort: {
      min: 20,
      max: 30,
      unit: 'PT' as const,
    },
  }),

  decisionData: () => ({
    decision: 'bid' as const,
    confidence: 0.9,
    reasoning: {
      tech: 'Strong technical match',
      commercial: 'Reasonable budget',
      risk: 'Low risk profile',
    },
    scores: {
      tech: 0.9,
      commercial: 0.85,
      risk: 0.8,
    },
  }),
};
