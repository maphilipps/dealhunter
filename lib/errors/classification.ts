/**
 * Error Classification System
 *
 * Classifies errors into categories that determine retry strategies:
 * - transient: Temporary failures (network, timeouts, rate limiting) → Auto-retry
 * - permanent: Persistent failures (auth, validation) → Manual retry button
 * - user_fixable: Missing/invalid data → Manual input form
 * - critical: System failures → Support contact
 */

import { ZodError } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ErrorCategory = 'transient' | 'permanent' | 'user_fixable' | 'critical';

export type ErrorType =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'MISSING_DATA'
  | 'BROWSER_AUTOMATION_ERROR'
  | 'PDF_PARSING_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AI_EMPTY_RESPONSE'
  | 'UNKNOWN_ERROR';

export interface ClassifiedError {
  type: ErrorType;
  category: ErrorCategory;
  message: string;
  details?: unknown;
  isRetryable: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classify an error into a category and type
 *
 * @param error - The error to classify
 * @returns Classified error with category, type, and retry strategy
 */
export function classifyError(error: unknown): ClassifiedError {
  // Zod validation errors → permanent
  if (error instanceof ZodError) {
    return {
      type: 'VALIDATION_ERROR',
      category: 'permanent',
      message: 'Validation failed: ' + error.issues.map(e => e.message).join(', '),
      details: error.issues,
      isRetryable: false,
    };
  }

  // Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // AI Empty Response errors → fallback-eligible (marked transient for retry, but special handling)
    // Gemini via LiteLLM sometimes returns HTTP 200 with no choices array
    if (
      errorName.includes('typevalidationerror') ||
      errorName.includes('ai_typevalidationerror') ||
      message.includes('choices') ||
      message.includes('expected array, received undefined') ||
      message.includes('completion_tokens') ||
      message.includes('empty response')
    ) {
      return {
        type: 'AI_EMPTY_RESPONSE',
        category: 'transient', // Mark as transient so fallback can handle
        message: 'AI model returned empty response. Trying fallback model...',
        details: error,
        isRetryable: true,
      };
    }

    // Network errors → transient
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('fetch failed') ||
      errorName.includes('networkerror')
    ) {
      return {
        type: 'NETWORK_ERROR',
        category: 'transient',
        message: 'Network connection failed. Retrying...',
        details: error,
        isRetryable: true,
      };
    }

    // Timeout errors → transient
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      errorName.includes('timeouterror')
    ) {
      return {
        type: 'TIMEOUT',
        category: 'transient',
        message: 'Request timed out. Retrying with increased timeout...',
        details: error,
        isRetryable: true,
      };
    }

    // Rate limiting → transient
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many')) {
      return {
        type: 'RATE_LIMIT',
        category: 'transient',
        message: 'Rate limit exceeded. Waiting before retry...',
        details: error,
        isRetryable: true,
      };
    }

    // Authentication errors → permanent
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('invalid api key') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return {
        type: 'AUTHENTICATION_ERROR',
        category: 'permanent',
        message: 'Authentication failed. Please check API credentials.',
        details: error,
        isRetryable: false,
      };
    }

    // Missing data errors → user_fixable
    if (
      message.includes('missing') ||
      message.includes('required') ||
      message.includes('not found') ||
      message.includes('no url')
    ) {
      return {
        type: 'MISSING_DATA',
        category: 'user_fixable',
        message: 'Required data is missing. Please provide the necessary information.',
        details: error,
        isRetryable: false,
      };
    }

    // PDF parsing errors → permanent (but can try manual input)
    if (message.includes('pdf') || message.includes('parsing') || message.includes('parse error')) {
      return {
        type: 'PDF_PARSING_ERROR',
        category: 'permanent',
        message: 'PDF could not be parsed. File may be corrupted or password-protected.',
        details: error,
        isRetryable: false,
      };
    }

    // Browser automation errors → transient (Playwright failures often retry-able)
    if (
      message.includes('playwright') ||
      message.includes('browser') ||
      message.includes('page.goto') ||
      message.includes('target closed')
    ) {
      return {
        type: 'BROWSER_AUTOMATION_ERROR',
        category: 'transient',
        message: 'Browser automation failed. Retrying...',
        details: error,
        isRetryable: true,
      };
    }

    // API errors → check status code
    if (message.includes('api') || message.includes('openai') || message.includes('claude')) {
      // 5xx errors → transient (server-side issues)
      if (message.match(/5\d{2}/)) {
        return {
          type: 'API_ERROR',
          category: 'transient',
          message: 'API server error. Retrying...',
          details: error,
          isRetryable: true,
        };
      }

      // 4xx errors (except 429) → permanent
      if (message.match(/4\d{2}/) && !message.includes('429')) {
        return {
          type: 'API_ERROR',
          category: 'permanent',
          message: 'API request failed. Please check the request.',
          details: error,
          isRetryable: false,
        };
      }

      // Generic API error → permanent
      return {
        type: 'API_ERROR',
        category: 'permanent',
        message: 'API request failed.',
        details: error,
        isRetryable: false,
      };
    }
  }

  // Unknown errors → critical
  return {
    type: 'UNKNOWN_ERROR',
    category: 'critical',
    message: error instanceof Error ? error.message : 'An unknown error occurred.',
    details: error,
    isRetryable: false,
  };
}

/**
 * Check if an error is retryable based on its category
 */
export function isRetryableError(category: ErrorCategory): boolean {
  return category === 'transient';
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(classifiedError: ClassifiedError): string {
  return classifiedError.message;
}

/**
 * Get recommended action for user
 */
export function getRecommendedAction(
  category: ErrorCategory
): 'retry' | 'manual_input' | 'skip' | 'contact_support' {
  switch (category) {
    case 'transient':
      return 'retry';
    case 'user_fixable':
      return 'manual_input';
    case 'permanent':
      return 'skip';
    case 'critical':
      return 'contact_support';
  }
}
