/**
 * PDF Text Extraction using AI
 *
 * Uses the adesso AI Hub (Gemini models) to extract text from PDFs.
 * This approach has several advantages over traditional PDF parsing:
 * - Handles scanned documents (OCR capability)
 * - Understands document structure and formatting
 * - No third-party library warnings or compatibility issues
 * - Works with complex PDFs (forms, tables, multi-column layouts)
 *
 * For large PDFs (>50 pages), uses chunked extraction to avoid token limits.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PDFDocument } from 'pdf-lib';

import { getProviderCredentials, warmModelConfigCache } from '@/lib/ai/model-config';

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

/**
 * Extract text content from a PDF buffer using AI
 *
 * For small PDFs: Single API call (fast) or multi-pass (thorough)
 * For large PDFs: Estimates page count and processes in chunks if needed
 *
 * @param buffer - The PDF file as a Buffer
 * @param options - Extraction options
 * @returns Promise<string> - The extracted text content
 * @throws Error if extraction fails
 */
export type PdfExtractionMode = 'fast' | 'thorough';

export type PdfExtractionOptions = {
  extractionMode?: PdfExtractionMode;
};

export async function extractTextFromPdf(
  buffer: Buffer,
  options: PdfExtractionOptions = {}
): Promise<string> {
  const extractionMode: PdfExtractionMode = options.extractionMode ?? 'fast';

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
      return extractTextMultiPass(buffer);
    }
    return extractTextSinglePass(buffer);
  }

  // For large documents, use chunked extraction
  console.warn(
    `[PDF Extractor] Large PDF detected (~${estimatedPages} pages). Using chunked extraction.`
  );
  if (extractionMode === 'thorough') {
    return extractTextChunked(buffer, estimatedPages, { extractionMode: 'thorough' });
  }
  return extractTextChunked(buffer, estimatedPages, { extractionMode: 'fast' });
}

type ExtractionPass = 'text' | 'tables' | 'images';

function getSystemPrompt(pass: ExtractionPass, extra?: { startPage?: number; endPage?: number }) {
  const pageHint =
    extra?.startPage && extra?.endPage
      ? `\n- Fokussiere dich auf die Seiten ${extra.startPage} bis ${extra.endPage}\n`
      : '\n';

  if (pass === 'tables') {
    return `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, ALLE TABELLEN aus einem PDF zu extrahieren.${pageHint}
WICHTIG:
- Extrahiere jede Tabelle vollstaendig (inkl. Kopfzeilen, Fusszeilen, Summen)
- Gib Tabellen als Markdown-Tabellen aus, wenn moeglich; ansonsten als klar strukturierter Text
- Wenn Tabellen ueber mehrere Seiten gehen, fuehre sie sinnvoll zusammen
- Ergaenze pro Tabelle eine kurze Ueberschrift, falls im Dokument vorhanden
- Gib NUR die Tabellen zurueck, keine Erklaerungen`;
  }

  if (pass === 'images') {
    return `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, TEXT AUS BILDERN/SCANS (OCR) in einem PDF zu extrahieren.${pageHint}
WICHTIG:
- Extrahiere lesbaren Text aus eingebetteten Bildern, Scans, Diagrammen, Screenshots
- Ignoriere rein dekorative Elemente ohne Text
- Wenn unleserlich: schreibe [UNLESERLICH] an die Stelle
- Gib NUR den extrahierten OCR-Text zurueck, keine Erklaerungen`;
  }

  // pass === 'text'
  return `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, den VOLLSTAENDIGEN Textinhalt aus PDF-Dokumenten zu extrahieren.${pageHint}
WICHTIG:
- Extrahiere den KOMPLETTEN Text, nichts auslassen
- Behalte die logische Struktur (Ueberschriften, Absaetze, Listen)
- Bei Formularen: Extrahiere Feldnamen und Werte
- Ignoriere Seitenzahlen, Header/Footer wenn nicht inhaltlich relevant
- Gib NUR den extrahierten Text zurueck, keine Kommentare oder Erklaerungen
- Wenn das Dokument zu lang ist, extrahiere so viel wie moeglich und ende mit [FORTSETZUNG NOETIG]`;
}

async function runExtractionPass(
  buffer: Buffer,
  pass: ExtractionPass,
  extra?: { startPage?: number; endPage?: number; partLabel?: string }
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
async function extractTextSinglePass(buffer: Buffer): Promise<string> {
  const extractedText = await runExtractionPass(buffer, 'text');

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error(
      'PDF enthält keinen extrahierbaren Text (möglicherweise leeres Dokument oder Bildformat)'
    );
  }

  // Check if extraction was truncated
  if (extractedText.includes('[FORTSETZUNG NÖTIG]')) {
    console.warn('[PDF Extractor] Output was truncated. Consider chunked extraction.');
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
async function extractTextMultiPass(buffer: Buffer): Promise<string> {
  const [text, tables] = await Promise.all([
    runExtractionPass(buffer, 'text'),
    runExtractionPass(buffer, 'tables'),
  ]);

  const parts: string[] = [];
  if (text) parts.push(`## Text\n\n${text}`);
  if (tables) parts.push(`## Tabellen\n\n${tables}`);

  // If we got almost nothing from the text pass, the PDF is likely scanned.
  if (text.length < 800) {
    const images = await runExtractionPass(buffer, 'images');
    if (images) parts.push(`## Bilder (OCR)\n\n${images}`);
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
  options: { extractionMode: PdfExtractionMode }
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
        }),
        runExtractionPass(buffer, 'tables', {
          startPage,
          endPage,
          partLabel: `(Teil ${i + 1} von ${numChunks})`,
        }),
      ]);

      const chunkParts: string[] = [];
      if (text) chunkParts.push(`## Text (S. ${startPage}-${endPage})\n\n${text}`);
      if (tables) chunkParts.push(`## Tabellen (S. ${startPage}-${endPage})\n\n${tables}`);

      if (text.length < 500) {
        const images = await runExtractionPass(buffer, 'images', {
          startPage,
          endPage,
          partLabel: `(Teil ${i + 1} von ${numChunks})`,
        });
        if (images) chunkParts.push(`## Bilder (OCR) (S. ${startPage}-${endPage})\n\n${images}`);
      }

      const chunkCombined = chunkParts.join('\n\n').trim();
      if (chunkCombined) chunks.push(chunkCombined);
    } else {
      const chunkText = await runExtractionPass(buffer, 'text', {
        startPage,
        endPage,
        partLabel: `(Teil ${i + 1} von ${numChunks})`,
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

/**
 * Extract text with explicit page range (for manual control)
 * Useful when you know exact page numbers to extract
 */
export async function extractTextFromPdfPages(
  buffer: Buffer,
  startPage: number,
  endPage: number
): Promise<string> {
  const model = await getPdfExtractionModel();

  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content: `Du bist ein Dokumenten-Extraktions-Assistent. Extrahiere Text aus einem spezifischen Seitenbereich.

WICHTIG:
- Extrahiere NUR Seiten ${startPage} bis ${endPage}
- Behalte die logische Struktur
- Gib NUR den extrahierten Text zurück`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extrahiere den Text von Seite ${startPage} bis ${endPage}:`,
          },
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

  const extractedText = result.text;

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error(`Keine Inhalte auf Seiten ${startPage}-${endPage} gefunden`);
  }

  return extractedText.trim();
}
