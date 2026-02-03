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

import { generateText, Output } from 'ai';
import type { Job } from 'bullmq';
import { eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import {
  runParallelMatrixResearch,
  saveMatrixToRfp,
} from '../../cms-matching/parallel-matrix-orchestrator';
import { extractRequirementsFromQuickScan } from '../../cms-matching/requirements';
import { generateBLRecommendation } from '../../quick-scan/workflow/steps/synthesis';
import type { TechStack } from '../../quick-scan/schema';
import { startCMSEvaluation } from '../../cms-matching/actions';
import { modelNames } from '../../ai/config';
import { getProviderForSlot } from '../../ai/providers';
import { extractTextFromPdf } from '../../bids/pdf-extractor';
import { QUALIFICATION_QUESTIONS, type TenQuestionsPayload } from '../../bids/ten-questions';
import { runTenQuestionsAgent } from '../../bids/ten-questions-agent';
import { db } from '../../db';
import {
  backgroundJobs,
  businessUnits,
  preQualifications,
  quickScans,
  technologies,
} from '../../db/schema';
import { runExtractionAgentNative } from '../../extraction/agent-native';
import type { ExtractedRequirements } from '../../extraction/schema';
import { detectPII, cleanText } from '../../pii/pii-cleaner';
import {
  runPreQualSectionOrchestrator,
  type Decision,
} from '../../qualification/orchestrator-worker';
import { runQuickScanAgentNative } from '../../quick-scan/agent-native';
import { embedAgentOutput } from '../../rag/embedding-service';
import { queryRawChunks, formatRAGContext } from '../../rag/raw-retrieval-service';
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

function getFallbackFeatures() {
  return {
    ecommerce: false,
    userAccounts: false,
    search: false,
    multiLanguage: false,
    blog: false,
    forms: false,
    api: false,
    mobileApp: false,
    customFeatures: [],
  };
}

const EMPTY_TECH_STACK: TechStack = {
  backend: [],
  libraries: [],
  analytics: [],
  marketing: [],
  javascriptFrameworks: [],
  cssFrameworks: [],
  headlessCms: [],
  buildTools: [],
  cdnProviders: [],
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
      status: status as (typeof preQualifications.$inferSelect)['status'],
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
): Promise<{
  fileName: string;
  text: string;
  piiMatches: Array<{ type: string; original: string; replacement: string }>;
}> {
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

/**
 * RAG-basierte Kundenname-Extraktion
 * Nutzt semantische Suche um den Auftraggeber zu finden
 */
async function inferCustomerNameFromRAG(preQualificationId: string): Promise<string | null> {
  try {
    const chunks = await queryRawChunks({
      preQualificationId,
      question: 'Wer ist der Auftraggeber, Vergabestelle, oder ausschreibende Organisation?',
      maxResults: 5,
    });

    if (chunks.length === 0) return null;

    const context = formatRAGContext(chunks);

    const schema = z.object({
      customerName: z.string().nullable(),
    });

    const result = await generateText({
      model: getProviderForSlot('fast')(modelNames.fast),
      output: Output.object({ schema }),
      prompt: `Extrahiere den Namen der ausschreibenden Organisation (Auftraggeber/Vergabestelle) aus diesem Kontext.

WICHTIG:
- Suche nach offiziellen Organisationsnamen (Behörden, Kommunen, Unternehmen)
- Ignoriere Kapitelüberschriften wie "8.10 SEO..."
- Wenn unklar, gib null zurück

Kontext:
${context}`,
      temperature: 0,
    });

    const name = result.output?.customerName?.trim();
    if (name && /^\d+\.\d+/.test(name)) {
      return null; // Reject chapter headings
    }
    return name && name.length > 0 ? name : null;
  } catch (error) {
    console.error('[PreQual Worker] RAG customer name inference failed:', error);
    return null;
  }
}

async function inferCustomerNameWithAI(
  rawInput: string,
  fileNames: string[]
): Promise<string | null> {
  const schema = z.object({
    customerName: z.string().nullable(),
  });

  const prompt = `Extract the issuing organization (customer/Auftraggeber/Vergabestelle) name from this tender context.

IMPORTANT:
- Look for official organization names, not chapter titles or document sections
- The customer is typically a government agency, municipality, company, or institution
- Ignore headings like "8.10 SEO..." or similar document structure elements
- If unsure, return null

Files: ${fileNames.join(', ') || 'n/a'}

Text:
${rawInput.slice(0, 12000)}`;

  try {
    const result = await generateText({
      model: getProviderForSlot('fast')(modelNames.fast),
      output: Output.object({ schema }),
      prompt,
      temperature: 0,
      maxOutputTokens: 200,
    });
    const name = result.output?.customerName?.trim();
    // Validate: reject obvious non-customer names (chapter headings, etc.)
    if (name && /^\d+\.\d+/.test(name)) {
      console.log(
        '[PreQual Worker] Rejected invalid customer name (looks like chapter heading):',
        name
      );
      return null;
    }
    return name && name.length > 0 ? name : null;
  } catch (error) {
    console.error('[PreQual Worker] AI customer name inference failed:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Synthetisiert die 10 Fragen aus der Orchestrator-Decision
 * Nutzt einen Agent (LLM) statt hartcodierter switch/case Logik
 */
async function synthesizeTenQuestionsFromDecision(
  decision: Decision
): Promise<TenQuestionsPayload> {
  const questionsSchema = z.object({
    answers: z.array(
      z.object({
        questionId: z.number().min(1).max(10).describe('Die Fragen-ID (1-10)'),
        answer: z
          .string()
          .nullable()
          .describe('Die Antwort auf die Frage, oder null wenn nicht beantwortbar'),
        confidence: z.number().min(0).max(100).describe('Konfidenz der Antwort in Prozent (0-100)'),
        reasoning: z
          .string()
          .describe(
            'Kurze Begründung für die Antwort. Leerer String "" wenn keine Begründung nötig.'
          ),
      })
    ),
  });

  const prompt = `Du bist ein Experte für Ausschreibungsanalyse. Basierend auf der folgenden Bid/No-Bid Decision, beantworte die 10 BD-Fragen so gut wie möglich.

## DECISION
- Empfehlung: ${decision.recommendation}
- Konfidenz: ${decision.confidence}%
- Begründung: ${decision.reasoning}
- Stärken: ${decision.strengths.join('; ') || 'Keine'}
- Schwächen: ${decision.weaknesses.join('; ') || 'Keine'}
- Bedingungen: ${decision.conditions.join('; ') || 'Keine'}

## DIE 10 BD-FRAGEN
${QUALIFICATION_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## ANWEISUNGEN
- Beantworte jede Frage basierend auf den Decision-Informationen
- Wenn eine Frage nicht aus der Decision beantwortbar ist (z.B. Kundenbeziehung), setze answer auf null
- Für Fragen mit passenden Informationen: Formuliere eine prägnante, hilfreiche Antwort
- Confidence = 0 wenn keine Antwort, 50-70 für abgeleitete Antworten, 80+ für direkt belegbare Antworten
- Verweise bei Bedarf auf die entsprechenden Sections (Budget, Timing, Contracts, etc.)

Gib für alle 10 Fragen eine Antwort.`;

  try {
    const result = await generateText({
      model: getProviderForSlot('fast')(modelNames.fast),
      output: Output.object({ schema: questionsSchema }),
      prompt,
      temperature: 0,
    });

    // Map agent responses to TenQuestionsPayload format
    const answersMap = new Map(result.output!.answers.map(a => [a.questionId, a]));

    const questions = QUALIFICATION_QUESTIONS.map((question, index) => {
      const id = index + 1;
      const agentAnswer = answersMap.get(id);

      return {
        id,
        question,
        answered: Boolean(agentAnswer?.answer),
        answer: agentAnswer?.answer ?? undefined,
        evidence: [],
        confidence: agentAnswer?.confidence ?? 0,
      };
    });

    const answeredCount = questions.filter(q => q.answered).length;

    console.log(`[PreQual Worker] Agent synthesized ${answeredCount}/10 questions from Decision`);

    return {
      questions,
      answeredCount,
      totalCount: questions.length,
      projectType: 'qualification',
    };
  } catch (error) {
    console.error('[PreQual Worker] Agent synthesis failed, using fallback:', error);

    // Fallback: Minimale Antworten ohne switch/case
    const questions = QUALIFICATION_QUESTIONS.map((question, index) => ({
      id: index + 1,
      question,
      answered: index === 9, // Nur letzte Frage (Bid/No-Bid) beantworten
      answer:
        index === 9
          ? `${decision.recommendation === 'bid' ? 'Empfehlung: Bieten' : decision.recommendation === 'no-bid' ? 'Empfehlung: Nicht bieten' : 'Empfehlung: Unter Bedingungen bieten'}. ${decision.reasoning}`
          : undefined,
      evidence: [],
      confidence: index === 9 ? decision.confidence : 0,
    }));

    return {
      questions,
      answeredCount: 1,
      totalCount: questions.length,
      projectType: 'qualification',
    };
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
      const results = await Promise.all(files.map(file => processPdf(file, enableDSGVO)));

      for (const result of results) {
        if (result.text.trim()) {
          extractedTexts.push({ fileName: result.fileName, text: result.text });
        }
        allPiiMatches.push(...result.piiMatches);
      }

      console.log(
        `[PreQual Worker] Extracted text from ${extractedTexts.length}/${files.length} PDFs`
      );
    }

    await job.updateProgress(PROGRESS.PDF_EXTRACTION);
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.PDF_EXTRACTION,
      currentStep: 'Dokumente vorbereitet',
    });

    // Build raw input
    let rawInput = buildRawInput(extractedTexts, websiteUrls, additionalText);

    if (rawInput.trim().length < 20) {
      const fileNames = files
        .map(file => file.name)
        .filter(Boolean)
        .join(', ');
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
          extractedRequirements = JSON.parse(
            existingPrequal.extractedRequirements
          ) as ExtractedRequirements;
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
        (await inferCustomerNameFromRAG(preQualificationId)) ||
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

    // Qualification should run purely on extracted documents (no web enrichment or URL suggestion).
    const shouldPersistRequirements = true;

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
    // STEP 3: DUPLICATE CHECK (removed)
    // ═══════════════════════════════════════════════════════════════
    await job.updateProgress(PROGRESS.DUPLICATE_CHECK);
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.DUPLICATE_CHECK,
      currentStep: 'Qualifikation läuft',
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: QUICK SCAN (50-90%)
    // ═══════════════════════════════════════════════════════════════
    const websiteUrl: string | null = null;

    if (websiteUrl) {
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
          mode: 'qualification',
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
            extractedRequirements.projectName ||
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

      let blRecommendation = result.blRecommendation;
      if (!blRecommendation?.primaryBusinessLine) {
        try {
          const buRows = await db.select().from(businessUnits);
          const buList = buRows
            .map(bu => {
              try {
                return { name: bu.name, keywords: JSON.parse(bu.keywords) as string[] };
              } catch {
                return { name: bu.name, keywords: [] };
              }
            })
            .filter(bu => bu.keywords.length > 0 || bu.name.length > 0);

          if (buList.length > 0) {
            blRecommendation = await generateBLRecommendation({
              url: websiteUrl || 'document-only',
              companyName: extractedRequirements?.customerName,
              techStack: result.techStack || {},
              contentVolume: {
                estimatedPageCount: result.contentVolume?.estimatedPageCount ?? 0,
                actualPageCount: result.contentVolume?.actualPageCount,
                sitemapFound: result.contentVolume?.sitemapFound,
                sitemapUrl: result.contentVolume?.sitemapUrl,
                contentTypes: result.contentVolume?.contentTypes ?? [],
                mediaAssets: result.contentVolume?.mediaAssets,
                languages: result.contentVolume?.languages ?? [],
                complexity: result.contentVolume?.complexity,
              },
              features: result.features || getFallbackFeatures(),
              businessUnits: buList,
              extractedRequirements,
            });
          }
        } catch (error) {
          console.error('[PreQual Worker] BL recommendation generation failed:', error);
        }
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
        recommendedBusinessUnit: blRecommendation?.primaryBusinessLine ?? null,
        confidence: blRecommendation?.confidence ?? null,
        reasoning: blRecommendation?.reasoning ?? null,
        navigationStructure: result.navigationStructure
          ? JSON.stringify(result.navigationStructure)
          : null,
        accessibilityAudit: result.accessibilityAudit
          ? JSON.stringify(result.accessibilityAudit)
          : null,
        seoAudit: result.seoAudit ? JSON.stringify(result.seoAudit) : null,
        legalCompliance: result.legalCompliance ? JSON.stringify(result.legalCompliance) : null,
        performanceIndicators: result.performanceIndicators
          ? JSON.stringify(result.performanceIndicators)
          : null,
        screenshots: result.screenshots ? JSON.stringify(result.screenshots) : null,
        companyIntelligence: result.companyIntelligence
          ? JSON.stringify(result.companyIntelligence)
          : null,
        contentTypes: result.contentTypes ? JSON.stringify(result.contentTypes) : null,
        migrationComplexity: result.migrationComplexity
          ? JSON.stringify(result.migrationComplexity)
          : null,
        decisionMakers: result.decisionMakers ? JSON.stringify(result.decisionMakers) : null,
        rawScanData: result.rawScanData ? JSON.stringify(result.rawScanData) : null,
        activityLog: JSON.stringify(result.activityLog),
        timeline: timeline ? JSON.stringify(timeline) : null,
        timelineGeneratedAt: timelineGeneratedAt,
        completedAt: new Date(),
      };

      await db.update(quickScans).set(quickScanPayload).where(eq(quickScans.id, quickScan.id));

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

      try {
        await updateQualificationJob(backgroundJobId, {
          currentStep: 'CMS-Matrix erstellen...',
        });

        const cmsTechs = await db
          .select()
          .from(technologies)
          .where(ilike(technologies.category, 'cms'));

        if (cmsTechs.length === 0) {
          throw new Error('Keine CMS-Technologies gefunden (technologies.category="CMS")');
        }

        const cmsOptions = cmsTechs.map(t => {
          let strengths: string[] = [];
          let weaknesses: string[] = [];
          try {
            strengths = t.pros ? (JSON.parse(t.pros) as string[]) : [];
          } catch {
            strengths = [];
          }
          try {
            weaknesses = t.cons ? (JSON.parse(t.cons) as string[]) : [];
          } catch {
            weaknesses = [];
          }
          return {
            id: t.id,
            name: t.name,
            isBaseline: t.isDefault || false,
            strengths,
            weaknesses,
          };
        });

        const requirements = extractRequirementsFromQuickScan({
          features: result.features,
          techStack: result.techStack,
          contentVolume: result.contentVolume,
          accessibilityAudit: result.accessibilityAudit,
          legalCompliance: result.legalCompliance,
          performanceIndicators: result.performanceIndicators,
        });

        const matrix = await runParallelMatrixResearch(requirements, cmsOptions, undefined, {
          useCache: true,
          saveToDb: true,
          maxConcurrency: 5,
        });

        await saveMatrixToRfp(preQualificationId, matrix);
      } catch (error) {
        console.error('[PreQual Worker] CMS Matrix generation failed:', error);
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

      // Run CMS Evaluation automatically after Quick Scan
      try {
        await updateQualificationJob(backgroundJobId, {
          currentStep: 'CMS-Matrix erstellen...',
        });
        const cmsResult = await startCMSEvaluation(quickScan.id, { useWebSearch: true });
        if (cmsResult.success) {
          console.log(
            `[PreQual Worker] CMS Evaluation completed: ${cmsResult.result?.recommendation.primaryCms}`
          );
        } else {
          console.warn('[PreQual Worker] CMS Evaluation failed:', cmsResult.error);
        }
      } catch (error) {
        console.error('[PreQual Worker] CMS Evaluation error:', error);
      }

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

      try {
        const buRows = await db.select().from(businessUnits);
        const buList = buRows
          .map(bu => {
            try {
              return { name: bu.name, keywords: JSON.parse(bu.keywords) as string[] };
            } catch {
              return { name: bu.name, keywords: [] };
            }
          })
          .filter(bu => bu.keywords.length > 0 || bu.name.length > 0);

        if (buList.length > 0) {
          const blRecommendation = await generateBLRecommendation({
            url: 'document-only',
            companyName: extractedRequirements?.customerName,
            techStack: EMPTY_TECH_STACK,
            contentVolume: {
              estimatedPageCount: 0,
              contentTypes: [],
              languages: [],
            },
            features: getFallbackFeatures(),
            businessUnits: buList,
            extractedRequirements,
          });

          await db
            .update(quickScans)
            .set({
              recommendedBusinessUnit: blRecommendation.primaryBusinessLine,
              confidence: blRecommendation.confidence,
              reasoning: blRecommendation.reasoning,
            })
            .where(eq(quickScans.id, quickScan.id));
        }
      } catch (error) {
        console.error('[PreQual Worker] BL recommendation (doc-only) failed:', error);
      }

      try {
        await updateQualificationJob(backgroundJobId, {
          currentStep: 'CMS-Matrix erstellen...',
        });

        const cmsTechs = await db
          .select()
          .from(technologies)
          .where(ilike(technologies.category, 'cms'));

        if (cmsTechs.length === 0) {
          throw new Error('Keine CMS-Technologies gefunden (technologies.category="CMS")');
        }

        const cmsOptions = cmsTechs.map(t => {
          let strengths: string[] = [];
          let weaknesses: string[] = [];
          try {
            strengths = t.pros ? (JSON.parse(t.pros) as string[]) : [];
          } catch {
            strengths = [];
          }
          try {
            weaknesses = t.cons ? (JSON.parse(t.cons) as string[]) : [];
          } catch {
            weaknesses = [];
          }
          return {
            id: t.id,
            name: t.name,
            isBaseline: t.isDefault || false,
            strengths,
            weaknesses,
          };
        });

        const requirements = extractRequirementsFromQuickScan({
          features: getFallbackFeatures(),
          techStack: {},
          contentVolume: { estimatedPageCount: 0 },
        });

        const matrix = await runParallelMatrixResearch(requirements, cmsOptions, undefined, {
          useCache: true,
          saveToDb: true,
          maxConcurrency: 5,
        });

        await saveMatrixToRfp(preQualificationId, matrix);
      } catch (error) {
        console.error('[PreQual Worker] CMS Matrix (doc-only) failed:', error);
      }

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

    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.SECTION_PAGES,
      currentStep: 'Detailseiten generieren',
    });

    // Orchestrator-Worker Pattern: Parallele Section-Verarbeitung
    const orchestratorResult = await runPreQualSectionOrchestrator(preQualificationId, {
      maxConcurrency: 5,
      enableEvaluation: true,
      qualityThreshold: 60,
      maxRetries: 1,
      skipPlanning: false,
      onProgress: (completed, total, sectionId) => {
        updateQualificationJob(backgroundJobId, {
          currentStep: `Section ${completed}/${total}: ${sectionId}`,
        }).catch(err => console.error('[PreQual Worker] Progress update failed:', err));
      },
    });

    if (!orchestratorResult.success) {
      console.error('[PreQual Worker] Orchestrator failed:', orchestratorResult.error);
      console.error(
        '[PreQual Worker] Failed sections:',
        orchestratorResult.failedSections.map(s => s.sectionId)
      );
    } else {
      console.log(
        `[PreQual Worker] Sections completed: ${orchestratorResult.completedSections}/${7}`
      );
      if (orchestratorResult.decision) {
        console.log(
          `[PreQual Worker] Bid/No Bid: ${orchestratorResult.decision.recommendation} (Confidence: ${orchestratorResult.decision.confidence}%)`
        );

        // Synthetisiere 10 Fragen aus Decision (Agent-basiert)
        const tenQuestions = await synthesizeTenQuestionsFromDecision(orchestratorResult.decision);

        // Speichere in quickScan
        const existingQuickScan = await db
          .select({ id: quickScans.id })
          .from(quickScans)
          .where(eq(quickScans.preQualificationId, preQualificationId))
          .limit(1);

        if (existingQuickScan.length > 0) {
          await db
            .update(quickScans)
            .set({
              tenQuestions: JSON.stringify(tenQuestions),
            })
            .where(eq(quickScans.id, existingQuickScan[0].id));
          console.log('[PreQual Worker] 10 Fragen aus Decision synthetisiert');
        }
      }
    }

    await job.updateProgress(PROGRESS.QUICK_SCAN);

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
        agentErrors: JSON.stringify([
          {
            agent: 'prequal-processing',
            error: errorMsg,
            errorDetails: {
              name: errorName,
              stack: errorStack,
            },
            timestamp: new Date().toISOString(),
          },
        ]),
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
