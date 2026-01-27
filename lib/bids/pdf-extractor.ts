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

import { AI_HUB_API_KEY, AI_HUB_BASE_URL } from '@/lib/ai/config';
import { getModelConfig } from '@/lib/ai/model-config';

function getPdfExtractionModel() {
  const config = getModelConfig('vision');
  const modelName = process.env.AI_PDF_MODEL_AI_HUB || config.modelName || 'gemini-3-flash-preview';

  const apiKey = AI_HUB_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('AI_HUB_API_KEY or OPENAI_API_KEY required for PDF extraction via AI Hub');
  }

  const hub = createOpenAI({
    apiKey,
    baseURL: AI_HUB_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
  });

  return hub(modelName);
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
 * For small PDFs: Single API call
 * For large PDFs: Estimates page count and processes in chunks if needed
 *
 * @param buffer - The PDF file as a Buffer
 * @returns Promise<string> - The extracted text content
 * @throws Error if extraction fails
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
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
    return extractTextSinglePass(buffer);
  }

  // For large documents, use chunked extraction
  console.warn(
    `[PDF Extractor] Large PDF detected (~${estimatedPages} pages). Using chunked extraction.`
  );
  return extractTextChunked(buffer, estimatedPages);
}

/**
 * Single-pass extraction for smaller PDFs
 */
async function extractTextSinglePass(buffer: Buffer): Promise<string> {
  const model = getPdfExtractionModel();

  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content: `Du bist ein Dokumenten-Extraktions-Assistent. Deine Aufgabe ist es, den VOLLSTÄNDIGEN Textinhalt aus PDF-Dokumenten zu extrahieren.

WICHTIG:
- Extrahiere den KOMPLETTEN Text, nichts auslassen
- Behalte die logische Struktur (Überschriften, Absätze, Listen)
- Bei Tabellen: Formatiere als lesbaren Text mit klarer Struktur
- Bei Formularen: Extrahiere Feldnamen und Werte
- Ignoriere Seitenzahlen, Header/Footer wenn nicht inhaltlich relevant
- Gib NUR den extrahierten Text zurück, keine Kommentare oder Erklärungen
- Wenn das Dokument zu lang ist, extrahiere so viel wie möglich und ende mit [FORTSETZUNG NÖTIG]`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extrahiere den vollständigen Textinhalt aus diesem PDF-Dokument:',
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
 * Chunked extraction for large PDFs
 * Processes the PDF in multiple passes, asking the AI to focus on different sections
 */
async function extractTextChunked(buffer: Buffer, estimatedPages: number): Promise<string> {
  const model = getPdfExtractionModel();

  // Calculate number of chunks needed
  const numChunks = Math.ceil(estimatedPages / MAX_PAGES_PER_CHUNK);
  const chunks: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startPage = i * MAX_PAGES_PER_CHUNK + 1;
    const endPage = Math.min((i + 1) * MAX_PAGES_PER_CHUNK, estimatedPages);

    const result = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content: `Du bist ein Dokumenten-Extraktions-Assistent. Extrahiere Text aus einem Teil eines großen PDF-Dokuments.

WICHTIG:
- Fokussiere dich auf die Seiten ${startPage} bis ${endPage} (von geschätzt ${estimatedPages} Seiten)
- Extrahiere den Text dieser Seiten vollständig
- Behalte die logische Struktur (Überschriften, Absätze, Listen)
- Gib NUR den extrahierten Text zurück, keine Kommentare
- Beginne NICHT mit "Seite X" oder ähnlichen Markierungen`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extrahiere den Text von Seite ${startPage} bis ${endPage} aus diesem PDF (Teil ${i + 1} von ${numChunks}):`,
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

    const chunkText = result.text;

    if (chunkText && chunkText.trim().length > 0) {
      chunks.push(chunkText.trim());
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
  const model = getPdfExtractionModel();

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
