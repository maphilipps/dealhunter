import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for Phase 3 Agent-Native tools:
 * - config.list, config.get, config.update
 * - progress.get
 * - technology.discover_features, technology.check_eol
 */

// Mock DB before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    query: {
      leadScans: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/lib/db/schema', () => ({
  technologies: {
    id: 'id',
    name: 'name',
    category: 'category',
    businessUnitId: 'business_unit_id',
    createdAt: 'created_at',
    description: 'description',
    websiteUrl: 'website_url',
    githubUrl: 'github_url',
    license: 'license',
    pros: 'pros',
    cons: 'cons',
    usps: 'usps',
    useCases: 'use_cases',
    isDefault: 'is_default',
  },
  businessUnits: { id: 'id', name: 'name' },
  auditScanRuns: {
    id: 'id',
    status: 'status',
    progress: 'progress',
    completedAgents: 'completed_agents',
    currentPhase: 'current_phase',
    createdAt: 'created_at',
    completedAt: 'completed_at',
    pitchId: 'pitch_id',
  },
  backgroundJobs: {
    id: 'id',
    jobType: 'job_type',
    status: 'status',
    progress: 'progress',
    createdAt: 'created_at',
    completedAt: 'completed_at',
    errorMessage: 'error_message',
    preQualificationId: 'pre_qualification_id',
  },
  preQualifications: {
    id: 'id',
    status: 'status',
    userId: 'user_id',
  },
}));

import { registry } from '@/lib/agent-tools/registry';
import type { ToolContext } from '@/lib/agent-tools/types';

// Import tools to register them
import '@/lib/agent-tools/tools/technology';

const adminContext: ToolContext = {
  userId: 'user-1',
  userRole: 'admin',
  userEmail: 'admin@test.com',
  userName: 'Admin',
};

// ─── Technology Tools ──────────────────────────────────────────────

describe('technology tools', () => {
  describe('technology.discover_features', () => {
    it('should be registered', () => {
      const tool = registry.get('technology.discover_features');
      expect(tool).toBeDefined();
      expect(tool!.category).toBe('technology');
    });

    it('should have correct input schema', () => {
      const tool = registry.get('technology.discover_features');
      const parsed = tool!.inputSchema.safeParse({ name: 'WordPress' });
      expect(parsed.success).toBe(true);
    });

    it('should require name field', () => {
      const tool = registry.get('technology.discover_features');
      const parsed = tool!.inputSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  describe('technology.check_eol', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('should be registered', () => {
      const tool = registry.get('technology.check_eol');
      expect(tool).toBeDefined();
      expect(tool!.category).toBe('technology');
    });

    it('should handle 404 (unknown product) gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const result = await registry.execute(
        'technology.check_eol',
        { product: 'unknown-product-xyz' },
        adminContext
      );

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).found).toBe(false);
    });

    it('should return versions for known products', async () => {
      const mockData = [
        {
          cycle: '22',
          eol: '2027-04-01',
          support: '2026-04-01',
          lts: true,
          latest: '22.04.3',
          releaseDate: '2022-04-21',
        },
        {
          cycle: '20',
          eol: '2025-04-02',
          support: '2024-04-02',
          lts: true,
          latest: '20.04.6',
          releaseDate: '2020-04-23',
        },
      ];

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }));

      const result = await registry.execute(
        'technology.check_eol',
        { product: 'ubuntu' },
        adminContext
      );

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(true);
      expect(data.product).toBe('ubuntu');
      expect(Array.isArray(data.versions)).toBe(true);
    });

    it('should return single version when version is specified', async () => {
      const mockData = {
        cycle: '22',
        eol: '2027-04-01',
        support: '2026-04-01',
        lts: true,
        latest: '22.04.3',
        releaseDate: '2022-04-21',
      };

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }));

      const result = await registry.execute(
        'technology.check_eol',
        { product: 'ubuntu', version: '22' },
        adminContext
      );

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(true);
      expect(data.version).toBe('22');
      expect(data.eol).toBe('2027-04-01');
    });

    it('should handle fetch errors gracefully', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const result = await registry.execute(
        'technology.check_eol',
        { product: 'test' },
        adminContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to check EOL');
    });

    it('should handle API errors', async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));

      const result = await registry.execute(
        'technology.check_eol',
        { product: 'test' },
        adminContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('endoflife.date API error: 500');
    });

    it('should require product field', () => {
      const tool = registry.get('technology.check_eol');
      const parsed = tool!.inputSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });

    it('should accept optional version field', () => {
      const tool = registry.get('technology.check_eol');
      const parsed = tool!.inputSchema.safeParse({ product: 'nodejs', version: '20' });
      expect(parsed.success).toBe(true);
    });
  });
});

// ─── Tool Registration Completeness ────────────────────────────────

describe('Phase 3 tool registration', () => {
  const expectedTools = ['technology.discover_features', 'technology.check_eol'];

  it.each(expectedTools)('tool "%s" should be registered', toolName => {
    expect(registry.get(toolName)).toBeDefined();
  });

  it('all Phase 3 tools should have descriptions', () => {
    expectedTools.forEach(name => {
      const tool = registry.get(name);
      expect(tool!.description.length).toBeGreaterThan(10);
    });
  });
});
