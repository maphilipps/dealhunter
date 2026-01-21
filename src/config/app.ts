/**
 * Centralized application configuration
 *
 * This file contains all configuration values used throughout the application.
 * Values can be overridden using environment variables for different environments.
 *
 * @see https://github.com/adesso-digital-experience/dealhunter/blob/main/CLAUDE.md
 */

/**
 * AI Configuration
 *
 * Controls AI model settings for requirement extraction and analysis.
 *
 * - baseUrl: adesso AI Hub endpoint (can be overridden with AI_HUB_URL env var)
 * - model: AI model to use for generation (can be overridden with AI_MODEL env var)
 */
export const aiConfig = {
  baseUrl: process.env.AI_HUB_URL || 'https://adesso-ai-hub.3asabc.de/v1',
  model: process.env.AI_MODEL || 'gpt-oss-120b-sovereign',
} as const;

/**
 * Upload Configuration
 *
 * Defines limits and validation rules for file uploads and text input.
 *
 * - maxPdfSize: Maximum PDF file size in bytes (5MB)
 * - minTextLength: Minimum text input length for quality assurance
 * - maxTextLength: Maximum text input length to prevent oversized inputs
 * - maxEmailLength: Maximum email content length
 */
export const uploadConfig = {
  maxPdfSize: 5 * 1024 * 1024, // 5MB in bytes
  minTextLength: 50,
  maxTextLength: 10000,
  maxEmailLength: 20000,
} as const;

/**
 * Type-safe configuration object
 *
 * Combines all configuration sections into a single exported constant.
 * Use this for all configuration access throughout the application.
 */
export const config = {
  ai: aiConfig,
  upload: uploadConfig,
} as const;

/**
 * Helper function to format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "5MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${bytes}B`;
}
