/**
 * BullMQ PreQual Processing Worker
 *
 * Processes new Pre-Qualification submissions in the background:
 * 1. PDF text extraction (parallel for multiple files)
 * 2. DSGVO/PII cleaning if enabled
 * 3. AI requirements extraction
 * 4. Duplicate check
 * 5. Quick Scan (website analysis)
 * 6. Status update to ready
 *
 * Progress is tracked via preQualifications.status field.
 */

import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { runDuplicateCheckAgent } from '../../bids/duplicate-check-agent';
import { extractTextFromPdf } from '../../bids/pdf-extractor';
import { db } from '../../db';
import { preQualifications, quickScans } from '../../db/schema';
import { extractRequirements } from '../../extraction/agent';
import type { ExtractedRequirements } from '../../extraction/schema';
import { suggestWebsiteUrls } from '../../extraction/url-suggestion-agent';
import { detectPII, cleanText } from '../../pii/pii-cleaner';
import { addQuickScanJob } from '../queues';
import type { PreQualProcessingJobData, PreQualProcessingJobResult } from '../queues';

/**
 * Progress percentages for each step
 */
const PROGRESS = {
  START: 0,
  PDF_EXTRACTION: 30,
  REQUIREMENTS: 40,
  DUPLICATE_CHECK: 50,
  QUICK_SCAN: 90,
  COMPLETE: 100,
};

/**
 * Update PreQualification status in database
 */
async function updateStatus(
  preQualId: string,
  status: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  await db
    .update(preQualifications)
    .set({
      status: status as typeof preQualifications.$inferSelect['status'],
      updatedAt: new Date(),
      ...additionalData,
    })
    .where(eq(preQualifications.id, preQualId));
}

/**
 * Process a single PDF file from base64
 */
async function processPdf(
  fileData: { name: string; base64: string; size: number },
  enableDSGVO: boolean
): Promise<{ fileName: string; text: string; piiMatches: Array<{ type: string; original: string; replacement: string }> }> {
  const buffer = Buffer.from(fileData.base64, 'base64');
  let text = await extractTextFromPdf(buffer);
  const piiMatches: Array<{ type: string; original: string; replacement: string }> = [];

  if (enableDSGVO && text) {
    const matches = detectPII(text);
    if (matches.length > 0) {
      text = cleanText(text, matches);
      piiMatches.push(
        ...matches.map(m => ({
          type: m.type,
          original: m.original,
          replacement: m.replacement,
        }))
      );
    }
  }

  return { fileName: fileData.name, text: text || '', piiMatches };
}

/**
 * Build structured raw input from multiple sources
 */
