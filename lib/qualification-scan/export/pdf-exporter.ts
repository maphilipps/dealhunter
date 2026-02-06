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
export function generatePrintableHTML(markdown: string): string {
  // Convert markdown to basic HTML
  let html = markdown
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore markdown constructs that got escaped
  html = html
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
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

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Qualification Scan Export</title>
  <style>
    @media print {
      body { margin: 0; padding: 20mm; }
      @page { margin: 15mm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 { font-size: 28px; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-top: 0; }
    h2 { font-size: 22px; color: #374151; margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    h3 { font-size: 18px; color: #4b5563; margin-top: 24px; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 24px 0; }
    p { margin: 8px 0; }
    ul { padding-left: 24px; }
    li { margin-bottom: 4px; }
    blockquote {
      border-left: 4px solid #667eea;
      margin: 16px 0;
      padding: 8px 16px;
      background: #f9fafb;
      color: #4b5563;
    }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 12px; border: 1px solid #d1d5db; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    strong { color: #111827; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}
