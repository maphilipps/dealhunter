/**
 * Shared AI environment configuration.
 *
 * This file exists to avoid circular dependencies between modules that need
 * access to the same AI hub credentials/base URL.
 */

export const AI_HUB_API_KEY = process.env.AI_HUB_API_KEY || process.env.OPENAI_API_KEY;

export const AI_HUB_BASE_URL =
  process.env.AI_HUB_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://adesso-ai-hub.3asabc.de/v1';
