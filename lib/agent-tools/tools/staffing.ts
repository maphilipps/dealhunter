import { z } from 'zod';
import { db } from '@/lib/db';
import { employees, businessUnits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

/**
 * Calculate skill match score for an employee against required skills
 * Uses the enhanced matching algorithm from DEA-10
 */
const calculateSkillMatchInputSchema = z.object({
  employeeId: z.string(),
  requiredSkills: z.object({
    cms: z.string().optional(),
    framework: z.string().optional(),
    integrations: z.array(z.string()).default([]),
    complexitySkills: z
      .object({
        animations: z.boolean().default(false),
        i18n: z.boolean().default(false),
        complexComponents: z.boolean().default(false),
      })
      .optional(),
    techStack: z.array(z.string()).default([]),
  }),
});

registry.register({
  name: 'staffing.calculateSkillMatch',
  description:
    'Calculate skill match score (0-100) for an employee against required skills using enhanced matching algorithm',
  category: 'staffing',
  inputSchema: calculateSkillMatchInputSchema,
  async execute(input, context: ToolContext) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);

    if (!employee) {
      return { success: false, error: 'Employee not found' };
    }

    const employeeSkills: string[] = JSON.parse(employee.skills);
    const employeeSkillsLower = employeeSkills.map(s => s.toLowerCase());

    let score = 0;
    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];

    // CMS Exact Match (+30 points) - CRITICAL
    if (input.requiredSkills.cms) {
      const cmsLower = input.requiredSkills.cms.toLowerCase();
      const hasCmsMatch = employeeSkillsLower.some(
        skill => skill === cmsLower || skill.includes(cmsLower) || cmsLower.includes(skill)
      );

      if (hasCmsMatch) {
        score += 30;
        matchingSkills.push(input.requiredSkills.cms);
      } else {
        missingSkills.push(input.requiredSkills.cms);
      }
    }

    // Framework Match (+20 points)
    if (input.requiredSkills.framework) {
      const frameworkLower = input.requiredSkills.framework.toLowerCase();
      const hasFrameworkMatch = employeeSkillsLower.some(
        skill =>
          skill === frameworkLower ||
          skill.includes(frameworkLower) ||
          frameworkLower.includes(skill)
      );

      if (hasFrameworkMatch) {
        score += 20;
        matchingSkills.push(input.requiredSkills.framework);
      } else {
        missingSkills.push(input.requiredSkills.framework);
      }
    }

    // Integration Skills (+15 points each)
    for (const integration of input.requiredSkills.integrations) {
      const integrationLower = integration.toLowerCase();
      const hasMatch = employeeSkillsLower.some(
        skill =>
          skill === integrationLower ||
          skill.includes(integrationLower) ||
          integrationLower.includes(skill)
      );

      if (hasMatch) {
        score += 15;
        matchingSkills.push(integration);
      } else {
        missingSkills.push(integration);
      }
    }

    // Complexity Skills (+10 points each)
    const complexitySkills = input.requiredSkills.complexitySkills;
    if (complexitySkills) {
      if (complexitySkills.animations) {
        const hasAnimationSkills = employeeSkillsLower.some(
          skill =>
            skill.includes('gsap') || skill.includes('animation') || skill.includes('framer-motion')
        );

        if (hasAnimationSkills) {
          score += 10;
          matchingSkills.push('animations');
        } else {
          missingSkills.push('animations (GSAP/framer-motion)');
        }
      }

      if (complexitySkills.i18n) {
        const hasI18nSkills = employeeSkillsLower.some(
          skill =>
            skill.includes('i18n') ||
            skill.includes('translation') ||
            skill.includes('multilingual')
        );

        if (hasI18nSkills) {
          score += 10;
          matchingSkills.push('i18n');
        } else {
          missingSkills.push('i18n/translation-mgmt');
        }
      }

      if (complexitySkills.complexComponents) {
        const hasAdvancedSkills = employeeSkillsLower.some(
          skill =>
            skill.includes('advanced') ||
            skill.includes('architecture') ||
            skill.includes('design-patterns')
        );

        if (hasAdvancedSkills) {
          score += 10;
          matchingSkills.push('complex components');
        } else {
          missingSkills.push('advanced component architecture');
        }
      }
    }

    // Tech Stack Match (+5 points each)
    for (const tech of input.requiredSkills.techStack) {
      const techLower = tech.toLowerCase();
      const hasMatch = employeeSkillsLower.some(
        skill => skill === techLower || skill.includes(techLower) || techLower.includes(skill)
      );

      if (hasMatch) {
        score += 5;
        matchingSkills.push(tech);
      }
    }

    // Availability Modifier
    if (employee.availabilityStatus === 'available') {
      score += 10;
    } else if (employee.availabilityStatus === 'on_project') {
      score += 5;
    } else if (employee.availabilityStatus === 'unavailable') {
      score -= 10;
    }

    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    return {
      success: true,
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        skillMatchScore: score,
        matchingSkills: [...new Set(matchingSkills)], // Remove duplicates
        missingSkills: [...new Set(missingSkills)],
        availabilityStatus: employee.availabilityStatus,
      },
    };
  },
});

