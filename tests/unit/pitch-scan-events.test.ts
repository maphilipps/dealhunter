import { describe, expect, it } from 'vitest';

import {
  normalizePitchScanEvent,
  isVisiblePitchScanEvent,
  PitchScanEventType,
} from '@/lib/streaming/pitch-scan-events';

describe('pitch-scan-events', () => {
  it('normalizes timestamp strings to timestampMs', () => {
    const ev = normalizePitchScanEvent({
      type: PitchScanEventType.PHASE_START,
      timestamp: '2026-02-08T12:00:00.000Z',
      phase: 'ps-discovery',
    });

    expect(ev).not.toBeNull();
    expect(ev?.type).toBe(PitchScanEventType.PHASE_START);
    expect(typeof ev?.timestampMs).toBe('number');
    expect(ev?.timestampMs).toBe(Date.parse('2026-02-08T12:00:00.000Z'));
  });

  it('ignores malformed payloads', () => {
    expect(normalizePitchScanEvent(null)).toBeNull();
    expect(normalizePitchScanEvent({})).toBeNull();
    expect(normalizePitchScanEvent({ type: '' })).toBeNull();
  });

  it('filters visible event types', () => {
    const visible = normalizePitchScanEvent({ type: PitchScanEventType.SECTION_RESULT })!;
    const hidden = normalizePitchScanEvent({ type: 'some_internal_event' })!;
    expect(isVisiblePitchScanEvent(visible)).toBe(true);
    expect(isVisiblePitchScanEvent(hidden)).toBe(false);
  });
});
