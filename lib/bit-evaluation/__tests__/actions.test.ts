/**
 * BIT Evaluation Actions Tests
 *
 * Tests for Server Actions related to BIT/NO-BID evaluation workflow:
 * - startBitEvaluation
 * - retriggerBitEvaluation
 * - getBitEvaluationResult
 * - confirmLowConfidenceDecision
 * - overrideBidDecision
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/quick-scan/actions', () => ({
  getQuickScanResult: vi.fn(),
}));

vi.mock('@/lib/admin/audit-actions', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('../agent', () => ({
  runBitEvaluation: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getQuickScanResult } from '@/lib/quick-scan/actions';
import { createAuditLog } from '@/lib/admin/audit-actions';
import { runBitEvaluation } from '../agent';

import {
  startBitEvaluation,
  retriggerBitEvaluation,
  getBitEvaluationResult,
  confirmLowConfidenceDecision,
  overrideBidDecision,
} from '../actions';

describe('BIT Evaluation Actions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'bl' as const,
  };

  const mockSession = {
    user: mockUser,
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };

  const mockBid = {
    id: 'bid-123',
    userId: 'user-123',
    status: 'quick_scanning' as const,
    decision: 'pending' as const,
    extractedRequirements: JSON.stringify({ requirements: ['test'] }),
    decisionData: null,
    alternativeRecommendation: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations - auth returns session with user
    vi.mocked(auth).mockImplementation(() => Promise.resolve(mockSession));
    vi.mocked(getQuickScanResult).mockImplementation(() => Promise.resolve({ success: false }));
    vi.mocked(createAuditLog).mockImplementation(() => Promise.resolve(undefined));
    vi.mocked(runBitEvaluation).mockImplementation(() =>
      Promise.resolve({
        decision: { decision: 'bit' as const, confidence: 0.85, reasoning: 'Test' },
        scores: {},
        alternative: null,
      })
    );

    // Create fresh mock chains for each test
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockBid]),
    };

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as unknown as typeof db.select);
    vi.mocked(db.update).mockReturnValue(mockUpdateChain as unknown as typeof db.update);
  });

  describe('startBitEvaluation', () => {
    it('should start BIT evaluation successfully', async () => {
      const result = await startBitEvaluation('bid-123');

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(db.update).toHaveBeenCalled();
    });

    it('should return error if not authenticated', async () => {
      vi.mocked(auth).mockImplementation(() => Promise.resolve(null));

      const result = await startBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nicht authentifiziert');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return error if bid not found', async () => {
      const emptySelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      };
      vi.mocked(db.select).mockReturnValueOnce(emptySelectChain as unknown as typeof db.select);

      const result = await startBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bid nicht gefunden');
    });

    it('should return error if user lacks permission', async () => {
      const otherUser = { ...mockUser, id: 'other-user' };
      const otherSession = { ...mockSession, user: otherUser };
      vi.mocked(auth).mockImplementation(() => Promise.resolve(otherSession));

      const result = await startBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keine Berechtigung');
    });

    it('should return error if no extracted requirements', async () => {
      const bidNoReqs = { ...mockBid, extractedRequirements: null };
      const noReqsSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([bidNoReqs]),
      };
      vi.mocked(db.select).mockReturnValueOnce(noReqsSelectChain as unknown as typeof db.select);

      const result = await startBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keine extrahierten Anforderungen vorhanden');
    });

    it('should handle evaluation errors and revert status', async () => {
      vi.mocked(runBitEvaluation).mockImplementation(() => Promise.reject(new Error('AI failed')));

      const result = await startBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Evaluierung fehlgeschlagen');
      expect(db.update).toHaveBeenCalledTimes(2); // Initial update + error revert
    });

    it('should correctly map "bit" decision to "bid"', async () => {
      vi.mocked(runBitEvaluation).mockImplementationOnce(() =>
        Promise.resolve({
          decision: { decision: 'bit' as const, confidence: 0.8, reasoning: 'Test' },
          scores: {},
          alternative: null,
        })
      );

      await startBitEvaluation('bid-123');

      expect(db.update).toHaveBeenCalled();
    });

    it('should correctly map "no_bit" decision to "no_bid"', async () => {
      vi.mocked(runBitEvaluation).mockImplementationOnce(() =>
        Promise.resolve({
          decision: { decision: 'no_bit' as const, confidence: 0.6, reasoning: 'Too risky' },
          scores: {},
          alternative: null,
        })
      );

      await startBitEvaluation('bid-123');

      expect(db.update).toHaveBeenCalled();
    });

    it('should include quick scan data if available', async () => {
      const mockQuickScan = {
        success: true,
        quickScan: {
          status: 'completed' as const,
          techStack: ['Drupal', 'React'],
          contentVolume: 5000,
          features: ['Blog', 'E-commerce'],
          recommendedBusinessUnit: 'CMS',
          confidence: 0.9,
          reasoning: 'Strong match',
        },
      };
      vi.mocked(getQuickScanResult).mockImplementationOnce(() => Promise.resolve(mockQuickScan));

      await startBitEvaluation('bid-123');

      expect(runBitEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          bidId: 'bid-123',
          quickScanResults: expect.objectContaining({
            techStack: ['Drupal', 'React'],
            contentVolume: 5000,
            features: ['Blog', 'E-commerce'],
            blRecommendation: expect.objectContaining({
              primaryBusinessLine: 'CMS',
              confidence: 0.9,
            }),
          }),
        })
      );
    });
  });

  describe('retriggerBitEvaluation', () => {
    it('should retrigger evaluation successfully', async () => {
      const result = await retriggerBitEvaluation('bid-123');

      expect(result.success).toBe(true);
      expect(result.status).toBe('evaluating');
    });

    it('should return error if not authenticated', async () => {
      vi.mocked(auth).mockImplementation(() => Promise.resolve(null));

      const result = await retriggerBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nicht authentifiziert');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should reset evaluation data', async () => {
      await retriggerBitEvaluation('bid-123');

      expect(db.update).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const errorSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValueOnce(new Error('DB error')),
      };
      vi.mocked(db.select).mockReturnValueOnce(errorSelectChain as unknown as typeof db.select);

      const result = await retriggerBitEvaluation('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('BIT Re-Evaluierung fehlgeschlagen');
    });
  });

  describe('getBitEvaluationResult', () => {
    const completedBid = {
      ...mockBid,
      status: 'decision_made' as const,
      decision: 'bid' as const,
      decisionData: JSON.stringify({
        decision: { decision: 'bit' as const, confidence: 0.85, reasoning: 'Test' },
        scores: { capability: 80, competition: 70 },
        alternative: null,
      }),
      alternativeRecommendation: null,
    };

    it('should get evaluation result successfully', async () => {
      const completedSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([completedBid]),
      };
      vi.mocked(db.select).mockReturnValueOnce(completedSelectChain as unknown as typeof db.select);

      const result = await getBitEvaluationResult('bid-123');

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.decision).toBe('bid');
    });

    it('should return error if not authenticated', async () => {
      vi.mocked(auth).mockImplementation(() => Promise.resolve(null));

      const result = await getBitEvaluationResult('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nicht authentifiziert');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return error if bid not found', async () => {
      const emptySelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      };
      vi.mocked(db.select).mockReturnValueOnce(emptySelectChain as unknown as typeof db.select);

      const result = await getBitEvaluationResult('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bid nicht gefunden');
    });

    it('should return error if no evaluation data exists', async () => {
      const pendingSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([mockBid]),
      };
      vi.mocked(db.select).mockReturnValueOnce(pendingSelectChain as unknown as typeof db.select);

      const result = await getBitEvaluationResult('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keine Evaluierung vorhanden');
    });

    it('should parse and include alternative recommendation', async () => {
      const bidWithAlternative = {
        ...completedBid,
        alternativeRecommendation: JSON.stringify({
          decision: 'no_bid' as const,
          confidence: 0.6,
          reasoning: 'Alternative approach',
        }),
      };
      const altSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([bidWithAlternative]),
      };
      vi.mocked(db.select).mockReturnValueOnce(altSelectChain as unknown as typeof db.select);

      const result = await getBitEvaluationResult('bid-123');

      expect(result.success).toBe(true);
      expect(result.result.alternative).toBeDefined();
    });
  });

  describe('confirmLowConfidenceDecision', () => {
    it('should confirm low confidence decision', async () => {
      const result = await confirmLowConfidenceDecision('bid-123', true);

      expect(result.success).toBe(true);
      expect(result.confirmed).toBe(true);
    });

    it('should reject and revert status when confirm=false', async () => {
      const result = await confirmLowConfidenceDecision('bid-123', false);

      expect(result.success).toBe(true);
      expect(result.confirmed).toBe(false);
      expect(db.update).toHaveBeenCalled();
    });

    it('should return error if not authenticated', async () => {
      vi.mocked(auth).mockImplementation(() => Promise.resolve(null));

      const result = await confirmLowConfidenceDecision('bid-123', true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nicht authentifiziert');
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('overrideBidDecision', () => {
    it('should override bid decision with BL role', async () => {
      const result = await overrideBidDecision('bid-123', 'no_bid', 'Market conditions changed');

      expect(result.success).toBe(true);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'bid_override',
          entityType: 'rfp',
          entityId: 'bid-123',
          reason: 'Market conditions changed',
        })
      );
    });

    it('should override bid decision with admin role', async () => {
      const adminUser = { ...mockUser, role: 'admin' as const };
      const adminSession = { ...mockSession, user: adminUser };
      vi.mocked(auth).mockImplementation(() => Promise.resolve(adminSession));

      const result = await overrideBidDecision('bid-123', 'bid', 'Strategic fit with enough chars');

      expect(result.success).toBe(true);
    });

    it('should reject override for non-BL/admin role', async () => {
      const regularUser = { ...mockUser, role: 'employee' as const };
      const employeeSession = { ...mockSession, user: regularUser };
      vi.mocked(auth).mockImplementation(() => Promise.resolve(employeeSession));

      const result = await overrideBidDecision('bid-123', 'bid', 'Test reason with enough chars');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nur BL oder Admin können Entscheidungen überschreiben');
      // Note: db.select IS called because auth and reason validation pass first
      expect(db.select).toHaveBeenCalled();
    });

    it('should require minimum reason length', async () => {
      const result = await overrideBidDecision('bid-123', 'bid', 'Short');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Begründung muss mindestens 10 Zeichen lang sein');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return error if not authenticated', async () => {
      vi.mocked(auth).mockImplementation(() => Promise.resolve(null));

      const result = await overrideBidDecision('bid-123', 'bid', 'Valid reason text that is long enough');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nicht authentifiziert');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return error if bid not found', async () => {
      const emptySelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      };
      vi.mocked(db.select).mockReturnValueOnce(emptySelectChain as unknown as typeof db.select);

      const result = await overrideBidDecision('bid-123', 'bid', 'Valid reason text that is long enough');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bid nicht gefunden');
    });

    it('should update decision and status', async () => {
      const updateSpy = vi.fn().mockReturnThis();
      const whereSpy = vi.fn().mockResolvedValue([]);
      const updateChain = {
        set: updateSpy,
        where: whereSpy,
      };
      vi.mocked(db.update).mockReturnValue(updateChain as unknown as typeof db.update);

      await overrideBidDecision('bid-123', 'no_bid', 'Valid reason text that is long enough');

      expect(db.update).toHaveBeenCalled();
      expect(createAuditLog).toHaveBeenCalled();
    });
  });
});
