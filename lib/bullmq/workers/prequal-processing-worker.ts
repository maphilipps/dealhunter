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

import { generateObject } from 'ai';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { modelNames } from '../../ai/config';
import { getProviderForSlot } from '../../ai/providers';
import { runDuplicateCheckAgent } from '../../bids/duplicate-check-agent';
import { extractTextFromPdf } from '../../bids/pdf-extractor';
import { runTenQuestionsAgent } from '../../bids/ten-questions-agent';
import { db } from '../../db';
import { backgroundJobs, preQualifications, quickScans } from '../../db/schema';
import { runExtractionAgentNative } from '../../extraction/agent-native';
import type { ExtractedRequirements } from '../../extraction/schema';
import { suggestWebsiteUrls } from '../../extraction/url-suggestion-agent';
import { runPreQualSectionAgent } from '../../json-render/prequal-section-agent';
import { detectPII, cleanText } from '../../pii/pii-cleaner';
import { runQuickScanAgentNative } from '../../quick-scan/agent-native';
import { embedAgentOutput } from '../../rag/embedding-service';
import { generateTimelineFromQuickScan } from '../../timeline/integration';
import { onAgentComplete } from '../../workflow/orchestrator';
import type { PreQualProcessingJobData, PreQualProcessingJobResult } from '../queues';

/**
 * Progress percentages for each step
 */
const PROGRESS = {
  START: 0,
  PDF_EXTRACTION: 20,
  REQUIREMENTS: 35,
  DUPLICATE_CHECK: 45,
  QUICK_SCAN: 70,
  TEN_QUESTIONS: 80,
  SECTION_PAGES: 90,
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

async function updateQualificationJob(
  backgroundJobId: string,
  update: Partial<{
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentStep: string | null;
    errorMessage: string | null;
    result: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>
) {
  await db
    .update(backgroundJobs)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(backgroundJobs.id, backgroundJobId));
}

/**
 * Process a single PDF file from base64
 */
async function processPdf(
  fileData: { name: string; base64: string; size: number },
  enableDSGVO: boolean
): Promise<{ fileName: string; text: string; piiMatches: Array<{ type: string; original: string; replacement: string }> }> {
  const buffer = Buffer.from(fileData.base64, 'base64');
  let text = '';
  if (buffer.length === 0) {
    console.warn(`[PreQual Worker] Skipping empty PDF: ${fileData.name}`);
    return { fileName: fileData.name, text: '', piiMatches: [] };
  }

  try {
    text = await extractTextFromPdf(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('document has no pages')) {
      console.warn(`[PreQual Worker] PDF has no pages, skipping: ${fileData.name}`);
    } else {
      console.error(`[PreQual Worker] PDF extraction failed for ${fileData.name}:`, message);
    }
    return { fileName: fileData.name, text: '', piiMatches: [] };
  }
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

function extractCustomerNameFromText(rawInput: string, fileNames: string[]): string | null {
  const patterns = [
    /(?:Auftraggeber|Vergabestelle|Kunde|Customer|Client|Issuer)\s*[:-]\s*(.+)/i,
    /(?:Organisation|Institution)\s*[:-]\s*(.+)/i,
    /(?:Issued\s+by|Issue(?:d)?\s+by|Contracting\s+Authority|Procuring\s+Entity|Purchaser|Buyer)\s*[:-]\s*(.+)/i,
    /(?:Authority\s+Name|Organization\s+Name|Company\s+Name)\s*[:-]\s*(.+)/i,
    /(?:Request\s+for\s+Proposal|RFP|Tender|Bid)\s+(?:by|from)\s+(.+)/i,
  ];

  const lines = rawInput
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\s{2,}/g, ' ');
      }
    }
  }

  const legalSuffixes = [
    'GmbH',
    'AG',
    'SE',
    'KG',
    'KGaA',
    'GmbH & Co. KG',
    'gGmbH',
    'e.V.',
    'Inc.',
    'LLC',
    'Ltd.',
    'PLC',
    'Corp.',
    'Co.',
    'BV',
    'NV',
    'SAS',
    'SA',
    'S.A.',
    'S.p.A.',
    'SRL',
    'SARL',
  ];

  for (const line of lines) {
    if (legalSuffixes.some(suffix => line.includes(suffix))) {
      return line.replace(/\s{2,}/g, ' ');
    }
  }

  for (const name of fileNames) {
    const candidate = name
      .replace(/\.[^.]+$/, '')
      .split(/[_-]/)[0]
      ?.trim();
    if (candidate && candidate.length >= 3) {
      return candidate;
    }
    const acronymMatch = name.match(/\b[A-Z]{2,6}\b/);
    if (acronymMatch?.[0]) {
      return acronymMatch[0];
    }
  }

  return null;
}

