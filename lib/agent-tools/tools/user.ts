import { eq, and, desc, or, ilike, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { users, businessUnits } from '@/lib/db/schema';

/**
 * User Read Tools for Agent Context
 *
 * Provides read-only access to user information for agents.
 * - Excludes sensitive fields (password)
 * - Respects business unit scoping for non-admin users
 * - Enables team composition queries and context understanding
 */

// ===== Input Schemas =====

const getUserInputSchema = z.object({
  userId: z.string(),
});

const listUsersInputSchema = z.object({
  businessUnitId: z.string().optional(),
  role: z.enum(['bd', 'bl', 'admin']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

const searchUsersInputSchema = z.object({
  query: z.string().min(1),
  businessUnitId: z.string().optional(),
  role: z.enum(['bd', 'bl', 'admin']).optional(),
  limit: z.number().min(1).max(50).default(20),
});

// ===== Helper: Safe User Projection =====

/**
 * Project user fields excluding sensitive data (password)
 */
function safeUserProjection() {
  return {
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    businessUnitId: users.businessUnitId,
    createdAt: users.createdAt,
  };
}

// ===== Tool Implementations =====

registry.register({
  name: 'user.get',
  description:
    'Get user details by ID. Returns name, email, role, and business unit. Use to understand team context or find contact information.',
  category: 'user',
  inputSchema: getUserInputSchema,
  async execute(input, context: ToolContext) {
    // Query user with business unit join
    const [user] = await db
      .select({
        ...safeUserProjection(),
        businessUnitName: businessUnits.name,
      })
      .from(users)
      .leftJoin(businessUnits, eq(users.businessUnitId, businessUnits.id))
      .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Non-admin users can only see users in their own business unit
    // (unless the target user has no BU, like an admin)
    if (
      context.userRole !== 'admin' &&
      context.businessUnitId &&
      user.businessUnitId &&
      user.businessUnitId !== context.businessUnitId
    ) {
      return {
        success: false,
        error: 'Access denied: User belongs to different business unit',
      };
    }

    return { success: true, data: user };
  },
});

registry.register({
  name: 'user.list',
  description:
    'List users, optionally filtered by business unit or role. Non-admin users only see their own business unit. Use to understand team composition.',
  category: 'user',
  inputSchema: listUsersInputSchema,
  async execute(input, context: ToolContext) {
    // Non-admin users are scoped to their own business unit
    const effectiveBusinessUnitId =
      context.userRole === 'admin' ? input.businessUnitId : context.businessUnitId;

    // Build conditions
    const conditions = [isNull(users.deletedAt)];

    if (effectiveBusinessUnitId) {
      conditions.push(eq(users.businessUnitId, effectiveBusinessUnitId));
    }

    if (input.role) {
      conditions.push(eq(users.role, input.role));
    }

    // Query with business unit join
    const results = await db
      .select({
        ...safeUserProjection(),
        businessUnitName: businessUnits.name,
      })
      .from(users)
      .leftJoin(businessUnits, eq(users.businessUnitId, businessUnits.id))
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(input.limit);

    return {
      success: true,
      data: results,
      metadata: {
        count: results.length,
        filters: {
          businessUnitId: effectiveBusinessUnitId,
          role: input.role,
        },
      },
    };
  },
});

registry.register({
  name: 'user.search',
  description:
    'Search users by name or email. Use to find specific team members. Non-admin users only see their own business unit.',
  category: 'user',
  inputSchema: searchUsersInputSchema,
  async execute(input, context: ToolContext) {
    // Non-admin users are scoped to their own business unit
    const effectiveBusinessUnitId =
      context.userRole === 'admin' ? input.businessUnitId : context.businessUnitId;

    // Build conditions
    const conditions = [
      isNull(users.deletedAt),
      or(ilike(users.name, `%${input.query}%`), ilike(users.email, `%${input.query}%`)),
    ];

    if (effectiveBusinessUnitId) {
      conditions.push(eq(users.businessUnitId, effectiveBusinessUnitId));
    }

    if (input.role) {
      conditions.push(eq(users.role, input.role));
    }

    // Query with business unit join
    const results = await db
      .select({
        ...safeUserProjection(),
        businessUnitName: businessUnits.name,
      })
      .from(users)
      .leftJoin(businessUnits, eq(users.businessUnitId, businessUnits.id))
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(input.limit);

    return {
      success: true,
      data: results,
      metadata: {
        query: input.query,
        count: results.length,
      },
    };
  },
});
