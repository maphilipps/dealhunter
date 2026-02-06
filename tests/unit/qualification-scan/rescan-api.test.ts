import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  preQualifications: { id: 'id', userId: 'userId' },
  qualificationScans: { id: 'id' },
}));

// Mock workflow
vi.mock('@/lib/qualification-scan/workflow/steps', () => ({
  qualificationScanSteps: new Map([
    ['tech-stack', { id: 'tech-stack', name: 'Tech Stack Detection' }],
    ['content-analysis', { id: 'content-analysis', name: 'Content Analysis' }],
  ]),
}));

vi.mock('@/lib/qualification-scan/workflow/engine', () => {
  return {
    WorkflowEngine: class MockWorkflowEngine {
      executeSingleStep = vi.fn().mockResolvedValue({
        stepId: 'tech-stack',
        success: true,
        output: { cms: 'Drupal' },
        duration: 1500,
      });
    },
  };
});

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { POST } from '@/app/api/qualifications/[id]/qualification-scan/rescan/route';
import { NextRequest } from 'next/server';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/qualifications/q1/qualification-scan/rescan', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function createContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/qualifications/[id]/qualification-scan/rescan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never);
    const req = createRequest({ stepId: 'tech-stack' });
    const res = await POST(req, createContext('q1'));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 400 when stepId is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const req = createRequest({});
    const res = await POST(req, createContext('q1'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('stepId is required');
  });

  it('should return 400 for unknown step', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const req = createRequest({ stepId: 'unknown-step' });
    const res = await POST(req, createContext('q1'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unknown step');
  });

  it('should return 404 when qualification not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    // db.select().from().where() returns empty array
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    (mockDb as Record<string, unknown>).select = selectMock;

    const req = createRequest({ stepId: 'tech-stack' });
    const res = await POST(req, createContext('q1'));
    expect(res.status).toBe(404);
  });

  it('should return 400 when no qualification scan exists', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    const qualification = { id: 'q1', userId: 'u1', qualificationScanId: null };

    const whereMock = vi.fn().mockResolvedValue([qualification]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    (mockDb as Record<string, unknown>).select = selectMock;

    const req = createRequest({ stepId: 'tech-stack' });
    const res = await POST(req, createContext('q1'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No qualification scan found');
  });

  it('should execute rescan and return result', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    const qualification = { id: 'q1', userId: 'u1', qualificationScanId: 'scan-1' };
    const scan = {
      id: 'scan-1',
      websiteUrl: 'https://test.com',
      rawScanData: JSON.stringify({
        'tech-stack': { success: true, output: { cms: 'WordPress' }, duration: 1000 },
      }),
    };

    let queryNum = 0;
    const selectMock = vi.fn().mockImplementation(() => {
      queryNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(queryNum === 1 ? [qualification] : [scan]),
        }),
      };
    });
    (mockDb as Record<string, unknown>).select = selectMock;

    // update chain for rawScanData update
    const updateWhereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    (mockDb as Record<string, unknown>).update = updateMock;

    const req = createRequest({ stepId: 'tech-stack' });
    const res = await POST(req, createContext('q1'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.stepId).toBe('tech-stack');
    expect(json.duration).toBe(1500);
  });
});