async function inferCustomerNameWithAI(rawInput: string, fileNames: string[]): Promise<string | null> {
  const schema = z.object({
    customerName: z.string().nullable(),
  });

  const prompt = `Extract the issuing organization (customer) name from this tender context. If unsure, return null.\n\nFiles: ${fileNames.join(', ') || 'n/a'}\n\nText:\n${rawInput.slice(0, 8000)}`;

  try {
    const result = await generateObject({
      model: getProviderForSlot('fast')(modelNames.fast),
      schema,
      prompt,
      temperature: 0,
      maxOutputTokens: 200,
    });
    const name = result.object.customerName?.trim();
    return name && name.length > 0 ? name : null;
  } catch (error) {
    console.error('[PreQual Worker] AI customer name inference failed:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
    backgroundJobId,
    userId,
  } = job.data;

  console.log(`[PreQual Worker] Starting job ${job.id} for prequal ${preQualificationId}`);

  try {
    await updateQualificationJob(backgroundJobId, {
      status: 'running',
      progress: PROGRESS.START,
      currentStep: 'Start Qualification',
      startedAt: new Date(),
      errorMessage: null,
    });
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: PDF EXTRACTION (0-30%)
    // ═══════════════════════════════════════════════════════════════
    await updateStatus(preQualificationId, 'extracting');
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.START,
      currentStep: 'Dokumente extrahieren',
    });
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
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.PDF_EXTRACTION,
      currentStep: 'Dokumente vorbereitet',
    });

    // Build raw input
    let rawInput = buildRawInput(extractedTexts, websiteUrls, additionalText);

    if (rawInput.trim().length < 20) {
      const fileNames = files.map(file => file.name).filter(Boolean).join(', ');
      rawInput = [
        'Hinweis: Keine extrahierbaren Inhalte erkannt.',
        fileNames ? `Dateien: ${fileNames}` : '',
        additionalText || '',
        websiteUrls.length > 0 ? `Website-URLs: ${websiteUrls.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // Determine input type based on sources
    const hasFiles = files.length > 0;
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

    const useExistingRequirements = job.data.useExistingRequirements === true;
    let extractedRequirements: ExtractedRequirements;

    if (useExistingRequirements) {
      await updateQualificationJob(backgroundJobId, {
        currentStep: 'Vorhandene Extraktion verwenden',
      });

      const [existingPrequal] = await db
        .select({ extractedRequirements: preQualifications.extractedRequirements })
        .from(preQualifications)
        .where(eq(preQualifications.id, preQualificationId))
        .limit(1);

      if (existingPrequal?.extractedRequirements) {
        try {
          extractedRequirements = JSON.parse(existingPrequal.extractedRequirements) as ExtractedRequirements;
        } catch {
          extractedRequirements = {} as ExtractedRequirements;
        }
      } else {
        extractedRequirements = {} as ExtractedRequirements;
      }
    } else {
      // Map inputType for extraction agent (doesn't support 'combined')
      const extractionInputType: 'pdf' | 'freetext' | 'email' =
        inputType === 'combined' ? 'freetext' : inputType;

      try {
        const extractionResult = await runExtractionAgentNative({
          preQualificationId,
          rawText: rawInput,
          inputType: extractionInputType,
          metadata: {},
        });

        if (!extractionResult.success || !extractionResult.requirements) {
          throw new Error(extractionResult.error || 'Extraktion fehlgeschlagen');
        }

        extractedRequirements = extractionResult.requirements;
      } catch (error) {
        console.error('[PreQual Worker] Extraction agent failed, using fallback:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        extractedRequirements = {
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.2,
          extractedAt: new Date().toISOString(),
        } as ExtractedRequirements;
      }
    }

    if (!extractedRequirements.customerName) {
      const fileNameCandidates = files.map(f => f.name);
      const inferredCustomer =
        extractCustomerNameFromRawInput(rawInput) ||
        extractCustomerNameFromText(rawInput, fileNameCandidates) ||
        (await inferCustomerNameWithAI(rawInput, fileNameCandidates));

      if (inferredCustomer) {
        extractedRequirements.customerName = inferredCustomer;
      }
    }

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
        extractCustomerNameFromRawInput(rawInput) ||
        extractCustomerNameFromText(rawInput, files.map(f => f.name));

      const resolvedCustomerName =
        customerName ||
        (await inferCustomerNameWithAI(rawInput, files.map(f => f.name)));

      if (resolvedCustomerName) {
        try {
          const suggestion = await suggestWebsiteUrls({
            customerName: resolvedCustomerName,
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
          console.error('[PreQual Worker] URL suggestion failed:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      } else {
        console.warn('[PreQual Worker] Missing customer name for URL suggestion');
      }
    }

    // Save extracted requirements (skip overwrite when using existing data unless we enriched URLs)
    const shouldPersistRequirements =
      !useExistingRequirements ||
      Boolean(extractedRequirements.websiteUrl) ||
      Boolean(extractedRequirements.websiteUrls?.length);

    if (shouldPersistRequirements) {
      await db
        .update(preQualifications)
        .set({
          extractedRequirements: JSON.stringify(extractedRequirements),
          updatedAt: new Date(),
        })
        .where(eq(preQualifications.id, preQualificationId));
    }

    await job.updateProgress(PROGRESS.REQUIREMENTS);
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.REQUIREMENTS,
      currentStep: 'Extraktion abgeschlossen',
    });

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
      console.error(`[PreQual Worker] Duplicate check failed:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        preQualificationId,
      });
      // Continue anyway - duplicate check is not critical
    }

    await job.updateProgress(PROGRESS.DUPLICATE_CHECK);
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.DUPLICATE_CHECK,
      currentStep: 'Duplikate geprüft',
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: QUICK SCAN (50-90%)
    // ═══════════════════════════════════════════════════════════════
    const websiteUrl = extractedRequirements.websiteUrl ||
      (extractedRequirements.websiteUrls && extractedRequirements.websiteUrls[0]?.url);

    if (websiteUrl) {
      await updateStatus(preQualificationId, 'quick_scanning');
      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.QUICK_SCAN,
        currentStep: 'Quick Scan läuft',
      });

      console.log(`[PreQual Worker] Running Quick Scan for ${websiteUrl}`);

      const [quickScan] = await db
        .insert(quickScans)
        .values({
          preQualificationId,
          websiteUrl,
          status: 'running',
          startedAt: new Date(),
        })
        .returning();

      await db
        .update(preQualifications)
        .set({
          quickScanId: quickScan.id,
          websiteUrl,
          updatedAt: new Date(),
        })
        .where(eq(preQualifications.id, preQualificationId));

      const result = await runQuickScanAgentNative(
        {
          bidId: preQualificationId,
          websiteUrl,
          extractedRequirements,
          userId,
          preQualificationId,
        },
        {
          onActivity: entry => {
            void updateQualificationJob(backgroundJobId, {
              currentStep: entry.action,
            });
          },
        }
      );

      let timeline: Record<string, unknown> | null = null;
      let timelineGeneratedAt: Date | null = null;

      try {
        timeline = await generateTimelineFromQuickScan({
          projectName:
            (extractedRequirements.projectTitle as string | undefined) ||
            extractedRequirements.projectDescription ||
            'Projekt',
          projectDescription: extractedRequirements.projectDescription,
          websiteUrl,
          extractedRequirements,
          quickScanResult: {
            techStack: result.techStack,
            contentVolume: result.contentVolume
              ? {
                  estimatedPages: result.contentVolume.estimatedPageCount,
                  estimatedContentTypes: result.contentVolume.contentTypes?.length,
                }
              : undefined,
            features: {
              detectedFeatures: result.features
                ? Object.entries(result.features)
                    .filter(([key, value]) => value === true && key !== 'customFeatures')
                    .map(([key]) => key)
                    .concat(result.features.customFeatures || [])
                : [],
            },
          },
        });
        timelineGeneratedAt = new Date();
      } catch (error) {
        console.error('[PreQual Worker] Timeline generation failed:', error);
      }

      const quickScanPayload = {
        ...quickScan,
        status: 'completed' as const,
        techStack: JSON.stringify(result.techStack),
        cms: result.techStack.cms || null,
        framework: result.techStack.framework || null,
        hosting: result.techStack.hosting || null,
        contentVolume: JSON.stringify(result.contentVolume),
        features: JSON.stringify(result.features),
        recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
        confidence: result.blRecommendation.confidence,
        reasoning: result.blRecommendation.reasoning,
        navigationStructure: result.navigationStructure
          ? JSON.stringify(result.navigationStructure)
          : null,
        accessibilityAudit: result.accessibilityAudit ? JSON.stringify(result.accessibilityAudit) : null,
        seoAudit: result.seoAudit ? JSON.stringify(result.seoAudit) : null,
        legalCompliance: result.legalCompliance ? JSON.stringify(result.legalCompliance) : null,
        performanceIndicators: result.performanceIndicators
          ? JSON.stringify(result.performanceIndicators)
          : null,
        screenshots: result.screenshots ? JSON.stringify(result.screenshots) : null,
        companyIntelligence: result.companyIntelligence ? JSON.stringify(result.companyIntelligence) : null,
        contentTypes: result.contentTypes ? JSON.stringify(result.contentTypes) : null,
        migrationComplexity: result.migrationComplexity ? JSON.stringify(result.migrationComplexity) : null,
        decisionMakers: result.decisionMakers ? JSON.stringify(result.decisionMakers) : null,
        rawScanData: result.rawScanData ? JSON.stringify(result.rawScanData) : null,
        activityLog: JSON.stringify(result.activityLog),
        timeline: timeline ? JSON.stringify(timeline) : null,
        timelineGeneratedAt: timelineGeneratedAt,
        completedAt: new Date(),
      };

      await db
        .update(quickScans)
        .set(quickScanPayload)
        .where(eq(quickScans.id, quickScan.id));

      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.QUICK_SCAN,
        currentStep: 'Quick Scan abgeschlossen',
      });

      try {
        await embedAgentOutput(
          preQualificationId,
          'quick_scan',
          result as unknown as Record<string, unknown>
        );
      } catch (error) {
        console.error('[PreQual Worker] Failed to embed Quick Scan result:', error);
      }

      const questions = await runTenQuestionsAgent({
        preQualificationId,
        userId,
        language: 'de',
      });

      await db
        .update(quickScans)
        .set({
          tenQuestions: JSON.stringify({
            questions: questions.questions,
            answeredCount: questions.answeredCount,
            totalCount: questions.totalCount,
            projectType: questions.projectType,
          }),
        })
        .where(eq(quickScans.id, quickScan.id));

      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.TEN_QUESTIONS,
        currentStep: '10 Fragen beantwortet',
      });

      await onAgentComplete(preQualificationId, 'QuickScan');
    } else {
      console.log(`[PreQual Worker] No website URL - document-only qualification`);

      const [quickScan] = await db
        .insert(quickScans)
        .values({
          preQualificationId,
          websiteUrl: 'document-only',
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();

      await db
        .update(preQualifications)
        .set({
          quickScanId: quickScan.id,
          updatedAt: new Date(),
        })
        .where(eq(preQualifications.id, preQualificationId));

      const questions = await runTenQuestionsAgent({
        preQualificationId,
        userId,
        language: 'de',
      });

      await db
        .update(quickScans)
        .set({
          tenQuestions: JSON.stringify({
            questions: questions.questions,
            answeredCount: questions.answeredCount,
            totalCount: questions.totalCount,
            projectType: questions.projectType,
          }),
        })
        .where(eq(quickScans.id, quickScan.id));

      await updateStatus(preQualificationId, 'questions_ready');
      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.QUICK_SCAN,
        currentStep: 'Dokumentenbasierte Qualification abgeschlossen',
      });
      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.TEN_QUESTIONS,
        currentStep: '10 Fragen beantwortet',
      });
    }

    const sectionIds = [
      'budget',
      'timing',
      'contracts',
      'deliverables',
      'references',
      'award-criteria',
      'legal',
      'tech-stack',
      'facts',
      'contacts',
    ];

    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.SECTION_PAGES,
      currentStep: 'Detailseiten generieren',
    });

    for (const sectionId of sectionIds) {
      try {
        await runPreQualSectionAgent({
          preQualificationId,
          sectionId,
          allowWebEnrichment: true,
        });
      } catch (error) {
        console.error(`[PreQual Worker] Section agent failed for ${sectionId}:`, error);
      }
    }

    await job.updateProgress(PROGRESS.QUICK_SCAN);

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: FINALIZE (90-100%)
    // ═══════════════════════════════════════════════════════════════
    await job.updateProgress(PROGRESS.COMPLETE);
    await updateQualificationJob(backgroundJobId, {
      status: 'completed',
      progress: PROGRESS.COMPLETE,
      currentStep: 'Abgeschlossen',
      completedAt: new Date(),
      result: JSON.stringify({ success: true }),
    });

    console.log(`[PreQual Worker] Job ${job.id} completed.`);

    return {
      success: true,
      step: 'complete',
      progress: PROGRESS.COMPLETE,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Error';

    console.error(`[PreQual Worker] Job ${job.id} failed:`, {
      message: errorMsg,
      name: errorName,
      stack: errorStack,
      preQualificationId,
      filesCount: job.data.files?.length || 0,
    });

    // Update status to failed state with full error details
    await db
      .update(preQualifications)
      .set({
        status: 'extraction_failed',
        agentErrors: JSON.stringify([{
          agent: 'prequal-processing',
          error: errorMsg,
          errorDetails: {
            name: errorName,
            stack: errorStack,
          },
          timestamp: new Date().toISOString(),
        }]),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId));

    await updateQualificationJob(backgroundJobId, {
      status: 'failed',
      progress: 100,
      currentStep: 'Fehlgeschlagen',
      errorMessage: JSON.stringify({
        message: errorMsg,
        name: errorName,
        stack: errorStack,
      }),
      completedAt: new Date(),
    });

    return {
      success: false,
      step: 'extracting',
      progress: 0,
      error: errorMsg,
    };
  }
}
