/**
 * Status values that indicate a qualification is currently being processed.
 * Used to show appropriate UI feedback (e.g., cancel button instead of delete).
 */
export const PROCESSING_STATES = [
  'processing',
  'extracting',
  'qualification_scanning',
  'duplicate_warning',
] as const;

export type ProcessingState = (typeof PROCESSING_STATES)[number];

/**
 * Type-safe check if a status is a processing state.
 */
export function isProcessingState(status: string): status is ProcessingState {
  return (PROCESSING_STATES as readonly string[]).includes(status);
}
