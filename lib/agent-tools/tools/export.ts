import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import { buildQualificationScanMarkdown } from '@/lib/qualification-scan/export/markdown-builder';
import { generatePrintableHTML } from '@/lib/qualification-scan/export/pdf-exporter';
import type { GeneratePrintableHTMLOptions } from '@/lib/qualification-scan/export/pdf-exporter';
import { generateWordDocument } from '@/lib/qualification-scan/export/word-exporter';

async function checkQualificationAccess(qualificationId: string, context: ToolContext) {
  if (context.userRole === 'admin') return { allowed: true };

  const [row] = await db
    .select({ id: preQualifications.id })
    .from(preQualifications)
    .where(
      and(eq(preQualifications.id, qualificationId), eq(preQualifications.userId, context.userId))
    )
    .limit(1);

  return row ? { allowed: true } : { allowed: false, error: 'No access to this Qualification' };
}

// ─── export.generate_markdown ────────────────────────────────────────────────

const exportMarkdownInputSchema = z.object({
  qualificationId: z.string(),
});

registry.register({
  name: 'export.generate_markdown',
  description: 'Generate the canonical Markdown export for a Qualification Scan',
  category: 'document',
  inputSchema: exportMarkdownInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQualificationAccess(input.qualificationId, context);
    if (!access.allowed) return { success: false, error: access.error };

    const markdown = await buildQualificationScanMarkdown(input.qualificationId);
    return {
      success: true,
      data: {
        qualificationId: input.qualificationId,
        filename: `qualification-scan-${input.qualificationId}.md`,
        contentType: 'text/markdown; charset=utf-8',
        markdown,
      },
    };
  },
});

// ─── export.generate_word ────────────────────────────────────────────────────

const exportWordInputSchema = z.object({
  qualificationId: z.string(),
});

registry.register({
  name: 'export.generate_word',
  description: 'Generate a Word (.docx) document from the Qualification Scan Markdown export',
  category: 'document',
  inputSchema: exportWordInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQualificationAccess(input.qualificationId, context);
    if (!access.allowed) return { success: false, error: access.error };

    const markdown = await buildQualificationScanMarkdown(input.qualificationId);
    const buffer = await generateWordDocument(markdown);
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      success: true,
      data: {
        qualificationId: input.qualificationId,
        filename: `qualification-scan-${input.qualificationId}.docx`,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        base64,
      },
    };
  },
});

// ─── export.generate_pdf ─────────────────────────────────────────────────────

const exportPdfInputSchema = z.object({
  qualificationId: z.string(),
  template: z.enum(['simple', 'corporate-a4']).optional(),
  includeCover: z.boolean().optional(),
  includeToc: z.boolean().optional(),
  enableMermaid: z.boolean().optional(),
});

registry.register({
  name: 'export.generate_pdf',
  description:
    'Generate printable HTML for PDF export (client prints to PDF). Markdown is the source of truth.',
  category: 'document',
  inputSchema: exportPdfInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQualificationAccess(input.qualificationId, context);
    if (!access.allowed) return { success: false, error: access.error };

    const markdown = await buildQualificationScanMarkdown(input.qualificationId);
    const options: GeneratePrintableHTMLOptions = {
      template: input.template,
      includeCover: input.includeCover,
      includeToc: input.includeToc,
      enableMermaid: input.enableMermaid,
    };
    const html = generatePrintableHTML(markdown, options);

    return {
      success: true,
      data: {
        qualificationId: input.qualificationId,
        filename: `qualification-scan-${input.qualificationId}.html`,
        contentType: 'text/html; charset=utf-8',
        html,
      },
    };
  },
});
