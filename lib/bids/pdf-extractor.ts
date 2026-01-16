export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // MVP: Store PDF metadata instead of extracting text
  // Text extraction will be implemented in future iteration with proper OCR
  const base64 = buffer.toString('base64');
  const sizeKB = (buffer.length / 1024).toFixed(2);

  return `[PDF Document - ${sizeKB} KB]\nBase64: ${base64.substring(0, 100)}...\n\nNote: Full text extraction will be implemented in future release.`;
}
