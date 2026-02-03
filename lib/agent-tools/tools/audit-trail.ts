import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { auditTrails, users } from '@/lib/db/schema';

/**
 * Audit Trail Read Tools for Agent Context
 *
 * Provides read-only access to audit trail entries (immutable history).
 * - Admin-only access (audit logs are sensitive)
 * - No create/update/delete tools (audit trails are append-only via other operations)
 * - Supports filtering by entity, action, user, and date range
 */

// ============================================================================
// Constants: Enum values from schema for Zod validation
// ============================================================================

const AUDIT_ACTIONS = [
  'bl_override',
  'bid_override',
  'team_change',
  'status_change',
  'create',
  'update',
  'delete',
  'validate',
  'reject',
] as const;

const AUDIT_ENTITY_TYPES = [
  'pre_qualification',
  'qualification',
  'business_unit',
  'employee',
  'reference',
  'competency',
  'competitor',
  'team_assignment',
  'pitchdeck',
] as const;

// ============================================================================
// Helper: Parse JSON fields safely
// ============================================================================

function parseJsonField(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value; // Return raw string if not valid JSON
  }
}

// ============================================================================
// audittrail.list - List audit trail entries with filters
// ============================================================================

const listAuditTrailInputSchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'audittrail.list',
  description:
    'List audit trail entries. Filter by action (e.g., status_change), entityType (e.g., pre_qualification), entityId, userId, or date range. Admin only.',
  category: 'audit-trail',
  inputSchema: listAuditTrailInputSchema,
  async execute(input, context: ToolContext) {
    // Admin-only access
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Access denied: Only admins can view audit trails' };
    }

    const conditions = [];

    if (input.action) {
      conditions.push(eq(auditTrails.action, input.action));
    }

    if (input.entityType) {
      conditions.push(eq(auditTrails.entityType, input.entityType));
    }

    if (input.entityId) {
      conditions.push(eq(auditTrails.entityId, input.entityId));
    }

    if (input.userId) {
      conditions.push(eq(auditTrails.userId, input.userId));
    }

    if (input.startDate) {
      conditions.push(gte(auditTrails.createdAt, new Date(input.startDate)));
    }

    if (input.endDate) {
      conditions.push(lte(auditTrails.createdAt, new Date(input.endDate)));
    }

    const results = await db
      .select({
        id: auditTrails.id,
        userId: auditTrails.userId,
        userName: users.name,
        userEmail: users.email,
        action: auditTrails.action,
        entityType: auditTrails.entityType,
        entityId: auditTrails.entityId,
        previousValue: auditTrails.previousValue,
        newValue: auditTrails.newValue,
        reason: auditTrails.reason,
        createdAt: auditTrails.createdAt,
      })
      .from(auditTrails)
      .leftJoin(users, eq(auditTrails.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditTrails.createdAt))
      .limit(input.limit);

    return {
      success: true,
      data: results.map(r => ({
        ...r,
        previousValue: parseJsonField(r.previousValue),
        newValue: parseJsonField(r.newValue),
      })),
      metadata: {
        count: results.length,
        filters: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: input.userId,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      },
    };
  },
});

// ============================================================================
// audittrail.get - Get a single audit trail entry by ID
// ============================================================================

const getAuditTrailInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'audittrail.get',
  description:
    'Get a single audit trail entry by ID. Returns full details including parsed JSON values. Admin only.',
  category: 'audit-trail',
  inputSchema: getAuditTrailInputSchema,
  async execute(input, context: ToolContext) {
    // Admin-only access
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Access denied: Only admins can view audit trails' };
    }

    const [result] = await db
      .select({
        id: auditTrails.id,
        userId: auditTrails.userId,
        userName: users.name,
        userEmail: users.email,
        action: auditTrails.action,
        entityType: auditTrails.entityType,
        entityId: auditTrails.entityId,
        previousValue: auditTrails.previousValue,
        newValue: auditTrails.newValue,
        reason: auditTrails.reason,
        changes: auditTrails.changes,
        createdAt: auditTrails.createdAt,
      })
      .from(auditTrails)
      .leftJoin(users, eq(auditTrails.userId, users.id))
      .where(eq(auditTrails.id, input.id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'Audit trail entry not found' };
    }

    return {
      success: true,
      data: {
        ...result,
        previousValue: parseJsonField(result.previousValue),
        newValue: parseJsonField(result.newValue),
        changes: parseJsonField(result.changes),
      },
    };
  },
});

