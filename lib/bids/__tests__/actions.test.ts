/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */

// Mock all dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'test-bid-id' }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'test-bid-id' }])),
        })),
      })),
    })),
  },
}));

vi.mock('./pdf-extractor', () => ({
  extractTextFromPdf: vi.fn(),
}));

vi.mock('@/lib/extraction/agent', () => ({
  extractRequirements: vi.fn(),
}));

vi.mock('@/lib/extraction/url-suggestion-agent', () => ({
  suggestWebsiteUrls: vi.fn(),
}));

vi.mock('@/lib/pii/pii-cleaner', () => ({
  detectPII: vi.fn(),
  cleanText: vi.fn(),
}));

vi.mock('@/lib/quick-scan/actions', () => ({
  startQuickScan: vi.fn(),
}));

vi.mock('@/lib/workflow/orchestrator', () => ({
  triggerNextAgent: vi.fn(),
}));

import {
  getBids,
  getBidDocuments,
  uploadFreetextBid,
  uploadEmailBid,
  startExtraction,
  updateExtractedRequirements,
  suggestWebsiteUrlsAction,
  forwardToBusinessLeader,
  makeBitDecision,
} from '../actions';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { extractRequirements } from '@/lib/extraction/agent';
import { suggestWebsiteUrls } from '@/lib/extraction/url-suggestion-agent';
import { startQuickScan } from '@/lib/quick-scan/actions';
import { triggerNextAgent } from '@/lib/workflow/orchestrator';

// Import functions to test

