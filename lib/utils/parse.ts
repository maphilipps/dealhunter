/**
 * Safe JSON parse utility
 * Wraps JSON.parse in a try-catch to prevent runtime crashes
 */
export function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', value.slice(0, 100), error);
    return fallback;
  }
}

/**
 * Safe JSON parse that returns null on failure
 */
export function safeJsonParseOrNull<T>(
  value: string | null | undefined
): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', value.slice(0, 100), error);
    return null;
  }
}
