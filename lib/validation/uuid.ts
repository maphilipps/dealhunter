/**
 * UUID Validation Utilities
 *
 * Validates UUID v4 format in route parameters and user input.
 * Prevents injection attacks and invalid database queries.
 */

/**
 * Regular expression for UUID v4 validation
 * Matches format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID v4
 *
 * @param value - The value to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUuid(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_V4_REGEX.test(value);
}

/**
 * Asserts that a value is a valid UUID v4
 * Throws an error if validation fails
 *
 * @param value - The value to validate
 * @param paramName - Parameter name for error message
 * @throws {Error} If value is not a valid UUID v4
 */
export function assertValidUuid(value: unknown, paramName = 'id'): asserts value is string {
  if (!isValidUuid(value)) {
    throw new Error(`Invalid ${paramName}: expected valid UUID v4, got "${value}"`);
  }
}

/**
 * Safely extracts UUID from route params
 * Returns null if invalid, throws if missing
 *
 * @param params - Route parameters object
 * @param paramName - Parameter name to extract (default: 'id')
 * @returns Valid UUID string
 * @throws {Error} If parameter is missing or invalid
 */
export function getUuidFromParams(
  params: Record<string, string | string[] | undefined>,
  paramName = 'id'
): string {
  const value = params[paramName];

  if (!value) {
    throw new Error(`Missing required parameter: ${paramName}`);
  }

  // Handle arrays (e.g., dynamic routes with [...slug])
  const uuidValue = Array.isArray(value) ? value[0] : value;

  if (!isValidUuid(uuidValue)) {
    throw new Error(`Invalid ${paramName}: expected valid UUID v4, got "${uuidValue}"`);
  }

  return uuidValue;
}