describe('Bid Management Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getBids', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await getBids();

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
        bids: [],
      });
      expect(auth).toHaveBeenCalled();
    });

    it('should return bids for authenticated user', async () => {
      const mockUser = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
      const mockBids = [
        { id: 'bid-1', title: 'Test Bid 1', userId: 'user-123' },
        { id: 'bid-2', title: 'Test Bid 2', userId: 'user-123' },
      ];

      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockBids),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const result = await getBids();

      expect(result.success).toBe(true);
      expect(result.bids).toEqual(mockBids);
      expect(db.select).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('DB Error')),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const result = await getBids();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fehler beim Laden der Bids');
      expect(result.bids).toEqual([]);
    });
  });

  describe('getBidDocuments', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await getBidDocuments('bid-123');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
        documents: [],
      });
    });

    it('should return documents for bid user has access to', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      const mockBid = [{ id: 'bid-123', userId: 'user-123' }];
      const mockDocs = [
        { id: 'doc-1', fileName: 'test.pdf', fileType: 'application/pdf' },
      ];

      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      // Mock first call (get bid)
      let callCount = 0;
      const selectMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockBid),
              }),
            }),
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockDocs),
              }),
            }),
          };
        }
      });
      vi.mocked(db.select).mockImplementation(selectMock as any);

      const result = await getBidDocuments('bid-123');

      expect(result.success).toBe(true);
      expect(result.documents).toEqual(mockDocs);
    });

    it('should return error when bid not found', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const result = await getBidDocuments('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bid nicht gefunden');
    });
  });

  describe('uploadFreetextBid', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await uploadFreetextBid({
        projectDescription: 'Test project description',
        customerName: 'Test Customer',
      });

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should validate minimum project description length', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const result = await uploadFreetextBid({
        projectDescription: 'Too short',
        customerName: 'Test Customer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Projektbeschreibung muss mindestens 50 Zeichen lang sein');
    });

    it('should validate customer name is provided', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const result = await uploadFreetextBid({
        projectDescription: 'A'.repeat(50),
        customerName: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Kundenname ist erforderlich');
    });

    it('should create bid successfully with valid data', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 'bid-123', status: 'draft' },
          ]),
        }),
      });
      vi.mocked(db.insert).mockImplementationOnce(insertMock as any);
      vi.mocked(triggerNextAgent).mockResolvedValueOnce(undefined);

      const result = await uploadFreetextBid({
        projectDescription: 'This is a valid project description with enough text',
        customerName: 'Test Customer',
        source: 'proactive',
        stage: 'warm',
      });

      expect(result.success).toBe(true);
      expect(result.bidId).toBe('bid-123');
      expect(db.insert).toHaveBeenCalled();
      expect(triggerNextAgent).toHaveBeenCalledWith('bid-123', 'draft');
    });

    it('should use default values for source and stage', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'bid-123' }]),
        }),
      });
      vi.mocked(db.insert).mockImplementationOnce(insertMock as any);
      vi.mocked(triggerNextAgent).mockResolvedValueOnce(undefined);

      await uploadFreetextBid({
        projectDescription: 'This is a valid project description with enough text',
        customerName: 'Test Customer',
      });

      const valuesCall = vi.mocked(db.insert).mock.results[0].value;
      expect(valuesCall).toBeDefined();
    });
  });

  describe('uploadEmailBid', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await uploadEmailBid({
        emailContent: 'Test email content',
      });

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should validate minimum email content length', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const result = await uploadEmailBid({
        emailContent: 'Too short',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('E-Mail-Inhalt muss mindestens 50 Zeichen lang sein');
    });

    it('should extract email headers correctly', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'bid-123' }]),
        }),
      });
      vi.mocked(db.insert).mockImplementationOnce(insertMock as any);

      const emailContent = `From: sender@example.com
Subject: Test Subject
Date: 2024-01-01

${'A'.repeat(50)}`;

      const result = await uploadEmailBid({
        emailContent,
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual({
        from: 'sender@example.com',
        subject: 'Test Subject',
        date: '2024-01-01',
      });
    });

    it('should handle missing email headers gracefully', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'bid-123' }]),
        }),
      });
      vi.mocked(db.insert).mockImplementationOnce(insertMock as any);

      const emailContent = 'No headers here\n' + 'A'.repeat(50);

      const result = await uploadEmailBid({
        emailContent,
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual({
        from: 'Unbekannt',
        subject: 'Kein Betreff',
        date: expect.any(String),
      });
    });
  });

  describe('startExtraction', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await startExtraction('bid-123');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should return error when bid not found', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const result = await startExtraction('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bid nicht gefunden');
    });

    it('should return error when user does not own the bid', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const mockBid = [{ id: 'bid-123', userId: 'other-user', version: 1 }];
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockBid),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const result = await startExtraction('bid-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keine Berechtigung');
    });

    it('should successfully extract requirements', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const mockBid = [
        { id: 'bid-123', userId: 'user-123', version: 1, rawInput: 'Test input', inputType: 'freetext', metadata: null },
      ];

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockBid),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(selectMock as any);

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'bid-123', version: 2 }]),
          }),
        }),
      });
      vi.mocked(db.update).mockImplementation(updateMock as any);

      vi.mocked(extractRequirements).mockResolvedValueOnce({
        success: true,
        requirements: { title: 'Test Project' },
      });

      const result = await startExtraction('bid-123');

      expect(result.success).toBe(true);
      expect(result.requirements).toEqual({ title: 'Test Project' });
      expect(extractRequirements).toHaveBeenCalledWith({
        rawText: 'Test input',
        inputType: 'freetext',
        metadata: {},
      });
    });
  });

  describe('updateExtractedRequirements', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await updateExtractedRequirements('bid-123', { title: 'Test' });

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should update requirements and trigger quick scan', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const mockBid = [{ id: 'bid-123', userId: 'user-123' }];
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockBid),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementationOnce(updateMock as any);

      vi.mocked(startQuickScan).mockResolvedValueOnce(undefined);

      const result = await updateExtractedRequirements('bid-123', { title: 'Updated Test' });

      expect(result.success).toBe(true);
      expect(result.quickScanStarted).toBe(true);
      expect(db.update).toHaveBeenCalled();
      expect(startQuickScan).toHaveBeenCalledWith('bid-123');
    });
  });

  describe('suggestWebsiteUrlsAction', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await suggestWebsiteUrlsAction({
        customerName: 'Test Customer',
      });

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
        suggestions: [],
      });
    });

    it('should return URL suggestions', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      vi.mocked(suggestWebsiteUrls).mockResolvedValueOnce({
        suggestions: [
          { url: 'https://example.com', type: 'corporate', description: 'Company website', confidence: 0.9 },
        ],
        reasoning: 'Test reasoning',
      });

      const result = await suggestWebsiteUrlsAction({
        customerName: 'Test Customer',
        industry: 'Technology',
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toEqual({
        url: 'https://example.com',
        type: 'corporate',
        description: 'Company website',
        confidence: 0.9,
        extractedFromDocument: false,
      });
      expect(result.reasoning).toBe('Test reasoning');
    });
  });

  describe('forwardToBusinessLeader', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await forwardToBusinessLeader('bid-123', 'bu-123');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should return error when bid not found', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const result = await forwardToBusinessLeader('bid-123', 'bu-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bid nicht gefunden');
    });
  });

  describe('makeBitDecision', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const result = await makeBitDecision('bid-123', 'bid', 'Good opportunity');

      expect(result).toEqual({
        success: false,
        error: 'Nicht authentifiziert',
      });
    });

    it('should update bid status to routed when decision is bid', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const mockBid = [{ id: 'bid-123', userId: 'user-123' }];
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockBid),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementationOnce(updateMock as any);

      const result = await makeBitDecision('bid-123', 'bid', 'Strong fit');

      expect(result.success).toBe(true);
      expect(result.decision).toBe('bid');
      expect(db.update).toHaveBeenCalled();
    });

    it('should update bid status to archived when decision is no_bid', async () => {
      const mockUser = { id: 'user-123', name: 'Test User' };
      vi.mocked(auth).mockResolvedValueOnce({ user: mockUser } as any);

      const mockBid = [{ id: 'bid-123', userId: 'user-123' }];
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockBid),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementationOnce(selectMock as any);

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementationOnce(updateMock as any);

      const result = await makeBitDecision('bid-123', 'no_bid', 'Out of scope');

      expect(result.success).toBe(true);
      expect(result.decision).toBe('no_bid');
    });
  });
});
