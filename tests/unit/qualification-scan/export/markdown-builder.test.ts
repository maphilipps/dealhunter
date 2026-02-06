import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB before importing the module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    orderBy: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  preQualifications: { id: 'id', qualificationScanId: 'qualificationScanId' },
  qualificationScans: { id: 'id' },
  dealEmbeddings: {
    agentName: 'agentName',
    chunkType: 'chunkType',
    content: 'content',
    chunkCategory: 'chunkCategory',
    confidence: 'confidence',
    preQualificationId: 'preQualificationId',
  },
  sectionNotes: { qualificationId: 'qualificationId', sectionId: 'sectionId' },
}));

import { buildQualificationScanMarkdown } from '@/lib/qualification-scan/export/markdown-builder';
import { db } from '@/lib/db';

const mockDb = vi.mocked(db);

function setupDbChain(returnValue: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
    orderBy: vi.fn().mockResolvedValue(returnValue),
  };
  // For chained calls without .limit(), resolve where() directly
  chain.where.mockImplementation(() => ({
    ...chain,
    limit: vi.fn().mockResolvedValue(returnValue),
    orderBy: vi.fn().mockResolvedValue(returnValue),
    then: (resolve: (v: unknown) => void) => resolve(returnValue),
  }));
  return chain;
}

describe('buildQualificationScanMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when qualification not found', async () => {
    // First query returns empty (no bid found)
    let callCount = 0;
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    await expect(buildQualificationScanMarkdown('non-existent')).rejects.toThrow(
      'Qualification nicht gefunden'
    );
  });

  it('should produce markdown with header and website URL', async () => {
    const bid = {
      id: 'q1',
      rawInput: 'Acme Corp Website Relaunch',
      websiteUrl: 'https://acme.com',
      qualificationScanId: null,
      createdAt: new Date('2026-01-15'),
    };

    let queryNum = 0;
    mockDb.select.mockImplementation((...args: unknown[]) => {
      queryNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (queryNum === 1) {
              // preQualifications query
              return {
                limit: vi.fn().mockResolvedValue([bid]),
              };
            }
            // embeddings and notes — no limit, return array directly
            return Promise.resolve([]);
          }),
        }),
      } as never;
    });

    const md = await buildQualificationScanMarkdown('q1');

    expect(md).toContain('# Qualification Scan — Acme Corp Website Relaunch');
    expect(md).toContain('**Website:** https://acme.com');
    expect(md).toContain('**Status:** N/A');
  });

  it('should include tech stack section when scan has techStack', async () => {
    const bid = {
      id: 'q2',
      rawInput: 'Test',
      websiteUrl: 'https://test.com',
      qualificationScanId: 'scan-1',
      createdAt: new Date('2026-01-20'),
    };
    const scan = {
      id: 'scan-1',
      websiteUrl: 'https://test.com',
      status: 'completed',
      techStack: JSON.stringify({ cms: 'WordPress', cmsVersion: '6.4', framework: 'PHP' }),
      contentVolume: null,
      companyIntelligence: null,
      migrationComplexity: null,
      accessibilityAudit: null,
      seoAudit: null,
      legalCompliance: null,
      recommendedBusinessUnit: null,
      confidence: null,
      reasoning: null,
      cmsEvaluation: null,
    };

    let queryNum = 0;
    mockDb.select.mockImplementation((...args: unknown[]) => {
      queryNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (queryNum === 1) return { limit: vi.fn().mockResolvedValue([bid]) };
            if (queryNum === 2) return { limit: vi.fn().mockResolvedValue([scan]) };
            return Promise.resolve([]);
          }),
        }),
      } as never;
    });

    const md = await buildQualificationScanMarkdown('q2');

    expect(md).toContain('## Technologie-Stack');
    expect(md).toContain('**CMS:** WordPress (6.4)');
    expect(md).toContain('**Framework:** PHP');
  });

  it('should include section notes as blockquotes', async () => {
    const bid = {
      id: 'q3',
      rawInput: 'Notes Test',
      websiteUrl: 'https://notes.com',
      qualificationScanId: 'scan-2',
      createdAt: new Date('2026-02-01'),
    };
    const scan = {
      id: 'scan-2',
      websiteUrl: 'https://notes.com',
      status: 'completed',
      techStack: JSON.stringify({ cms: 'Drupal' }),
      contentVolume: null,
      companyIntelligence: null,
      migrationComplexity: null,
      accessibilityAudit: null,
      seoAudit: null,
      legalCompliance: null,
      recommendedBusinessUnit: null,
      confidence: null,
      reasoning: null,
      cmsEvaluation: null,
    };

    const notes = [{ sectionId: 'tech-stack', content: 'Drupal 10 confirmed by client' }];

    let queryNum = 0;
    mockDb.select.mockImplementation(() => {
      queryNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (queryNum === 1) return { limit: vi.fn().mockResolvedValue([bid]) };
            if (queryNum === 2) return { limit: vi.fn().mockResolvedValue([scan]) };
            if (queryNum === 3) return Promise.resolve([]); // embeddings
            if (queryNum === 4) return Promise.resolve(notes); // notes
            return Promise.resolve([]);
          }),
        }),
      } as never;
    });

    const md = await buildQualificationScanMarkdown('q3');

    expect(md).toContain('> **Notizen:**');
    expect(md).toContain('> - Drupal 10 confirmed by client');
  });

  it('should include migration complexity section', async () => {
    const bid = {
      id: 'q4',
      rawInput: 'Migration',
      websiteUrl: 'https://migrate.com',
      qualificationScanId: 'scan-3',
      createdAt: new Date('2026-02-01'),
    };
    const scan = {
      id: 'scan-3',
      websiteUrl: 'https://migrate.com',
      status: 'completed',
      techStack: null,
      contentVolume: null,
      companyIntelligence: null,
      migrationComplexity: JSON.stringify({
        score: 72,
        recommendation: 'Moderate complexity',
        estimatedEffort: { minPT: 20, maxPT: 40 },
        warnings: ['Legacy PHP version'],
      }),
      accessibilityAudit: null,
      seoAudit: null,
      legalCompliance: null,
      recommendedBusinessUnit: null,
      confidence: null,
      reasoning: null,
      cmsEvaluation: null,
    };

    let queryNum = 0;
    mockDb.select.mockImplementation(() => {
      queryNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (queryNum === 1) return { limit: vi.fn().mockResolvedValue([bid]) };
            if (queryNum === 2) return { limit: vi.fn().mockResolvedValue([scan]) };
            return Promise.resolve([]);
          }),
        }),
      } as never;
    });

    const md = await buildQualificationScanMarkdown('q4');

    expect(md).toContain('## Migrations-Analyse');
    expect(md).toContain('**Score:** 72/100');
    expect(md).toContain('20–40 PT');
    expect(md).toContain('Legacy PHP version');
  });
});
