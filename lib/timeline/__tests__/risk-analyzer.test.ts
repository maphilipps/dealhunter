import { describe, it, expect } from 'vitest';

import {
  analyzeTimelineRisk,
  getRiskBadgeVariant,
  getRiskIcon,
  formatTimelineSummary,
} from '../risk-analyzer';
import type { ProjectTimeline } from '../schema';

// Mock timeline for testing
const mockTimeline: ProjectTimeline = {
  totalDays: 120,
  totalWeeks: 24,
  totalMonths: 6,
  estimatedStart: null,
  estimatedGoLive: null,
  phases: [
    {
      name: 'Setup & Discovery',
      durationDays: 12,
      startDay: 0,
      endDay: 11,
      keyActivities: ['Kickoff', 'Requirements'],
    },
    {
      name: 'Development',
      durationDays: 60,
      startDay: 12,
      endDay: 71,
      keyActivities: ['Frontend', 'Backend'],
    },
    {
      name: 'Testing',
      durationDays: 30,
      startDay: 72,
      endDay: 101,
      keyActivities: ['QA', 'UAT'],
    },
    {
      name: 'Go-Live',
      durationDays: 18,
      startDay: 102,
      endDay: 119,
      keyActivities: ['Deployment', 'Training'],
    },
  ],
  assumedTeamSize: {
    min: 2,
    optimal: 4,
    max: 6,
  },
  confidence: 75,
  assumptions: ['Standard team size', 'No major blockers'],
  calculationBasis: {
    contentVolume: '100 pages',
    complexity: 'medium',
    integrations: 2,
    hasCriticalDeadline: false,
  },
  generatedAt: new Date().toISOString(),
  phase: 'quick_scan',
};

describe('analyzeTimelineRisk', () => {
  it('should return LOW risk when no deadline is provided', () => {
    const result = analyzeTimelineRisk(null, mockTimeline);

    expect(result.risk).toBe('LOW');
    expect(result.deltaDays).toBe(0);
    expect(result.isRealistic).toBe(true);
    expect(result.rfpDeadline).toBeNull();
    expect(result.aiEstimatedCompletion).toBeNull();
    expect(result.warning).toContain('Keine Pre-Qualification-Deadline');
  });

  it('should return HIGH risk when Pre-Qualification deadline is >30 days before AI estimate', () => {
    // AI needs 120 working days (~24 weeks = ~168 calendar days)
    // Pre-Qualification only gives 60 calendar days (~42 working days)
    // Delta: 42 - 120 = -78 working days (HIGH risk)
    const today = new Date('2026-01-21');
    const rfpDeadline = new Date(today);
    rfpDeadline.setDate(rfpDeadline.getDate() + 60); // 60 calendar days

    const result = analyzeTimelineRisk(rfpDeadline, mockTimeline, today);

    expect(result.risk).toBe('HIGH');
    expect(result.isRealistic).toBe(false);
    expect(result.warning).toContain('Unrealistische Timeline');
    expect(result.warning).toContain('Wochen');
    expect(result.deltaDays).toBeLessThan(-30); // More than 30 days short
  });

  it('should return MEDIUM risk when Pre-Qualification deadline is 0-30 days before AI estimate', () => {
    // AI needs 120 working days (~168 calendar days)
    // Pre-Qualification gives ~150 calendar days (~107 working days)
    // Delta: 107 - 120 = -13 working days (MEDIUM risk)
    const today = new Date('2026-01-21');
    const rfpDeadline = new Date(today);
    rfpDeadline.setDate(rfpDeadline.getDate() + 150); // 150 calendar days

    const result = analyzeTimelineRisk(rfpDeadline, mockTimeline, today);

    expect(result.risk).toBe('MEDIUM');
    expect(result.isRealistic).toBe(false);
    expect(result.warning).toContain('Timeline knapp');
    expect(result.warning).toContain('weniger Buffer');
    expect(result.deltaDays).toBeGreaterThan(-30); // Less than 30 days short
    expect(result.deltaDays).toBeLessThan(0); // Still negative
  });

  it('should return LOW risk when Pre-Qualification deadline has buffer', () => {
    // AI needs 120 working days, Pre-Qualification gives 150 working days
    const today = new Date('2026-01-21');
    const rfpDeadline = new Date(today);
    // Add 150 working days (approx 210 calendar days accounting for weekends)
    rfpDeadline.setDate(rfpDeadline.getDate() + 210);

    const result = analyzeTimelineRisk(rfpDeadline, mockTimeline, today);

    expect(result.risk).toBe('LOW');
    expect(result.isRealistic).toBe(true);
    expect(result.warning).toContain('realistisch');
    expect(result.warning).toContain('Buffer');
    expect(result.deltaDays).toBeGreaterThan(0);
  });

  it('should handle string Pre-Qualification deadline', () => {
    const today = new Date('2026-01-21');
    const rfpDeadline = new Date(today);
    rfpDeadline.setDate(rfpDeadline.getDate() + 210);

    const result = analyzeTimelineRisk(rfpDeadline.toISOString(), mockTimeline, today);

    expect(result.risk).toBe('LOW');
    expect(result.rfpDeadline).toBe(rfpDeadline.toISOString());
  });

  it('should use current date as default start if not provided', () => {
    const rfpDeadline = new Date();
    rfpDeadline.setDate(rfpDeadline.getDate() + 210);

    const result = analyzeTimelineRisk(rfpDeadline, mockTimeline);

    expect(result.risk).toBeDefined();
    expect(result.aiEstimatedCompletion).not.toBeNull();
  });

  it('should calculate AI estimated completion correctly', () => {
    const today = new Date('2026-01-21');
    const rfpDeadline = new Date(today);
    rfpDeadline.setDate(rfpDeadline.getDate() + 210);

    const result = analyzeTimelineRisk(rfpDeadline, mockTimeline, today);

    expect(result.aiEstimatedCompletion).not.toBeNull();
    if (result.aiEstimatedCompletion) {
      const aiDate = new Date(result.aiEstimatedCompletion);
      expect(aiDate.getTime()).toBeGreaterThan(today.getTime());
    }
  });
});

describe('getRiskBadgeVariant', () => {
  it('should return destructive variant for HIGH risk', () => {
    expect(getRiskBadgeVariant('HIGH')).toBe('destructive');
  });

  it('should return warning variant for MEDIUM risk', () => {
    expect(getRiskBadgeVariant('MEDIUM')).toBe('warning');
  });

  it('should return success variant for LOW risk', () => {
    expect(getRiskBadgeVariant('LOW')).toBe('success');
  });
});

describe('getRiskIcon', () => {
  it('should return red circle for HIGH risk', () => {
    expect(getRiskIcon('HIGH')).toBe('🔴');
  });

  it('should return yellow circle for MEDIUM risk', () => {
    expect(getRiskIcon('MEDIUM')).toBe('🟡');
  });

  it('should return green circle for LOW risk', () => {
    expect(getRiskIcon('LOW')).toBe('🟢');
  });
});

describe('formatTimelineSummary', () => {
  it('should format timeline summary correctly', () => {
    const result = formatTimelineSummary(mockTimeline);

    expect(result).toBe('120 Arbeitstage / 24 Wochen / 6 Monate');
  });

  it('should handle different timeline values', () => {
    const customTimeline: ProjectTimeline = {
      ...mockTimeline,
      totalDays: 60,
      totalWeeks: 12,
      totalMonths: 3,
    };

    const result = formatTimelineSummary(customTimeline);

    expect(result).toBe('60 Arbeitstage / 12 Wochen / 3 Monate');
  });
});
