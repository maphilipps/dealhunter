/**
 * DEA-164 (PA-005): Timeline Calculator
 *
 * Calculates internal delivery deadlines by working backwards from the RFP deadline.
 * Includes configurable buffers for review and QA.
 */

export interface TimelineConfig {
  /**
   * Buffer days for final review before RFP submission
   * @default 2
   */
  reviewBufferDays: number;

  /**
   * Buffer days for final QA before review
   * @default 1
   */
  qaBufferDays: number;

  /**
   * Additional safety margin (percentage of available time)
   * @default 0.1 (10%)
   */
  safetyMargin: number;
}

const DEFAULT_CONFIG: TimelineConfig = {
  reviewBufferDays: 2,
  qaBufferDays: 1,
  safetyMargin: 0.1, // 10% safety margin
};

/**
 * Calculate internal deadlines for deliverables working backwards from RFP deadline.
 *
 * Strategy:
 * 1. Reserve review + QA buffer at the end
 * 2. Divide remaining time equally among deliverables
 * 3. Apply safety margin to prevent tight deadlines
 *
 * @param rfpDeadline - The external RFP submission deadline
 * @param deliverableCount - Number of deliverables to schedule
 * @param config - Optional timeline configuration
 * @returns Array of internal deadlines, one per deliverable (in chronological order)
 *
 * @example
 * ```ts
 * const rfpDeadline = new Date('2026-02-15');
 * const deadlines = calculateInternalDeadlines(rfpDeadline, 3);
 * // Returns 3 deadlines before Feb 15, with review/QA buffers
 * ```
 */
export function calculateInternalDeadlines(
  rfpDeadline: Date,
  deliverableCount: number,
  config: Partial<TimelineConfig> = {}
): Date[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (deliverableCount === 0) {
    return [];
  }

  const now = new Date();

  // Total buffer days at the end (review + QA)
  const totalBufferDays = fullConfig.reviewBufferDays + fullConfig.qaBufferDays;

  // Calculate deadline after subtracting buffers
  const workDeadline = new Date(rfpDeadline);
  workDeadline.setDate(workDeadline.getDate() - totalBufferDays);

  // Available working days from now to work deadline
  const availableMs = workDeadline.getTime() - now.getTime();
  const availableDays = Math.floor(availableMs / (1000 * 60 * 60 * 24));

  if (availableDays <= 0) {
    // RFP deadline is too close - set all deadlines to work deadline
    console.warn(
      `RFP deadline (${rfpDeadline.toISOString()}) is too close. All deliverables set to work deadline.`
    );
    return Array.from({ length: deliverableCount }, () => new Date(workDeadline));
  }

  // Apply safety margin
  const effectiveAvailableDays = Math.floor(availableDays * (1 - fullConfig.safetyMargin));

  // Days per deliverable (distributed evenly)
  const daysPerDeliverable = Math.max(1, Math.floor(effectiveAvailableDays / deliverableCount));

  // Generate deadlines in chronological order
  const deadlines: Date[] = [];
  for (let i = 0; i < deliverableCount; i++) {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + daysPerDeliverable * (i + 1));

    // Ensure deadline doesn't exceed work deadline
    if (deadline > workDeadline) {
      deadlines.push(new Date(workDeadline));
    } else {
      deadlines.push(deadline);
    }
  }

  return deadlines;
}

/**
 * Check if a deadline is approaching (within warning threshold)
 *
 * @param deadline - The deadline to check
 * @param warningDays - Number of days before deadline to start warning
 * @returns 'overdue' | 'warning' | 'ok'
 */
export function getDeadlineStatus(
  deadline: Date,
  warningDays: number = 3
): 'overdue' | 'warning' | 'ok' {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return 'overdue';
  }

  if (diffDays < warningDays) {
    return 'warning';
  }

  return 'ok';
}
