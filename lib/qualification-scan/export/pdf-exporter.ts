// ═══════════════════════════════════════════════════════════════════════════════
// PDF EXPORTER - Qualification Scan Export
// Converts Markdown to a styled HTML document, then to PDF via html-pdf-like approach.
// Uses a simple server-side HTML rendering strategy (no heavy deps).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a styled HTML string from Markdown for PDF rendering.
 * The HTML can be served as a printable page or converted via browser print.
 *
 * Note: True server-side PDF generation (e.g. Puppeteer/Playwright) is heavy.
 * This approach returns styled HTML that the client renders as PDF via window.print().
 */
export type PdfExportTemplate = 'simple' | 'corporate-a4';

export type PdfExportMeta = {
  documentTitle: string;
  subtitle: string;
  customerName: string;
  websiteUrl: string;
  generatedDate: string;
  toc: Array<{ level: 2 | 3; title: string; id: string }>;
};

export type GeneratePrintableHTMLOptions = {
  template?: PdfExportTemplate;
  includeCover?: boolean;
  includeToc?: boolean;
  enableMermaid?: boolean;
  meta?: Partial<Omit<PdfExportMeta, 'toc'>>; // toc derived from markdown
};

export function generatePrintableHTML(
  markdown: string,
  options: GeneratePrintableHTMLOptions = {}
): string {
  const template: PdfExportTemplate = options.template ?? 'corporate-a4';
  const includeCover = options.includeCover ?? template !== 'simple';
  const includeToc = options.includeToc ?? template !== 'simple';
  const enableMermaid = options.enableMermaid ?? true;

  const meta = extractMeta(markdown, options.meta);

  const { escapedMarkdown, codeBlocks, hasMermaid } = preprocessMarkdown(markdown);
  const shouldEnableMermaid = enableMermaid && hasMermaid;

  // Convert markdown to basic HTML (on escaped input)
  let html = escapedMarkdown;

  const idFactory = createHeadingIdFactory();

  // Restore markdown constructs that got escaped
  html = html
    // Headers
    .replace(/^### (.+)$/gm, (_m, t) => `<h3 id="${idFactory(t)}">${t}</h3>`)
    .replace(/^## (.+)$/gm, (_m, t) => `<h2 id="${idFactory(t)}">${t}</h2>`)
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Bullet lists — wrap consecutive items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Simple table conversion
  html = html.replace(/(\|[^\n]+\|\n\|[-|:\s]+\|\n(?:\|[^\n]+\|\n?)*)/g, match => {
    const rows = match.trim().split('\n');
    if (rows.length < 2) return match;
    const headerCells = rows[0]
      .split('|')
      .filter(c => c.trim())
      .map(c => `<th>${c.trim()}</th>`);
    const dataRows = rows.slice(2).map(row => {
      const cells = row
        .split('|')
        .filter(c => c.trim())
        .map(c => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    });
    return `<table><thead><tr>${headerCells.join('')}</tr></thead><tbody>${dataRows.join('')}</tbody></table>`;
  });

  // Wrap paragraphs (lines that aren't already HTML tags)
  html = html
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  // Re-inject extracted code blocks (prevents inline transformations inside fenced code)
  for (const [id, blockHtml] of codeBlocks) {
    html = html.replaceAll(`<div data-codeblock="${id}"></div>`, blockHtml);
  }

  const tocItems = meta.toc.map(item => {
    const indent = item.level === 3 ? 'toc-item toc-item--h3' : 'toc-item';
    return `<a class="${indent}" href="#${item.id}">${escapeHtml(item.title)}</a>`;
  });

  const coverHtml = includeCover
    ? `
  <section class="cover">
    <div>
      <div class="cover__top">
        <img class="cover__logo" src="/logo.png" alt="Logo" />
        <div class="cover__brand">DealHunter</div>
      </div>
      <h1 class="cover__title">${escapeHtml(meta.documentTitle)}</h1>
      <p class="cover__subtitle">${escapeHtml(meta.subtitle)}</p>
      <dl class="cover__meta">
        <dt>Kunde</dt>
        <dd>${escapeHtml(meta.customerName)}</dd>
        <dt>Website</dt>
        <dd>${escapeHtml(meta.websiteUrl)}</dd>
        <dt>Datum</dt>
        <dd>${escapeHtml(meta.generatedDate)}</dd>
      </dl>
    </div>
    <div style="color: var(--muted); font-size: 12px;">Vertraulich. Nur fuer interne Nutzung.</div>
  </section>`
    : '';

  const tocHtml = includeToc
    ? `
  <section class="toc">
    <h2>Inhaltsverzeichnis</h2>
    <div class="toc-list">${tocItems.join('')}</div>
  </section>`
    : '';

  const mermaidScript = shouldEnableMermaid
    ? `
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: "neutral",
      securityLevel: "strict"
    });
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.documentTitle)}</title>
  <style>
    :root{
      --ink:#0f172a;
      --muted:#475569;
      --line:#e2e8f0;
      --brand:#0ea5e9;
      --brand-ink:#075985;
      --paper:#ffffff;
      --panel:#f8fafc;
    }
    @media print {
      @page { size: A4; margin: 18mm 16mm; }
      body { margin: 0; }
    }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: var(--ink);
      background: var(--paper);
      max-width: 860px;
      margin: 0 auto;
      padding: 28px 16px 48px;
    }
    .cover{
      page-break-after: always;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, #e0f2fe 0%, #ffffff 60%);
      padding: 28mm 18mm;
      min-height: 240mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover__top{ display:flex; align-items:center; gap:14px; }
    .cover__logo{ width: 46px; height: 46px; object-fit: contain; }
    .cover__brand{ font-weight: 700; letter-spacing: 0.02em; color: var(--brand-ink); }
    .cover__title{ font-size: 34px; line-height: 1.15; margin: 18mm 0 6mm; }
    .cover__subtitle{ color: var(--muted); margin: 0 0 10mm; }
    .cover__meta{
      background: rgba(255,255,255,0.7);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .cover__meta dt{ color: var(--muted); font-size: 12px; margin-top: 8px; }
    .cover__meta dd{ margin: 2px 0 0; font-weight: 600; }
    .toc{
      page-break-after: always;
      padding: 6mm 0 0;
    }
    .toc h2{ margin-top: 0; }
    .toc-list{ display:flex; flex-direction:column; gap:6px; }
    .toc-item{
      text-decoration:none;
      color: var(--ink);
      border-bottom: 1px dotted var(--line);
      padding-bottom: 4px;
    }
    .toc-item--h3{ padding-left: 14px; color: var(--muted); }

    .page-header, .page-footer{
      position: fixed;
      left: 0;
      right: 0;
      color: var(--muted);
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 16px;
    }
    .page-header{ top: 0; border-bottom: 1px solid var(--line); background: rgba(255,255,255,0.85); }
    .page-footer{ bottom: 0; border-top: 1px solid var(--line); background: rgba(255,255,255,0.85); }
    .page-footer__page:after{ content: counter(page); }

    .content{ padding-top: 28px; }

    h1 { font-size: 26px; border-bottom: 2px solid var(--brand); padding-bottom: 8px; margin-top: 0; }
    h2 { font-size: 20px; color: #0b1220; margin-top: 28px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
    h3 { font-size: 16px; color: var(--muted); margin-top: 20px; }
    hr { border: none; border-top: 1px solid var(--line); margin: 22px 0; }
    p { margin: 8px 0; }
    ul { padding-left: 24px; }
    li { margin-bottom: 4px; }
    blockquote {
      border-left: 4px solid var(--brand);
      margin: 16px 0;
      padding: 8px 16px;
      background: var(--panel);
      color: var(--muted);
    }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 10px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: var(--panel); font-weight: 700; }
    strong { color: #0b1220; }
    pre { background: var(--panel); border: 1px solid var(--line); padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
    .mermaid { background: #ffffff; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
    ${
      template === 'simple'
        ? `
    .page-header, .page-footer { display:none; }
    body { max-width: 800px; padding-top: 12px; }
    .content{ padding-top: 0; }
    h1 { border-bottom-color: #d1d5db; }
    `
        : ''
    }
  </style>
</head>
<body>
  <div class="page-header">
    <div>${escapeHtml(meta.customerName)}</div>
    <div>${escapeHtml(meta.generatedDate)}</div>
  </div>
  <div class="page-footer">
    <div>DealHunter Qualification Scan</div>
    <div>Seite <span class="page-footer__page"></span></div>
  </div>

${coverHtml}
${tocHtml}

  <main class="content">
    ${html}
  </main>
${mermaidScript}
</body>
</html>`;
}

function preprocessMarkdown(markdown: string): {
  escapedMarkdown: string;
  codeBlocks: Map<string, string>;
  hasMermaid: boolean;
} {
  const lines = markdown.split('\n');
  const out: string[] = [];
  const codeBlocks = new Map<string, string>();
  let inFence = false;
  let fenceLang = '';
  let fenceBuf: string[] = [];
  let fenceCount = 0;
  let hasMermaid = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inFence) {
        inFence = true;
        fenceLang = line.slice(3).trim().toLowerCase();
        fenceBuf = [];
      } else {
        // Close fence
        const id = String(fenceCount++);
        const raw = fenceBuf.join('\n');
        const escaped = escapeHtml(raw);

        if (fenceLang === 'mermaid') {
          hasMermaid = true;
          codeBlocks.set(id, `<pre class="mermaid">${escaped}</pre>`);
        } else {
          const langClass = fenceLang ? `language-${escapeHtml(fenceLang)}` : 'language-text';
          codeBlocks.set(id, `<pre><code class="${langClass}">${escaped}</code></pre>`);
        }

        out.push(`<div data-codeblock="${id}"></div>`);
        inFence = false;
        fenceLang = '';
        fenceBuf = [];
      }
      continue;
    }

    if (inFence) {
      fenceBuf.push(line);
      continue;
    }

    // Escape everything else
    out.push(escapeHtml(line));
  }

  // If fence was left open, treat it as regular text.
  if (inFence) {
    out.push('```' + escapeHtml(fenceLang));
    for (const l of fenceBuf) out.push(escapeHtml(l));
  }

  return { escapedMarkdown: out.join('\n'), codeBlocks, hasMermaid };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createHeadingIdFactory(): (title: string) => string {
  const counts = new Map<string, number>();
  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/&amp;/g, 'and')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  return (title: string) => {
    const base = slugify(title) || 'section';
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

function extractMeta(
  markdown: string,
  metaOverride?: Partial<Omit<PdfExportMeta, 'toc'>>
): PdfExportMeta {
  const lines = markdown.split('\n');
  const h1 =
    lines
      .find(l => l.startsWith('# '))
      ?.slice(2)
      .trim() || 'Qualification Scan';
  const customerName = h1.includes('—') ? h1.split('—').slice(1).join('—').trim() : h1;
  const websiteLine = lines.find(l => l.startsWith('**Website:**')) || '';
  const websiteUrl = websiteLine.replace('**Website:**', '').trim() || 'N/A';
  const dateLine = lines.find(l => l.startsWith('**Erstellt:**')) || '';
  const generatedDate =
    dateLine.replace('**Erstellt:**', '').trim() || new Date().toLocaleDateString('de-DE');

  const toc: Array<{ level: 2 | 3; title: string; id: string }> = [];
  const makeId = createHeadingIdFactory();

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      toc.push({ level: 2, title, id: makeId(title) });
    } else if (line.startsWith('### ')) {
      const title = line.slice(4).trim();
      toc.push({ level: 3, title, id: makeId(title) });
    }
  }

  return {
    documentTitle: metaOverride?.documentTitle ?? h1,
    subtitle: metaOverride?.subtitle ?? 'Zusammenfassung, Analyse und Empfehlungen',
    customerName: metaOverride?.customerName ?? customerName,
    websiteUrl: metaOverride?.websiteUrl ?? websiteUrl,
    generatedDate: metaOverride?.generatedDate ?? generatedDate,
    toc,
  };
}
