import { beforeEach, describe, expect, it, vi } from 'vitest';

// TODO: Fix next-auth ESM module resolution issue with next/server
// Error: Cannot find module 'next/server' imported from next-auth/lib/env.js
// This is a vitest/next-auth compatibility issue, not a code issue
// eslint-disable-next-line vitest/no-disabled-tests
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/leads/[id]/pitchdeck/confirm-team/route';
import * as authModule from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, pitchdecks, users, employees, rfps, pitchdeckTeamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/db');
vi.mock('@/lib/admin/audit-actions', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/notifications/email', () => ({
  sendTeamNotificationEmails: vi.fn().mockResolvedValue(undefined),
}));

// Mock next/server's after function
vi.mock('next/server', async importOriginal => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((fn: () => void) => {
      // Execute immediately in tests instead of deferring
      fn();
    }),
  };
});

describe.skip('POST /api/leads/[id]/pitchdeck/confirm-team', () => {
  const mockLeadId = 'lead-123';
  const mockUserId = 'user-bl-1';
  const mockAdminUserId = 'user-admin-1';
  const mockBdUserId = 'user-bd-1';
  const mockPitchdeckId = 'pitchdeck-123';
  const mockRfpId = 'rfp-123';
  const mockEmployeeId1 = 'emp-1';
  const mockEmployeeId2 = 'emp-2';
  const mockBusinessUnitId = 'bu-1';

  const mockLead = {
    id: mockLeadId,
    rfpId: mockRfpId,
    businessUnitId: mockBusinessUnitId,
    projectDescription: 'Test project',
  };

  const mockPitchdeck = {
    id: mockPitchdeckId,
    leadId: mockLeadId,
    status: 'team_proposed' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBlUser = {
    id: mockUserId,
    email: 'bl@example.com',
    name: 'BL User',
    role: 'bl' as const,
    businessUnitId: mockBusinessUnitId,
  };

  const mockAdminUser = {
    id: mockAdminUserId,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin' as const,
    businessUnitId: null,
  };

  const mockBdUser = {
    id: mockBdUserId,
    email: 'bd@example.com',
    name: 'BD User',
    role: 'bd' as const,
    businessUnitId: mockBusinessUnitId,
  };

  const mockEmployee1 = {
    id: mockEmployeeId1,
    name: 'John Doe',
    email: 'john@example.com',
  };

  const mockEmployee2 = {
    id: mockEmployeeId2,
    name: 'Jane Smith',
    email: 'jane@example.com',
  };

  const mockRfp = {
    id: mockRfpId,
    extractedRequirements: JSON.stringify({
      customerName: 'Test Customer',
      projectDescription: 'Test Project Description',
    }),
  };

  const validTeamMembers = [
    { employeeId: mockEmployeeId1, role: 'pm' as const },
    { employeeId: mockEmployeeId2, role: 'frontend' as const },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as BL user
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: mockUserId },
      expires: '2099-01-01',
    });

    // Mock database queries - using chained mocks
    const createMockDbQuery = (returnValue: unknown) => ({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([returnValue]),
      returning: vi.fn().mockResolvedValue([returnValue]),
    });

    // Setup db.select() mocks for different tables
    vi.mocked(db.select).mockImplementation(() => {
      return {
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return createMockDbQuery(mockLead);
          }
          if (table === pitchdecks) {
            return createMockDbQuery(mockPitchdeck);
          }
          if (table === users) {
            return createMockDbQuery(mockBlUser);
          }
          if (table === employees) {
            // Return different employees based on employeeId
            return {
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([mockEmployee1]),
              })),
            };
          }
          if (table === rfps) {
            return createMockDbQuery(mockRfp);
          }
          return createMockDbQuery(null);
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    // Mock db.update()
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          ...mockPitchdeck,
          status: 'team_confirmed',
          teamConfirmedAt: new Date(),
          teamConfirmedByUserId: mockUserId,
        },
      ]),
    } as unknown as ReturnType<typeof db.update>);

    // Mock db.insert()
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.insert>);
  });

  const createRequest = (body: unknown) => {
    return {
      json: vi.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  const createParams = (id: string) => Promise.resolve({ id });

  describe('Authorization Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is BD role', async () => {
      // Mock BD user
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockLead]),
            };
          }
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockPitchdeck]),
            };
          }
          if (table === users) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockBdUser]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden: Only Business Line Leads can confirm team');
    });

    it('should return 200 when user is BL role with correct business unit', async () => {
      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should return 200 when user is Admin (override)', async () => {
      // Mock Admin user
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockLead]),
            };
          }
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockPitchdeck]),
            };
          }
          if (table === users) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockAdminUser]),
            };
          }
          if (table === employees) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockEmployee1]),
            };
          }
          if (table === rfps) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockRfp]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should return 403 when BL user tries to confirm team for different business unit', async () => {
      const differentBuLead = { ...mockLead, businessUnitId: 'different-bu' };

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([differentBuLead]),
            };
          }
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockPitchdeck]),
            };
          }
          if (table === users) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockBlUser]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe(
        'Forbidden: You can only confirm teams for leads in your Business Unit'
      );
    });
  });

  describe('Validation Tests', () => {
    it('should return 400 when lead ID is invalid', async () => {
      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams('') });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid lead ID');
    });

    it('should return 404 when lead is not found', async () => {
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockBlUser]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Lead not found');
    });

    it('should return 404 when pitchdeck is not found', async () => {
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockLead]),
            };
          }
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Pitchdeck not found for this lead');
    });

    it('should return 400 when team members are empty', async () => {
      const request = createRequest({ teamMembers: [] });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Team is incomplete');
    });

    it('should return 400 when pitchdeck status is invalid', async () => {
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockLead]),
            };
          }
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([{ ...mockPitchdeck, status: 'submitted' }]),
            };
          }
          if (table === users) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockBlUser]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid pitchdeck status');
    });
  });

  describe('Success Tests', () => {
    it('should successfully confirm team and return updated pitchdeck', async () => {
      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.pitchdeck.status).toBe('team_confirmed');
      expect(data.message).toBe('Team confirmed successfully');
    });

    it('should insert team members into database', async () => {
      const insertMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: insertMock,
      } as unknown as ReturnType<typeof db.insert>);

      const request = createRequest({ teamMembers: validTeamMembers });
      await POST(request, { params: createParams(mockLeadId) });

      expect(insertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            pitchdeckId: mockPitchdeckId,
            employeeId: mockEmployeeId1,
            role: 'pm',
          }),
        ])
      );
    });

    it('should update pitchdeck status to team_confirmed', async () => {
      const updateMock = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            ...mockPitchdeck,
            status: 'team_confirmed',
            teamConfirmedAt: new Date(),
            teamConfirmedByUserId: mockUserId,
          },
        ]),
      };

      vi.mocked(db.update).mockReturnValue(updateMock as unknown as ReturnType<typeof db.update>);

      const request = createRequest({ teamMembers: validTeamMembers });
      await POST(request, { params: createParams(mockLeadId) });

      expect(updateMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'team_confirmed',
          teamConfirmedByUserId: mockUserId,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing RFP gracefully', async () => {
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockLead]),
            };
          }
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockPitchdeck]),
            };
          }
          if (table === users) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockBlUser]),
            };
          }
          if (table === rfps) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('RFP not found');
    });

    it('should accept pitchdeck in draft status', async () => {
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === pitchdecks) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([{ ...mockPitchdeck, status: 'draft' }]),
            };
          }
          if (table === leads) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockLead]),
            };
          }
          if (table === users) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockBlUser]),
            };
          }
          if (table === employees) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockEmployee1]),
            };
          }
          if (table === rfps) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue([mockRfp]),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as unknown as typeof db.select;

      const request = createRequest({ teamMembers: validTeamMembers });
      const response = await POST(request, { params: createParams(mockLeadId) });

      expect(response.status).toBe(200);
    });
  });
});
