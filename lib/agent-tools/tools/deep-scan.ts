/**
 * Deep Scan v2 Agent Tools
 *
 * Agent-native tools for the Deep Scan pipeline.
 * These tools enable agents to trigger, monitor, and manage deep scan runs.
 */

import { registry } from '../registry';
import type { ToolContext, ToolResult } from '../types';
import { db } from '@/lib/db';
import {
  deepScanV2Runs,
  deepScanV2Documents,
  deepScanV2AuditResults,
  preQualifications,
} from '@/lib/db/schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import {
  triggerDeepScanInputSchema,
  getDeepScanStatusInputSchema,
  getDeepScanResultInputSchema,
  cancelDeepScanInputSchema,
  deleteDeepScanInputSchema,
  retryDeepScanInputSchema,
  getDeepScanActivityInputSchema,
  listDeepScansInputSchema,
  type TriggerDeepScanInput,
  type GetDeepScanStatusInput,
  type GetDeepScanResultInput,
  type CancelDeepScanInput,
  type DeleteDeepScanInput,
  type RetryDeepScanInput,
  type GetDeepScanActivityInput,
  type ListDeepScansInput,
  type DeepScanV2Status,
  type ActivityLogEntry,
  type DeepScanV2ResultsFormat,
} from '@/lib/deep-scan-v2';
import { DEEP_SCAN_TOOL_NAMES, VALID_STATUS_TRANSITIONS } from '@/lib/deep-scan-v2/constants';

// ====== Helper Functions ======

function parseJsonSafe<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

function appendActivityLog(existingLog: string | null, entry: ActivityLogEntry): string {
  const log = parseJsonSafe<ActivityLogEntry[]>(existingLog, []);
  log.push(entry);
  // Keep last 1000 entries
  if (log.length > 1000) {
    log.splice(0, log.length - 1000);
  }
  return JSON.stringify(log);
}

// ====== Tool: Trigger Deep Scan ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.TRIGGER,
  description:
    'Startet einen neuen Deep Scan für eine Pre-Qualification. Analysiert Website, CMS-Empfehlung und generiert Indication-Dokument.',
  category: 'deep-scan',
  inputSchema: triggerDeepScanInputSchema,
  async execute(
    input: TriggerDeepScanInput,
    context: ToolContext
  ): Promise<ToolResult<{ runId: string }>> {
    // Verify pre-qualification exists and user has access
    const preQual = await db.query.preQualifications.findFirst({
      where: eq(preQualifications.id, input.preQualificationId),
      columns: { id: true, userId: true },
    });

    if (!preQual) {
      return {
        success: false,
        error: `Pre-Qualification ${input.preQualificationId} nicht gefunden`,
      };
    }

    // Create the run
    const [run] = await db
      .insert(deepScanV2Runs)
      .values({
        preQualificationId: input.preQualificationId,
        userId: context.userId,
        websiteUrl: input.websiteUrl,
        targetCmsIds: input.targetCmsIds ? JSON.stringify(input.targetCmsIds) : null,
        interviewResults: input.interviewResults ? JSON.stringify(input.interviewResults) : null,
        status: 'pending',
        activityLog: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            type: 'run_started',
            message: `Deep Scan gestartet für ${input.websiteUrl}`,
            metadata: { triggeredBy: context.userId },
          },
        ] satisfies ActivityLogEntry[]),
      })
      .returning({ id: deepScanV2Runs.id });

    // TODO: Queue BullMQ job for actual processing
    // await deepScanQueue.add('process', { runId: run.id });

    return {
      success: true,
      data: { runId: run.id },
    };
  },
});

// ====== Tool: Get Status ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.STATUS,
  description:
    'Ruft den aktuellen Status eines Deep Scan Runs ab inkl. Fortschritt und aktuellem Agent.',
  category: 'deep-scan',
  inputSchema: getDeepScanStatusInputSchema,
  async execute(
    input: GetDeepScanStatusInput,
    _context: ToolContext
  ): Promise<
    ToolResult<{
      status: DeepScanV2Status;
      progress: number;
      currentPhase: string | null;
      currentAgent: string | null;
      startedAt: string | null;
      errorMessage: string | null;
    }>
  > {
    const run = await db.query.deepScanV2Runs.findFirst({
      where: eq(deepScanV2Runs.id, input.runId),
      columns: {
        status: true,
        progress: true,
        currentPhase: true,
        currentAgent: true,
        startedAt: true,
        errorMessage: true,
      },
    });

    if (!run) {
      return {
        success: false,
        error: `Run ${input.runId} nicht gefunden`,
      };
    }

    return {
      success: true,
      data: {
        status: run.status as DeepScanV2Status,
        progress: run.progress,
        currentPhase: run.currentPhase,
        currentAgent: run.currentAgent,
        startedAt: run.startedAt?.toISOString() ?? null,
        errorMessage: run.errorMessage,
      },
    };
  },
});

