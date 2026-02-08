import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  phaseAgentResponseSchema,
  formatPreQualContext,
  buildBaseUserPrompt,
  loadPreQualContext,
  formatPreviousResults,
} from '../shared';
import type { PhaseContext } from '../../types';

// ─── Mock DB ────────────────────────────────────────────────────────────────────

// Queue-based mock: each db.select() chain resolves with the next value from the queue.
// Push an Error instance to make the next call throw.
const dbResultQueue: Array<unknown[] | Error> = [];

function pushDbResult(result: unknown[] | Error) {
  dbResultQueue.push(result);
}

function nextDbResult(): unknown[] {
  const next = dbResultQueue.shift();
  if (next instanceof Error) throw next;
  return next ?? [];
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => nextDbResult(),
          orderBy: () => ({
            limit: () => nextDbResult(),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  pitches: { id: 'id', preQualificationId: 'preQualificationId' },
  dealEmbeddings: {
    preQualificationId: 'preQualificationId',
    agentName: 'agentName',
    chunkType: 'chunkType',
    chunkCategory: 'chunkCategory',
    confidence: 'confidence',
    content: 'content',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ['eq', ...args]),
  and: vi.fn((...args: unknown[]) => ['and', ...args]),
  desc: vi.fn((...args: unknown[]) => ['desc', ...args]),
  gte: vi.fn((...args: unknown[]) => ['gte', ...args]),
  inArray: vi.fn((...args: unknown[]) => ['inArray', ...args]),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeFinding(overrides: Record<string, unknown> = {}) {
  return {
    problem: 'Seite laedt langsam',
    relevance: 'Performance beeinflusst Conversion Rate',
    recommendation: 'Bildoptimierung und Caching einfuehren',
    ...overrides,
  };
}

function makeValidResponse(findingsCount = 3) {
  return {
    content: {
      summary: 'Zusammenfassung der Analyse',
      findings: Array.from({ length: findingsCount }, (_, i) =>
        makeFinding({ problem: `Problem ${i + 1}` })
      ),
    },
    confidence: 75,
    sources: ['https://example.com'],
  };
}

function makeContext(overrides: Partial<PhaseContext> = {}): PhaseContext {
  return {
    runId: 'run-1',
    pitchId: 'pitch-1',
    websiteUrl: 'https://example.com',
    previousResults: {},
    targetCmsIds: ['drupal'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('shared phase utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── phaseAgentResponseSchema ──────────────────────────────────────────────

  describe('phaseAgentResponseSchema', () => {
    it('accepts valid response with 3 findings', () => {
      const result = phaseAgentResponseSchema.safeParse(makeValidResponse(3));
      expect(result.success).toBe(true);
    });

    it('accepts valid response with 5 findings', () => {
      const result = phaseAgentResponseSchema.safeParse(makeValidResponse(5));
      expect(result.success).toBe(true);
    });

    it('accepts valid response with 7 findings (max)', () => {
      const result = phaseAgentResponseSchema.safeParse(makeValidResponse(7));
      expect(result.success).toBe(true);
    });

    it('rejects response with fewer than 3 findings', () => {
      const result = phaseAgentResponseSchema.safeParse(makeValidResponse(2));
      expect(result.success).toBe(false);
    });

    it('rejects response with more than 7 findings', () => {
      const result = phaseAgentResponseSchema.safeParse(makeValidResponse(8));
      expect(result.success).toBe(false);
    });

    it('rejects finding without problem field', () => {
      const data = makeValidResponse(3);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (data.content.findings[0] as any).problem;
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects finding without relevance field', () => {
      const data = makeValidResponse(3);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (data.content.findings[0] as any).relevance;
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects finding without recommendation field', () => {
      const data = makeValidResponse(3);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (data.content.findings[0] as any).recommendation;
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects empty problem string', () => {
      const data = makeValidResponse(3);
      data.content.findings[0] = makeFinding({ problem: '' });
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts optional estimatedImpact field', () => {
      const data = makeValidResponse(3);
      data.content.findings[0] = makeFinding({ estimatedImpact: 'high' });
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects invalid estimatedImpact value', () => {
      const data = makeValidResponse(3);
      data.content.findings[0] = makeFinding({ estimatedImpact: 'critical' });
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects confidence below 0', () => {
      const data = makeValidResponse(3);
      data.confidence = -1;
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects confidence above 100', () => {
      const data = makeValidResponse(3);
      data.confidence = 101;
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts missing sources (optional)', () => {
      const { sources: _, ...data } = makeValidResponse(3);
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('allows passthrough fields on content', () => {
      const data = makeValidResponse(3);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data.content as any).techStack = ['React', 'Node.js'];
      const result = phaseAgentResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.content as Record<string, unknown>).techStack).toEqual([
          'React',
          'Node.js',
        ]);
      }
    });
  });

  // ── formatPreQualContext ──────────────────────────────────────────────────

  describe('formatPreQualContext', () => {
    it('formats chunks with agent name, type, and metadata', () => {
      const chunks = [
        {
          agentName: 'tech-scanner',
          chunkType: 'analysis',
          chunkCategory: 'fact',
          confidence: 85,
          content: 'Uses React 18 with SSR',
        },
      ];
      const { raw } = formatPreQualContext(chunks, 8000);
      expect(raw).toContain('### tech-scanner (analysis) [cat=fact, conf=85%]');
      expect(raw).toContain('Uses React 18 with SSR');
      expect(raw).toContain('<prequal_context>');
      expect(raw).toContain('</prequal_context>');
    });

    it('formats chunk without category or confidence', () => {
      const chunks = [
        {
          agentName: 'scanner',
          chunkType: 'summary',
          chunkCategory: null,
          confidence: null,
          content: 'Basic summary',
        },
      ];
      const { raw } = formatPreQualContext(chunks, 8000);
      expect(raw).toContain('### scanner (summary)');
      expect(raw).not.toContain('cat=');
      expect(raw).not.toContain('conf=');
    });

    it('truncates at maxChars and marks as truncated', () => {
      const longContent = 'A'.repeat(9000);
      const chunks = [
        {
          agentName: 'agent',
          chunkType: 'type',
          chunkCategory: null,
          confidence: null,
          content: longContent,
        },
      ];
      const { raw, truncated } = formatPreQualContext(chunks, 100);
      expect(truncated).toBe(true);
      expect(raw).toContain('[...Kontext gekuerzt]');
    });

    it('does not truncate when under maxChars', () => {
      const chunks = [
        {
          agentName: 'agent',
          chunkType: 'type',
          chunkCategory: null,
          confidence: null,
          content: 'Short',
        },
      ];
      const { truncated } = formatPreQualContext(chunks, 8000);
      expect(truncated).toBe(false);
    });

    it('returns wrapped empty content for empty array', () => {
      const { raw, truncated } = formatPreQualContext([], 8000);
      expect(raw).toBe('<prequal_context>\n\n</prequal_context>');
      expect(truncated).toBe(false);
    });
  });

  // ── formatPreviousResults ─────────────────────────────────────────────────

  describe('formatPreviousResults', () => {
    it('returns fallback message when no previous results', () => {
      const context = makeContext();
      const result = formatPreviousResults(context);
      expect(result).toBe('Keine vorherigen Ergebnisse verfügbar.');
    });

    it('formats string results with headers', () => {
      const context = makeContext({
        previousResults: { discovery: 'Found React + Node.js stack' },
      });
      const result = formatPreviousResults(context);
      expect(result).toContain('### discovery');
      expect(result).toContain('Found React + Node.js stack');
    });

    it('formats object results as JSON', () => {
      const context = makeContext({
        previousResults: { tech: { cms: 'WordPress', version: '6.0' } },
      });
      const result = formatPreviousResults(context);
      expect(result).toContain('### tech');
      expect(result).toContain('WordPress');
    });

    it('truncates long results at 2000 chars', () => {
      const longValue = 'X'.repeat(3000);
      const context = makeContext({ previousResults: { long: longValue } });
      const result = formatPreviousResults(context);
      expect(result.length).toBeLessThan(3000);
    });
  });

  // ── buildBaseUserPrompt ───────────────────────────────────────────────────

  describe('buildBaseUserPrompt', () => {
    it('includes the website URL', () => {
      const context = makeContext({ websiteUrl: 'https://test.de' });
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('https://test.de');
      expect(prompt).toContain('# Website');
    });

    it('shows fallback when no website URL', () => {
      const context = makeContext({ websiteUrl: '' });
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('(keine URL)');
    });

    it('includes PreQual context when available', () => {
      const context = makeContext({
        preQualContext: {
          raw: '<prequal_context>\nSome context\n</prequal_context>',
          metadata: {
            preQualificationId: 'pq-1',
            chunkCount: 5,
            truncated: false,
          },
        },
      });
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('Kontext aus Pre-Qualification');
      expect(prompt).toContain('<prequal_context>');
      expect(prompt).toContain('Some context');
    });

    it('shows truncation hint when PreQual context was truncated', () => {
      const context = makeContext({
        preQualContext: {
          raw: '<prequal_context>\nTruncated\n</prequal_context>',
          metadata: {
            preQualificationId: 'pq-1',
            chunkCount: 15,
            truncated: true,
          },
        },
      });
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('Kontext wurde gekuerzt');
    });

    it('shows fallback message when no PreQual available', () => {
      const context = makeContext();
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('Kein PreQual-Kontext verfuegbar');
      expect(prompt).toContain('Best-Effort');
    });

    it('includes previous results section', () => {
      const context = makeContext({
        previousResults: { discovery: 'React-based SPA' },
      });
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('# Vorherige Analyse-Ergebnisse');
      expect(prompt).toContain('React-based SPA');
    });

    it('shows no-results fallback when previousResults is empty', () => {
      const context = makeContext();
      const prompt = buildBaseUserPrompt(context);
      expect(prompt).toContain('Keine vorherigen Ergebnisse verfügbar.');
    });
  });

  // ── loadPreQualContext ────────────────────────────────────────────────────

  describe('loadPreQualContext', () => {
    it('returns undefined when pitch has no preQualificationId', async () => {
      pushDbResult([{ preQualificationId: null }]);
      const result = await loadPreQualContext('pitch-1');
      expect(result).toBeUndefined();
    });

    it('returns undefined when pitch is not found', async () => {
      pushDbResult([]);
      const result = await loadPreQualContext('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns formatted context when chunks exist', async () => {
      // First query: pitch lookup
      pushDbResult([{ preQualificationId: 'pq-123' }]);
      // Second query: chunks lookup (uses orderBy path)
      pushDbResult([
        {
          agentName: 'tech-scanner',
          chunkType: 'analysis',
          chunkCategory: 'fact',
          confidence: 90,
          content: 'Uses WordPress 6.0',
        },
      ]);

      const result = await loadPreQualContext('pitch-1');
      expect(result).toBeDefined();
      expect(result?.raw).toContain('tech-scanner');
      expect(result?.raw).toContain('Uses WordPress 6.0');
      expect(result?.metadata.preQualificationId).toBe('pq-123');
      expect(result?.metadata.chunkCount).toBe(1);
    });

    it('returns undefined when no chunks match filters', async () => {
      pushDbResult([{ preQualificationId: 'pq-123' }]);
      pushDbResult([]);

      const result = await loadPreQualContext('pitch-1');
      expect(result).toBeUndefined();
    });

    it('returns undefined on DB error (graceful degradation)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      pushDbResult(new Error('DB connection failed'));

      const result = await loadPreQualContext('pitch-1');
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load PreQual context'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
