/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
 

/**
 * Tests for lib/bids/bid-decision-action.ts
 *
 * Tests the manual BID/NO-BID decision action that BD managers use to make decisions.
 * This is a critical server action that triggers downstream workflows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeBidDecision } from '../bid-decision-action';

// Mock all dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  rfps: {},
}));

vi.mock('@/lib/admin/audit-actions', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/workflow/orchestrator', () => ({
  handleBidDecision: vi.fn(),
}));

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleBidDecision } from '@/lib/workflow/orchestrator';

describe('makeBidDecision', () => {
  const mockUserId = 'user-123';
  const mockRfpId = 'rfp-456';
  const mockRfp = {
    id: mockRfpId,
    userId: mockUserId,
    status: 'bit_pending',
    title: 'Test RFP',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
      expect(auth).toHaveBeenCalledOnce();
    });

    it('should return error when session has no user', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: null } as never);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should return error when session has no user ID', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: {} } as never);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });
  });

  describe('RFP Validation', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);
    });

    it('should return error when RFP is not found', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'RFP nicht gefunden',
      });
      expect(db.select).toHaveBeenCalledOnce();
    });

    it('should return error when RFP belongs to different user', async () => {
      const otherUserRfp = { ...mockRfp, userId: 'other-user-789' };
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([otherUserRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'timeline',
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result.success).toBe(true);
      expect(handleBidDecision).toHaveBeenCalled();
    });

    it('should return error when RFP is not in bit_pending status', async () => {
      const rfpWrongStatus = { ...mockRfp, status: 'draft' };
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([rfpWrongStatus]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'RFP muss im Status "BID/NO-BID Entscheidung erforderlich" sein (aktuell: draft)',
      });
    });

    it('should accept RFP in bit_pending status', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'timeline',
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result.success).toBe(true);
    });
  });

  describe('BID Decision', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);
    });

    it('should handle BID decision successfully', async () => {
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'timeline',
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: true,
        decision: 'bid',
        nextAgent: 'timeline',
      });
      expect(handleBidDecision).toHaveBeenCalledWith(mockRfpId, 'bid');
      expect(createAuditLog).toHaveBeenCalledWith({
        action: 'bid_override',
        entityType: 'rfp',
        entityId: mockRfpId,
        previousValue: 'pending',
        newValue: 'bid',
        reason: 'Manual BID decision by BD Manager',
      });
    });

    it('should create audit log with correct action type', async () => {
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'timeline',
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      await makeBidDecision(mockRfpId, 'bid');

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'bid_override',
          entityType: 'rfp',
          entityId: mockRfpId,
        })
      );
    });
  });

  describe('NO-BID Decision', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);
    });

    it('should handle NO-BID decision successfully', async () => {
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: null,
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'no_bid');

      expect(result).toEqual({
        success: true,
        decision: 'no_bid',
        nextAgent: null,
      });
      expect(handleBidDecision).toHaveBeenCalledWith(mockRfpId, 'no_bid');
      expect(createAuditLog).toHaveBeenCalledWith({
        action: 'bid_override',
        entityType: 'rfp',
        entityId: mockRfpId,
        previousValue: 'pending',
        newValue: 'no_bid',
        reason: 'Manual NO_BID decision by BD Manager',
      });
    });
  });

  describe('Workflow Integration', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);
    });

    it('should pass through orchestrator result nextAgent', async () => {
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'team-assignment',
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result.nextAgent).toBe('team-assignment');
    });

    it('should handle orchestrator returning null nextAgent', async () => {
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: null,
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'no_bid');

      expect(result.nextAgent).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);
    });

    it('should handle database errors gracefully', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockRejectedValueOnce(new Error('DB connection failed')),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'DB connection failed',
      });
    });

    it('should handle orchestrator errors gracefully', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      vi.mocked(handleBidDecision).mockRejectedValueOnce(
        new Error('Orchestrator failed')
      );
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'Orchestrator failed',
      });
    });

    it('should NOT fail on audit log errors (non-blocking)', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'timeline',
      } as never);
      vi.mocked(createAuditLog).mockRejectedValueOnce(
        new Error('Audit log failed')
      );

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result.success).toBe(true);
      expect(result.decision).toBe('bid');
    });

    it('should handle non-Error objects in catch block', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockRejectedValueOnce('String error'),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      const result = await makeBidDecision(mockRfpId, 'bid');

      expect(result).toEqual({
        success: false,
        error: 'Unbekannter Fehler',
      });
    });
  });

  describe('Security', () => {
    it('should rely on database query for ownership validation', async () => {
      const attackerUserId = 'attacker-123';
      const victimRfpId = 'victim-rfp-789';

      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: attackerUserId },
      } as never);

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);

      const result = await makeBidDecision(victimRfpId, 'bid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RFP nicht gefunden');
      expect(handleBidDecision).not.toHaveBeenCalled();
    });
  });

  describe('Console Logging - Success Cases', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    beforeEach(() => {
      consoleErrorSpy.mockClear();
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([mockRfp]),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(mockSelect as never);
      vi.mocked(handleBidDecision).mockResolvedValueOnce({
        success: true,
        nextAgent: 'timeline',
      } as never);
      vi.mocked(createAuditLog).mockResolvedValueOnce(undefined);
    });

    afterAll(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log decision to console', async () => {
      await makeBidDecision(mockRfpId, 'bid');

      expect(console.error).toHaveBeenCalledWith(
        `[BID Decision Action] User ${mockUserId} decided "bid" for RFP ${mockRfpId}`
      );
    });

    it('should log NO-BID decision correctly', async () => {
      await makeBidDecision(mockRfpId, 'no_bid');

      expect(console.error).toHaveBeenCalledWith(
        `[BID Decision Action] User ${mockUserId} decided "no_bid" for RFP ${mockRfpId}`
      );
    });
  });

  describe('Console Logging - Error Cases', () => {
    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.clearAllMocks();

      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: mockUserId },
      } as never);

      const errorMockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockRejectedValueOnce(new Error('Test error')),
        })),
      }));
      vi.mocked(db.select).mockImplementationOnce(errorMockSelect as never);

      await makeBidDecision(mockRfpId, 'bid');

      expect(console.error).toHaveBeenCalledWith(
        '[BID Decision Action] Error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