// ====== Tool: Get Result ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.RESULT,
  description:
    'Ruft die vollständigen Ergebnisse eines abgeschlossenen Deep Scans ab inkl. Audits, Analysen und generierter Dokumente.',
  category: 'deep-scan',
  inputSchema: getDeepScanResultInputSchema,
  async execute(
    input: GetDeepScanResultInput,
    _context: ToolContext
  ): Promise<ToolResult<DeepScanV2ResultsFormat>> {
    const run = await db.query.deepScanV2Runs.findFirst({
      where: eq(deepScanV2Runs.id, input.runId),
    });

    if (!run) {
      return {
        success: false,
        error: `Run ${input.runId} nicht gefunden`,
      };
    }

    // Get documents if requested
    let documents: DeepScanV2ResultsFormat['documents'] = [];
    if (input.includeDocuments) {
      const docs = await db.query.deepScanV2Documents.findMany({
        where: eq(deepScanV2Documents.runId, input.runId),
      });
      documents = docs.map(doc => ({
        id: doc.id,
        type: doc.type as 'indication' | 'calculation' | 'presentation' | 'proposal',
        format: doc.format as 'html' | 'xlsx' | 'pptx' | 'docx' | 'pdf',
        title: doc.title,
        downloadUrl: doc.publicUrl ?? undefined,
      }));
    }

    // Get audit results
    const auditResults = await db.query.deepScanV2AuditResults.findMany({
      where: eq(deepScanV2AuditResults.runId, input.runId),
    });

    // Build audits object - results are stored as JSON strings
    const audits: DeepScanV2ResultsFormat['audits'] = {};
    for (const audit of auditResults) {
      const results = parseJsonSafe(audit.results, null);
      if (!results) continue;

      switch (audit.auditType) {
        case 'tech_detection':
          audits.techStack = results as DeepScanV2ResultsFormat['audits']['techStack'];
          break;
        case 'performance':
          audits.performance = results as DeepScanV2ResultsFormat['audits']['performance'];
          break;
        case 'accessibility':
          audits.accessibility = results as DeepScanV2ResultsFormat['audits']['accessibility'];
          break;
        case 'component_analysis':
          audits.componentAnalysis =
            results as DeepScanV2ResultsFormat['audits']['componentAnalysis'];
          break;
      }
    }

    // Parse activity log for timing info
    const activityLog = parseJsonSafe<ActivityLogEntry[]>(run.activityLog, []);
    const phases = activityLog
      .filter(e => e.type === 'phase_started' || e.type === 'phase_completed')
      .reduce(
        (acc, entry) => {
          const existing = acc.find(p => p.name === entry.phase);
          if (entry.type === 'phase_started') {
            if (!existing) {
              acc.push({ name: entry.phase ?? '', startedAt: entry.timestamp });
            }
          } else if (entry.type === 'phase_completed' && existing) {
            existing.completedAt = entry.timestamp;
            existing.durationMs = entry.durationMs;
          }
          return acc;
        },
        [] as DeepScanV2ResultsFormat['timing']['phases']
      );

    const result: DeepScanV2ResultsFormat = {
      runId: run.id,
      status: run.status as DeepScanV2Status,
      progress: run.progress,
      confidence: run.confidence ?? 0,
      audits,
      analysis: parseJsonSafe(run.analysisResults, {}),
      documents,
      provenance: input.includeProvenance
        ? {
            sources: auditResults.flatMap(a => parseJsonSafe<string[]>(a.sources, [])),
            methodology:
              auditResults
                .map(a => a.methodology)
                .filter(Boolean)
                .join('; ') || 'Automated analysis',
            dataCollectedAt: run.startedAt?.toISOString() ?? new Date().toISOString(),
            toolVersions: { 'deep-scan': '2.0.0' },
          }
        : {
            sources: [],
            methodology: '',
            dataCollectedAt: '',
            toolVersions: {},
          },
      timing: {
        startedAt: run.startedAt?.toISOString() ?? run.createdAt?.toISOString() ?? '',
        completedAt: run.completedAt?.toISOString(),
        phases,
      },
    };

    return {
      success: true,
      data: result,
    };
  },
});

