// ═══════════════════════════════════════════════════════════════════════════════
// WORD EXPORTER - Qualification Scan Export
// Converts structured Markdown into a .docx file using the `docx` package
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
} from 'docx';

/**
 * Generate a Word (.docx) document from Markdown content.
 * Supports: H1, H2, H3, bullet lists, bold, tables, blockquotes, horizontal rules.
 */
export async function generateWordDocument(markdown: string): Promise<Buffer> {
  const lines = markdown.split('\n');
  const children: (Paragraph | Table)[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Table detection (| ... | ... |)
    if (line.startsWith('|') && lines[i + 1]?.match(/^\|[-|:\s]+\|$/)) {
      const tableRows: string[][] = [];
      // Header row
      tableRows.push(parseTableRow(line));
      i++; // skip separator
      i++;
      // Data rows
      while (i < lines.length && lines[i].startsWith('|')) {
        tableRows.push(parseTableRow(lines[i]));
        i++;
      }
      children.push(createTable(tableRows));
      continue;
    }

    // H1
    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: line.slice(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 100 },
        })
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.startsWith('---')) {
      children.push(
        new Paragraph({
          text: '',
          spacing: { before: 200, after: 200 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          },
        })
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      children.push(
        new Paragraph({
          children: parseInlineFormatting(line.slice(2)),
          indent: { left: 720 },
          spacing: { after: 100 },
        })
      );
      i++;
      continue;
    }

    // Bullet list
    if (line.startsWith('- ')) {
      children.push(
        new Paragraph({
          children: parseInlineFormatting(line.slice(2)),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    children.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { after: 120 },
      })
    );
    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    .map(cell => cell.trim());
}

function createTable(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, rowIdx) =>
        new TableRow({
          children: cells.map(
            cell =>
              new TableCell({
                width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        bold: rowIdx === 0,
                        size: 20,
                      }),
                    ],
                    alignment: AlignmentType.LEFT,
                  }),
                ],
              })
          ),
        })
    ),
  });
}

/**
 * Parse **bold** markers within a line and return TextRun children
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part) {
      runs.push(new TextRun({ text: part }));
    }
  }

  return runs;
}
