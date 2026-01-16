'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditTrails, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function getAuditLogs(limit = 100) {
  try {
    const logs = await db
      .select({
        id: auditTrails.id,
        action: auditTrails.action,
        entityType: auditTrails.entityType,
        entityId: auditTrails.entityId,
        changes: auditTrails.changes,
        createdAt: auditTrails.createdAt,
        userId: auditTrails.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditTrails)
      .leftJoin(users, eq(auditTrails.userId, users.id))
      .orderBy(desc(auditTrails.createdAt))
      .limit(limit);

    return { success: true, auditLogs: logs };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { success: false, error: 'Fehler beim Laden der Audit Logs' };
  }
}

export async function createAuditLog(data: {
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any> | null;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [log] = await db
      .insert(auditTrails)
      .values({
        userId: session.user.id,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: data.changes ? JSON.stringify(data.changes) : null,
      })
      .returning();

    return { success: true, auditLog: log };
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { success: false, error: 'Fehler beim Erstellen des Audit Logs' };
  }
}
