/**
 * QualificationScan Utilities - Shared helper functions
 * Consolidated from multiple components to reduce duplication
 */

/**
 * Safely parse JSON fields from database
 * Handles both string (from raw DB) and already-parsed objects (from API)
 *
 * @example
 * const techStack = parseJsonField<TechStackData>(qualificationScan.techStack);
 */
export function parseJsonField<T>(value: unknown): T | null {
  if (!value) return null;

  // If already an object, return as-is
  if (typeof value === 'object') {
    return value as T;
  }

  // Otherwise parse the JSON string
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Type guard for checking if a value is a non-empty object
 */
export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}

/**
 * Get color class for audit scores
 */
export function getScoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get badge variant for audit scores
 */
export function getScoreBadgeVariant(
  score: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

/**
 * Get migration score color class
 */
export function getMigrationScoreColor(score: number): string {
  if (score < 30) return 'text-green-600';
  if (score < 50) return 'text-yellow-600';
  if (score < 70) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get migration recommendation label in German
 */
export function getMigrationRecommendationLabel(recommendation: string): string {
  const labels: Record<string, string> = {
    easy: 'Einfach',
    simple: 'Einfach',
    moderate: 'Mittel',
    complex: 'Komplex',
    very_complex: 'Sehr Komplex',
  };
  return labels[recommendation] || recommendation;
}

/**
 * Get load time label in German
 */
export function getLoadTimeLabel(loadTime: 'fast' | 'medium' | 'slow'): string {
  const labels: Record<string, string> = {
    fast: 'Schnell',
    medium: 'Mittel',
    slow: 'Langsam',
  };
  return labels[loadTime] || loadTime;
}

/**
 * Get complexity label in German
 */
export function getComplexityLabel(complexity: string): string {
  const labels: Record<string, string> = {
    low: 'Niedrig',
    simple: 'Einfach',
    medium: 'Mittel',
    moderate: 'Moderat',
    high: 'Hoch',
    complex: 'Komplex',
    very_complex: 'Sehr Komplex',
  };
  return labels[complexity] || complexity;
}

/**
 * Format byte size to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
