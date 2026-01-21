import { inngest } from '../client';
import { db } from '@/lib/db';
import { backgroundJobs, rfps, teamAssignments, employees } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendTeamNotificationEmails, TeamMemberNotification } from '@/lib/notifications/email';

interface ProjectPlanSummary {
  totalWeeks: number;
  totalHours: number;
  startPhase: string;
}

/**
 * Team Notification Background Job
 * Sends email notifications to all assigned team members
 * Expected duration: 1-2 minutes
 */
export const teamNotificationFunction = inngest.createFunction(
  {
    id: 'team-notification-send',
    name: 'Team Notification',
    retries: 3,
  },
  { event: 'team-notification.send' },
  async ({ event, step }) => {
    const { bidId, userId, jobId } = event.data;

    // Step 1: Initialize job tracking
    const jobRecord = await step.run('init-job', async () => {
      console.log('[Inngest] Starting team notification for bid:', bidId);

      const [job] = await db
        .insert(backgroundJobs)
        .values({
          id: jobId,
          jobType: 'team-notification',
          inngestRunId: event.id || 'manual-trigger',
          rfpId: bidId,
          userId,
          status: 'running',
          progress: 0,
          currentStep: 'Initializing team notification',
          startedAt: new Date(),
          attemptNumber: 1,
          maxAttempts: 3,
        })
        .returning();

      return job;
    });

    try {
      // Step 2: Fetch bid and team data
      const { bid, teamMembers, projectPlan, blLeader } = await step.run('fetch-data', async () => {
        // Update progress
        await db
          .update(backgroundJobs)
          .set({
            progress: 20,
            currentStep: 'Fetching team and project data',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        const [bidData] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

        if (!bidData) {
          throw new Error(`Bid ${bidId} not found`);
        }

        if (!bidData.assignedBusinessUnitId) {
          throw new Error('No business unit assigned - cannot notify team');
        }

        // Fetch team assignments
        const assignments = await db
          .select({
            assignment: teamAssignments,
            employee: employees,
          })
          .from(teamAssignments)
          .innerJoin(employees, eq(teamAssignments.employeeId, employees.id))
          .where(eq(teamAssignments.rfpId, bidId));

        if (assignments.length === 0) {
          throw new Error('No team members assigned - cannot send notifications');
        }

        // Parse project plan summary (if available)
        let projectPlanSummary: ProjectPlanSummary | undefined;
        if (bidData.projectPlanningResult) {
          try {
            const planData = JSON.parse(bidData.projectPlanningResult);
            projectPlanSummary = {
              totalWeeks: planData.totalWeeks || 0,
              totalHours: planData.totalHours || 0,
              startPhase: planData.timeline?.[0]?.phase || 'Kick-off',
            };
          } catch (e) {
            console.warn('Could not parse project planning result');
          }
        }

        // Get BL leader info from assignedTeam JSON
        let blLeaderName = 'Bereichsleiter';
        if (bidData.assignedTeam) {
          try {
            const teamData = JSON.parse(bidData.assignedTeam);
            blLeaderName = teamData.blLeaderName || 'Bereichsleiter';
          } catch (e) {
            console.warn('Could not parse assigned team data');
          }
        }

        return {
          bid: bidData,
          teamMembers: assignments,
          projectPlan: projectPlanSummary,
          blLeader: blLeaderName,
        };
      });

      // Step 3: Send notification emails
      const notificationResults = await step.run('send-emails', async () => {
        await db
          .update(backgroundJobs)
          .set({
            progress: 40,
            currentStep: `Sending notifications to ${teamMembers.length} team members`,
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        // Extract customer name and description from extractedRequirements
        let customerName = 'Customer';
        let projectDescription = 'Project details pending';
        if (bid.extractedRequirements) {
          try {
            const requirements = JSON.parse(bid.extractedRequirements);
            customerName = requirements.customerName || customerName;
            projectDescription = requirements.projectDescription || projectDescription;
          } catch (e) {
            console.warn('Could not parse extracted requirements');
          }
        }

        // Map team members for notification
        const teamNotifications: TeamMemberNotification[] = teamMembers.map(tm => {
          const roleLabels: Record<string, string> = {
            lead: 'Team Lead',
            architect: 'Solution Architect',
            developer: 'Developer',
            designer: 'UX/UI Designer',
            qa: 'Quality Assurance',
            pm: 'Project Manager',
            consultant: 'Consultant',
          };

          return {
            employeeId: tm.employee.id,
            employeeName: tm.employee.name,
            employeeEmail: tm.employee.email,
            role: tm.assignment.role,
            roleLabel: roleLabels[tm.assignment.role] || tm.assignment.role,
          };
        });

        // Send emails
        const result = await sendTeamNotificationEmails({
          bidId: bid.id,
          projectName: `${customerName} Migration`,
          customerName,
          projectDescription,
          teamMembers: teamNotifications,
          projectPlanSummary: projectPlan,
          blLeaderName: blLeader,
        });

        return result;
      });

      // Step 4: Update team notification status in bid
      await step.run('update-bid-status', async () => {
        await db
          .update(backgroundJobs)
          .set({
            progress: 80,
            currentStep: 'Updating bid notification status',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        // Update teamNotifications field in RFP
        await db
          .update(rfps)
          .set({
            teamNotifications: JSON.stringify(notificationResults.results),
            teamNotifiedAt: new Date(),
            status: 'notified',
            updatedAt: new Date(),
          })
          .where(eq(rfps.id, bidId));

        // Update notifiedAt timestamp in team_assignments
        for (const member of teamMembers) {
          await db
            .update(teamAssignments)
            .set({
              notifiedAt: new Date(),
            })
            .where(
              and(
                eq(teamAssignments.rfpId, bidId),
                eq(teamAssignments.employeeId, member.employee.id)
              )
            );
        }
      });

      // Step 5: Complete job
      await step.run('complete-job', async () => {
        await db
          .update(backgroundJobs)
          .set({
            status: 'completed',
            progress: 100,
            currentStep: 'Notifications sent successfully',
            result: JSON.stringify({
              totalSent: notificationResults.results.filter(r => r.status === 'sent').length,
              totalFailed: notificationResults.results.filter(r => r.status === 'failed').length,
              results: notificationResults.results,
            }),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        console.log('[Inngest] Team notification completed');
      });

      return {
        success: true,
        bidId,
        jobId: jobRecord.id,
        message: 'Team notifications sent successfully',
        summary: {
          totalMembers: teamMembers.length,
          sent: notificationResults.results.filter(r => r.status === 'sent').length,
          failed: notificationResults.results.filter(r => r.status === 'failed').length,
        },
      };
    } catch (error) {
      // Handle errors
      await step.run('handle-error', async () => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error('[Inngest] Team notification failed:', {
          bidId,
          jobId: jobRecord.id,
          error: errorMessage,
        });

        // Update job status to failed
        await db
          .update(backgroundJobs)
          .set({
            status: 'failed',
            errorMessage,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        return { success: false };
      });

      // Re-throw to trigger Inngest retry mechanism
      throw error;
    }
  }
);
