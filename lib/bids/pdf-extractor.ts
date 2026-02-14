/**
 * PDF Text Extraction
 *
 * Supports two engines:
 * - 'deterministic' (default): Uses pdfjs-dist for fast, deterministic extraction.
 *   No API calls, works offline, produces consistent output.
 * - 'ai': Uses the adesso AI Hub (Gemini models) for OCR-capable extraction.
 *   Handles scanned documents and complex layouts but is slower and non-deterministic.
 *
 * The engine can be controlled via the `engine` option or the PDF_EXTRACTION_ENGINE env var.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PDFDocument } from 'pdf-lib';

import { getProviderCredentials, warmModelConfigCache } from '@/lib/ai/model-config';
import { extractTextDeterministic } from './pdf-deterministic-extractor';

const pdfProviderCache = new Map<string, ReturnType<typeof createOpenAI>>();

async function getPdfExtractionModel() {
  // Ensure DB config is loaded
  await warmModelConfigCache();

  // Force Gemini Flash on AI Hub for PDF extraction.
  const envModel = process.env.AI_PDF_MODEL_AI_HUB;
  const modelName =
    envModel && envModel.startsWith('gemini-') ? envModel : 'gemini-3-flash-preview';

  // Use config system: DB → Env → Default for AI Hub credentials
  const credentials = await getProviderCredentials('ai-hub');
  if (!credentials.apiKey) {
    throw new Error(
      'AI Hub API key not configured (check DB provider config or AI_HUB_API_KEY env var)'
    );
  }

  const cacheKey = `ai-hub:${credentials.baseURL}`;
  if (!pdfProviderCache.has(cacheKey)) {
    pdfProviderCache.set(
      cacheKey,
      createOpenAI({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseURL,
      })
    );
  }

  if (envModel && !envModel.startsWith('gemini-')) {
    console.warn(
      `[PDF Extractor] Ignoring non-gemini AI_PDF_MODEL_AI_HUB=${envModel}; using ${modelName}`
    );
  }

  return pdfProviderCache.get(cacheKey)!(modelName);
}

// Approximate max pages before chunking (based on typical PDF page = ~500-1000 tokens output)
const MAX_PAGES_PER_CHUNK = 30;

// Max tokens for output - Gemini supports up to 8192 output tokens by default
// We use a higher value and let the API handle truncation gracefully
const MAX_OUTPUT_TOKENS = 16000;
const PDF_CHUNK_DELAY_MS = parseInt(process.env.PDF_CHUNK_DELAY_MS || '1500', 10);

export type PdfExtractionMode = 'fast' | 'thorough';

type PdfLocatorStyle = 'bracket_v1';

export type PdfExtractionPass = 'text' | 'tables' | 'images';

export type PdfExtractionEngine = 'deterministic' | 'ai';

export type PdfExtractionOptions = {
  extractionMode?: PdfExtractionMode;
  /**
   * Extraction engine to use.
   * - 'deterministic': pdfjs-dist based, fast, no API calls (default)
   * - 'ai': Gemini-based, supports OCR for scanned documents
   *
   * Can also be set via PDF_EXTRACTION_ENGINE env var.
   */
  engine?: PdfExtractionEngine;
  /**
   * When enabled, the extractor will try to preserve source locators using explicit markers:
   * - [[PAGE N]] at the start of each page
   * - [[PASS text|tables|images]] at the start of each extraction pass (added by us, not the model)
   * - [[H]] Heading for headings
   *
   * This is best-effort (model may not fully comply), but allows deterministic parsing later.
   */
  includeLocators?: boolean;
  locatorStyle?: PdfLocatorStyle;
};

function withPassHeader(pass: PdfExtractionPass, text: string): string {
  if (!text) return '';
  return `[[PASS ${pass}]]\n${text}`.trim();
}

/**
 * Extract text from a PDF buffer.
 *
 * @param buffer - The PDF file as a Buffer
 * @param options - Extraction options
 * @param options.engine - 'deterministic' (default, pdfjs-dist) or 'ai' (Gemini-based, OCR-capable)
 *
 * When using the 'deterministic' engine, AI-specific options (extractionMode, includeLocators,
 * model) are ignored. The deterministic engine uses pdfjs-dist for fast, offline extraction.
 *
 * When using the 'ai' engine, all options are supported including OCR for scanned PDFs.
 */
