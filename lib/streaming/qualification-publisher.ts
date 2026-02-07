import Redis from 'ioredis';

import {
  QualificationEventType,
  type FindingData,
  type QualificationPhaseId,
  type QualificationProcessingEvent,
} from './qualification-events';
import { REDIS_URL } from './redis-config';

const EVENT_LIST_TTL = 3600; // 1 hour
const EVENT_LIST_MAX = 500;

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });
    publisher.on('error', err => {
      console.error('[QualificationPublisher] Redis publisher error:', err);
    });
  }
  return publisher;
}

function channelKey(qualificationId: string): string {
  return `qualification:processing:${qualificationId}`;
}

function eventsListKey(qualificationId: string): string {
  return `qualification:events:${qualificationId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE PUBLISH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Publish a qualification event to both the Redis pub/sub channel
 * and persist it to a Redis List for replay.
 *
 * Errors propagate to the caller — callers are expected to handle via .catch().
 */
export async function publishQualificationEvent(
  qualificationId: string,
  event: QualificationProcessingEvent
): Promise<void> {
  const redis = getPublisher();
  const payload = JSON.stringify(event);
  const listKey = eventsListKey(qualificationId);

  await Promise.all([
    redis.publish(channelKey(qualificationId), payload),
    redis.rpush(listKey, payload),
    redis.ltrim(listKey, -EVENT_LIST_MAX, -1),
  ]);

  // Refresh TTL on every push
  await redis.expire(listKey, EVENT_LIST_TTL);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retrieve all persisted events for replay (e.g. when a client reconnects).
 */
export async function getQualificationEvents(
  qualificationId: string
): Promise<QualificationProcessingEvent[]> {
  try {
    const redis = getPublisher();
    const raw = await redis.lrange(eventsListKey(qualificationId), 0, -1);
    return raw
      .map(item => {
        try {
          return JSON.parse(item) as QualificationProcessingEvent;
        } catch {
          console.warn('[QualificationPublisher] Corrupt event, skipping');
          return null;
        }
      })
      .filter(Boolean) as QualificationProcessingEvent[];
  } catch (error) {
    console.error('[QualificationPublisher] Failed to get events:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function publishPhaseStart(
  qualificationId: string,
  phase: QualificationPhaseId,
  message: string
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.PHASE_START,
    timestamp: Date.now(),
    phase,
    data: { message },
  });
}

export async function publishPhaseComplete(
  qualificationId: string,
  phase: QualificationPhaseId,
  message?: string
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.PHASE_COMPLETE,
    timestamp: Date.now(),
    phase,
    data: message ? { message } : undefined,
  });
}

export async function publishPhaseError(
  qualificationId: string,
  phase: QualificationPhaseId,
  error: string
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.PHASE_ERROR,
    timestamp: Date.now(),
    phase,
    data: { error },
  });
}

export async function publishAgentProgress(
  qualificationId: string,
  phase: QualificationPhaseId,
  agent: string,
  message: string,
  reasoning?: string
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.AGENT_PROGRESS,
    timestamp: Date.now(),
    phase,
    data: { agent, message, reasoning },
  });
}

export async function publishProgressUpdate(
  qualificationId: string,
  phase: QualificationPhaseId,
  agent: string,
  message: string,
  progress: number
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.AGENT_PROGRESS,
    timestamp: Date.now(),
    phase,
    progress,
    data: { agent, message },
  });
}

export async function publishAgentComplete(
  qualificationId: string,
  phase: QualificationPhaseId,
  agent: string,
  confidence?: number
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.AGENT_COMPLETE,
    timestamp: Date.now(),
    phase,
    data: { agent, confidence },
  });
}

export async function publishToolCall(
  qualificationId: string,
  phase: QualificationPhaseId,
  toolName: string,
  toolArgs?: Record<string, unknown>
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.TOOL_CALL,
    timestamp: Date.now(),
    phase,
    data: { toolName, toolArgs },
  });
}

export async function publishToolResult(
  qualificationId: string,
  phase: QualificationPhaseId,
  toolName: string,
  toolResult?: string
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.TOOL_RESULT,
    timestamp: Date.now(),
    phase,
    data: { toolName, toolResult },
  });
}

export async function publishSectionStart(
  qualificationId: string,
  sectionId: string,
  sectionLabel: string
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.SECTION_START,
    timestamp: Date.now(),
    phase: 'section_orchestration',
    data: { sectionId, sectionLabel },
  });
}

export async function publishSectionComplete(
  qualificationId: string,
  sectionId: string,
  completedSections: number,
  totalSections: number
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.SECTION_COMPLETE,
    timestamp: Date.now(),
    phase: 'section_orchestration',
    data: { sectionId, completedSections, totalSections },
  });
}

export async function publishSectionQuality(
  qualificationId: string,
  sectionId: string,
  confidence: number
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.SECTION_QUALITY,
    timestamp: Date.now(),
    phase: 'section_orchestration',
    data: { sectionId, confidence },
  });
}

export async function publishCompletion(qualificationId: string, message?: string): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.COMPLETE,
    timestamp: Date.now(),
    phase: 'completion',
    progress: 100,
    data: { message: message ?? 'Verarbeitung abgeschlossen' },
  });
}

export async function publishError(qualificationId: string, error: string): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.ERROR,
    timestamp: Date.now(),
    data: { error },
  });
}

export async function publishFinding(
  qualificationId: string,
  phase: QualificationPhaseId,
  finding: FindingData
): Promise<void> {
  await publishQualificationEvent(qualificationId, {
    type: QualificationEventType.FINDING,
    timestamp: Date.now(),
    phase,
    data: { finding },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

export async function closeQualificationPublisher(): Promise<void> {
  if (publisher) {
    const p = publisher;
    publisher = null;
    try {
      await p.quit();
    } catch (err) {
      console.warn('[QualificationPublisher] Error during close:', err);
    }
  }
}
