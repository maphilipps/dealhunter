import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  competitors: 'competitors_table',
}));

vi.mock('@/lib/streaming/in-process/event-types', () => ({
  AgentEventType: {
    STEP_START: 'STEP_START',
    STEP_COMPLETE: 'STEP_COMPLETE',
    AGENT_COMPLETE: 'AGENT_COMPLETE',
    AGENT_PROGRESS: 'AGENT_PROGRESS',
  },
}));

import { competitorDetectionStep } from '@/lib/qualification-scan/workflow/steps/competitor-detection';
import type { CompetitorDetectionResult } from '@/lib/qualification-scan/workflow/steps/competitor-detection';
import type { WorkflowContext, WebsiteData } from '@/lib/qualification-scan/workflow/types';
import { db } from '@/lib/db';

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

function createWebsiteData(html: string): WebsiteData {
  return {
    html,
    headers: {},
    url: 'https://example.com',
    wappalyzerResults: [],
    sitemapUrls: [],
    sitemapFound: false,
  };
}

describe('competitorDetectionStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DB mock to return empty array
    (db.select as any).mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    });
  });

  describe('config', () => {
    it('should have correct step configuration', () => {
      expect(competitorDetectionStep.config.name).toBe('competitorDetection');
      expect(competitorDetectionStep.config.phase).toBe('analysis');
      expect(competitorDetectionStep.config.dependencies).toContain('fetchWebsite');
      expect(competitorDetectionStep.config.optional).toBe(true);
    });
  });

  describe('no fingerprints found', () => {
    it('should return null agency for clean HTML', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><body><h1>Hello</h1></body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.detectedAgency).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.matchedCompetitor).toBeUndefined();
    });

    it('should return empty fingerprints for plain HTML', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>No agency here</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.fingerprints).toEqual([]);
    });
  });

  describe('agency fingerprint detection', () => {
    it('should detect Accenture from HTML content', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>Built by Accenture</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.detectedAgency).toBe('Accenture');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect DEPT from domain pattern', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>Visit dept.agency for more</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.detectedAgency).toBe('DEPT');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect SinnerSchrader (case insensitive)', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>SinnerSchrader digital agency</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.detectedAgency).toBe('SinnerSchrader');
    });

    it('should pick agency with most pattern matches', async () => {
      const ctx = createMockContext();
      // IBM iX has two patterns matching: ibm ix and built by ibm
      const input = createWebsiteData('<html><body>IBM iX solution. Built by IBM.</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.detectedAgency).toBe('IBM iX');
      // Higher confidence because multiple patterns matched
      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });
  });

  describe('fingerprint extraction', () => {
    it('should extract meta generator tag', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData(
        '<html><head><meta name="generator" content="WordPress 6.4"></head><body></body></html>'
      );

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.fingerprints).toContainEqual(
        expect.stringContaining('meta-generator: WordPress 6.4')
      );
    });

    it('should extract HTML comments with "built by"', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><!-- Built by Valtech --><body></body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.fingerprints.some(f => f.includes('comment:'))).toBe(true);
      expect(result.detectedAgency).toBe('Valtech');
    });

    it('should extract footer "built by" patterns', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData(
        '<html><body><footer>Powered by Reply digital</footer></body></html>'
      );

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.fingerprints.some(f => f.includes('footer:'))).toBe(true);
    });
  });

  describe('DB competitor matching', () => {
    it('should match detected agency against DB competitors', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue([
          { id: 'comp-1', companyName: 'Accenture Interactive' },
          { id: 'comp-2', companyName: 'Deloitte Digital' },
        ]),
      });

      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>accenture solutions</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.matchedCompetitor).toBeDefined();
      expect(result.matchedCompetitor!.name).toBe('Accenture Interactive');
      expect(result.matchedCompetitor!.id).toBe('comp-1');
    });

    it('should handle DB query failure gracefully', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      });

      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>accenture content</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      // Should still detect the agency, just not match from DB
      expect(result.detectedAgency).toBe('Accenture');
      expect(result.matchedCompetitor).toBeUndefined();
    });
  });

  describe('confidence scoring', () => {
    it('should return 0 confidence when no agency detected', async () => {
      const ctx = createMockContext();
      const input = createWebsiteData('<html><body>clean site</body></html>');

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.confidence).toBe(0);
    });

    it('should cap confidence at 95', async () => {
      const ctx = createMockContext();
      // Multiple pattern matches + fingerprints => high confidence but capped
      const input = createWebsiteData(
        '<html><head><meta name="generator" content="Accenture"></head>' +
          '<!-- Built by Accenture -->' +
          '<body><footer>Powered by Accenture team</footer>Built by Accenture</body></html>'
      );

      const result = await competitorDetectionStep.execute(input, ctx);

      expect(result.confidence).toBeLessThanOrEqual(95);
    });
  });
});