/**
 * Find employees by required skills with match scores
 */
const findEmployeesBySkillsInputSchema = z.object({
  businessUnitId: z.string(),
  requiredSkills: z.object({
    cms: z.string().optional(),
    framework: z.string().optional(),
    integrations: z.array(z.string()).default([]),
    complexitySkills: z
      .object({
        animations: z.boolean().default(false),
        i18n: z.boolean().default(false),
        complexComponents: z.boolean().default(false),
      })
      .optional(),
    techStack: z.array(z.string()).default([]),
  }),
  minMatchScore: z.number().min(0).max(100).default(50),
  limit: z.number().min(1).max(50).default(20),
});

registry.register({
  name: 'staffing.findEmployeesBySkills',
  description: 'Find employees by required skills and return them sorted by match score',
  category: 'staffing',
  inputSchema: findEmployeesBySkillsInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin' && context.userRole !== 'bl') {
      return { success: false, error: 'Nur Admin oder BL kann Mitarbeiter suchen' };
    }

    // Get all employees from the business unit
    const employeesList = await db
      .select()
      .from(employees)
      .where(eq(employees.businessUnitId, input.businessUnitId))
      .limit(input.limit);

    // Calculate match scores for each employee
    const employeesWithScores = [];

    for (const emp of employeesList) {
      const matchResult = await registry.execute(
        'staffing.calculateSkillMatch',
        {
          employeeId: emp.id,
          requiredSkills: input.requiredSkills,
        },
        context
      );

      if (matchResult.success && matchResult.data) {
        const data = matchResult.data as {
          skillMatchScore: number;
          matchingSkills: string[];
          missingSkills: string[];
        };

        if (data.skillMatchScore >= input.minMatchScore) {
          employeesWithScores.push({
            employee: emp,
            matchScore: data.skillMatchScore,
            matchingSkills: data.matchingSkills,
            missingSkills: data.missingSkills,
          });
        }
      }
    }

    // Sort by match score (highest first)
    employeesWithScores.sort((a, b) => b.matchScore - a.matchScore);

    return {
      success: true,
      data: {
        matches: employeesWithScores,
        totalFound: employeesWithScores.length,
      },
    };
  },
});

/**
 * Check availability of employees
 */
const checkEmployeeAvailabilityInputSchema = z.object({
  employeeIds: z.array(z.string()),
});

registry.register({
  name: 'staffing.checkAvailability',
  description: 'Check availability status of multiple employees',
  category: 'staffing',
  inputSchema: checkEmployeeAvailabilityInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin' && context.userRole !== 'bl') {
      return { success: false, error: 'Nur Admin oder BL kann Verfügbarkeit prüfen' };
    }

    const availabilityData = [];

    for (const empId of input.employeeIds) {
      const [emp] = await db.select().from(employees).where(eq(employees.id, empId)).limit(1);

      if (emp) {
        availabilityData.push({
          employeeId: emp.id,
          name: emp.name,
          email: emp.email,
          availabilityStatus: emp.availabilityStatus,
          skills: JSON.parse(emp.skills),
          roles: JSON.parse(emp.roles),
        });
      }
    }

    return {
      success: true,
      data: {
        employees: availabilityData,
        availableCount: availabilityData.filter(e => e.availabilityStatus === 'available').length,
        onProjectCount: availabilityData.filter(e => e.availabilityStatus === 'on_project').length,
        unavailableCount: availabilityData.filter(e => e.availabilityStatus === 'unavailable')
          .length,
      },
    };
  },
});
