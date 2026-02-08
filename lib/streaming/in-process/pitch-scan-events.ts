/**
 * Pitch scan progress events.
 *
 * These events are published via Redis pub/sub to `pitch:progress:{runId}`
 * and consumed by `/api/pitches/[id]/progress` (SSE) → client EventSource.
 *
 * Important: The stream may include heterogeneous payloads (snapshot hydration,
 * progress events, and chat/result events). Clients must be tolerant to unknown
 * or malformed events.
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Event Types
// -----------------------------------------------------------------------------

export const PitchScanEventType = {
  // Connection / hydration
  CONNECTED: 'connected',
  SNAPSHOT: 'snapshot',

  // Legacy progress events
  PHASE_START: 'phase_start',
  AGENT_START: 'agent_start',
  AGENT_COMPLETE: 'agent_complete',
  COMPLETE: 'complete',
  ERROR: 'error',

  // Pitch Scan v2 (chat-first)
  PLAN_CREATED: 'plan_created',
  CHAT_MESSAGE: 'chat_message',
  SECTION_RESULT: 'section_result',
} as const;

export type PitchScanEventType = (typeof PitchScanEventType)[keyof typeof PitchScanEventType];

export type PitchScanChatLevel = 'info' | 'finding' | 'warning';
export type PitchScanSectionStatus = 'completed' | 'failed';

export const pitchScanEventSchema = z
  .object({
    type: z.string(),
    timestamp: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type PitchScanRawEvent = z.infer<typeof pitchScanEventSchema> & {
  [key: string]: unknown;
};

export interface PitchScanNormalizedEvent {
  type: string;
  timestampMs: number;
  raw: PitchScanRawEvent;
}

// -----------------------------------------------------------------------------
// Normalization Helpers
// -----------------------------------------------------------------------------

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * Best-effort normalization: returns null for unparseable payloads.
 */
export function normalizePitchScanEvent(input: unknown): PitchScanNormalizedEvent | null {
  const parsed = pitchScanEventSchema.safeParse(input);
  if (!parsed.success) return null;

  const raw = parsed.data as PitchScanRawEvent;
  if (typeof raw.type !== 'string' || raw.type.length === 0) return null;

  return {
    type: raw.type,
    timestampMs: parseTimestampMs(raw.timestamp) ?? Date.now(),
    raw,
  };
}

// -----------------------------------------------------------------------------
// Visibility
// -----------------------------------------------------------------------------

export function isVisiblePitchScanEvent(event: PitchScanNormalizedEvent): boolean {
  return (
    event.type === PitchScanEventType.PLAN_CREATED ||
    event.type === PitchScanEventType.CHAT_MESSAGE ||
    event.type === PitchScanEventType.SECTION_RESULT ||
    event.type === PitchScanEventType.PHASE_START ||
    event.type === PitchScanEventType.AGENT_COMPLETE ||
    event.type === PitchScanEventType.ERROR ||
    event.type === PitchScanEventType.COMPLETE
  );
}
