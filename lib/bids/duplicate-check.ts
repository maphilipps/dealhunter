import { ne, and, isNotNull } from 'drizzle-orm';

import {
  generateRfpEmbedding,
  cosineSimilarity,
  similarityToPercentage,
  parseEmbedding,
} from './embedding-service';

import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

// Re-export embedding generation for use in other modules
export { generateRfpEmbedding } from './embedding-service';

/**
 * Duplicate Check Result Types
 */
export interface DuplicateMatch {
  preQualificationId: string;
  customerName: string;
  reason: string;
  websiteUrl?: string;
  submissionDeadline?: string;
  createdAt?: Date | null;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  exactMatches: DuplicateMatch[];
  similarMatches: Array<DuplicateMatch & { similarity: number }>;
  checkedAt: string;
}

/**
 * Normalize a URL for comparison
 * - Removes protocol (http/https)
 * - Removes www.
 * - Removes trailing slashes
 * - Converts to lowercase
 */
function normalizeUrl(url: string): string {
  if (!url) return '';

  let normalized = url.toLowerCase().trim();

  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Remove www.
  normalized = normalized.replace(/^www\./, '');

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Remove query strings and fragments
  normalized = normalized.split('?')[0].split('#')[0];

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy customer name matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100 (100 = identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();

  // Both empty = 100% identical
  if (s1 === '' && s2 === '') return 100;

  // One empty, one not = 0% similarity
  if (s1 === '' || s2 === '') return 0;

  // Exact match
  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Check if two dates are within a range of days
 */
function isWithinDateRange(date1: string, date2: string, rangeDays: number): boolean {
  if (!date1 || !date2) return false;

  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= rangeDays;
  } catch {
    return false;
  }
}

/**
 * Extract all website URLs from extracted requirements
 */
function extractUrls(requirements: ExtractedRequirements): string[] {
  const urls: string[] = [];

  if (requirements.websiteUrl) {
    urls.push(requirements.websiteUrl);
  }

  if (requirements.websiteUrls && Array.isArray(requirements.websiteUrls)) {
    for (const urlObj of requirements.websiteUrls) {
      if (urlObj.url) {
        urls.push(urlObj.url);
      }
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Main function to check for duplicate Pre-Qualifications with semantic similarity
 *
 * @param extractedRequirements - The extracted requirements to check
 * @param accountId - Optional account ID for exact matching
 * @param excludeRfpId - Pre-Qualification ID to exclude from results (own ID for updates)
 * @param currentEmbedding - Optional pre-generated embedding (to avoid regenerating)
 * @returns DuplicateCheckResult with exact and similar matches
 */
export async function checkForDuplicates(
  extractedRequirements: ExtractedRequirements,
  accountId?: string,
  excludeRfpId?: string,
  currentEmbedding?: number[]
): Promise<DuplicateCheckResult> {
  const exactMatches: DuplicateMatch[] = [];
  const similarMatches: Array<DuplicateMatch & { similarity: number }> = [];

  // Extract data from requirements
  const customerName = extractedRequirements.customerName || '';
  const submissionDeadline = extractedRequirements.submissionDeadline;
  const urls = extractUrls(extractedRequirements);
  const normalizedUrls = urls.map(normalizeUrl).filter(u => u.length > 0);

  // Generate embedding for semantic similarity (if not provided)
  let embedding: number[] | null = currentEmbedding || null;
  try {
    if (!embedding) {
      embedding = await generateRfpEmbedding(extractedRequirements);
    }
  } catch (error) {
    console.error('[Duplicate Check] Failed to generate embedding:', error);
    // Continue without semantic similarity if embedding fails
  }

  // Build query conditions
  const conditions = [];

  // Exclude self if updating
  if (excludeRfpId) {
    conditions.push(ne(preQualifications.id, excludeRfpId));
  }

  // Only check Pre-Qualifications that have extracted requirements
  conditions.push(isNotNull(preQualifications.extractedRequirements));

  // Fetch potential duplicates (including embeddings)
  const existingRfps = await db
    .select({
      id: preQualifications.id,
      accountId: preQualifications.accountId,
      websiteUrl: preQualifications.websiteUrl,
      extractedRequirements: preQualifications.extractedRequirements,
      descriptionEmbedding: preQualifications.descriptionEmbedding,
      createdAt: preQualifications.createdAt,
    })
    .from(preQualifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Check each existing Pre-Qualification for duplicates
  for (const existing of existingRfps) {
    if (!existing.extractedRequirements) continue;

    let existingReqs: ExtractedRequirements;
    try {
      existingReqs = JSON.parse(existing.extractedRequirements) as ExtractedRequirements;
    } catch {
      continue;
    }

    const existingCustomerName = existingReqs.customerName || '';
    const existingDeadline = existingReqs.submissionDeadline;
    const existingUrls = extractUrls(existingReqs);
    const normalizedExistingUrls = existingUrls.map(normalizeUrl).filter(u => u.length > 0);

    // Check 1: Exact URL match (HIGH priority)
    const matchingUrl = normalizedUrls.find(url => normalizedExistingUrls.includes(url));

    if (matchingUrl) {
      exactMatches.push({
        preQualificationId: existing.id,
        customerName: existingCustomerName,
        reason: `Gleiche Website-URL: ${matchingUrl}`,
        websiteUrl: matchingUrl,
        submissionDeadline: existingDeadline,
        createdAt: existing.createdAt,
      });
      continue; // Skip other checks if exact URL match
    }

    // Check 2: Same account (HIGH priority)
    if (accountId && existing.accountId === accountId) {
      exactMatches.push({
        preQualificationId: existing.id,
        customerName: existingCustomerName,
        reason: 'Gleicher Account',
        websiteUrl: normalizedExistingUrls[0],
        submissionDeadline: existingDeadline,
        createdAt: existing.createdAt,
      });
      continue;
    }

    // Check 3: Customer name similarity (HIGH priority, fuzzy)
    if (customerName && existingCustomerName) {
      const similarity = calculateSimilarity(customerName, existingCustomerName);

      if (similarity >= 90) {
        // Very high similarity - treat as exact match
        exactMatches.push({
          preQualificationId: existing.id,
          customerName: existingCustomerName,
          reason: `Sehr ähnlicher Kundenname (${similarity}% Übereinstimmung)`,
          websiteUrl: normalizedExistingUrls[0],
          submissionDeadline: existingDeadline,
          createdAt: existing.createdAt,
        });
        continue;
      }

      if (similarity >= 80) {
        // Check if deadline is also similar
        const deadlineMatch =
          submissionDeadline &&
          existingDeadline &&
          isWithinDateRange(submissionDeadline, existingDeadline, 14);

        similarMatches.push({
          preQualificationId: existing.id,
          customerName: existingCustomerName,
          similarity,
          reason: deadlineMatch
            ? `Ähnlicher Kundenname + Deadline in ±14 Tagen`
            : `Ähnlicher Kundenname (${similarity}% Übereinstimmung)`,
          websiteUrl: normalizedExistingUrls[0],
          submissionDeadline: existingDeadline,
          createdAt: existing.createdAt,
        });
      }
    }

    // Check 4: Semantic similarity via embeddings (NEW)
    if (embedding && existing.descriptionEmbedding) {
      const existingEmbedding = parseEmbedding(existing.descriptionEmbedding);

      if (existingEmbedding) {
        const cosineSim = cosineSimilarity(embedding, existingEmbedding);
        const semanticSimilarity = similarityToPercentage(cosineSim);

        // High semantic similarity (>85%) indicates potential duplicate
        if (semanticSimilarity >= 85) {
          similarMatches.push({
            preQualificationId: existing.id,
            customerName: existingCustomerName,
            similarity: semanticSimilarity,
            reason: `Hohe semantische Ähnlichkeit (${semanticSimilarity}% via Embeddings)`,
            websiteUrl: normalizedExistingUrls[0],
            submissionDeadline: existingDeadline,
            createdAt: existing.createdAt,
          });
        }
      }
    }
  }

  // Sort matches by relevance
  exactMatches.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  similarMatches.sort((a, b) => b.similarity - a.similarity);

  return {
    hasDuplicates: exactMatches.length > 0 || similarMatches.length > 0,
    exactMatches,
    similarMatches,
    checkedAt: new Date().toISOString(),
  };
}
