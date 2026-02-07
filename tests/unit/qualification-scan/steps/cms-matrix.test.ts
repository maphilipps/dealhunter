import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  technologies: {
    id: 'id',
    name: 'name',
    pros: 'pros',
    cons: 'cons',
    isDefault: 'isDefault',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockReturnValue('eq_condition'),
}));

vi.mock('@/lib/streaming/event-types', () => ({
  AgentEventType: {
    STEP_START: 'STEP_START',
    STEP_COMPLETE: 'STEP_COMPLETE',
    AGENT_COMPLETE: 'AGENT_COMPLETE',
    AGENT_PROGRESS: 'AGENT_PROGRESS',
  },
}));

vi.mock('@/lib/cms-matching/requirements', () => ({
  extractRequirementsFromQualificationScan: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/cms-matching/parallel-matrix-orchestrator', () => ({
  runParallelMatrixResearch: vi.fn().mockResolvedValue({
    requirements: [],
    technologies: [],
    cells: [],
    metadata: { averageScore: 75 },
  }),
}));

import { cmsMatrixStep } from '@/lib/qualification-scan/workflow/steps/cms-matrix';
import type { WorkflowContext } from '@/lib/qualification-scan/workflow/types';
import type { TechStack, Features, ContentVolume } from '@/lib/qualification-scan/schema';
import { db } from '@/lib/db';
import { extractRequirementsFromQualificationScan } from '@/lib/cms-matching/requirements';
import { runParallelMatrixResearch } from '@/lib/cms-matching/parallel-matrix-orchestrator';

function createMockContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    input: { url: 'https://example.com', preQualificationId: '1' } as any,
    emit: vi.fn(),
    results: new Map(),
    getResult: vi.fn(),
    fullUrl: 'https://example.com',
    ...overrides,
  };
}

function createCMSInput() {
  return {
    techStack: { cms: 'WordPress' } as TechStack,
    features: {
      ecommerce: false,
      userAccounts: false,
      search: true,
      multiLanguage: false,
      blog: true,
      forms: true,
      api: false,
      mobileApp: false,
      customFeatures: [],
    } as Features,
    contentVolume: {
      estimatedPageCount: 100,
    } as ContentVolume,
  };
}

describe('cmsMatrixStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('config', () => {
    it('should have correct step configuration', () => {
      expect(cmsMatrixStep.config.name).toBe('cmsMatrix');
      expect(cmsMatrixStep.config.phase).toBe('synthesis');
      expect(cmsMatrixStep.config.optional).toBe(true);
      expect(cmsMatrixStep.config.dependencies).toContain('techStack');
      expect(cmsMatrixStep.config.dependencies).toContain('features');
      expect(cmsMatrixStep.config.dependencies).toContain('contentVolume');
    });

    it('should have 120s timeout for long-running evaluations', () => {
      expect(cmsMatrixStep.config.timeout).toBe(120000);
    });
  });

  describe('no default technologies', () => {
    it('should return null when no default CMS technologies are configured', async () => {
      // DB returns empty array for technologies
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const ctx = createMockContext();
      const result = await cmsMatrixStep.execute(createCMSInput(), ctx);

      expect(result).toBeNull();
    });
  });

  describe('no requirements extracted', () => {
    it('should return null when no requirements can be extracted', async () => {
      // Technologies exist but no requirements
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 'drupal', name: 'Drupal', pros: '["flexible"]', cons: '["complex"]' },
            ]),
        }),
      });

      (extractRequirementsFromQualificationScan as any).mockReturnValue([]);

      const ctx = createMockContext();
      const result = await cmsMatrixStep.execute(createCMSInput(), ctx);

      expect(result).toBeNull();
    });
  });

  describe('full evaluation flow', () => {
    it('should run parallel matrix research when technologies and requirements exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'drupal',
              name: 'Drupal',
              pros: '["flexible","scalable"]',
              cons: '["steep learning curve"]',
            },
            { id: 'typo3', name: 'TYPO3', pros: '["enterprise"]', cons: null },
          ]),
        }),
      });

      (extractRequirementsFromQualificationScan as any).mockReturnValue([
        { id: 'req-1', name: 'Multi-Language', weight: 3 },
        { id: 'req-2', name: 'Search', weight: 2 },
      ]);

      const mockMatrix = {
        requirements: [
          { id: 'req-1', name: 'Multi-Language', weight: 3 },
          { id: 'req-2', name: 'Search', weight: 2 },
        ],
        technologies: [
          { id: 'drupal', name: 'Drupal' },
          { id: 'typo3', name: 'TYPO3' },
        ],
        cells: [],
        metadata: { averageScore: 82 },
      };

      (runParallelMatrixResearch as any).mockResolvedValue(mockMatrix);

      const ctx = createMockContext();
      const result = await cmsMatrixStep.execute(createCMSInput(), ctx);

      expect(result).not.toBeNull();
      expect(result!.metadata.averageScore).toBe(82);
      expect(runParallelMatrixResearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({ id: 'drupal', name: 'Drupal', isBaseline: true }),
        ]),
        expect.any(Function),
        { useCache: true, saveToDb: true }
      );
    });

    it('should mark first technology as baseline', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'first', name: 'First CMS', pros: null, cons: null },
            { id: 'second', name: 'Second CMS', pros: null, cons: null },
          ]),
        }),
      });

      (extractRequirementsFromQualificationScan as any).mockReturnValue([
        { id: 'r1', name: 'Test', weight: 1 },
      ]);
      (runParallelMatrixResearch as any).mockResolvedValue({
        requirements: [],
        technologies: [],
        cells: [],
        metadata: { averageScore: 50 },
      });

      const ctx = createMockContext();
      await cmsMatrixStep.execute(createCMSInput(), ctx);

      const callArgs = (runParallelMatrixResearch as any).mock.calls[0];
      const cmsOptions = callArgs[1];
      expect(cmsOptions[0].isBaseline).toBe(true);
      expect(cmsOptions[1].isBaseline).toBe(false);
    });
  });

  describe('progress reporting', () => {
    it('should emit progress events during execution', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ id: 'drupal', name: 'Drupal', pros: null, cons: null }]),
        }),
      });

      (extractRequirementsFromQualificationScan as any).mockReturnValue([
        { id: 'r1', name: 'Test', weight: 1 },
      ]);
      (runParallelMatrixResearch as any).mockResolvedValue({
        requirements: [],
        technologies: [],
        cells: [],
        metadata: { averageScore: 50 },
      });

      const ctx = createMockContext();
      await cmsMatrixStep.execute(createCMSInput(), ctx);

      // Should have emitted at least STEP_START event
      expect(ctx.emit).toHaveBeenCalled();
    });
  });
});
