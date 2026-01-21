import PDFParser from 'pdf2json';

/**
 * Extract text content from a PDF buffer
 * Uses pdf2json to parse PDF and extract text
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true); // null = no owner password, true = don't combine text

    pdfParser.on('pdfParser_dataReady', pdfData => {
      try {
        // Extract text from all pages
        const pages = pdfData.Pages || [];
        const textContent: string[] = [];

        for (const page of pages) {
          const pageTexts: string[] = [];

          if (page.Texts) {
            for (const textItem of page.Texts) {
              if (textItem.R) {
                for (const run of textItem.R) {
                  if (run.T) {
                    // Decode URI-encoded text (with fallback for malformed URIs)
                    try {
                      const decodedText = decodeURIComponent(run.T);
                      pageTexts.push(decodedText);
                    } catch {
                      // If decoding fails, use raw text
                      pageTexts.push(run.T);
                    }
                  }
                }
              }
            }
          }

          // Join page text with spaces, preserving some structure
          if (pageTexts.length > 0) {
            textContent.push(pageTexts.join(' '));
          }
        }

        // Join all pages with double newlines
        const fullText = textContent.join('\n\n');

        if (!fullText || fullText.trim().length === 0) {
          // Fallback: Try to get raw text content
          const rawText = pdfParser.getRawTextContent();
          if (rawText && rawText.trim().length > 0) {
            resolve(rawText);
            return;
          }
          reject(
            new Error('PDF enthält keinen extrahierbaren Text (möglicherweise gescanntes Dokument)')
          );
          return;
        }

        resolve(fullText);
      } catch (error) {
        reject(
          new Error(
            `Fehler beim Verarbeiten des PDF-Inhalts: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
          )
        );
      }
    });

    pdfParser.on('pdfParser_dataError', (errData: { parserError?: Error } | Error) => {
      const errorMessage =
        errData instanceof Error
          ? errData.message
          : errData.parserError?.message || 'Unbekannter Fehler';
      reject(new Error(`PDF konnte nicht gelesen werden: ${errorMessage}`));
    });

    // Parse the buffer
    pdfParser.parseBuffer(buffer);
  });
}
