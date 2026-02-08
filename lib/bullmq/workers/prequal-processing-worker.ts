/**
 * BullMQ PreQual Processing Worker
 *
 * Processes new Qualification submissions in the background:
 * 1. PDF text extraction (parallel for multiple files)
 * 2. DSGVO/PII cleaning if enabled
 * 3. AI requirements extraction
 * 4. Duplicate check
 * 5. Qualification Scan (website analysis)
 * 6. Status update to ready
 *
 * Progress is tracked via preQualifications.status field.
 */

import { generateText, Output } from 'ai';
import type { Job } from 'bullmq';
import { eq, ilike } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';

import {
  runParallelMatrixResearch,
  saveMatrixToRfp,
  matrixToCMSMatchingResult,
  type LicenseCostContext,
} from '../../cms-matching/parallel-matrix-orchestrator';
import { extractRequirementsFromQualificationScan } from '../../cms-matching/requirements';
import { runCMSRequirementsAgent } from '../../cms-matching/requirements-agent';
import { generateBLRecommendation } from '../../qualification-scan/workflow/steps/synthesis';
import type { TechStack } from '../../qualification-scan/schema';
import { startCMSEvaluation } from '../../cms-matching/actions';
import { modelNames } from '../../ai/config';
import { warmModelConfigCache } from '../../ai/model-config';
import { getProviderForSlot } from '../../ai/providers';
import { extractTextFromPdf } from '../../bids/pdf-extractor';
import { QUALIFICATION_QUESTIONS, type TenQuestionsPayload } from '../../bids/ten-questions';
import { runTenQuestionsAgent } from '../../bids/ten-questions-agent';
import { db } from '../../db';
import {
  backgroundJobs,
  businessUnits,
  preQualifications,
  leadScans,
  technologies,
} from '../../db/schema';
import { runExtractionAgentNative } from '../../extraction/agent-native';
import { extractedRequirementsSchema, type ExtractedRequirements } from '../../extraction/schema';
import { detectPII, cleanText } from '../../pii/pii-cleaner';
import {
  runPreQualSectionOrchestrator,
  SECTION_IDS,
  type Decision,
} from '../../qualification/orchestrator-worker';
import { runQualificationScanAgentNative } from '../../qualification-scan/agent-native';
import { embedAgentOutput } from '../../rag/embedding-service';
import { queryRawChunks, formatRAGContext } from '../../rag/raw-retrieval-service';
import { gatherCompanyIntelligence } from '../../qualification-scan/tools/company-research';
import { searchDecisionMakersNameOnly } from '../../qualification-scan/tools/decision-maker-research';
import { checkAndSuggestUrl } from '../../qualification-scan/tools/url-suggestion-agent';
import {
  publishPhaseStart,
  publishPhaseComplete,
  publishAgentProgress,
  publishProgressUpdate,
  publishToolCall,
  publishToolResult,
  publishSectionComplete,
  publishSectionQuality,
  publishFinding,
  publishCompletion,
  publishError,
} from '../../streaming/qualification-publisher';
import { generateTimelineFromQualificationScan } from '../../timeline/integration';
import { onAgentComplete } from '../../workflow/orchestrator';
import type { PreQualProcessingJobData, PreQualProcessingJobResult } from '../queues';

/**
 * Progress percentages for each step
 */
const PROGRESS = {
  START: 0,
  PDF_EXTRACTION: 20,
  REQUIREMENTS: 40,
  LEAD_SCAN: 70,
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

function normalizeWebsiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const full = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  try {
    const url = new URL(full);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    // Keep search params, but normalize the trailing slash for the homepage.
    if (url.pathname === '/') url.pathname = '';
    return url.toString();
  } catch {
    return null;
  }
}

function pickWebsiteUrl(
  websiteUrls: string[],
  extractedRequirements: ExtractedRequirements
): string | null {
  const candidates: Array<string | undefined | null> = [
    websiteUrls?.[0],
    extractedRequirements.websiteUrl,
    extractedRequirements.websiteUrls?.[0]?.url,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const normalized = normalizeWebsiteUrl(String(c));
    if (normalized) return normalized;
  }

  return null;
}

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
 * Simple fallback extraction when ToolLoopAgent fails.
 * Uses a single generateText call with structured output validation.
 */
