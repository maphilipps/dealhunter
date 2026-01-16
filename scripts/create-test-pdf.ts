import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function createTestPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const content = fs.readFileSync(
    path.join(process.cwd(), 'test-pdf-sample.txt'),
    'utf-8'
  );

  const lines = content.split('\n');
  let y = 800;
  const lineHeight = 14;
  const margin = 50;

  for (const line of lines) {
    if (y < 50) break; // Stop if we run out of space

    const isBold = line.includes(':') && !line.startsWith(' ');
    const currentFont = isBold ? boldFont : font;
    const fontSize = isBold ? 12 : 10;

    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font: currentFont,
      color: rgb(0, 0, 0),
    });

    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(process.cwd(), 'test-requirements.pdf');
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`✅ Test PDF created: ${outputPath}`);
}

createTestPdf().catch(console.error);