function buildRawInput(
  extractedTexts: Array<{ fileName: string; text: string }>,
  websiteUrls: string[],
  additionalText: string
): string {
  const rawInputParts: string[] = [];

  // Add PDF sections
  if (extractedTexts.length === 1) {
    rawInputParts.push(extractedTexts[0].text);
  } else if (extractedTexts.length > 1) {
    for (const { fileName, text } of extractedTexts) {
      rawInputParts.push(`=== DOKUMENT: ${fileName} ===\n\n${text}`);
    }
  }

  // Add website URLs section
  if (websiteUrls.length === 1) {
    rawInputParts.push(`Website-URL: ${websiteUrls[0]}`);
  } else if (websiteUrls.length > 1) {
    rawInputParts.push(
      `Website-URLs:\n${websiteUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
    );
  }

  // Add additional text section
  if (additionalText) {
    rawInputParts.push(`Zusätzliche Informationen:\n${additionalText}`);
  }

  return rawInputParts.join('\n\n---\n\n');
}

function extractCustomerNameFromRawInput(rawInput: string): string | null {
  const match = rawInput.match(/^(Kunde|Customer):\s*(.+)$/im);
  if (match && match[2]) {
    return match[2].trim();
  }
  return null;
}

/**
 * Main processor function for PreQual Processing jobs
 */
export async function processPreQualJob(
  job: Job<PreQualProcessingJobData>
): Promise<PreQualProcessingJobResult> {
  const {
    preQualificationId,
    files,
    websiteUrls,
    additionalText,
    enableDSGVO,
  } = job.data;

  console.log(`[PreQual Worker] Starting job ${job.id} for prequal ${preQualificationId}`);

  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: PDF EXTRACTION (0-30%)
    // ═══════════════════════════════════════════════════════════════
    await updateStatus(preQualificationId, 'extracting');
    await job.updateProgress(PROGRESS.START);

    const extractedTexts: Array<{ fileName: string; text: string }> = [];
    const allPiiMatches: Array<{ type: string; original: string; replacement: string }> = [];

    if (files.length > 0) {
      console.log(`[PreQual Worker] Extracting text from ${files.length} PDFs`);

      // Process PDFs in parallel
      const results = await Promise.all(
        files.map(file => processPdf(file, enableDSGVO))
      );

      for (const result of results) {
        if (result.text.trim()) {
          extractedTexts.push({ fileName: result.fileName, text: result.text });
        }
        allPiiMatches.push(...result.piiMatches);
      }

      console.log(`[PreQual Worker] Extracted text from ${extractedTexts.length}/${files.length} PDFs`);
    }

    await job.updateProgress(PROGRESS.PDF_EXTRACTION);

    // Build raw input
    const rawInput = buildRawInput(extractedTexts, websiteUrls, additionalText);

    if (rawInput.trim().length < 20) {
      throw new Error('Eingabe zu kurz (mindestens 20 Zeichen erforderlich)');
    }

    // Determine input type based on sources
    const hasFiles = extractedTexts.length > 0;
    const hasUrls = websiteUrls.length > 0;
    const hasText = additionalText.length > 0;
    const sourceCount = [hasFiles, hasUrls, hasText].filter(Boolean).length;

    // Input type - 'combined' is valid in DB enum but may not be in generated types yet
    let inputType: 'pdf' | 'freetext' | 'combined' = 'freetext';
    if (sourceCount > 1 || extractedTexts.length > 1 || websiteUrls.length > 1) {
      inputType = 'combined';
    } else if (hasFiles) {
      inputType = 'pdf';
    }

    // Update raw input in DB
    // Note: 'combined' is valid in DB schema, cast to bypass stale TS types
    await db
      .update(preQualifications)
      .set({
        rawInput,
        inputType: inputType as 'pdf' | 'freetext', // 'combined' valid in DB
        metadata: allPiiMatches.length > 0 ? JSON.stringify(allPiiMatches) : null,
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId));

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: AI REQUIREMENTS EXTRACTION (30-40%)
    // ═══════════════════════════════════════════════════════════════
    console.log(`[PreQual Worker] Running AI requirements extraction`);

    // Map inputType for extraction agent (doesn't support 'combined')
    const extractionInputType: 'pdf' | 'freetext' | 'email' =
      inputType === 'combined' ? 'freetext' : inputType;

    const extractionResult = await extractRequirements({
      preQualificationId,
      rawText: rawInput,
      inputType: extractionInputType,
      metadata: {},
    });

    if (!extractionResult.success || !extractionResult.requirements) {
      throw new Error(extractionResult.error || 'Extraktion fehlgeschlagen');
    }

    const extractedRequirements = extractionResult.requirements;

    // Merge website URLs into extracted requirements if not already present
    if (
      websiteUrls.length > 0 &&
      (!extractedRequirements.websiteUrls || extractedRequirements.websiteUrls.length === 0)
    ) {
      extractedRequirements.websiteUrls = websiteUrls.map(url => ({
        url,
        type: 'corporate',
        extractedFromDocument: false,
      }));
      extractedRequirements.websiteUrl = websiteUrls[0];
    }

    // If still no website URL, attempt web search-based suggestion
    const hasWebsiteUrl =
      (extractedRequirements.websiteUrls && extractedRequirements.websiteUrls.length > 0) ||
      Boolean(extractedRequirements.websiteUrl);

    if (!hasWebsiteUrl) {
      const customerName =
        extractedRequirements.customerName ||
        extractedRequirements.projectName ||
        extractCustomerNameFromRawInput(rawInput);

      if (customerName) {
        try {
          const suggestion = await suggestWebsiteUrls({
            customerName,
            industry: extractedRequirements.industry,
            projectDescription: extractedRequirements.projectDescription,
            technologies: extractedRequirements.technologies,
            useWebSearch: true,
          });

          if (suggestion.suggestions.length > 0) {
            extractedRequirements.websiteUrls = suggestion.suggestions.map(s => ({
              url: s.url,
              type: s.type,
              description: s.description,
              extractedFromDocument: false,
            }));
            extractedRequirements.websiteUrl = suggestion.suggestions[0].url;
          }
        } catch (error) {
          console.error('[PreQual Worker] URL suggestion failed:', error);
        }
      } else {
        console.warn('[PreQual Worker] Missing customer name for URL suggestion');
      }
    }

    // Save extracted requirements
    await db
      .update(preQualifications)
      .set({
        extractedRequirements: JSON.stringify(extractedRequirements),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId));

    await job.updateProgress(PROGRESS.REQUIREMENTS);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: DUPLICATE CHECK (40-50%)
    // ═══════════════════════════════════════════════════════════════
    await updateStatus(preQualificationId, 'duplicate_checking');
    console.log(`[PreQual Worker] Running duplicate check`);

    try {
      const duplicateResult = await runDuplicateCheckAgent({
        extractedRequirements: extractedRequirements,
        excludeRfpId: preQualificationId,
      });

      await db
        .update(preQualifications)
        .set({
          duplicateCheckResult: JSON.stringify(duplicateResult),
          updatedAt: new Date(),
        })
        .where(eq(preQualifications.id, preQualificationId));

      // If duplicates found with high confidence, set warning status
      if (duplicateResult.hasDuplicates && duplicateResult.confidence >= 70) {
        console.log(`[PreQual Worker] Duplicates found (${duplicateResult.confidence}% confidence)`);
        await updateStatus(preQualificationId, 'duplicate_warning');

        // Return early - user needs to decide
        return {
          success: true,
          step: 'duplicate_checking',
          progress: PROGRESS.DUPLICATE_CHECK,
        };
      }
    } catch (error) {
      console.error(`[PreQual Worker] Duplicate check failed:`, error);
      // Continue anyway - duplicate check is not critical
    }

    await job.updateProgress(PROGRESS.DUPLICATE_CHECK);

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: QUICK SCAN (50-90%)
    // ═══════════════════════════════════════════════════════════════
    const websiteUrl = extractedRequirements.websiteUrl ||
      (extractedRequirements.websiteUrls && extractedRequirements.websiteUrls[0]?.url);

    let finalStatus: string = 'reviewing';

    if (websiteUrl) {
      await updateStatus(preQualificationId, 'quick_scanning');
      console.log(`[PreQual Worker] Starting Quick Scan for ${websiteUrl}`);

      try {
      // Create QuickScan record (background job will execute scan)
      const [quickScan] = await db
        .insert(quickScans)
        .values({
          preQualificationId,
          websiteUrl,
          status: 'pending',
          startedAt: new Date(),
        })
        .returning();

        // Link to PreQualification
        await db
          .update(preQualifications)
          .set({
            quickScanId: quickScan.id,
            websiteUrl,
            updatedAt: new Date(),
          })
          .where(eq(preQualifications.id, preQualificationId));

        await addQuickScanJob({
          preQualificationId,
          quickScanId: quickScan.id,
          websiteUrl,
          userId: job.data.userId,
        });

        console.log(`[PreQual Worker] Quick Scan enqueued: ${quickScan.id}`);
        finalStatus = 'quick_scanning';
      } catch (error) {
        console.error(`[PreQual Worker] Quick Scan failed:`, error);
        // Mark QuickScan as failed but continue
        finalStatus = 'quick_scan_failed';
      }
    } else {
      console.log(`[PreQual Worker] No website URL - skipping Quick Scan`);
    }

    await job.updateProgress(PROGRESS.QUICK_SCAN);

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: FINALIZE (90-100%)
    // ═══════════════════════════════════════════════════════════════
    await updateStatus(preQualificationId, finalStatus);
    await job.updateProgress(PROGRESS.COMPLETE);

    console.log(`[PreQual Worker] Job ${job.id} completed. Final status: ${finalStatus}`);

    return {
      success: true,
      step: 'complete',
      progress: PROGRESS.COMPLETE,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PreQual Worker] Job ${job.id} failed:`, errorMsg);

    // Update status to failed state
    await db
      .update(preQualifications)
      .set({
        status: 'extraction_failed',
        agentErrors: JSON.stringify([{
          agent: 'prequal-processing',
          error: errorMsg,
          timestamp: new Date().toISOString(),
        }]),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId));

    return {
      success: false,
      step: 'extracting',
      progress: 0,
      error: errorMsg,
    };
  }
}