// ====== Tool: Cancel ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.CANCEL,
  description:
    'Bricht einen laufenden Deep Scan ab. Nur möglich bei Status pending, running, audit_complete, generating oder waiting_for_user.',
  category: 'deep-scan',
  inputSchema: cancelDeepScanInputSchema,
  async execute(
    input: CancelDeepScanInput,
    context: ToolContext
  ): Promise<ToolResult<{ cancelled: boolean }>> {
    const run = await db.query.deepScanV2Runs.findFirst({
      where: eq(deepScanV2Runs.id, input.runId),
      columns: { id: true, status: true, activityLog: true },
    });

    if (!run) {
      return {
        success: false,
        error: `Run ${input.runId} nicht gefunden`,
      };
    }

    const validTransitions = VALID_STATUS_TRANSITIONS[run.status] ?? [];
    if (!validTransitions.includes('cancelled')) {
      return {
        success: false,
        error: `Run kann im Status '${run.status}' nicht abgebrochen werden`,
      };
    }

    const newActivityLog = appendActivityLog(run.activityLog, {
      timestamp: new Date().toISOString(),
      type: 'run_cancelled',
      message: input.reason ?? 'Abbruch durch Benutzer',
      metadata: { cancelledBy: context.userId },
    });

    await db
      .update(deepScanV2Runs)
      .set({
        status: 'cancelled',
        activityLog: newActivityLog,
        updatedAt: new Date(),
      })
      .where(eq(deepScanV2Runs.id, input.runId));

    // TODO: Cancel BullMQ job if running
    // await deepScanQueue.remove(run.bullmqJobId);

    return {
      success: true,
      data: { cancelled: true },
    };
  },
});

// ====== Tool: Delete ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.DELETE,
  description:
    'Löscht einen Deep Scan Run und optional alle generierten Dokumente. Nur möglich bei abgeschlossenen oder abgebrochenen Runs.',
  category: 'deep-scan',
  inputSchema: deleteDeepScanInputSchema,
  async execute(
    input: DeleteDeepScanInput,
    _context: ToolContext
  ): Promise<ToolResult<{ deleted: boolean }>> {
    const run = await db.query.deepScanV2Runs.findFirst({
      where: eq(deepScanV2Runs.id, input.runId),
      columns: { id: true, status: true },
    });

    if (!run) {
      return {
        success: false,
        error: `Run ${input.runId} nicht gefunden`,
      };
    }

    // Only allow deletion of terminal states
    if (!['completed', 'failed', 'cancelled'].includes(run.status)) {
      return {
        success: false,
        error: `Run kann im Status '${run.status}' nicht gelöscht werden. Bitte zuerst abbrechen.`,
      };
    }

    // Documents and audit results are deleted via ON DELETE CASCADE
    await db.delete(deepScanV2Runs).where(eq(deepScanV2Runs.id, input.runId));

    return {
      success: true,
      data: { deleted: true },
    };
  },
});

// ====== Tool: Retry ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.RETRY,
  description:
    'Startet einen fehlgeschlagenen Deep Scan erneut, optional ab einer bestimmten Phase. Erstellt einen neuen Versuch mit erhöhter attemptNumber.',
  category: 'deep-scan',
  inputSchema: retryDeepScanInputSchema,
  async execute(
    input: RetryDeepScanInput,
    context: ToolContext
  ): Promise<ToolResult<{ runId: string; attemptNumber: number }>> {
    const run = await db.query.deepScanV2Runs.findFirst({
      where: eq(deepScanV2Runs.id, input.runId),
    });

    if (!run) {
      return {
        success: false,
        error: `Run ${input.runId} nicht gefunden`,
      };
    }

    if (run.status !== 'failed') {
      return {
        success: false,
        error: `Nur fehlgeschlagene Runs können erneut gestartet werden. Aktueller Status: ${run.status}`,
      };
    }

    if (run.attemptNumber >= run.maxAttempts) {
      return {
        success: false,
        error: `Maximale Anzahl Versuche (${run.maxAttempts}) erreicht`,
      };
    }

    const newAttemptNumber = run.attemptNumber + 1;
    const newActivityLog = appendActivityLog(run.activityLog, {
      timestamp: new Date().toISOString(),
      type: 'retry_attempted',
      message: `Versuch ${newAttemptNumber} von ${run.maxAttempts}`,
      metadata: {
        retriedBy: context.userId,
        fromPhase: input.fromPhase ?? 'last_checkpoint',
        previousError: run.errorMessage,
      },
    });

    await db
      .update(deepScanV2Runs)
      .set({
        status: 'pending',
        attemptNumber: newAttemptNumber,
        errorMessage: null,
        errorDetails: null,
        activityLog: newActivityLog,
        updatedAt: new Date(),
      })
      .where(eq(deepScanV2Runs.id, input.runId));

    // TODO: Queue new BullMQ job
    // await deepScanQueue.add('process', { runId: input.runId, fromPhase: input.fromPhase });

    return {
      success: true,
      data: { runId: input.runId, attemptNumber: newAttemptNumber },
    };
  },
});

