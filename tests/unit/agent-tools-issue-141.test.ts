import { describe, it, expect, vi } from 'vitest';

// Minimal mocks so tool modules can be imported without touching a real DB.
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/db/schema', () => ({
  features: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    category: 'category',
    description: 'description',
    priority: 'priority',
    isActive: 'is_active',
    createdAt: 'created_at',
  },
  cmsFeatureEvaluations: {
    id: 'id',
    featureId: 'feature_id',
    technologyId: 'technology_id',
    score: 'score',
    reasoning: 'reasoning',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
  },
  technologies: { id: 'id', name: 'name' },
  preQualifications: { id: 'id', userId: 'user_id' },
}));

vi.mock('@/lib/qualification-scan/export/markdown-builder', () => ({
  buildQualificationScanMarkdown: vi.fn(),
}));
vi.mock('@/lib/qualification-scan/export/pdf-exporter', () => ({
  generatePrintableHTML: vi.fn(),
}));
vi.mock('@/lib/qualification-scan/export/word-exporter', () => ({
  generateWordDocument: vi.fn(),
}));

import { registry } from '@/lib/agent-tools/registry';
import type { ToolContext } from '@/lib/agent-tools/types';

// Import tools to register them
import '@/lib/agent-tools/tools/feature';
import '@/lib/agent-tools/tools/cms-evaluation';
import '@/lib/agent-tools/tools/export';

const userContext: ToolContext = {
  userId: 'user-1',
  userRole: 'bd',
  userEmail: 'user@test.com',
  userName: 'User',
};

describe('Issue #141 agent tools', () => {
  it('registers feature tools', () => {
    expect(registry.get('feature.list')).toBeDefined();
    expect(registry.get('feature.get')).toBeDefined();
    expect(registry.get('feature.create')).toBeDefined();
    expect(registry.get('feature.update')).toBeDefined();
    expect(registry.get('feature.delete')).toBeDefined();
  });

  it('registers cmsEvaluation tools', () => {
    expect(registry.get('cmsEvaluation.list')).toBeDefined();
    expect(registry.get('cmsEvaluation.get')).toBeDefined();
    expect(registry.get('cmsEvaluation.answer')).toBeDefined();
  });

  it('registers export tools', () => {
    expect(registry.get('export.generate_markdown')).toBeDefined();
    expect(registry.get('export.generate_word')).toBeDefined();
    expect(registry.get('export.generate_pdf')).toBeDefined();
  });

  it('blocks feature.create for non-admin', async () => {
    const result = await registry.execute(
      'feature.create',
      { name: 'Test Feature', category: 'functional', priority: 50, isActive: true },
      userContext
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Admin');
  });

  it('blocks feature.update for non-admin', async () => {
    const result = await registry.execute('feature.update', { id: 'f1', name: 'New' }, userContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Admin');
  });

  it('blocks feature.delete for non-admin', async () => {
    const result = await registry.execute('feature.delete', { id: 'f1' }, userContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Admin');
  });
});
