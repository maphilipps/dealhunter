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

/**
 * Creates the reportProgress tool that updates DB and emits SSE events.
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
