import { tool } from 'ai';
import { z } from 'zod';
import Redis from 'ioredis';

import { updateRunStatus } from '../checkpoints';
import type { ProgressEvent } from '../types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });
    publisher.on('error', err => {
      console.error('[Progress] Redis publisher error:', err);
    });
  }
  return publisher;
}

/**
 * Publish any JSON payload to a pitch progress channel via Redis pub/sub.
 */
export async function publishToChannel(runId: string, payload: object): Promise<void> {
  try {
    const redis = getPublisher();
    await redis.publish(`pitch:progress:${runId}`, JSON.stringify(payload));
  } catch (error) {
    console.error('[Progress] Failed to publish to channel:', error);
  }
}

/**
 * Publish a progress event via Redis pub/sub for SSE consumption.
 */
async function publishProgress(runId: string, event: ProgressEvent): Promise<void> {
  await publishToChannel(runId, event);
}

// =============================================================================
// PRIMITIVE TOOLS
// These are atomic operations that do ONE thing each.
// The agent should compose these rather than using the convenience wrapper.
// =============================================================================

/**
 * PRIMITIVE: Update progress in the database only.
 * Does NOT publish SSE events.
 */
export function createUpdateProgressDbTool(params: { runId: string }) {
  return tool({
    description:
      'Speichere den Fortschritt in der Datenbank. ' +
      'Nutze publishProgressEvent separat für SSE-Events.',
    inputSchema: z.object({
      progress: z.number().min(0).max(100).describe('Fortschritt in Prozent (0-100)'),
      currentStep: z.string().describe('Aktuelle Statusmeldung'),
    }),
    execute: async ({ progress, currentStep }) => {
      await updateRunStatus(params.runId, 'running', {
        progress,
        currentStep,
      });
      return { updated: true, progress, currentStep };
    },
  });
}

/**
 * PRIMITIVE: Publish a progress event via SSE only.
 * Does NOT update the database.
 */
export function createPublishProgressEventTool(params: { runId: string }) {
  return tool({
    description:
      'Sende ein Progress-Event via SSE an den Client. ' +
      'Nutze updateProgressDb separat für Datenbank-Updates.',
    inputSchema: z.object({
      type: z
        .enum([
          'phase_start',
          'agent_start',
          'agent_complete',
          'document_ready',
          'question',
          'answer_received',
          'complete',
          'error',
        ])
        .describe('Event-Typ'),
      phase: z.string().describe('Aktuelle Phase (audit, analysis, generation)'),
      progress: z.number().min(0).max(100).describe('Fortschritt in Prozent (0-100)'),
      message: z.string().describe('Statusmeldung für den User'),
      agent: z.string().optional().describe('Name des aktiven Agents (optional)'),
    }),
    execute: async ({ type, phase, progress, message, agent }) => {
      const event: ProgressEvent = {
        type,
        phase,
        agent,
        progress,
        message,
        timestamp: new Date().toISOString(),
      };
      await publishProgress(params.runId, event);
      return { published: true, event };
    },
  });
}

// =============================================================================
// CONVENIENCE WRAPPER (for backward compatibility)
// This combines DB update + SSE publish. Prefer using primitives above.
// =============================================================================

/**
 * CONVENIENCE WRAPPER: Updates DB and emits SSE events in one call.
 * @deprecated Prefer using createUpdateProgressDbTool + createPublishProgressEventTool
 */
export function createProgressTool(params: { runId: string }) {
  return tool({
    description:
      'Melde den aktuellen Fortschritt der Pipeline. ' +
      'Rufe dieses Tool regelmäßig auf, damit der User den Status sieht.',
    inputSchema: z.object({
      phase: z.string().describe('Aktuelle Phase (audit, analysis, generation)'),
      progress: z.number().min(0).max(100).describe('Fortschritt in Prozent (0-100)'),
      message: z.string().describe('Statusmeldung für den User'),
      agent: z.string().optional().describe('Name des aktiven Agents (optional)'),
    }),
    execute: async ({ phase, progress, message, agent }) => {
      // Update DB
      await updateRunStatus(params.runId, 'running', {
        progress,
        currentStep: message,
      });

      // Publish SSE event
      const event: ProgressEvent = {
        type: agent ? 'agent_start' : 'phase_start',
        phase,
        agent,
        progress,
        message,
        timestamp: new Date().toISOString(),
      };

      await publishProgress(params.runId, event);

      return { reported: true, progress, message };
    },
  });
}

/**
 * Publish a completion event. Called by the orchestrator after all work is done.
 */
export async function publishCompletion(runId: string, documentId?: string): Promise<void> {
  const event: ProgressEvent = {
    type: 'complete',
    phase: 'complete',
    progress: 100,
    message: 'Pipeline abgeschlossen',
    documentId,
    timestamp: new Date().toISOString(),
  };

  await publishProgress(runId, event);
}

/**
 * Publish an error event. Called by the orchestrator on failure.
 */
export async function publishError(runId: string, errorMessage: string): Promise<void> {
  const event: ProgressEvent = {
    type: 'error',
    phase: 'error',
    progress: 0,
    message: errorMessage,
    timestamp: new Date().toISOString(),
  };

  await publishProgress(runId, event);
}

/**
 * Cleanup the Redis publisher connection.
 */
export async function closeProgressPublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
