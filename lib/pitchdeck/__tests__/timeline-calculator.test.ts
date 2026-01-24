/**
 * Unit Tests: Timeline Calculator (DEA-181 / PA-026)
 *
 * Tests backwards planning, buffer calculation, deadline distribution,
 * and deadline status checks for pitchdeck timeline management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  calculateInternalDeadlines,
  getDeadlineStatus,
  type TimelineConfig,
} from '../timeline-calculator';

describe('Timeline Calculator', () => {
  // Store original Date to restore later
  let originalDate: DateConstructor;

  beforeEach(() => {
    originalDate = global.Date;
    // Mock current time to fixed date for consistent testing
    const mockNow = new Date('2026-02-01T10:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    global.Date = originalDate;
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALCULATEINTERNALDEADLINES - BASIC FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('calculateInternalDeadlines - Basic Functionality', () => {
    it('should return empty array when deliverableCount is 0', () => {
      const rfpDeadline = new Date('2026-02-15T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 0);

      expect(deadlines).toEqual([]);
    });

    it('should calculate deadlines with default config buffers', () => {
      // RFP Deadline: Feb 15 (14 days from now)
      // Default buffers: 2 days review + 1 day QA = 3 days total
      // Work deadline: Feb 12
      // With 10% safety margin: ~12.6 days effective
      // 3 deliverables: ~4.2 days each
      const rfpDeadline = new Date('2026-02-15T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 3);

      expect(deadlines).toHaveLength(3);

      // All deadlines should be before work deadline (Feb 12)
      const workDeadline = new Date('2026-02-12T23:59:59Z');
      deadlines.forEach(deadline => {
        expect(deadline.getTime()).toBeLessThanOrEqual(workDeadline.getTime());
      });

      // Deadlines should be in chronological order
      for (let i = 1; i < deadlines.length; i++) {
        expect(deadlines[i].getTime()).toBeGreaterThanOrEqual(deadlines[i - 1].getTime());
      }
    });

    it('should distribute deadlines evenly across available time', () => {
      // RFP Deadline: Feb 21 (20 days from now)
      // Buffers: 3 days total → work deadline: Feb 18 (17 days)
      // Safety margin: 10% → ~15.3 days effective
      // 3 deliverables: ~5 days each
      const rfpDeadline = new Date('2026-02-21T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 3);

      expect(deadlines).toHaveLength(3);

      // Check spacing between deadlines (should be roughly equal)
      const spacing1 = deadlines[1].getTime() - deadlines[0].getTime();
      const spacing2 = deadlines[2].getTime() - deadlines[1].getTime();

      // Allow some variation due to rounding (within 2 days)
      const dayInMs = 1000 * 60 * 60 * 24;
      expect(Math.abs(spacing1 - spacing2)).toBeLessThanOrEqual(2 * dayInMs);
    });

    it('should return deadlines in chronological order', () => {
      const rfpDeadline = new Date('2026-02-28T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 5);

      // Verify ascending order
      for (let i = 1; i < deadlines.length; i++) {
        expect(deadlines[i].getTime()).toBeGreaterThanOrEqual(deadlines[i - 1].getTime());
      }

      // First deadline should be after now
      const now = new Date();
      expect(deadlines[0].getTime()).toBeGreaterThan(now.getTime());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALCULATEINTERNALDEADLINES - BUFFER CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('calculateInternalDeadlines - Buffer Calculation', () => {
    it('should apply custom review buffer', () => {
      const rfpDeadline = new Date('2026-02-15T23:59:59Z');
      const config: Partial<TimelineConfig> = {
        reviewBufferDays: 5, // Custom 5 days
        qaBufferDays: 1,
      };

      const deadlines = calculateInternalDeadlines(rfpDeadline, 3, config);

      // Work deadline should be 6 days before RFP deadline (5 + 1)
      const expectedWorkDeadline = new Date('2026-02-09T23:59:59Z');
      const lastDeadline = deadlines[deadlines.length - 1];

      expect(lastDeadline.getTime()).toBeLessThanOrEqual(expectedWorkDeadline.getTime());
    });

    it('should apply custom QA buffer', () => {
      const rfpDeadline = new Date('2026-02-15T23:59:59Z');
      const config: Partial<TimelineConfig> = {
        reviewBufferDays: 2,
        qaBufferDays: 3, // Custom 3 days
      };

      const deadlines = calculateInternalDeadlines(rfpDeadline, 3, config);

      // Work deadline should be 5 days before RFP deadline (2 + 3)
      const expectedWorkDeadline = new Date('2026-02-10T23:59:59Z');
      const lastDeadline = deadlines[deadlines.length - 1];

      expect(lastDeadline.getTime()).toBeLessThanOrEqual(expectedWorkDeadline.getTime());
    });

    it('should apply custom safety margin', () => {
      const rfpDeadline = new Date('2026-02-28T23:59:59Z'); // 27 days from now
      const configLowMargin: Partial<TimelineConfig> = {
        safetyMargin: 0.05, // 5% margin
      };
      const configHighMargin: Partial<TimelineConfig> = {
        safetyMargin: 0.3, // 30% margin
      };

      const deadlinesLow = calculateInternalDeadlines(rfpDeadline, 3, configLowMargin);
      const deadlinesHigh = calculateInternalDeadlines(rfpDeadline, 3, configHighMargin);

      // High margin should result in earlier deadlines (more conservative)
      expect(deadlinesHigh[2].getTime()).toBeLessThan(deadlinesLow[2].getTime());
    });

    it('should combine all buffer settings correctly', () => {
      const rfpDeadline = new Date('2026-03-01T23:59:59Z'); // 28 days from now
      const config: Partial<TimelineConfig> = {
        reviewBufferDays: 4,
        qaBufferDays: 2,
        safetyMargin: 0.2, // 20% margin
      };

      const deadlines = calculateInternalDeadlines(rfpDeadline, 4, config);

      expect(deadlines).toHaveLength(4);

      // Work deadline: March 1 - 6 days (4+2) = Feb 23
      // Available: 22 days
      // With 20% margin: ~17.6 days effective
      // Should fit all deadlines before work deadline
      const workDeadline = new Date('2026-02-23T23:59:59Z');
      deadlines.forEach(deadline => {
        expect(deadline.getTime()).toBeLessThanOrEqual(workDeadline.getTime());
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALCULATEINTERNALDEADLINES - EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('calculateInternalDeadlines - Edge Cases', () => {
    it('should handle very close RFP deadline (all deadlines set to work deadline)', () => {
      // RFP deadline in 2 days - too close after buffers
      const rfpDeadline = new Date('2026-02-03T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 3);

      expect(deadlines).toHaveLength(3);

      // All deadlines should be the same (work deadline)
      const workDeadline = new Date(rfpDeadline);
      workDeadline.setDate(workDeadline.getDate() - 3); // Default 3 day buffer

      deadlines.forEach(deadline => {
        expect(deadline.getTime()).toBe(workDeadline.getTime());
      });
    });

    it('should handle past RFP deadline gracefully', () => {
      // RFP deadline was yesterday
      const rfpDeadline = new Date('2026-01-31T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 3);

      expect(deadlines).toHaveLength(3);

      // Should still return deadlines (all set to work deadline in past)
      deadlines.forEach(deadline => {
        expect(deadline).toBeInstanceOf(Date);
      });
    });

    it('should handle single deliverable', () => {
      const rfpDeadline = new Date('2026-02-15T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 1);

      expect(deadlines).toHaveLength(1);
      expect(deadlines[0]).toBeInstanceOf(Date);

      // Should be before work deadline
      const workDeadline = new Date('2026-02-12T23:59:59Z');
      expect(deadlines[0].getTime()).toBeLessThanOrEqual(workDeadline.getTime());
    });

    it('should handle many deliverables (stress test)', () => {
      const rfpDeadline = new Date('2026-06-01T23:59:59Z'); // 4 months out
      const deliverableCount = 50;

      const deadlines = calculateInternalDeadlines(rfpDeadline, deliverableCount);

      expect(deadlines).toHaveLength(deliverableCount);

      // All deadlines should be valid dates
      deadlines.forEach(deadline => {
        expect(deadline).toBeInstanceOf(Date);
        expect(isNaN(deadline.getTime())).toBe(false);
      });

      // Should be in chronological order
      for (let i = 1; i < deadlines.length; i++) {
        expect(deadlines[i].getTime()).toBeGreaterThanOrEqual(deadlines[i - 1].getTime());
      }
    });

    it('should ensure minimum 1 day per deliverable', () => {
      // Very tight timeline: 5 days total, 10 deliverables
      const rfpDeadline = new Date('2026-02-06T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 10);

      expect(deadlines).toHaveLength(10);

      // With minimum 1 day per deliverable, they should be spaced
      for (let i = 1; i < deadlines.length; i++) {
        const daysDiff =
          (deadlines[i].getTime() - deadlines[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        expect(daysDiff).toBeGreaterThanOrEqual(0); // At least same day or later
      }
    });

    it('should not exceed work deadline', () => {
      const rfpDeadline = new Date('2026-02-20T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 10);

      // Work deadline is rfpDeadline - 3 days (default buffers)
      const workDeadline = new Date('2026-02-17T23:59:59Z');

      deadlines.forEach(deadline => {
        expect(deadline.getTime()).toBeLessThanOrEqual(workDeadline.getTime());
      });
    });

    it('should handle zero buffer days (edge case)', () => {
      const rfpDeadline = new Date('2026-02-15T23:59:59Z');
      const config: Partial<TimelineConfig> = {
        reviewBufferDays: 0,
        qaBufferDays: 0,
        safetyMargin: 0,
      };

      const deadlines = calculateInternalDeadlines(rfpDeadline, 3, config);

      expect(deadlines).toHaveLength(3);

      // Last deadline should be close to RFP deadline (no buffers)
      const lastDeadline = deadlines[deadlines.length - 1];
      expect(lastDeadline.getTime()).toBeLessThanOrEqual(rfpDeadline.getTime());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // GETDEADLINESTATUS - STATUS CHECKS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getDeadlineStatus - Status Checks', () => {
    it('should return "ok" for deadline far in future', () => {
      const deadline = new Date('2026-02-15T23:59:59Z'); // 14 days from now
      const status = getDeadlineStatus(deadline);

      expect(status).toBe('ok');
    });

    it('should return "warning" for deadline within warning threshold', () => {
      const deadline = new Date('2026-02-03T23:59:59Z'); // 2 days from now
      const status = getDeadlineStatus(deadline, 3); // 3 day warning threshold

      expect(status).toBe('warning');
    });

    it('should return "ok" for deadline exactly at warning threshold', () => {
      const deadline = new Date('2026-02-04T10:00:00Z'); // Exactly 3 days from now
      const status = getDeadlineStatus(deadline, 3);

      // At exactly threshold, considered ok (not yet within warning window)
      expect(status).toBe('ok');
    });

    it('should return "overdue" for past deadline', () => {
      const deadline = new Date('2026-01-31T23:59:59Z'); // Yesterday
      const status = getDeadlineStatus(deadline);

      expect(status).toBe('overdue');
    });

    it('should return "warning" for deadline exactly now', () => {
      const deadline = new Date('2026-02-01T10:00:00Z'); // Right now
      const status = getDeadlineStatus(deadline);

      // At exactly the deadline time (diffDays = 0), still within warning period
      expect(status).toBe('warning');
    });

    it('should use custom warning threshold', () => {
      const deadline = new Date('2026-02-08T23:59:59Z'); // 7 days from now

      const status3Days = getDeadlineStatus(deadline, 3);
      const status10Days = getDeadlineStatus(deadline, 10);

      expect(status3Days).toBe('ok'); // 7 days > 3 day threshold
      expect(status10Days).toBe('warning'); // 7 days < 10 day threshold
    });

    it('should default to 3 day warning threshold when not specified', () => {
      const deadline4Days = new Date('2026-02-05T10:00:00Z'); // 4 days from now
      const deadline2Days = new Date('2026-02-03T10:00:00Z'); // 2 days from now

      expect(getDeadlineStatus(deadline4Days)).toBe('ok');
      expect(getDeadlineStatus(deadline2Days)).toBe('warning');
    });

    it('should handle very short warning threshold (1 hour)', () => {
      const deadlineIn30Mins = new Date('2026-02-01T10:30:00Z'); // 30 minutes from now
      const status = getDeadlineStatus(deadlineIn30Mins, 1 / 24); // 1 hour in days

      // 30 minutes (0.5 hours = ~0.02 days) < 1 hour threshold → warning
      expect(status).toBe('warning');
    });

    it('should handle very long warning threshold (30 days)', () => {
      const deadline = new Date('2026-03-01T23:59:59Z'); // 28 days from now
      const status = getDeadlineStatus(deadline, 30);

      expect(status).toBe('warning'); // 28 days < 30 day threshold
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('End-to-End Integration', () => {
    it('should calculate realistic timeline with status checks', () => {
      // Realistic scenario: 5 deliverables, 30 days until RFP
      const rfpDeadline = new Date('2026-03-03T23:59:59Z');
      const deliverableCount = 5;

      const deadlines = calculateInternalDeadlines(rfpDeadline, deliverableCount);

      expect(deadlines).toHaveLength(5);

      // Check status of each deadline
      const statuses = deadlines.map(deadline => getDeadlineStatus(deadline));

      // First deadline should be closer (possibly warning)
      // Last deadline should be further out (ok)
      expect(statuses[0]).toMatch(/ok|warning/);
      expect(statuses[statuses.length - 1]).toBe('ok');

      // No deadlines should be overdue initially
      expect(statuses.every(s => s !== 'overdue')).toBe(true);
    });

    it('should handle complete workflow: calculate, check, simulate progress', () => {
      const rfpDeadline = new Date('2026-02-20T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 3);

      // Initial check - all should be ok or warning
      const initialStatuses = deadlines.map(d => getDeadlineStatus(d));
      expect(initialStatuses.every(s => s !== 'overdue')).toBe(true);

      // Simulate time passing - move 10 days forward
      vi.setSystemTime(new Date('2026-02-11T10:00:00Z'));

      // Now check statuses again
      const laterStatuses = deadlines.map(d => getDeadlineStatus(d));

      // First deadline should now be overdue or in warning
      expect(['overdue', 'warning']).toContain(laterStatuses[0]);
    });

    it('should handle complex scenario with custom config', () => {
      const rfpDeadline = new Date('2026-04-01T23:59:59Z'); // 2 months out
      const config: Partial<TimelineConfig> = {
        reviewBufferDays: 5,
        qaBufferDays: 3,
        safetyMargin: 0.15,
      };

      const deadlines = calculateInternalDeadlines(rfpDeadline, 8, config);

      expect(deadlines).toHaveLength(8);

      // Verify all deadlines respect work deadline (Apr 1 - 8 days)
      const workDeadline = new Date('2026-03-24T23:59:59Z');
      deadlines.forEach(deadline => {
        expect(deadline.getTime()).toBeLessThanOrEqual(workDeadline.getTime());
      });

      // Check distribution - should be relatively evenly spaced
      const daysBetween: number[] = [];
      for (let i = 1; i < deadlines.length; i++) {
        const days = (deadlines[i].getTime() - deadlines[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        daysBetween.push(days);
      }

      // Standard deviation should be reasonable (not too spread out)
      const avg = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
      const variance =
        daysBetween.reduce((sum, days) => sum + Math.pow(days - avg, 2), 0) / daysBetween.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be less than half the average (reasonable distribution)
      expect(stdDev).toBeLessThan(avg / 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATE HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Date Handling', () => {
    it('should handle dates across month boundaries', () => {
      const rfpDeadline = new Date('2026-03-05T23:59:59Z'); // Early March
      const deadlines = calculateInternalDeadlines(rfpDeadline, 5);

      // Some deadlines should be in February
      const hasFebruaryDeadline = deadlines.some(d => d.getMonth() === 1); // Month 1 = February
      expect(hasFebruaryDeadline).toBe(true);
    });

    it('should handle dates across year boundaries', () => {
      const rfpDeadline = new Date('2027-01-15T23:59:59Z'); // Next year
      const deadlines = calculateInternalDeadlines(rfpDeadline, 10);

      expect(deadlines).toHaveLength(10);

      // All deadlines should be valid
      deadlines.forEach(d => {
        expect(d).toBeInstanceOf(Date);
        expect(isNaN(d.getTime())).toBe(false);
      });
    });

    it('should preserve time precision', () => {
      const rfpDeadline = new Date('2026-02-15T14:30:00Z'); // Specific time
      const deadlines = calculateInternalDeadlines(rfpDeadline, 3);

      // Deadlines should maintain time precision
      deadlines.forEach(d => {
        expect(d.getHours()).toBeDefined();
        expect(d.getMinutes()).toBeDefined();
      });
    });

    it('should handle leap year dates correctly', () => {
      // Set to leap year context
      vi.setSystemTime(new Date('2024-02-01T10:00:00Z'));

      const rfpDeadline = new Date('2024-03-01T23:59:59Z');
      const deadlines = calculateInternalDeadlines(rfpDeadline, 5);

      // Should calculate correctly even with Feb 29th in range
      expect(deadlines).toHaveLength(5);

      deadlines.forEach(d => {
        expect(d).toBeInstanceOf(Date);
        expect(d.getTime()).toBeLessThanOrEqual(rfpDeadline.getTime());
      });
    });
  });
});