// ============================================================================
// audittrail.getByEntity - Get audit trail for a specific entity
// ============================================================================

const getByEntityInputSchema = z.object({
  entityType: z.enum(AUDIT_ENTITY_TYPES),
  entityId: z.string(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'audittrail.getByEntity',
  description:
    'Get the audit trail history for a specific entity (e.g., a pre_qualification). Returns entries in reverse chronological order. Admin only.',
  category: 'audit-trail',
  inputSchema: getByEntityInputSchema,
  async execute(input, context: ToolContext) {
    // Admin-only access
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Access denied: Only admins can view audit trails' };
    }

    const results = await db
      .select({
        id: auditTrails.id,
        userId: auditTrails.userId,
        userName: users.name,
        userEmail: users.email,
        action: auditTrails.action,
        entityType: auditTrails.entityType,
        entityId: auditTrails.entityId,
        previousValue: auditTrails.previousValue,
        newValue: auditTrails.newValue,
        reason: auditTrails.reason,
        createdAt: auditTrails.createdAt,
      })
      .from(auditTrails)
      .leftJoin(users, eq(auditTrails.userId, users.id))
      .where(
        and(eq(auditTrails.entityType, input.entityType), eq(auditTrails.entityId, input.entityId))
      )
      .orderBy(desc(auditTrails.createdAt))
      .limit(input.limit);

    return {
      success: true,
      data: results.map(r => ({
        ...r,
        previousValue: parseJsonField(r.previousValue),
        newValue: parseJsonField(r.newValue),
      })),
      metadata: {
        entityType: input.entityType,
        entityId: input.entityId,
        count: results.length,
      },
    };
  },
});

// ============================================================================
// audittrail.getByUser - Get all actions performed by a user
// ============================================================================

const getByUserInputSchema = z.object({
  userId: z.string(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'audittrail.getByUser',
  description:
    'Get all audit trail entries for actions performed by a specific user. Useful for user activity tracking. Admin only.',
  category: 'audit-trail',
  inputSchema: getByUserInputSchema,
  async execute(input, context: ToolContext) {
    // Admin-only access
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Access denied: Only admins can view audit trails' };
    }

    const conditions = [eq(auditTrails.userId, input.userId)];

    if (input.startDate) {
      conditions.push(gte(auditTrails.createdAt, new Date(input.startDate)));
    }

    if (input.endDate) {
      conditions.push(lte(auditTrails.createdAt, new Date(input.endDate)));
    }

    const results = await db
      .select({
        id: auditTrails.id,
        userId: auditTrails.userId,
        userName: users.name,
        userEmail: users.email,
        action: auditTrails.action,
        entityType: auditTrails.entityType,
        entityId: auditTrails.entityId,
        previousValue: auditTrails.previousValue,
        newValue: auditTrails.newValue,
        reason: auditTrails.reason,
        createdAt: auditTrails.createdAt,
      })
      .from(auditTrails)
      .leftJoin(users, eq(auditTrails.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditTrails.createdAt))
      .limit(input.limit);

    return {
      success: true,
      data: results.map(r => ({
        ...r,
        previousValue: parseJsonField(r.previousValue),
        newValue: parseJsonField(r.newValue),
      })),
      metadata: {
        userId: input.userId,
        count: results.length,
        dateRange: {
          start: input.startDate,
          end: input.endDate,
        },
      },
    };
  },
});
