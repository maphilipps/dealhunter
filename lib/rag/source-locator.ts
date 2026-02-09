export type SourceKind = 'pdf' | 'user_text' | 'website';

export type PdfSourceLocator = {
  kind: 'pdf';
  fileName: string;
  pass?: 'text' | 'tables' | 'images';
  page: number;
  paragraphNumber: number;
  heading: string | null;
};

export type ParagraphNode = {
  text: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
  source?: PdfSourceLocator;
};

// Rough token estimation: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type Context = {
  fileName: string | null;
  pass: 'text' | 'tables' | 'images' | null;
  page: number | null;
  heading: string | null;
  paragraphCounter: number;
};

function parseDocMarker(line: string): string | null {
  const m = line.match(/^\s*\[\[DOC\]\]\s+(.+?)\s*$/);
  return m ? m[1] : null;
}

function parsePageMarker(line: string): number | null {
  const m = line.match(/^\s*\[\[PAGE\s+(\d+)\]\]\s*$/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePassMarker(line: string): 'text' | 'tables' | 'images' | null {
  const m = line.match(/^\s*\[\[PASS\]\]\s*(text|tables|images)\s*$/);
  if (m) return m[1] as 'text' | 'tables' | 'images';

  const m2 = line.match(/^\s*\[\[PASS\s+(text|tables|images)\]\]\s*$/);
  if (m2) return m2[1] as 'text' | 'tables' | 'images';

  return null;
}

function parseHeadingMarker(line: string): string | null {
  const m = line.match(/^\s*\[\[H\]\]\s*(.+?)\s*$/);
  return m ? m[1] : null;
}

function isEndDocMarker(line: string): boolean {
  return /^\s*\[\[ENDDOC\]\]\s*$/.test(line);
}

function isSeparatorLine(line: string): boolean {
  // Common artificial separators between extracted parts.
  return /^\s*---+\s*$/.test(line);
}

export function parseDocumentTextToParagraphs(rawText: string): ParagraphNode[] {
  const text = rawText.replace(/\r\n/g, '\n');

  const ctx: Context = {
    fileName: null,
    pass: null,
    page: null,
    heading: null,
    paragraphCounter: 0,
  };

  const nodes: ParagraphNode[] = [];

  // Current paragraph buffer
  let paraLines: string[] = [];
  let paraStartOffset: number | null = null;
  let lastNonEmptyLineEndOffset: number | null = null;

  const flushParagraph = () => {
    if (paraLines.length === 0) return;
    const body = paraLines.join('\n').trim();
    paraLines = [];

    if (!body) {
      paraStartOffset = null;
      lastNonEmptyLineEndOffset = null;
      return;
    }

    const startOffset = paraStartOffset ?? 0;
    const endOffset = lastNonEmptyLineEndOffset ?? startOffset + body.length;

    let source: PdfSourceLocator | undefined;
    if (ctx.fileName && ctx.page) {
      ctx.paragraphCounter += 1;
      source = {
        kind: 'pdf',
        fileName: ctx.fileName,
        ...(ctx.pass ? { pass: ctx.pass } : {}),
        page: ctx.page,
        paragraphNumber: ctx.paragraphCounter,
        heading: ctx.heading,
      };
    }

    nodes.push({
      text: body,
      tokenCount: estimateTokens(body),
      startOffset,
      endOffset,
      ...(source ? { source } : {}),
    });

    paraStartOffset = null;
    lastNonEmptyLineEndOffset = null;
  };

  const lines = text.split('\n');
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1; // + '\n'

    const docName = parseDocMarker(line);
    if (docName) {
      flushParagraph();
      ctx.fileName = docName;
      ctx.pass = null;
      ctx.page = null;
      ctx.heading = null;
      ctx.paragraphCounter = 0;
      continue;
    }

    if (isEndDocMarker(line)) {
      flushParagraph();
      ctx.fileName = null;
      ctx.pass = null;
      ctx.page = null;
      ctx.heading = null;
      ctx.paragraphCounter = 0;
      continue;
    }

    const pass = parsePassMarker(line);
    if (pass) {
      flushParagraph();
      ctx.pass = pass;
      ctx.page = null;
      ctx.heading = null;
      ctx.paragraphCounter = 0;
      continue;
    }

    const page = parsePageMarker(line);
    if (page) {
      flushParagraph();
      ctx.page = page;
      ctx.heading = null;
      ctx.paragraphCounter = 0;
      continue;
    }

    const heading = parseHeadingMarker(line);
    if (heading) {
      flushParagraph();
      ctx.heading = heading;
      continue;
    }

    if (isSeparatorLine(line)) {
      flushParagraph();
      continue;
    }

    if (line.trim().length === 0) {
      // Blank line: paragraph boundary
      flushParagraph();
      continue;
    }

    if (paraLines.length === 0) {
      paraStartOffset = lineStart;
    }
    paraLines.push(line);
    lastNonEmptyLineEndOffset = lineEnd;
  }

  flushParagraph();
  return nodes;
}