// ====== Tool: Activity Log ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.ACTIVITY,
  description:
    'Ruft das Activity Log eines Deep Scan Runs ab. Zeigt alle Ereignisse wie Phase-Starts, Agent-Aktivitäten und Fehler.',
  category: 'deep-scan',
  inputSchema: getDeepScanActivityInputSchema,
  async execute(
    input: GetDeepScanActivityInput,
    _context: ToolContext
  ): Promise<ToolResult<{ entries: ActivityLogEntry[]; total: number }>> {
    const run = await db.query.deepScanV2Runs.findFirst({
      where: eq(deepScanV2Runs.id, input.runId),
      columns: { activityLog: true },
    });

    if (!run) {
      return {
        success: false,
        error: `Run ${input.runId} nicht gefunden`,
      };
    }

    let entries = parseJsonSafe<ActivityLogEntry[]>(run.activityLog, []);
    const total = entries.length;

    // Filter by types if specified
    if (input.types && input.types.length > 0) {
      entries = entries.filter(e => input.types!.includes(e.type));
    }

    // Apply limit
    entries = entries.slice(-input.limit);

    return {
      success: true,
      data: { entries, total },
    };
  },
});

// ====== Tool: List Runs ======

registry.register({
  name: DEEP_SCAN_TOOL_NAMES.LIST,
  description:
    'Listet Deep Scan Runs mit Filteroptionen auf. Unterstützt Filterung nach Pre-Qualification, Status und Paginierung.',
  category: 'deep-scan',
  inputSchema: listDeepScansInputSchema,
  async execute(
    input: ListDeepScansInput,
    context: ToolContext
  ): Promise<
    ToolResult<{
      runs: Array<{
        id: string;
        preQualificationId: string;
        status: DeepScanV2Status;
        progress: number;
        websiteUrl: string;
        createdAt: string;
        completedAt: string | null;
      }>;
      total: number;
      hasMore: boolean;
    }>
  > {
    // Build where conditions
    const conditions = [];

    if (input.preQualificationId) {
      conditions.push(eq(deepScanV2Runs.preQualificationId, input.preQualificationId));
    }

    if (input.status && input.status.length > 0) {
      conditions.push(inArray(deepScanV2Runs.status, input.status));
    }

    // Non-admins can only see their own runs
    if (context.userRole !== 'admin') {
      conditions.push(eq(deepScanV2Runs.userId, context.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(deepScanV2Runs)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    // Get runs with pagination
    const runs = await db.query.deepScanV2Runs.findMany({
      where: whereClause,
      columns: {
        id: true,
        preQualificationId: true,
        status: true,
        progress: true,
        websiteUrl: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy:
        input.orderDir === 'asc'
          ? [deepScanV2Runs[input.orderBy ?? 'createdAt']]
          : [desc(deepScanV2Runs[input.orderBy ?? 'createdAt'])],
      limit: input.limit,
      offset: input.offset,
    });

    return {
      success: true,
      data: {
        runs: runs.map(r => ({
          id: r.id,
          preQualificationId: r.preQualificationId,
          status: r.status as DeepScanV2Status,
          progress: r.progress,
          websiteUrl: r.websiteUrl,
          createdAt: r.createdAt?.toISOString() ?? '',
          completedAt: r.completedAt?.toISOString() ?? null,
        })),
        total,
        hasMore: (input.offset ?? 0) + runs.length < total,
      },
    };
  },
});
