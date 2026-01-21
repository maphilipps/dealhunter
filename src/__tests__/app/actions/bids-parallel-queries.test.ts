import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedRequirements } from '@/lib/types/extracted-requirements';

/**
 * Test suite for parallel query optimization in extractRequirements
 * Verifies that independent database queries run concurrently using Promise.all
 */
describe('extractRequirements - Parallel Query Optimization', () => {
  let mockDb: any;
  let bidQueryStartTime: number | null = null;
  let documentsQueryStartTime: number | null = null;
  let bidQueryEndTime: number | null = null;
  let documentsQueryEndTime: number | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    bidQueryStartTime = null;
    documentsQueryStartTime = null;
    bidQueryEndTime = null;
    documentsQueryEndTime = null;

    // Mock auth
    vi.mock('@/auth', () => ({
      auth: vi.fn(() => Promise.resolve({ user: { id: 'test-user-id' } })),
    }));

    // Mock environment
    vi.mock('@/lib/env', () => ({
      env: {
        OPENAI_API_KEY: () => 'test-key',
        ANTHROPIC_API_KEY: () => 'test-key',
        DATABASE_URL: () => 'test-db',
        AUTH_SECRET: () => 'test-secret',
        NEXTAUTH_URL: () => 'http://localhost:3000',
        OPENAI_BASE_URL: 'https://adesso-ai-hub.3asabc.de/v1',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      },
    }));

    // Mock AI SDK
    vi.mock('@ai-sdk/openai', () => ({
      createOpenAI: vi.fn(() => ({})),
    }));

    // Mock AI generation
    vi.mock('ai', () => ({
      generateText: vi.fn(() =>
        Promise.resolve({
          text: JSON.stringify({
            title: 'Test Project',
            customerName: 'Test Customer',
            projectDescription: 'Test description',
            technologies: ['React'],
            budget: { min: 10000, max: 20000, currency: 'EUR' },
            timeline: 'Q1 2027',
            scope: ['Development'],
            keyRequirements: ['Testing'],
            confidence: 95,
          }),
        })
      ),
    }));

    // Mock revalidatePath
    vi.mock('next/cache', () => ({
      revalidatePath: vi.fn(),
    }));

    // Mock drizzle-orm
    vi.mock('drizzle-orm', () => ({
      eq: vi.fn(() => ({})),
    }));

    // Mock schema
    vi.mock('@/db/schema', () => ({
      bidOpportunities: {},
      bidDocuments: {},
    }));
  });

  it('should execute bid and documents queries in parallel', async () => {
    // Create a mock database with timing tracking
    const createTimedQuery = (queryName: string, resultData: any, delay = 20) => {
      return new Promise(resolve => {
        if (queryName === 'bid') {
          bidQueryStartTime = Date.now();
        } else {
          documentsQueryStartTime = Date.now();
        }

        setTimeout(() => {
          if (queryName === 'bid') {
            bidQueryEndTime = Date.now();
          } else {
            documentsQueryEndTime = Date.now();
          }
          resolve(resultData);
        }, delay);
      });
    };

    mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(() => {
            // Detect which table is being queried
            const tableName = JSON.stringify(table);
            const isBidOpportunities = tableName.includes('opportunities') || table === undefined;

            if (isBidOpportunities) {
              // Bid opportunities query
              return {
                limit: vi.fn(() =>
                  createTimedQuery(
                    'bid',
                    [
                      {
                        id: 'test-bid-id',
                        createdById: 'test-user-id',
                        status: 'draft',
                      },
                    ],
                    20
                  )
                ),
              };
            } else {
              // Bid documents query
              return createTimedQuery(
                'documents',
                [
                  {
                    id: 'doc-1',
                    bidId: 'test-bid-id',
                    inputType: 'freetext',
                    fileName: null,
                    rawInput: 'Test requirement document',
                    createdById: 'test-user-id',
                  },
                ],
                20
              );
            }
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    };

    vi.mock('@/db', () => ({
      db: mockDb,
    }));

    // Import after mocks are set up
    const { extractRequirements } = await import('@/app/actions/bids');

    // Execute the function
    const startTime = Date.now();
    await extractRequirements('test-bid-id');
    const totalTime = Date.now() - startTime;

    // Verify that both queries were called
    expect(mockDb.select).toHaveBeenCalledTimes(2);

    // Verify parallel execution by checking timing
    // Both queries should start at approximately the same time
    if (bidQueryStartTime && documentsQueryStartTime) {
      const timeDifference = Math.abs(bidQueryStartTime - documentsQueryStartTime);
      // Queries should start within 5ms of each other (parallel execution)
      expect(timeDifference).toBeLessThan(5);
    }

    // Total execution time should be close to single query time (20ms), not double (40ms)
    // Allow some overhead, so test for < 35ms
    expect(totalTime).toBeLessThan(35);
  });

  it('should handle errors in parallel queries correctly', async () => {
    const errorMessage = 'Database connection failed';

    mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(() => {
            const tableName = JSON.stringify(table);
            const isBidOpportunities = tableName.includes('opportunities') || table === undefined;

            if (isBidOpportunities) {
              return {
                limit: vi.fn(() => Promise.reject(new Error(errorMessage))),
              };
            } else {
              return Promise.resolve([
                {
                  id: 'doc-1',
                  bidId: 'test-bid-id',
                  inputType: 'freetext',
                  fileName: null,
                  rawInput: 'Test requirement document',
                  createdById: 'test-user-id',
                },
              ]);
            }
          }),
        })),
      })),
    };

    vi.mock('@/db', () => ({
      db: mockDb,
    }));

    const { extractRequirements } = await import('@/app/actions/bids');

    // Promise.all should reject if any query fails
    await expect(extractRequirements('test-bid-id')).rejects.toThrow(errorMessage);
  });

  it('should maintain same behavior as sequential queries', async () => {
    mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(() => {
            const tableName = JSON.stringify(table);
            const isBidOpportunities = tableName.includes('opportunities') || table === undefined;

            if (isBidOpportunities) {
              return {
                limit: vi.fn(() =>
                  Promise.resolve([
                    {
                      id: 'test-bid-id',
                      createdById: 'test-user-id',
                      status: 'draft',
                    },
                  ])
                ),
              };
            } else {
              return Promise.resolve([
                {
                  id: 'doc-1',
                  bidId: 'test-bid-id',
                  inputType: 'freetext',
                  fileName: null,
                  rawInput: 'Test requirement document',
                  createdById: 'test-user-id',
                },
              ]);
            }
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    };

    vi.mock('@/db', () => ({
      db: mockDb,
    }));

    const { extractRequirements } = await import('@/app/actions/bids');

    // Should complete successfully with both queries
    const result = await extractRequirements('test-bid-id');

    // Verify both queries were executed
    expect(mockDb.select).toHaveBeenCalledTimes(2);

    // Verify update was called (status change to 'extracting')
    expect(mockDb.update).toHaveBeenCalled();
  });
});
