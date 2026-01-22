/**
 * Safely parse JSON strings with fallback support
 * @param json - JSON string to parse (can be null/undefined)
 * @param fallback - Value to return if parsing fails
 * @returns Parsed JSON object or fallback value
 */
export function parseJsonField<T>(json: string | null | undefined, fallback: T): T {
  if (!json) {
    return fallback;
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely parse JSON from unknown value (string or already parsed object)
 * Useful when database field might be string or already parsed
 * @param value - Value to parse (can be string, object, null, undefined)
 * @returns Parsed JSON object or null
 */
export function parseJsonValue<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object') {
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}
