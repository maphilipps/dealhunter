import { describe, it, expect, beforeEach, vi } from 'vitest';

import { registry } from '../../registry';
import type { ToolContext } from '../../types';

import { db } from '@/lib/db';
import { employees, businessUnits } from '@/lib/db/schema';

// Import the staffing tools to register them
import '../staffing';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Staffing Tools', () => {
  const mockContext: ToolContext = {
    userId: 'test-user-id',
    userRole: 'bl',
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
  };

  const mockEmployee = {
    id: 'emp-1',
    name: 'John Doe',
    email: 'john@example.com',
    businessUnitId: 'bu-1',
    skills: JSON.stringify(['React', 'Next.js', 'TypeScript', 'Drupal', 'GSAP']),
    roles: JSON.stringify(['Frontend Developer']),
    availabilityStatus: 'available' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployeeOnProject = {
    id: 'emp-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    businessUnitId: 'bu-1',
    skills: JSON.stringify(['Vue.js', 'Nuxt', 'TypeScript', 'Contentful']),
    roles: JSON.stringify(['Frontend Developer']),
    availabilityStatus: 'on_project' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployeeUnavailable = {
    id: 'emp-3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    businessUnitId: 'bu-1',
    skills: JSON.stringify(['Angular', 'Java', 'Spring']),
    roles: JSON.stringify(['Full Stack Developer']),
    availabilityStatus: 'unavailable' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('staffing.calculateSkillMatch', () => {
    it('should return error when employee not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'non-existent',
          requiredSkills: {
            cms: 'Drupal',
          },
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found');
    });

    it('should calculate high score for perfect CMS match', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            cms: 'Drupal',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.skillMatchScore).toBeGreaterThanOrEqual(30); // CMS match + availability
      expect(result.data.matchingSkills).toContain('Drupal');
    });

    it('should calculate score for framework match', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            framework: 'Next.js',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.skillMatchScore).toBeGreaterThanOrEqual(20); // Framework match + availability
      expect(result.data.matchingSkills).toContain('Next.js');
    });

    it('should calculate score for multiple integrations', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            integrations: ['TypeScript', 'React'],
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.skillMatchScore).toBeGreaterThanOrEqual(30); // 2x15 points + availability
      expect(result.data.matchingSkills).toContain('TypeScript');
      expect(result.data.matchingSkills).toContain('React');
    });

    it('should calculate score for complexity skills - animations', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            complexitySkills: {
              animations: true,
            },
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.skillMatchScore).toBeGreaterThanOrEqual(10); // Animation skills + availability
      expect(result.data.matchingSkills).toContain('animations');
    });

    it('should track missing skills', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            cms: 'WordPress',
            framework: 'Angular',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.missingSkills).toContain('WordPress');
      expect(result.data.missingSkills).toContain('Angular');
    });

    it('should apply availability modifier - available', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            cms: 'Drupal',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // Score should include +10 for availability
      expect(result.data.skillMatchScore).toBe(40); // 30 (CMS) + 10 (available)
    });

    it('should apply availability modifier - on_project', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployeeOnProject]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-2',
          requiredSkills: {
            framework: 'Vue.js',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // Score should include +5 for on_project
      expect(result.data.skillMatchScore).toBe(25); // 20 (framework) + 5 (on_project)
    });

    it('should apply availability modifier - unavailable (negative)', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployeeUnavailable]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-3',
          requiredSkills: {
            framework: 'Angular',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // Score should include -10 for unavailable
      expect(result.data.skillMatchScore).toBe(10); // 20 (framework) - 10 (unavailable)
    });

    it('should cap score at 100', async () => {
      const superEmployee = {
        ...mockEmployee,
        skills: JSON.stringify([
          'React',
          'Next.js',
          'TypeScript',
          'Drupal',
          'GSAP',
          'i18n',
          'architecture',
          'design-patterns',
          'REST',
          'GraphQL',
          'Docker',
          'AWS',
        ]),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([superEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            cms: 'Drupal',
            framework: 'Next.js',
            integrations: ['TypeScript', 'GraphQL', 'REST'],
            complexitySkills: {
              animations: true,
              i18n: true,
              complexComponents: true,
            },
            techStack: ['Docker', 'AWS', 'React'],
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.skillMatchScore).toBeLessThanOrEqual(100);
    });

    it('should not go below 0 score', async () => {
      const noMatchEmployee = {
        ...mockEmployeeUnavailable,
        skills: JSON.stringify(['Java', 'Spring']),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([noMatchEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-3',
          requiredSkills: {
            cms: 'Drupal',
            framework: 'React',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.skillMatchScore).toBeGreaterThanOrEqual(0);
    });

    it('should deduplicate matching skills', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: 'emp-1',
          requiredSkills: {
            integrations: ['TypeScript'],
            techStack: ['TypeScript'],
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      const typeScriptCount = result.data.matchingSkills.filter(
        (s: string) => s === 'TypeScript'
      ).length;
      expect(typeScriptCount).toBe(1);
    });
  });

  describe('staffing.findEmployeesBySkills', () => {
    it('should return error for non-admin/non-bl users', async () => {
      const bdContext: ToolContext = {
        ...mockContext,
        userRole: 'bd',
      };

      const result = await registry.execute(
        'staffing.findEmployeesBySkills',
        {
          businessUnitId: 'bu-1',
          requiredSkills: {
            cms: 'Drupal',
          },
        },
        bdContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nur Admin oder BL kann Mitarbeiter suchen');
    });

    it('should find and sort employees by match score', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee, mockEmployeeOnProject]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.findEmployeesBySkills',
        {
          businessUnitId: 'bu-1',
          requiredSkills: {
            cms: 'Drupal',
          },
          minMatchScore: 30,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.matches).toBeDefined();
      expect(result.data.totalFound).toBeGreaterThanOrEqual(0);

      // Verify sorting (highest score first)
      if (result.data.matches.length > 1) {
        for (let i = 0; i < result.data.matches.length - 1; i++) {
          expect(result.data.matches[i].matchScore).toBeGreaterThanOrEqual(
            result.data.matches[i + 1].matchScore
          );
        }
      }
    });

    it('should filter by minimum match score', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee, mockEmployeeOnProject]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.findEmployeesBySkills',
        {
          businessUnitId: 'bu-1',
          requiredSkills: {
            cms: 'Drupal',
          },
          minMatchScore: 90, // Very high threshold
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // With high threshold, we expect fewer or no matches
      result.data.matches.forEach((match: { matchScore: number }) => {
        expect(match.matchScore).toBeGreaterThanOrEqual(90);
      });
    });

    it('should handle empty employee list', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.findEmployeesBySkills',
        {
          businessUnitId: 'bu-empty',
          requiredSkills: {
            cms: 'Drupal',
          },
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.matches).toHaveLength(0);
      expect(result.data.totalFound).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const manyEmployees = Array.from({ length: 50 }, (_, i) => ({
        ...mockEmployee,
        id: `emp-${i}`,
      }));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(manyEmployees.slice(0, 10)),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.findEmployeesBySkills',
        {
          businessUnitId: 'bu-1',
          requiredSkills: {
            cms: 'Drupal',
          },
          limit: 10,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // Should not exceed limit
      expect(result.data.matches.length).toBeLessThanOrEqual(10);
    });

    it('should allow admin role', async () => {
      const adminContext: ToolContext = {
        ...mockContext,
        userRole: 'admin',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.findEmployeesBySkills',
        {
          businessUnitId: 'bu-1',
          requiredSkills: {
            cms: 'Drupal',
          },
        },
        adminContext
      );

      expect(result.success).toBe(true);
    });
  });

  describe('staffing.checkAvailability', () => {
    it('should return error for non-admin/non-bl users', async () => {
      const bdContext: ToolContext = {
        ...mockContext,
        userRole: 'bd',
      };

      const result = await registry.execute(
        'staffing.checkAvailability',
        {
          employeeIds: ['emp-1'],
        },
        bdContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nur Admin oder BL kann Verfügbarkeit prüfen');
    });

    it('should check availability of multiple employees', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockEmployee]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockEmployeeOnProject]),
            }),
          }),
        } as never);

      const result = await registry.execute(
        'staffing.checkAvailability',
        {
          employeeIds: ['emp-1', 'emp-2'],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.employees).toHaveLength(2);
      expect(result.data.availableCount).toBe(1);
      expect(result.data.onProjectCount).toBe(1);
      expect(result.data.unavailableCount).toBe(0);
    });

    it('should count availability statuses correctly', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockEmployee]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockEmployeeOnProject]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockEmployeeUnavailable]),
            }),
          }),
        } as never);

      const result = await registry.execute(
        'staffing.checkAvailability',
        {
          employeeIds: ['emp-1', 'emp-2', 'emp-3'],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.availableCount).toBe(1);
      expect(result.data.onProjectCount).toBe(1);
      expect(result.data.unavailableCount).toBe(1);
    });

    it('should skip non-existent employees', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockEmployee]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never);

      const result = await registry.execute(
        'staffing.checkAvailability',
        {
          employeeIds: ['emp-1', 'non-existent'],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.employees).toHaveLength(1);
    });

    it('should include employee details', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockEmployee]),
          }),
        }),
      } as never);

      const result = await registry.execute(
        'staffing.checkAvailability',
        {
          employeeIds: ['emp-1'],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.employees[0]).toMatchObject({
        employeeId: 'emp-1',
        name: 'John Doe',
        email: 'john@example.com',
        availabilityStatus: 'available',
      });
      expect(result.data.employees[0].skills).toBeDefined();
      expect(result.data.employees[0].roles).toBeDefined();
    });

    it('should handle empty employee list', async () => {
      const result = await registry.execute(
        'staffing.checkAvailability',
        {
          employeeIds: [],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.employees).toHaveLength(0);
      expect(result.data.availableCount).toBe(0);
      expect(result.data.onProjectCount).toBe(0);
      expect(result.data.unavailableCount).toBe(0);
    });
  });
});