export async function extractTextFromPdf(
  buffer: Buffer,
  options: PdfExtractionOptions = {}
): Promise<string> {
  const VALID_ENGINES: PdfExtractionEngine[] = ['deterministic', 'ai'];
  const rawEngine = process.env.PDF_EXTRACTION_ENGINE;
  let envEngine: PdfExtractionEngine | undefined;
  if (rawEngine) {
    if (VALID_ENGINES.includes(rawEngine as PdfExtractionEngine)) {
      envEngine = rawEngine as PdfExtractionEngine;
    } else {
      console.warn(
        `[PDF Extractor] Invalid PDF_EXTRACTION_ENGINE="${rawEngine}", falling back to default`
      );
    }
  }
  const engine: PdfExtractionEngine = options.engine ?? envEngine ?? 'deterministic';

  if (engine === 'deterministic') {
    return extractTextDeterministic(buffer);
  }

  return extractTextFromPdfAI(buffer, options);
}

async function extractTextFromPdfAI(
  buffer: Buffer,
  options: PdfExtractionOptions = {}
): Promise<string> {
  const extractionMode: PdfExtractionMode = options.extractionMode ?? 'fast';
  const includeLocators = options.includeLocators === true;
  const locatorStyle: PdfLocatorStyle = options.locatorStyle ?? 'bracket_v1';

  // Try to get actual page count to avoid calling the model on empty PDFs
  let estimatedPages = Math.ceil(buffer.length / (50 * 1024));
  try {
    const pdf = await PDFDocument.load(buffer);
    const pageCount = pdf.getPageCount();
    if (pageCount === 0) {
      throw new Error('Document has no pages');
    }
    estimatedPages = pageCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('no pages')) {
      throw error;
    }
    console.warn('[PDF Extractor] Failed to read page count, using size heuristic:', message);
  }

  // For small documents, use single extraction
  if (estimatedPages <= MAX_PAGES_PER_CHUNK) {
    if (extractionMode === 'thorough') {
      return extractTextMultiPass(buffer, { includeLocators, locatorStyle });
    }
    return extractTextSinglePass(buffer, { includeLocators, locatorStyle });
  }

  // For large documents, use chunked extraction
  console.warn(
    `[PDF Extractor] Large PDF detected (~${estimatedPages} pages). Using chunked extraction.`
  );
  if (extractionMode === 'thorough') {
    return extractTextChunked(buffer, estimatedPages, {
      extractionMode: 'thorough',
      includeLocators,
      locatorStyle,
    });
  }
  return extractTextChunked(buffer, estimatedPages, {
    extractionMode: 'fast',
    includeLocators,
    locatorStyle,
  });
}

type ExtractionPass = 'text' | 'tables' | 'images';

