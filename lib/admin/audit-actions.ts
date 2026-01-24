'use server';

import { desc, eq, and, gte, lte, SQL } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditTrails, users } from '@/lib/db/schema';

export async function getAuditLogs(filters?: {
  entityId?: string;
  entityType?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  try {
    const limit = filters?.limit || 100;
    const conditions: SQL[] = [];

    // Build dynamic filters
    if (filters?.entityId) {
      conditions.push(eq(auditTrails.entityId, filters.entityId));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditTrails.entityType, filters.entityType as any));
    }
    if (filters?.action) {
      conditions.push(eq(auditTrails.action, filters.action as any));
    }
    if (filters?.userId) {
      conditions.push(eq(auditTrails.userId, filters.userId));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditTrails.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditTrails.createdAt, filters.endDate));
    }

    const logs = await db
      .select({
        id: auditTrails.id,
        action: auditTrails.action,
        entityType: auditTrails.entityType,
        entityId: auditTrails.entityId,
        previousValue: auditTrails.previousValue,
        newValue: auditTrails.newValue,
        reason: auditTrails.reason,
        changes: auditTrails.changes,
        createdAt: auditTrails.createdAt,
        userId: auditTrails.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditTrails)
      .leftJoin(users, eq(auditTrails.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditTrails.createdAt))
      .limit(limit);

    return { success: true, auditLogs: logs };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { success: false, error: 'Fehler beim Laden der Audit Logs' };
  }
}

export type AuditAction =
  | 'bl_override'
  | 'bid_override'
  | 'team_change'
  | 'status_change'
  | 'create'
  | 'update'
  | 'delete'
  | 'validate'
  | 'reject';

export type AuditEntityType =
  | 'rfp'
  | 'lead'
  | 'business_unit'
  | 'employee'
  | 'reference'
  | 'competency'
  | 'competitor'
  | 'team_assignment'
  | 'pitchdeck';

export async function createAuditLog(data: {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  changes?: Record<string, any> | null; // Deprecated, for backwards compatibility
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Validate: Override actions MUST have a reason
  const overrideActions: AuditAction[] = [
    'bl_override',
    'bid_override',
    'team_change',
    'status_change',
  ];
  if (overrideActions.includes(data.action) && !data.reason) {
    return { success: false, error: 'Reason ist erforderlich für manuelle Overrides' };
  }

  try {
    const [log] = await db
      .insert(auditTrails)
      .values({
        userId: session.user.id,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        previousValue: data.previousValue !== undefined ? JSON.stringify(data.previousValue) : null,
        newValue: data.newValue !== undefined ? JSON.stringify(data.newValue) : null,
        reason: data.reason || null,
        changes: data.changes ? JSON.stringify(data.changes) : null,
      })
      .returning();

    return { success: true, auditLog: log };
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { success: false, error: 'Fehler beim Erstellen des Audit Logs' };
  }
}
