import { eq, desc, and, count } from 'drizzle-orm';

import { listToolsForAgent, getToolsByCategory } from '@/lib/agent-tools';
import { db } from '@/lib/db';
import {
  rfps,
  accounts,
  references,
  competencies,
  businessUnits,
  employees,
  technologies,
} from '@/lib/db/schema';

export interface AgentContext {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'bd' | 'bl' | 'admin';
    businessUnitId?: string;
    businessUnitName?: string;
  };
  resources: {
    rfpCount: number;
    recentRfps: Array<{ id: string; status: string; customerName?: string }>;
    accountCount: number;
    referenceCount: number;
    competencyCount: number;
  };
  capabilities: {
    availableTools: Array<{ name: string; description: string }>;
    toolsByCategory: Record<string, Array<{ name: string; description: string }>>;
    permissions: string[];
  };
  businessContext?: {
    businessUnits: Array<{ id: string; name: string }>;
    technologies: Array<{ id: string; name: string; category?: string | null }>;
    employeeCount?: number;
  };
}

export async function buildAgentContext(userId: string): Promise<AgentContext> {
  const { users } = await import('@/lib/db/schema');

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  let businessUnitName: string | undefined;
  if (user.businessUnitId) {
    const [bu] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, user.businessUnitId))
      .limit(1);
    businessUnitName = bu?.name;
  }

  const [rfpCountResult] = await db
    .select({ count: count() })
    .from(rfps)
    .where(eq(rfps.userId, userId));

  const recentRfps = await db
    .select({
      id: rfps.id,
      status: rfps.status,
      extractedRequirements: rfps.extractedRequirements,
    })
    .from(rfps)
    .where(eq(rfps.userId, userId))
    .orderBy(desc(rfps.createdAt))
    .limit(5);

  const [accountCountResult] = await db
    .select({ count: count() })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const [referenceCountResult] = await db.select({ count: count() }).from(references);

  const [competencyCountResult] = await db.select({ count: count() }).from(competencies);

  const allBusinessUnits = await db
    .select({
      id: businessUnits.id,
      name: businessUnits.name,
    })
    .from(businessUnits);

  const allTechnologies = await db
    .select({
      id: technologies.id,
      name: technologies.name,
      category: technologies.category,
    })
    .from(technologies)
    .limit(50);

  let employeeCount: number | undefined;
  if (user.role === 'admin' || user.role === 'bl') {
    const [empCount] = await db.select({ count: count() }).from(employees);
    employeeCount = empCount.count;
  }

  const permissions = getPermissionsForRole(user.role);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessUnitId: user.businessUnitId ?? undefined,
      businessUnitName,
    },
    resources: {
      rfpCount: rfpCountResult.count,
      recentRfps: recentRfps.map(r => {
        let customerName: string | undefined;
        if (r.extractedRequirements) {
          try {
            const reqs = JSON.parse(r.extractedRequirements);
            customerName = reqs.customerName;
          } catch {
            // Ignore parse error
          }
        }
        return { id: r.id, status: r.status, customerName };
      }),
      accountCount: accountCountResult.count,
      referenceCount: referenceCountResult.count,
      competencyCount: competencyCountResult.count,
    },
    capabilities: {
      availableTools: listToolsForAgent(),
      toolsByCategory: getToolsByCategory(),
      permissions,
    },
    businessContext: {
      businessUnits: allBusinessUnits,
      technologies: allTechnologies,
      employeeCount,
    },
  };
}

function getPermissionsForRole(role: 'bd' | 'bl' | 'admin'): string[] {
  const basePermissions = [
    'rfp.create',
    'rfp.list',
    'rfp.get',
    'rfp.update',
    'account.create',
    'account.list',
    'account.get',
    'account.update',
    'account.delete',
    'reference.create',
    'reference.list',
    'reference.get',
    'competency.create',
    'competency.list',
    'competency.get',
  ];

  if (role === 'bl') {
    return [...basePermissions, 'employee.list', 'employee.get', 'team.assign', 'routing.route'];
  }

  if (role === 'admin') {
    return [
      ...basePermissions,
      'employee.create',
      'employee.list',
      'employee.get',
      'employee.update',
      'employee.delete',
      'technology.create',
      'technology.list',
      'technology.get',
      'technology.update',
      'technology.delete',
      'businessUnit.create',
      'businessUnit.list',
      'businessUnit.get',
      'businessUnit.update',
      'businessUnit.delete',
      'user.list',
      'user.updateRole',
      'user.delete',
      'validation.approve',
      'validation.reject',
      'reference.update',
      'reference.delete',
      'competency.update',
      'competency.delete',
    ];
  }

  return basePermissions;
}

export function formatContextForPrompt(context: AgentContext): string {
  const lines: string[] = [
    '## Current User Context',
    `- Name: ${context.user.name}`,
    `- Role: ${context.user.role}`,
    context.user.businessUnitName ? `- Business Unit: ${context.user.businessUnitName}` : '',
    '',
    '## Available Resources',
    `- RFPs: ${context.resources.rfpCount} total`,
    context.resources.recentRfps.length > 0
      ? `- Recent: ${context.resources.recentRfps.map(r => `${r.customerName || r.id} (${r.status})`).join(', ')}`
      : '',
    `- Accounts: ${context.resources.accountCount}`,
    `- References: ${context.resources.referenceCount}`,
    `- Competencies: ${context.resources.competencyCount}`,
    '',
    '## Available Tools',
  ];

  for (const [category, tools] of Object.entries(context.capabilities.toolsByCategory)) {
    lines.push(`### ${category}`);
    for (const tool of tools) {
      lines.push(`- ${tool.name}: ${tool.description}`);
    }
  }

  if (context.businessContext) {
    lines.push('', '## Business Context');
    lines.push(
      `- Business Units: ${context.businessContext.businessUnits.map(b => b.name).join(', ')}`
    );
    if (context.businessContext.employeeCount !== undefined) {
      lines.push(`- Employees: ${context.businessContext.employeeCount}`);
    }
  }

  return lines.filter(l => l !== '').join('\n');
}