async function runSimpleFallbackExtraction(rawInput: string): Promise<ExtractedRequirements> {
  const truncatedInput = rawInput.slice(0, 30000); // Keep within token limits

  const result = await generateText({
    model: (await getProviderForSlot('fast'))(modelNames.fast),
    output: Output.object({ schema: extractedRequirementsSchema }),
    prompt: `Analysiere das folgende Ausschreibungsdokument und extrahiere die wichtigsten Informationen als JSON.

DOKUMENT:
---
${truncatedInput}
---

Setze Felder auf null/leer wenn nicht im Dokument vorhanden. Erfinde KEINE Daten.`,
    temperature: 0,
  });

  const parsed = result.output;
  if (!parsed) throw new Error('Fallback extraction produced no structured output');

  return {
    ...parsed,
    extractedAt: new Date().toISOString(),
    technologies: parsed.technologies ?? [],
    keyRequirements: parsed.keyRequirements ?? [],
  };
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
  pageCount: number;
  chunked: boolean;
  piiMatches: Array<{ type: string; original: string; replacement: string }>;
}> {
  const buffer = Buffer.from(fileData.base64, 'base64');
  let text = '';
  let pageCount = 0;
  if (buffer.length === 0) {
    console.warn(`[PreQual Worker] Skipping empty PDF: ${fileData.name}`);
    return { fileName: fileData.name, text: '', pageCount: 0, chunked: false, piiMatches: [] };
  }

  // Read page count before extraction
  try {
    const pdf = await PDFDocument.load(buffer);
    pageCount = pdf.getPageCount();
  } catch {
    // Fallback: estimate from file size (~50KB per page)
    pageCount = Math.ceil(buffer.length / (50 * 1024));
  }

  const chunked = pageCount > 30;

  try {
    text = await extractTextFromPdf(buffer, { extractionMode: 'thorough' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('document has no pages')) {
      console.warn(`[PreQual Worker] PDF has no pages, skipping: ${fileData.name}`);
    } else {
      console.error(`[PreQual Worker] PDF extraction failed for ${fileData.name}:`, message);
    }
    return { fileName: fileData.name, text: '', pageCount, chunked, piiMatches: [] };
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

  return { fileName: fileData.name, text: text || '', pageCount, chunked, piiMatches };
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
      model: (await getProviderForSlot('fast'))(modelNames.fast),
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

async function inferCustomerName(
  preQualificationId: string,
  rawInput: string,
  fileNames: string[]
): Promise<string | null> {
  // Preferred: RAG (grounded in extracted raw chunks). If empty/unclear, fallback to direct LLM.
  const fromRag = await inferCustomerNameFromRAG(preQualificationId);
  if (fromRag) return fromRag;

  return inferCustomerNameWithAI(rawInput, fileNames);
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
      model: (await getProviderForSlot('fast'))(modelNames.fast),
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
      model: (await getProviderForSlot('fast'))(modelNames.fast),
      output: Output.object({ schema: questionsSchema }),
      prompt,
      temperature: 0,
    });

    // Map agent responses to TenQuestionsPayload format
    const answersMap = new Map(result.output.answers.map(a => [a.questionId, a]));

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

  // Ensure AI model config is loaded from DB (cached with 60s TTL)
  await warmModelConfigCache();

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
    void publishPhaseStart(preQualificationId, 'pdf_extraction', 'Dokumente extrahieren').catch(
      err => console.error('[PreQual Worker] Publish failed:', err)
    );
    await job.updateProgress(PROGRESS.START);

    const extractedTexts: Array<{ fileName: string; text: string }> = [];
    const allPiiMatches: Array<{ type: string; original: string; replacement: string }> = [];
    let totalPages = 0;

    if (files.length > 0) {
      console.log(`[PreQual Worker] Extracting text from ${files.length} PDFs`);
      void publishAgentProgress(
        preQualificationId,
        'pdf_extraction',
        'PDF Extraktor',
        `Verarbeite ${files.length} Dokumente...`
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      // Process PDFs sequentially for granular progress
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await processPdf(file, enableDSGVO);
        if (result.text.trim()) {
          extractedTexts.push({ fileName: result.fileName, text: result.text });
        }
        totalPages += result.pageCount;
        allPiiMatches.push(...result.piiMatches);

        // Publish per-file progress with page count and chunking info
        const fileProgress = Math.round(
          PROGRESS.START + ((i + 1) / files.length) * (PROGRESS.PDF_EXTRACTION - PROGRESS.START)
        );
        const pageInfo =
          result.pageCount > 0
            ? ` (${result.pageCount} Seiten${result.chunked ? ', Chunking' : ''})`
            : '';
        void publishProgressUpdate(
          preQualificationId,
          'pdf_extraction',
          'PDF Extraktor',
          `Dokument ${i + 1}/${files.length}: ${file.name}${pageInfo}`,
          fileProgress
        ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
      }

      // Summary with total pages
      const totalChars = extractedTexts.reduce((sum, t) => sum + t.text.length, 0);
      const pagesInfo = totalPages > 0 ? `, ${totalPages} Seiten` : '';
      void publishAgentProgress(
        preQualificationId,
        'pdf_extraction',
        'PDF Extraktor',
        `${extractedTexts.length} Dokumente extrahiert (${totalChars.toLocaleString('de-DE')} Zeichen${pagesInfo})`
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      console.log(
        `[PreQual Worker] Extracted text from ${extractedTexts.length}/${files.length} PDFs`
      );
    }

    await job.updateProgress(PROGRESS.PDF_EXTRACTION);
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.PDF_EXTRACTION,
      currentStep: 'Dokumente vorbereitet',
    });
    void publishPhaseComplete(
      preQualificationId,
      'pdf_extraction',
      `${extractedTexts.length} Dokumente extrahiert`
    ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

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

    void publishPhaseStart(
      preQualificationId,
      'requirements_extraction',
      'Anforderungen extrahieren'
    ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

    if (useExistingRequirements) {
      await updateQualificationJob(backgroundJobId, {
        currentStep: 'Vorhandene Extraktion verwenden',
      });
      void publishAgentProgress(
        preQualificationId,
        'requirements_extraction',
        'Extraction Agent',
        'Vorhandene Extraktion verwenden'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

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

      void publishProgressUpdate(
        preQualificationId,
        'requirements_extraction',
        'Extraction Agent',
        'KI-Extraktion gestartet...',
        PROGRESS.PDF_EXTRACTION + 5
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

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

        // Report extracted fields
        const foundFields: string[] = [];
        if (extractedRequirements.customerName) foundFields.push('Kunde');
        if (extractedRequirements.projectName) foundFields.push('Projekt');
        if (extractedRequirements.budgetRange) foundFields.push('Budget');
        if (extractedRequirements.submissionDeadline) foundFields.push('Frist');
        if (extractedRequirements.technologies?.length)
          foundFields.push(`${extractedRequirements.technologies.length} Technologien`);
        if (extractedRequirements.contacts?.length)
          foundFields.push(`${extractedRequirements.contacts.length} Kontakte`);

        void publishAgentProgress(
          preQualificationId,
          'requirements_extraction',
          'Extraction Agent',
          `KI-Extraktion abgeschlossen: ${foundFields.join(', ') || 'Basisdaten'}`
        ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[PreQual Worker] Extraction agent failed:', errMsg);

        void publishAgentProgress(
          preQualificationId,
          'requirements_extraction',
          'Extraction Agent',
          `Agent-Extraktion fehlgeschlagen (${errMsg.slice(0, 60)}), versuche Direkt-Extraktion...`
        ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

        // Fallback: simple direct extraction with generateText + structured output
        try {
          extractedRequirements = await runSimpleFallbackExtraction(rawInput);
          const fallbackFields: string[] = [];
          if (extractedRequirements.customerName) fallbackFields.push('Kunde');
          if (extractedRequirements.projectName) fallbackFields.push('Projekt');
          if (extractedRequirements.technologies?.length)
            fallbackFields.push(`${extractedRequirements.technologies.length} Tech`);

          void publishAgentProgress(
            preQualificationId,
            'requirements_extraction',
            'Extraction Agent',
            `Direkt-Extraktion erfolgreich: ${fallbackFields.join(', ') || 'Basisdaten'}`
          ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        } catch (fallbackError) {
          console.error('[PreQual Worker] Fallback extraction also failed:', fallbackError);

          extractedRequirements = {
            technologies: [],
            keyRequirements: [],
            confidenceScore: 0.2,
            extractedAt: new Date().toISOString(),
          } as ExtractedRequirements;

          void publishAgentProgress(
            preQualificationId,
            'requirements_extraction',
            'Extraction Agent',
            'Extraktion fehlgeschlagen, verwende Minimaldaten'
          ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }
      }
    }

    if (!extractedRequirements.customerName) {
      const fileNameCandidates = files.map(f => f.name);
      const inferredCustomer = await inferCustomerName(
        preQualificationId,
        rawInput,
        fileNameCandidates
      );

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

    // Publish findings for all extracted fields
    const pf = (finding: Parameters<typeof publishFinding>[2]) =>
      void publishFinding(preQualificationId, 'requirements_extraction', finding).catch(err =>
        console.error('[PreQual Worker] Publish failed:', err)
      );

    // Customer & Company
    if (extractedRequirements.customerName) {
      pf({ type: 'customer', label: 'Kundenname', value: extractedRequirements.customerName });
    }
    if (extractedRequirements.industry) {
      pf({ type: 'industry', label: 'Branche', value: extractedRequirements.industry });
    }
    if (extractedRequirements.companyLocation) {
      pf({ type: 'location', label: 'Standort', value: extractedRequirements.companyLocation });
    }
    if (extractedRequirements.companySize) {
      const sizeLabels: Record<string, string> = {
        startup: 'Startup',
        small: 'Klein',
        medium: 'Mittelstand',
        large: 'Großunternehmen',
        enterprise: 'Konzern',
      };
      pf({
        type: 'customer',
        label: 'Unternehmensgröße',
        value: sizeLabels[extractedRequirements.companySize] || extractedRequirements.companySize,
      });
    }
    if (extractedRequirements.procurementType) {
      const procLabels: Record<string, string> = {
        public: 'Öffentlich',
        private: 'Privat',
        'semi-public': 'Halböffentlich',
      };
      pf({
        type: 'contract',
        label: 'Vergabeart',
        value:
          procLabels[extractedRequirements.procurementType] ||
          extractedRequirements.procurementType,
      });
    }

    // Project Details
    if (extractedRequirements.projectName) {
      pf({ type: 'requirement', label: 'Projektname', value: extractedRequirements.projectName });
    }
    if (extractedRequirements.projectDescription) {
      pf({
        type: 'scope',
        label: 'Projektbeschreibung',
        value:
          extractedRequirements.projectDescription.length > 200
            ? extractedRequirements.projectDescription.slice(0, 200) + '...'
            : extractedRequirements.projectDescription,
      });
    }
    if (extractedRequirements.scope) {
      pf({ type: 'scope', label: 'Projektumfang', value: extractedRequirements.scope });
    }

    // Project Goal
    if (extractedRequirements.projectGoal?.objective) {
      pf({
        type: 'goal',
        label: 'Projektziel',
        value: extractedRequirements.projectGoal.objective,
      });
    }
    if (extractedRequirements.projectGoal?.businessDrivers?.length) {
      pf({
        type: 'goal',
        label: 'Treiber',
        value: extractedRequirements.projectGoal.businessDrivers.join(', '),
      });
    }

    // Budget
    if (extractedRequirements.budgetRange) {
      const br = extractedRequirements.budgetRange;
      const budgetStr =
        br.min && br.max
          ? `${br.min.toLocaleString('de-DE')}–${br.max.toLocaleString('de-DE')} ${br.currency ?? 'EUR'}`
          : br.max
            ? `bis ${br.max.toLocaleString('de-DE')} ${br.currency ?? 'EUR'}`
            : JSON.stringify(br);
      pf({ type: 'budget', label: 'Budget', value: budgetStr, confidence: br.confidence });
    }

    // Timeline & Deadlines
    if (extractedRequirements.timeline) {
      pf({ type: 'timeline', label: 'Projektzeitrahmen', value: extractedRequirements.timeline });
    }
    if (extractedRequirements.submissionDeadline) {
      pf({
        type: 'deadline',
        label: 'Abgabefrist',
        value: `${extractedRequirements.submissionDeadline}${extractedRequirements.submissionTime ? ` um ${extractedRequirements.submissionTime} Uhr` : ''}`,
      });
    }
    if (extractedRequirements.projectStartDate) {
      pf({
        type: 'timeline',
        label: 'Projektstart',
        value: extractedRequirements.projectStartDate,
      });
    }
    if (extractedRequirements.projectEndDate) {
      pf({ type: 'timeline', label: 'Projektende', value: extractedRequirements.projectEndDate });
    }
    if (extractedRequirements.contractDuration) {
      pf({
        type: 'timeline',
        label: 'Vertragslaufzeit',
        value: extractedRequirements.contractDuration,
      });
    }

    // Technologies
    if (extractedRequirements.technologies?.length) {
      pf({
        type: 'tech_stack',
        label: 'Technologien',
        value: extractedRequirements.technologies.join(', '),
      });
    }
    if (extractedRequirements.cmsConstraints) {
      const cms = extractedRequirements.cmsConstraints;
      const parts: string[] = [];
      if (cms.required?.length) parts.push(`Pflicht: ${cms.required.join(', ')}`);
      if (cms.preferred?.length) parts.push(`Bevorzugt: ${cms.preferred.join(', ')}`);
      if (cms.excluded?.length) parts.push(`Ausgeschlossen: ${cms.excluded.join(', ')}`);
      if (parts.length > 0) {
        pf({
          type: 'cms',
          label: 'CMS-Vorgaben',
          value: parts.join(' | '),
          confidence: cms.confidence,
        });
      }
    }

    // Contract
    if (extractedRequirements.contractType) {
      pf({ type: 'contract', label: 'Vertragstyp', value: extractedRequirements.contractType });
    }
    if (extractedRequirements.contractModel) {
      pf({ type: 'contract', label: 'Vertragsmodell', value: extractedRequirements.contractModel });
    }
    if (extractedRequirements.procedureType) {
      pf({
        type: 'contract',
        label: 'Vergabeverfahren',
        value: extractedRequirements.procedureType,
      });
    }

    // Contacts
    if (extractedRequirements.contactPerson) {
      pf({
        type: 'contact',
        label: 'Ansprechpartner',
        value: `${extractedRequirements.contactPerson}${extractedRequirements.contactEmail ? ` (${extractedRequirements.contactEmail})` : ''}`,
      });
    }
    if (extractedRequirements.contacts?.length) {
      for (const contact of extractedRequirements.contacts) {
        const catLabels: Record<string, string> = {
          decision_maker: 'Entscheider',
          influencer: 'Einflussnehmer',
          coordinator: 'Koordinator',
          unknown: '',
        };
        const catLabel = catLabels[contact.category] || '';
        pf({
          type: 'contact',
          label: catLabel ? `Kontakt (${catLabel})` : 'Kontakt',
          value: `${contact.name} — ${contact.role}${contact.email ? ` (${contact.email})` : ''}`,
          confidence: contact.confidence,
        });
      }
    }

    // Required Services
    if (extractedRequirements.requiredServices?.length) {
      pf({
        type: 'service',
        label: 'Geforderte Leistungen',
        value: extractedRequirements.requiredServices.join(', '),
      });
    }

    // Key Requirements
    if (extractedRequirements.keyRequirements?.length) {
      for (const req of extractedRequirements.keyRequirements.slice(0, 8)) {
        pf({ type: 'requirement', label: 'Anforderung', value: req });
      }
    }

    // Required Deliverables
    if (extractedRequirements.requiredDeliverables?.length) {
      for (const del of extractedRequirements.requiredDeliverables.slice(0, 5)) {
        const parts = [del.name];
        if (del.deadline) parts.push(`bis ${del.deadline}`);
        if (del.format) parts.push(`Format: ${del.format}`);
        pf({
          type: 'deliverable',
          label: del.mandatory ? 'Pflichtunterlage' : 'Unterlage',
          value: parts.join(' — '),
          confidence: del.confidence,
        });
      }
    }

    // Award Criteria
    if (extractedRequirements.awardCriteria?.criteria?.length) {
      for (let i = 0; i < extractedRequirements.awardCriteria.criteria.length && i < 6; i++) {
        const crit = extractedRequirements.awardCriteria.criteria[i];
        const weight = extractedRequirements.awardCriteria.weights?.[i];
        pf({
          type: 'criterion',
          label: 'Zuschlagskriterium',
          value: weight ? `${crit} (${weight})` : crit,
        });
      }
    }

    // References
    if (extractedRequirements.referenceRequirements) {
      const ref = extractedRequirements.referenceRequirements;
      const parts: string[] = [];
      if (ref.count) parts.push(`${ref.count} Referenzen`);
      if (ref.requiredIndustries?.length)
        parts.push(`Branchen: ${ref.requiredIndustries.join(', ')}`);
      if (ref.requiredTechnologies?.length)
        parts.push(`Technologien: ${ref.requiredTechnologies.join(', ')}`);
      if (ref.description && !parts.length) parts.push(ref.description);
      if (parts.length > 0) {
        pf({ type: 'reference', label: 'Referenzanforderungen', value: parts.join(' | ') });
      }
    }

    // Submission Portal
    if (extractedRequirements.submissionPortal?.name) {
      pf({
        type: 'deadline',
        label: 'Vergabeportal',
        value: `${extractedRequirements.submissionPortal.name}${extractedRequirements.submissionPortal.url ? ` (${extractedRequirements.submissionPortal.url})` : ''}`,
      });
    }

    // Team Size
    if (extractedRequirements.teamSize) {
      pf({
        type: 'requirement',
        label: 'Teamgröße',
        value: `${extractedRequirements.teamSize} Personen`,
      });
    }

    // Constraints
    if (extractedRequirements.constraints?.length) {
      pf({
        type: 'requirement',
        label: 'Einschränkungen',
        value: extractedRequirements.constraints.join(', '),
      });
    }

    await job.updateProgress(PROGRESS.REQUIREMENTS);
    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.REQUIREMENTS,
      currentStep: 'Extraktion abgeschlossen',
    });
    void publishPhaseComplete(
      preQualificationId,
      'requirements_extraction',
      'Extraktion abgeschlossen'
    ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: LEAD SCAN (50-90%)
    // ═══════════════════════════════════════════════════════════════
    let websiteUrl: string | null = pickWebsiteUrl(websiteUrls, extractedRequirements);

    if (websiteUrl) {
      try {
        const urlCheck = await checkAndSuggestUrl(websiteUrl);
        if (urlCheck.reachable) {
          websiteUrl = urlCheck.finalUrl;
          if (urlCheck.redirectChain?.length) {
            void publishAgentProgress(
              preQualificationId,
              'qualification_scan',
              'Website Crawler',
              `URL erreichbar (${urlCheck.statusCode ?? 'OK'}): ${urlCheck.finalUrl}`
            ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
          }
        } else if (urlCheck.suggestedUrl) {
          websiteUrl = urlCheck.suggestedUrl;
          void publishFinding(preQualificationId, 'qualification_scan', {
            type: 'customer',
            label: 'URL Vorschlag',
            value: `${urlCheck.finalUrl} → ${urlCheck.suggestedUrl}${urlCheck.reason ? ` (${urlCheck.reason})` : ''}`,
            confidence: 60,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        } else {
          // No reachable URL found; fall back to document-only path.
          websiteUrl = null;
          void publishFinding(preQualificationId, 'qualification_scan', {
            type: 'customer',
            label: 'Website',
            value: `Nicht erreichbar: ${urlCheck.reason || urlCheck.finalUrl}`,
            confidence: 20,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }
      } catch (error) {
        console.error('[PreQual Worker] URL check failed:', error);
        websiteUrl = null;
      }
    }

    if (websiteUrl) {
      const [preQualRow] = await db
        .select({ qualificationScanId: preQualifications.qualificationScanId })
        .from(preQualifications)
        .where(eq(preQualifications.id, preQualificationId))
        .limit(1);

      let qualificationScan = preQualRow?.qualificationScanId
        ? (
            await db
              .select()
              .from(leadScans)
              .where(eq(leadScans.id, preQualRow.qualificationScanId))
              .limit(1)
          )[0]
        : null;

      if (!qualificationScan) {
        [qualificationScan] = await db
          .insert(leadScans)
          .values({
            preQualificationId,
            websiteUrl,
            status: 'running',
            startedAt: new Date(),
          })
          .returning();
      } else {
        await db
          .update(leadScans)
          .set({
            websiteUrl,
            status: 'running',
            startedAt: qualificationScan.startedAt || new Date(),
            completedAt: null,
          })
          .where(eq(leadScans.id, qualificationScan.id));
      }

      await db
        .update(preQualifications)
        .set({
          qualificationScanId: qualificationScan.id,
          websiteUrl,
          updatedAt: new Date(),
        })
        .where(eq(preQualifications.id, preQualificationId));

      void publishPhaseStart(preQualificationId, 'qualification_scan', 'Website analysieren').catch(
        err => console.error('[PreQual Worker] Publish failed:', err)
      );

      const result = await runQualificationScanAgentNative(
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
            void publishAgentProgress(
              preQualificationId,
              'qualification_scan',
              'Website Scanner',
              entry.action
            ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
          },
        }
      );

      let timeline: Record<string, unknown> | null = null;
      let timelineGeneratedAt: Date | null = null;

      try {
        timeline = await generateTimelineFromQualificationScan({
          projectName:
            extractedRequirements.projectName ||
            extractedRequirements.projectDescription ||
            'Projekt',
          projectDescription: extractedRequirements.projectDescription,
          websiteUrl,
          extractedRequirements,
          qualificationScanResult: {
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

      // CMS Matrix FIRST, then BL Recommendation (BL needs CMS result as context)
      let urlPathCmsRecommendation: string | undefined;

      try {
        await updateQualificationJob(backgroundJobId, {
          currentStep: 'CMS-Matrix erstellen...',
        });

        // Select only the columns this step actually needs. This makes the query resilient
        // against schema drift (e.g. dev DBs not pushed/migrated yet) and avoids selecting
        // newer columns that may not exist.
        const cmsTechs = await db
          .select({
            id: technologies.id,
            name: technologies.name,
            isDefault: technologies.isDefault,
            pros: technologies.pros,
            cons: technologies.cons,
            category: technologies.category,
          })
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

        // Combine scan-detected features with agent-extracted document requirements
        const scanRequirements = extractRequirementsFromQualificationScan({
          features: result.features,
          techStack: result.techStack,
          contentVolume: result.contentVolume,
          accessibilityAudit: result.accessibilityAudit,
          legalCompliance: result.legalCompliance,
          performanceIndicators: result.performanceIndicators,
        });
        const agentRequirements = await runCMSRequirementsAgent(extractedRequirements);

        // Merge & deduplicate (scan takes precedence on name conflicts)
        const seen = new Set(scanRequirements.map(r => r.name.trim().toLowerCase()));
        const requirements = [
          ...scanRequirements,
          ...agentRequirements.filter(r => !seen.has(r.name.trim().toLowerCase())),
        ];
        console.log(
          `[PreQual Worker] CMS Requirements: ${scanRequirements.length} (Scan) + ${agentRequirements.length} (Agent) = ${requirements.length} (merged)`
        );

        const matrix = await runParallelMatrixResearch(requirements, cmsOptions, undefined, {
          useCache: true,
          saveToDb: true,
          maxConcurrency: 5,
        });

        // Build license cost context from extracted requirements
        const licenseCostCtx: LicenseCostContext = {
          companySize: extractedRequirements.companySize,
          pageCount: result.contentVolume?.estimatedPageCount,
          requirements: requirements.map(r => ({ name: r.name, priority: r.priority })),
        };
        // License info is optional context. When the DB schema is not yet pushed/migrated,
        // these columns might not exist; keep the pipeline resilient by providing defaults.
        const DEFAULT_LICENSE_BY_CMS: Record<
          string,
          { annualLicenseCost: number; requiresEnterprise: boolean }
        > = {
          Drupal: { annualLicenseCost: 0, requiresEnterprise: false },
          Sulu: { annualLicenseCost: 0, requiresEnterprise: false },
          Ibexa: { annualLicenseCost: 15_000, requiresEnterprise: false },
          Magnolia: { annualLicenseCost: 30_000, requiresEnterprise: true },
          FirstSpirit: { annualLicenseCost: 50_000, requiresEnterprise: true },
        };
        const techLicenseInfos = cmsTechs.map(t => {
          const defaults = DEFAULT_LICENSE_BY_CMS[t.name] ?? {
            annualLicenseCost: 0,
            requiresEnterprise: false,
          };
          return { id: t.id, ...defaults };
        });

        await saveMatrixToRfp(preQualificationId, matrix, licenseCostCtx, techLicenseInfos);

        // Extract CMS recommendation for BL context
        const cmsMatchingResult = matrixToCMSMatchingResult(
          matrix,
          licenseCostCtx,
          techLicenseInfos
        );
        urlPathCmsRecommendation = cmsMatchingResult.recommendation.primaryCms;
      } catch (error) {
        console.error('[PreQual Worker] CMS Matrix generation failed:', error);
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
              cmsRecommendation: urlPathCmsRecommendation,
            });
          }
        } catch (error) {
          console.error('[PreQual Worker] BL recommendation generation failed:', error);
        }
      }

      const qualificationScanPayload = {
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

      await db
        .update(leadScans)
        .set(qualificationScanPayload)
        .where(eq(leadScans.id, qualificationScan.id));

      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.LEAD_SCAN,
        currentStep: 'Quick Scan abgeschlossen',
      });
      void publishPhaseComplete(
        preQualificationId,
        'qualification_scan',
        'Quick Scan abgeschlossen'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      try {
        await embedAgentOutput(
          preQualificationId,
          'qualification_scan',
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
        .update(leadScans)
        .set({
          tenQuestions: JSON.stringify({
            questions: questions.questions,
            answeredCount: questions.answeredCount,
            totalCount: questions.totalCount,
            projectType: questions.projectType,
          }),
        })
        .where(eq(leadScans.id, qualificationScan.id));

      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.TEN_QUESTIONS,
        currentStep: '10 Fragen beantwortet',
      });

      // Run CMS Evaluation automatically after Quick Scan
      try {
        await updateQualificationJob(backgroundJobId, {
          currentStep: 'CMS-Evaluation...',
        });
        const cmsResult = await startCMSEvaluation(qualificationScan.id, { useWebSearch: true });
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

      await onAgentComplete(preQualificationId, 'QualificationScan');
    } else {
      console.log(`[PreQual Worker] No website URL - document-only qualification`);
      void publishPhaseStart(
        preQualificationId,
        'qualification_scan',
        'Dokumentenbasierte Analyse'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      const [qualificationScan] = await db
        .insert(leadScans)
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
          qualificationScanId: qualificationScan.id,
          updatedAt: new Date(),
        })
        .where(eq(preQualifications.id, preQualificationId));

      void publishAgentProgress(
        preQualificationId,
        'qualification_scan',
        'Dokumentenanalyse',
        'Dokumentenbasierte Analyse wird vorbereitet...'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      // Best-effort customer/decision-maker research (name-only) for doc-only qualifications.
      if (extractedRequirements.customerName) {
        try {
          await updateQualificationJob(backgroundJobId, {
            currentStep: 'Kundenrecherche (name-only)...',
          });
          void publishAgentProgress(
            preQualificationId,
            'qualification_scan',
            'Research Agent',
            'Kundenrecherche (name-only) gestartet...'
          ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

          const [companyIntel, decisionMakers] = await Promise.all([
            gatherCompanyIntelligence(extractedRequirements.customerName, null),
            searchDecisionMakersNameOnly(extractedRequirements.customerName),
          ]);

          await db
            .update(leadScans)
            .set({
              companyIntelligence: companyIntel ? JSON.stringify(companyIntel) : null,
              decisionMakers: decisionMakers ? JSON.stringify(decisionMakers) : null,
            })
            .where(eq(leadScans.id, qualificationScan.id));

          if (companyIntel?.basicInfo?.employeeCount) {
            void publishFinding(preQualificationId, 'qualification_scan', {
              type: 'customer',
              label: 'Mitarbeiter',
              value: companyIntel.basicInfo.employeeCount,
              confidence: companyIntel.dataQuality?.confidence ?? 40,
            }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
          }

          const dmCount = decisionMakers?.decisionMakers?.length ?? 0;
          if (dmCount > 0) {
            void publishFinding(preQualificationId, 'qualification_scan', {
              type: 'contact',
              label: 'Entscheider',
              value: `${dmCount} Profile gefunden (z.B. LinkedIn)`,
              confidence: decisionMakers.researchQuality?.confidence ?? 40,
            }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
          }
        } catch (error) {
          console.error('[PreQual Worker] Doc-only research failed:', error);
        }
      }

      void publishAgentProgress(
        preQualificationId,
        'qualification_scan',
        '10-Fragen Agent',
        '10 BD-Fragen werden beantwortet...'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      const questions = await runTenQuestionsAgent({
        preQualificationId,
        userId,
        language: 'de',
      });

      await db
        .update(leadScans)
        .set({
          tenQuestions: JSON.stringify({
            questions: questions.questions,
            answeredCount: questions.answeredCount,
            totalCount: questions.totalCount,
            projectType: questions.projectType,
          }),
        })
        .where(eq(leadScans.id, qualificationScan.id));

      // Publish each answered question as a finding
      void publishAgentProgress(
        preQualificationId,
        'qualification_scan',
        '10-Fragen Agent',
        `${questions.answeredCount}/${questions.totalCount} Fragen beantwortet`
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
      for (const q of questions.questions) {
        if (q.answered && q.answer) {
          void publishFinding(preQualificationId, 'qualification_scan', {
            type: 'question',
            label: `Frage ${q.id}: ${q.question.slice(0, 60)}${q.question.length > 60 ? '...' : ''}`,
            value: q.answer,
            confidence: q.confidence,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }
      }

      // CMS Matrix FIRST, then BL Recommendation (BL needs CMS result as context)
      void publishAgentProgress(
        preQualificationId,
        'qualification_scan',
        'CMS Agent',
        'CMS-Matrix wird erstellt...'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

      let docOnlyCmsRecommendation: string | undefined;

      try {
        await updateQualificationJob(backgroundJobId, {
          currentStep: 'CMS-Matrix erstellen...',
        });

        // Select only the columns this step actually needs (avoid schema drift in dev DB).
        const cmsTechs = await db
          .select({
            id: technologies.id,
            name: technologies.name,
            isDefault: technologies.isDefault,
            pros: technologies.pros,
            cons: technologies.cons,
            category: technologies.category,
          })
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

        // Agent-native: AI agent extracts CMS requirements from document data
        const requirements = await runCMSRequirementsAgent(extractedRequirements);
        console.log(`[PreQual Worker] CMS Agent extrahierte ${requirements.length} Anforderungen`);

        const matrix = await runParallelMatrixResearch(requirements, cmsOptions, undefined, {
          useCache: true,
          saveToDb: true,
          maxConcurrency: 5,
        });

        // Build license cost context from extracted requirements (document-only)
        const docLicenseCostCtx: LicenseCostContext = {
          companySize: extractedRequirements.companySize,
          requirements: requirements.map(r => ({ name: r.name, priority: r.priority })),
        };
        const DEFAULT_LICENSE_BY_CMS: Record<
          string,
          { annualLicenseCost: number; requiresEnterprise: boolean }
        > = {
          Drupal: { annualLicenseCost: 0, requiresEnterprise: false },
          Sulu: { annualLicenseCost: 0, requiresEnterprise: false },
          Ibexa: { annualLicenseCost: 15_000, requiresEnterprise: false },
          Magnolia: { annualLicenseCost: 30_000, requiresEnterprise: true },
          FirstSpirit: { annualLicenseCost: 50_000, requiresEnterprise: true },
        };
        const docTechLicenseInfos = cmsTechs.map(t => {
          const defaults = DEFAULT_LICENSE_BY_CMS[t.name] ?? {
            annualLicenseCost: 0,
            requiresEnterprise: false,
          };
          return { id: t.id, ...defaults };
        });

        await saveMatrixToRfp(preQualificationId, matrix, docLicenseCostCtx, docTechLicenseInfos);

        // Extract CMS recommendation for BL context
        const cmsMatchingResult = matrixToCMSMatchingResult(
          matrix,
          docLicenseCostCtx,
          docTechLicenseInfos
        );
        docOnlyCmsRecommendation = cmsMatchingResult.recommendation.primaryCms;
      } catch (error) {
        console.error('[PreQual Worker] CMS Matrix (doc-only) failed:', error);
      }

      void publishAgentProgress(
        preQualificationId,
        'qualification_scan',
        'Routing Agent',
        'Business-Line-Zuordnung...'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

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
            cmsRecommendation: docOnlyCmsRecommendation,
          });

          await db
            .update(leadScans)
            .set({
              recommendedBusinessUnit: blRecommendation.primaryBusinessLine,
              confidence: blRecommendation.confidence,
              reasoning: blRecommendation.reasoning,
            })
            .where(eq(leadScans.id, qualificationScan.id));

          void publishFinding(preQualificationId, 'qualification_scan', {
            type: 'business_line',
            label: 'Business Line',
            value: `${blRecommendation.primaryBusinessLine}${blRecommendation.reasoning ? ` — ${blRecommendation.reasoning}` : ''}`,
            confidence: blRecommendation.confidence,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }
      } catch (error) {
        console.error('[PreQual Worker] BL recommendation (doc-only) failed:', error);
      }

      await updateStatus(preQualificationId, 'questions_ready');
      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.LEAD_SCAN,
        currentStep: 'Dokumentenbasierte Qualification abgeschlossen',
      });
      void publishPhaseComplete(
        preQualificationId,
        'qualification_scan',
        'Dokumentenbasierte Analyse abgeschlossen'
      ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
      await updateQualificationJob(backgroundJobId, {
        progress: PROGRESS.TEN_QUESTIONS,
        currentStep: '10 Fragen beantwortet',
      });
    }

    await updateQualificationJob(backgroundJobId, {
      progress: PROGRESS.SECTION_PAGES,
      currentStep: 'Detailseiten generieren',
    });
    void publishPhaseStart(
      preQualificationId,
      'section_orchestration',
      'Detailseiten generieren'
    ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
    void publishAgentProgress(
      preQualificationId,
      'section_orchestration',
      'Orchestrator',
      `Generiere ${SECTION_IDS.length} Detailseiten parallel...`
    ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

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
        void publishSectionComplete(preQualificationId, sectionId, completed, total).catch(err =>
          console.error('[PreQual Worker] Publish failed:', err)
        );
        void publishSectionQuality(
          preQualificationId,
          sectionId,
          Math.round((completed / total) * 100)
        ).catch(err => console.error('[PreQual Worker] Publish failed:', err));
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
        `[PreQual Worker] Sections completed: ${orchestratorResult.completedSections}/${SECTION_IDS.length}`
      );
      if (orchestratorResult.decision) {
        console.log(
          `[PreQual Worker] Bid/No Bid: ${orchestratorResult.decision.recommendation} (Confidence: ${orchestratorResult.decision.confidence}%)`
        );

        const dec = orchestratorResult.decision;
        const recLabels: Record<string, string> = {
          bid: 'Bieten',
          'no-bid': 'Nicht bieten',
          conditional: 'Unter Bedingungen bieten',
        };

        void publishFinding(preQualificationId, 'completion', {
          type: 'decision',
          label: 'Bid-Empfehlung',
          value: `${recLabels[dec.recommendation] || dec.recommendation} — ${dec.reasoning}`,
          confidence: dec.confidence,
        }).catch(err => console.error('[PreQual Worker] Publish failed:', err));

        // Decision details as findings
        for (const s of dec.strengths) {
          void publishFinding(preQualificationId, 'completion', {
            type: 'strength',
            label: 'Stärke',
            value: s,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }
        for (const w of dec.weaknesses) {
          void publishFinding(preQualificationId, 'completion', {
            type: 'weakness',
            label: 'Schwäche',
            value: w,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }
        for (const c of dec.conditions) {
          void publishFinding(preQualificationId, 'completion', {
            type: 'condition',
            label: 'Bedingung',
            value: c,
          }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
        }

        void publishAgentProgress(
          preQualificationId,
          'section_orchestration',
          'Decision Agent',
          '10 Fragen werden aus Decision synthetisiert...'
        ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

        // Synthetisiere 10 Fragen aus Decision (Agent-basiert)
        const tenQuestions = await synthesizeTenQuestionsFromDecision(dec);

        // Publish each answered question as a finding
        for (const q of tenQuestions.questions) {
          if (q.answered && q.answer) {
            void publishFinding(preQualificationId, 'section_orchestration', {
              type: 'question',
              label: `Frage ${q.id}: ${q.question.slice(0, 60)}${q.question.length > 60 ? '...' : ''}`,
              value: q.answer,
              confidence: q.confidence,
            }).catch(err => console.error('[PreQual Worker] Publish failed:', err));
          }
        }

        // Speichere in qualificationScan
        const existingQualificationScan = await db
          .select({ id: leadScans.id })
          .from(leadScans)
          .where(eq(leadScans.preQualificationId, preQualificationId))
          .limit(1);

        if (existingQualificationScan.length > 0) {
          await db
            .update(leadScans)
            .set({
              tenQuestions: JSON.stringify(tenQuestions),
            })
            .where(eq(leadScans.id, existingQualificationScan[0].id));
          console.log('[PreQual Worker] 10 Fragen aus Decision synthetisiert');
        }
      }
    }

    void publishPhaseComplete(
      preQualificationId,
      'section_orchestration',
      `${orchestratorResult.completedSections} Sektionen abgeschlossen`
    ).catch(err => console.error('[PreQual Worker] Publish failed:', err));

    await job.updateProgress(PROGRESS.LEAD_SCAN);

    // If ALL sections failed, mark job as failed
    if (orchestratorResult.completedSections === 0) {
      const errorMsg =
        orchestratorResult.error ||
        `Alle ${orchestratorResult.failedSections.length} Sections fehlgeschlagen`;

      await job.updateProgress(PROGRESS.COMPLETE);
      await updateQualificationJob(backgroundJobId, {
        status: 'failed',
        progress: PROGRESS.COMPLETE,
        currentStep: 'Sections fehlgeschlagen',
        errorMessage: errorMsg,
        completedAt: new Date(),
      });
      void publishError(preQualificationId, errorMsg).catch(err =>
        console.error('[PreQual Worker] Publish failed:', err)
      );

      console.error(`[PreQual Worker] Job ${job.id} failed: ${errorMsg}`);

      return {
        success: false,
        step: 'scanning',
        progress: PROGRESS.SECTION_PAGES,
        error: errorMsg,
      };
    }

    // At least some sections succeeded
    const resultPayload = {
      success: true,
      completedSections: orchestratorResult.completedSections,
      totalSections: SECTION_IDS.length,
      failedSections: orchestratorResult.failedSections.map(s => s.sectionId),
      decision: orchestratorResult.decision?.recommendation,
    };

    await job.updateProgress(PROGRESS.COMPLETE);
    await updateQualificationJob(backgroundJobId, {
      status: 'completed',
      progress: PROGRESS.COMPLETE,
      currentStep: 'Abgeschlossen',
      completedAt: new Date(),
      result: JSON.stringify(resultPayload),
    });
    void publishCompletion(preQualificationId, 'Verarbeitung abgeschlossen').catch(err =>
      console.error('[PreQual Worker] Publish failed:', err)
    );

    console.log(
      `[PreQual Worker] Job ${job.id} completed (${orchestratorResult.completedSections}/${SECTION_IDS.length} sections).`
    );

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
    void publishError(preQualificationId, errorMsg).catch(err =>
      console.error('[PreQual Worker] Publish failed:', err)
    );

    return {
      success: false,
      step: 'extracting',
      progress: 0,
      error: errorMsg,
    };
  }
}
