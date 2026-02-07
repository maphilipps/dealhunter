import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import { buildQualificationScanMarkdown } from '@/lib/qualification-scan/export/markdown-builder';
import { generateWordDocument } from '@/lib/qualification-scan/export/word-exporter';
import { generatePrintableHTML } from '@/lib/qualification-scan/export/pdf-exporter';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id } = await params;

  // Ownership verification
  const [qualification] = await db
    .select({ id: preQualifications.id })
    .from(preQualifications)
    .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));
  if (!qualification) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const safeId = id.replace(/[^a-zA-Z0-9-]/g, '');
  const format = request.nextUrl.searchParams.get('format') ?? 'html';

  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  try {
    const markdown = await buildQualificationScanMarkdown(id);

    if (format === 'md') {
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="qualification-scan-${safeId}.md"`,
        },
      });
    }

    if (format === 'docx') {
      const buffer = await generateWordDocument(markdown);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="qualification-scan-${safeId}.docx"`,
        },
      });
    }

    if (format === 'pdf') {
      // Return printable HTML — client uses window.print() for PDF
      const html = generatePrintableHTML(markdown);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': csp,
        },
      });
    }

    // Default: return printable HTML
    const html = generatePrintableHTML(markdown);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': csp,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export fehlgeschlagen' }, { status: 500 });
  }
}