function getSystemPrompt(
  pass: ExtractionPass,
  extra?: {
    startPage?: number;
    endPage?: number;
    includeLocators?: boolean;
    locatorStyle?: PdfLocatorStyle;
  }
) {
  const pageHint =
    extra?.startPage && extra?.endPage
      ? `\n- Fokussiere dich auf die Seiten ${extra.startPage} bis ${extra.endPage}\n`
      : '\n';

  const locatorsHint = extra?.includeLocators
    ? `\nQUELLENMARKER (WICHTIG):\n- Gib jede Seite separat aus.\n- Beginne jede Seite mit einer eigenen Zeile im Format [[PAGE N]] (N = Original-Seitennummer).\n- Markiere Ueberschriften mit einer eigenen Zeile im Format [[H]] <Ueberschrift>.\n- Trenne Absaetze durch eine Leerzeile.\n- Gib nur Inhalte zurueck, keine Erklaerungen.\n`
    : '';

  if (pass === 'tables') {
    return `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, ALLE TABELLEN aus einem PDF zu extrahieren.${pageHint}
WICHTIG:
- Extrahiere jede Tabelle vollstaendig (inkl. Kopfzeilen, Fusszeilen, Summen)
- Gib Tabellen als Markdown-Tabellen aus, wenn moeglich; ansonsten als klar strukturierter Text
- Wenn Tabellen ueber mehrere Seiten gehen, fuehre sie sinnvoll zusammen
- Ergaenze pro Tabelle eine kurze Ueberschrift, falls im Dokument vorhanden
- Gib NUR die Tabellen zurueck, keine Erklaerungen${locatorsHint}`;
  }

  if (pass === 'images') {
    return `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, TEXT AUS BILDERN/SCANS (OCR) in einem PDF zu extrahieren.${pageHint}
WICHTIG:
- Extrahiere lesbaren Text aus eingebetteten Bildern, Scans, Diagrammen, Screenshots
- Ignoriere rein dekorative Elemente ohne Text
- Wenn unleserlich: schreibe [UNLESERLICH] an die Stelle
- Gib NUR den extrahierten OCR-Text zurueck, keine Erklaerungen${locatorsHint}`;
  }

  // pass === 'text'
  return `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, den VOLLSTAENDIGEN Textinhalt aus PDF-Dokumenten zu extrahieren.${pageHint}
WICHTIG:
- Extrahiere den KOMPLETTEN Text, nichts auslassen
- Behalte die logische Struktur (Ueberschriften, Absaetze, Listen)
- Bei Formularen: Extrahiere Feldnamen und Werte
- Ignoriere Seitenzahlen, Header/Footer wenn nicht inhaltlich relevant
- Gib NUR den extrahierten Text zurueck, keine Kommentare oder Erklaerungen
- Wenn das Dokument zu lang ist, extrahiere so viel wie moeglich und ende mit [FORTSETZUNG NOETIG]${locatorsHint}`;
}

async function runExtractionPass(
  buffer: Buffer,
  pass: ExtractionPass,
  extra?: {
    startPage?: number;
    endPage?: number;
    partLabel?: string;
    includeLocators?: boolean;
    locatorStyle?: PdfLocatorStyle;
  }
): Promise<string> {
  const model = await getPdfExtractionModel();

  const system = getSystemPrompt(pass, extra);
  const label = extra?.partLabel ? ` ${extra.partLabel}` : '';
  const requestText =
    extra?.startPage && extra?.endPage
      ? `Extrahiere (${pass}) von Seite ${extra.startPage} bis ${extra.endPage}${label}:`
      : `Extrahiere (${pass}) aus diesem PDF${label}:`;

  const result = await generateText({
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: requestText },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: buffer,
            filename: 'document.pdf',
          },
        ],
      },
    ],
    // omit temperature for model compatibility
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return (result.text || '').trim();
}

/**
 * Single-pass extraction for smaller PDFs
 */
async function extractTextSinglePass(
  buffer: Buffer,
  options: { includeLocators: boolean; locatorStyle: PdfLocatorStyle }
): Promise<string> {
  const extractedText = await runExtractionPass(buffer, 'text', {
    includeLocators: options.includeLocators,
    locatorStyle: options.locatorStyle,
  });

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error(
      'PDF enthält keinen extrahierbaren Text (möglicherweise leeres Dokument oder Bildformat)'
    );
  }

  // Check if extraction was truncated
  if (extractedText.includes('[FORTSETZUNG NÖTIG]')) {
    console.warn('[PDF Extractor] Output was truncated. Consider chunked extraction.');
  }

  if (options.includeLocators) {
    return withPassHeader('text', extractedText);
  }

  return extractedText.trim();
}

/**
 * Multi-pass extraction (thorough)
 *
 * 1) Full text
 * 2) Tables (often lost in linearized extraction)
 * 3) OCR text from images only if the text pass looks suspiciously empty
 */
