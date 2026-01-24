import { createId } from '@paralleldrive/cuid2';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { leads, users, rfps, teamAssignments, employees, leadSectionData } from '@/lib/db/schema';
import { sendBLAssignmentEmail, sendTeamNotificationEmails } from '@/lib/notifications/email';

/**
 * Sprint 4.1: Notification Tools
 *
 * Tools for sending team alerts and scheduling reminders.
 * Wraps existing email infrastructure with agent-callable tools.
 */

// ============================================================================
// notification.sendTeamAlert
// ============================================================================

const sendTeamAlertInputSchema = z.object({
  leadId: z.string(),
  message: z.string().optional(),
  includeLeadDetails: z.boolean().default(true),
});

registry.register({
  name: 'notification.sendTeamAlert',
  description:
    'Send notification emails to all team members assigned to a lead. Includes project details and custom message.',
  category: 'notification',
  inputSchema: sendTeamAlertInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead (authorize via rfp.userId)
    const [leadData] = await db
      .select({ lead: leads, rfp: rfps })
      .from(leads)
      .innerJoin(rfps, eq(leads.rfpId, rfps.id))
      .where(and(eq(leads.id, input.leadId), eq(rfps.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const lead = leadData.lead;
    const rfp = leadData.rfp;

    // Get team assignments for this RFP
    const assignments = await db
      .select({
        assignment: teamAssignments,
        employee: employees,
      })
      .from(teamAssignments)
      .innerJoin(employees, eq(teamAssignments.employeeId, employees.id))
      .where(eq(teamAssignments.rfpId, rfp.id));

    if (assignments.length === 0) {
      return { success: false, error: 'No team members assigned to this lead' };
    }

    // Build team member details for email
    const teamDetails = assignments.map(a => ({
      employeeId: a.employee.id,
      employeeName: a.employee.name,
      employeeEmail: a.employee.email,
      role: a.assignment.role, // Technical role identifier
      roleLabel: a.assignment.role, // Human-readable label (same for now)
    }));

    // Get BL leader name (rfp owner)
    const [blLeader] = await db.select().from(users).where(eq(users.id, rfp.userId)).limit(1);

    // Send notifications
    try {
      const result = await sendTeamNotificationEmails({
        bidId: rfp.id,
        projectName: lead.customerName || 'Unnamed Project',
        customerName: lead.customerName || 'Unknown Customer',
        projectDescription: input.message || lead.projectDescription || 'No description available',
        teamMembers: teamDetails,
        blLeaderName: blLeader?.name || 'Unknown',
        projectUrl: `/leads/${lead.id}`, // Override to use lead URL instead of RFP
      });

      return {
        success: result.success,
        data: {
          leadId: input.leadId,
          recipientCount: teamDetails.length,
          recipients: teamDetails.map(t => ({
            email: t.employeeEmail,
            role: t.role,
            name: t.employeeName,
          })),
          results: result.results,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notifications',
      };
    }
  },
});

// ============================================================================
// notification.scheduleReminder
// ============================================================================

const scheduleReminderInputSchema = z.object({
  leadId: z.string(),
  reminderType: z.enum(['decision-deadline', 'follow-up', 'document-request', 'custom']),
  message: z.string(),
  scheduledFor: z.string().datetime(), // ISO datetime
  recipientUserId: z.string().optional(), // If omitted, sends to lead owner
});

interface ScheduledReminder {
  id: string;
  leadId: string;
  reminderType: string;
  message: string;
  scheduledFor: Date;
  recipientUserId: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: Date;
}

registry.register({
  name: 'notification.scheduleReminder',
  description:
    'Schedule a reminder notification for a lead. Reminders are sent at the specified time via email.',
  category: 'notification',
  inputSchema: scheduleReminderInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead (authorize via rfp.userId)
    const [leadData] = await db
      .select({ lead: leads, rfp: rfps })
      .from(leads)
      .innerJoin(rfps, eq(leads.rfpId, rfps.id))
      .where(and(eq(leads.id, input.leadId), eq(rfps.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const lead = leadData.lead;

    // Determine recipient
    const recipientUserId = input.recipientUserId || context.userId;

    // Get recipient user
    const [recipient] = await db.select().from(users).where(eq(users.id, recipientUserId)).limit(1);

    if (!recipient) {
      return { success: false, error: 'Recipient user not found' };
    }

    // Validate scheduled time is in future
    const scheduledDate = new Date(input.scheduledFor);
    if (scheduledDate <= new Date()) {
      return { success: false, error: 'Scheduled time must be in the future' };
    }

    // Get existing reminders from leadSectionData (sectionId="_reminders")
    const [existingSection] = await db
      .select()
      .from(leadSectionData)
      .where(
        and(eq(leadSectionData.leadId, input.leadId), eq(leadSectionData.sectionId, '_reminders'))
      )
      .limit(1);

    const existingReminders = existingSection
      ? (JSON.parse(existingSection.content) as ScheduledReminder[])
      : [];

    const newReminder: ScheduledReminder = {
      id: createId(),
      leadId: input.leadId,
      reminderType: input.reminderType,
      message: input.message,
      scheduledFor: scheduledDate,
      recipientUserId,
      status: 'pending',
      createdAt: new Date(),
    };

    const updatedReminders = [...existingReminders, newReminder];

    // Upsert reminders section
    if (existingSection) {
      await db
        .update(leadSectionData)
        .set({
          content: JSON.stringify(updatedReminders),
          updatedAt: new Date(),
        })
        .where(eq(leadSectionData.id, existingSection.id));
    } else {
      await db.insert(leadSectionData).values({
        leadId: input.leadId,
        sectionId: '_reminders',
        content: JSON.stringify(updatedReminders),
        confidence: 100,
      });
    }

    return {
      success: true,
      data: {
        reminderId: newReminder.id,
        leadId: input.leadId,
        scheduledFor: scheduledDate.toISOString(),
        recipient: {
          userId: recipient.id,
          name: recipient.name,
          email: recipient.email,
        },
        message: input.message,
        status: 'pending',
        note: 'Reminder scheduled. A background job will send the email at the specified time.',
      },
    };
  },
});

// ============================================================================
// notification.listReminders
// ============================================================================

const listRemindersInputSchema = z.object({
  leadId: z.string(),
  status: z.enum(['pending', 'sent', 'cancelled']).optional(),
});

registry.register({
  name: 'notification.listReminders',
  description: 'List all scheduled reminders for a lead. Filter by status.',
  category: 'notification',
  inputSchema: listRemindersInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead (authorize via rfp.userId)
    const [leadData] = await db
      .select({ lead: leads, rfp: rfps })
      .from(leads)
      .innerJoin(rfps, eq(leads.rfpId, rfps.id))
      .where(and(eq(leads.id, input.leadId), eq(rfps.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    // Get reminders from leadSectionData
    const [remindersSection] = await db
      .select()
      .from(leadSectionData)
      .where(
        and(eq(leadSectionData.leadId, input.leadId), eq(leadSectionData.sectionId, '_reminders'))
      )
      .limit(1);

    const reminders: ScheduledReminder[] = remindersSection
      ? JSON.parse(remindersSection.content)
      : [];

    // Filter by status if provided
    const filteredReminders = input.status
      ? reminders.filter(r => r.status === input.status)
      : reminders;

    return {
      success: true,
      data: {
        leadId: input.leadId,
        reminders: filteredReminders,
        total: filteredReminders.length,
      },
    };
  },
});

// ============================================================================
// notification.cancelReminder
// ============================================================================

const cancelReminderInputSchema = z.object({
  leadId: z.string(),
  reminderId: z.string(),
});

registry.register({
  name: 'notification.cancelReminder',
  description: 'Cancel a scheduled reminder. Only pending reminders can be cancelled.',
  category: 'notification',
  inputSchema: cancelReminderInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead (authorize via rfp.userId)
    const [leadData] = await db
      .select({ lead: leads, rfp: rfps })
      .from(leads)
      .innerJoin(rfps, eq(leads.rfpId, rfps.id))
      .where(and(eq(leads.id, input.leadId), eq(rfps.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    // Get reminders from leadSectionData
    const [remindersSection] = await db
      .select()
      .from(leadSectionData)
      .where(
        and(eq(leadSectionData.leadId, input.leadId), eq(leadSectionData.sectionId, '_reminders'))
      )
      .limit(1);

    if (!remindersSection) {
      return { success: false, error: 'No reminders found for this lead' };
    }

    const reminders: ScheduledReminder[] = JSON.parse(remindersSection.content);

    // Find reminder
    const reminderIndex = reminders.findIndex(r => r.id === input.reminderId);
    if (reminderIndex === -1) {
      return { success: false, error: 'Reminder not found' };
    }

    const reminder = reminders[reminderIndex];
    if (reminder.status !== 'pending') {
      return {
        success: false,
        error: `Cannot cancel reminder with status: ${reminder.status}`,
      };
    }

    // Update reminder status
    const updatedReminders = [...reminders];
    updatedReminders[reminderIndex] = {
      ...reminder,
      status: 'cancelled',
    };

    // Update leadSectionData
    await db
      .update(leadSectionData)
      .set({
        content: JSON.stringify(updatedReminders),
        updatedAt: new Date(),
      })
      .where(eq(leadSectionData.id, remindersSection.id));

    return {
      success: true,
      data: {
        reminderId: input.reminderId,
        leadId: input.leadId,
        status: 'cancelled',
        message: 'Reminder cancelled successfully',
      },
    };
  },
});
