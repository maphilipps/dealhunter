import { createId } from '@paralleldrive/cuid2';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import {
  pitches,
  users,
  preQualifications,
  teamAssignments,
  employees,
  pitchSectionData,
} from '@/lib/db/schema';
import { sendEmail, sendTeamNotificationEmails } from '@/lib/notifications/email';

/**
 * Notification Tools — Primitives for sending emails and managing reminders.
 *
 * Primitive tools (data in, action out):
 * - notification.send_email — send a single email
 * - notification.send_team_emails — send batch emails to team members
 *
 * Team resolution is the agent's job:
 *   1. Use teamAssignment.listByPreQualification to get team
 *   2. Use user.get for BL leader details
 *   3. Call notification.send_team_emails with the gathered data
 */

// ============================================================================
// notification.send_email — generic email-sending primitive
// ============================================================================

const sendEmailInputSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

registry.register({
  name: 'notification.send_email',
  description:
    'Send a single email. Takes recipient, subject, and HTML body. No data fetching — agent provides all content.',
  category: 'notification',
  inputSchema: sendEmailInputSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await sendEmail({
        to: input.to,
        subject: input.subject,
        html: input.body,
      });
      return {
        success: result.success,
        data: {
          to: input.to,
          subject: input.subject,
        },
        ...(result.error ? { error: result.error } : {}),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  },
});

// ============================================================================
// notification.send_team_emails — batch email primitive
// ============================================================================

const sendTeamEmailsInputSchema = z.object({
  teamMembers: z.array(
    z.object({
      employeeId: z.string(),
      employeeName: z.string(),
      employeeEmail: z.string().email(),
      role: z.string(),
      roleLabel: z.string(),
    })
  ),
  projectName: z.string(),
  customerName: z.string(),
  projectDescription: z.string(),
  blLeaderName: z.string(),
  projectUrl: z.string(),
  bidId: z.string(),
});

registry.register({
  name: 'notification.send_team_emails',
  description:
    'Send project assignment emails to a list of team members. Agent provides all team and project data — no data fetching.',
  category: 'notification',
  inputSchema: sendTeamEmailsInputSchema,
  async execute(input, _context: ToolContext) {
    if (input.teamMembers.length === 0) {
      return { success: false, error: 'No team members provided' };
    }

    try {
      const result = await sendTeamNotificationEmails({
        bidId: input.bidId,
        projectName: input.projectName,
        customerName: input.customerName,
        projectDescription: input.projectDescription,
        teamMembers: input.teamMembers,
        blLeaderName: input.blLeaderName,
        projectUrl: input.projectUrl,
      });

      return {
        success: result.success,
        data: {
          recipientCount: input.teamMembers.length,
          recipients: input.teamMembers.map(t => ({
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
        error: error instanceof Error ? error.message : 'Failed to send team emails',
      };
    }
  },
});

// ============================================================================
// notification.sendTeamAlert — DEPRECATED, use notification.send_team_emails
// ============================================================================

const sendTeamAlertInputSchema = z.object({
  leadId: z.string(),
  message: z.string().optional(),
  includeLeadDetails: z.boolean().default(true),
});

registry.register({
  name: 'notification.sendTeamAlert',
  description:
    '[DEPRECATED: use teamAssignment.listByPreQualification + user.get + notification.send_team_emails] Send notification emails to all team members assigned to a lead.',
  category: 'notification',
  inputSchema: sendTeamAlertInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead (authorize via preQualification.userId)
    const [leadData] = await db
      .select({ lead: pitches, preQualification: preQualifications })
      .from(pitches)
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(pitches.id, input.leadId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const lead = leadData.lead;
    const preQualification = leadData.preQualification;

    // Get team assignments for this Pre-Qualification
    const assignments = await db
      .select({
        assignment: teamAssignments,
        employee: employees,
      })
      .from(teamAssignments)
      .innerJoin(employees, eq(teamAssignments.employeeId, employees.id))
      .where(eq(teamAssignments.preQualificationId, preQualification.id));

    if (assignments.length === 0) {
      return { success: false, error: 'No team members assigned to this lead' };
    }

    // Build team member details for email
    const teamDetails = assignments.map(a => ({
      employeeId: a.employee.id,
      employeeName: a.employee.name,
      employeeEmail: a.employee.email,
      role: a.assignment.role,
      roleLabel: a.assignment.role,
    }));

    // Get BL leader name (preQualification owner)
    const [blLeader] = await db
      .select()
      .from(users)
      .where(eq(users.id, preQualification.userId))
      .limit(1);

    // Send notifications
    try {
      const result = await sendTeamNotificationEmails({
        bidId: preQualification.id,
        projectName: lead.customerName || 'Unnamed Project',
        customerName: lead.customerName || 'Unknown Customer',
        projectDescription: input.message || lead.projectDescription || 'No description available',
        teamMembers: teamDetails,
        blLeaderName: blLeader?.name || 'Unknown',
        projectUrl: `/pitches/${lead.id}`,
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
    // Get lead (authorize via preQualification.userId)
    const [leadData] = await db
      .select({ lead: pitches, preQualification: preQualifications })
      .from(pitches)
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(pitches.id, input.leadId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

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

    // Get existing reminders from pitchSectionData (sectionId="_reminders")
    const [existingSection] = await db
      .select()
      .from(pitchSectionData)
      .where(
        and(
          eq(pitchSectionData.pitchId, input.leadId),
          eq(pitchSectionData.sectionId, '_reminders')
        )
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
        .update(pitchSectionData)
        .set({
          content: JSON.stringify(updatedReminders),
          updatedAt: new Date(),
        })
        .where(eq(pitchSectionData.id, existingSection.id));
    } else {
      await db.insert(pitchSectionData).values({
        pitchId: input.leadId,
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
    // Get lead (authorize via preQualification.userId)
    const [leadData] = await db
      .select({ lead: pitches, preQualification: preQualifications })
      .from(pitches)
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(pitches.id, input.leadId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    // Get reminders from pitchSectionData
    const [remindersSection] = await db
      .select()
      .from(pitchSectionData)
      .where(
        and(
          eq(pitchSectionData.pitchId, input.leadId),
          eq(pitchSectionData.sectionId, '_reminders')
        )
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
    // Get lead (authorize via preQualification.userId)
    const [leadData] = await db
      .select({ lead: pitches, preQualification: preQualifications })
      .from(pitches)
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(pitches.id, input.leadId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    // Get reminders from pitchSectionData
    const [remindersSection] = await db
      .select()
      .from(pitchSectionData)
      .where(
        and(
          eq(pitchSectionData.pitchId, input.leadId),
          eq(pitchSectionData.sectionId, '_reminders')
        )
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

    // Update pitchSectionData
    await db
      .update(pitchSectionData)
      .set({
        content: JSON.stringify(updatedReminders),
        updatedAt: new Date(),
      })
      .where(eq(pitchSectionData.id, remindersSection.id));

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