async function extractTextMultiPass(
  buffer: Buffer,
  options: { includeLocators: boolean; locatorStyle: PdfLocatorStyle }
): Promise<string> {
  const [text, tables] = await Promise.all([
    runExtractionPass(buffer, 'text', options),
    runExtractionPass(buffer, 'tables', options),
  ]);

  const parts: string[] = [];
  if (options.includeLocators) {
    if (text) parts.push(withPassHeader('text', text));
    if (tables) parts.push(withPassHeader('tables', tables));
  } else {
    if (text) parts.push(`## Text\n\n${text}`);
    if (tables) parts.push(`## Tabellen\n\n${tables}`);
  }

  // If we got almost nothing from the text pass, the PDF is likely scanned.
  if (text.length < 800) {
    const images = await runExtractionPass(buffer, 'images', options);
    if (images)
      parts.push(
        options.includeLocators ? withPassHeader('images', images) : `## Bilder (OCR)\n\n${images}`
      );
  }

  const combined = parts.join('\n\n---\n\n').trim();
  if (!combined) {
    throw new Error(
      'PDF enthält keinen extrahierbaren Text (möglicherweise leeres Dokument oder Bildformat)'
    );
  }
  return combined;
}

/**
 * Chunked extraction for large PDFs
 * Processes the PDF in multiple passes, asking the AI to focus on different sections
 */
async function extractTextChunked(
  buffer: Buffer,
  estimatedPages: number,
  options: {
    extractionMode: PdfExtractionMode;
    includeLocators: boolean;
    locatorStyle: PdfLocatorStyle;
  }
): Promise<string> {
  const extractionMode = options.extractionMode;

  // Calculate number of chunks needed
  const numChunks = Math.ceil(estimatedPages / MAX_PAGES_PER_CHUNK);
  const chunks: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startPage = i * MAX_PAGES_PER_CHUNK + 1;
    const endPage = Math.min((i + 1) * MAX_PAGES_PER_CHUNK, estimatedPages);

    if (extractionMode === 'thorough') {
      const [text, tables] = await Promise.all([
        runExtractionPass(buffer, 'text', {
          startPage,
          endPage,
          partLabel: `(Teil ${i + 1} von ${numChunks})`,
          includeLocators: options.includeLocators,
          locatorStyle: options.locatorStyle,
        }),
        runExtractionPass(buffer, 'tables', {
          startPage,
          endPage,
          partLabel: `(Teil ${i + 1} von ${numChunks})`,
          includeLocators: options.includeLocators,
          locatorStyle: options.locatorStyle,
        }),
      ]);

      const chunkParts: string[] = [];
      if (options.includeLocators) {
        if (text) chunkParts.push(withPassHeader('text', text));
        if (tables) chunkParts.push(withPassHeader('tables', tables));
      } else {
        if (text) chunkParts.push(`## Text (S. ${startPage}-${endPage})\n\n${text}`);
        if (tables) chunkParts.push(`## Tabellen (S. ${startPage}-${endPage})\n\n${tables}`);
      }

      if (text.length < 500) {
        const images = await runExtractionPass(buffer, 'images', {
          startPage,
          endPage,
          partLabel: `(Teil ${i + 1} von ${numChunks})`,
          includeLocators: options.includeLocators,
          locatorStyle: options.locatorStyle,
        });
        if (images)
          chunkParts.push(
            options.includeLocators
              ? withPassHeader('images', images)
              : `## Bilder (OCR) (S. ${startPage}-${endPage})\n\n${images}`
          );
      }

      const chunkCombined = chunkParts.join('\n\n').trim();
      if (chunkCombined) chunks.push(chunkCombined);
    } else {
      const chunkText = await runExtractionPass(buffer, 'text', {
        startPage,
        endPage,
        partLabel: `(Teil ${i + 1} von ${numChunks})`,
        includeLocators: options.includeLocators,
        locatorStyle: options.locatorStyle,
      });
      if (chunkText) chunks.push(chunkText);
    }

    // Small delay between API calls to avoid rate limiting
    if (i < numChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, PDF_CHUNK_DELAY_MS));
    }
  }

  if (chunks.length === 0) {
    throw new Error('PDF enthält keinen extrahierbaren Text');
  }

  // Combine chunks with clear separation
  return chunks.join('\n\n---\n\n');
}
