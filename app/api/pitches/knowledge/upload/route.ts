import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { extractTextFromPdf } from '@/lib/bids/pdf-extractor';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ingestDocument } from '@/lib/pitch/rag/ingest-pipeline';

export const runtime = 'nodejs';

/**
 * POST /api/pitches/knowledge/upload
 *
 * Admin-only: Upload a knowledge document for RAG ingestion.
 * Accepts multipart/form-data with file + metadata.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Read metadata from form fields
    const cms = formData.get('cms') as string | null;
    const industry = formData.get('industry') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const businessUnit = formData.get('businessUnit') as string | null;
    const sourceType = (formData.get('sourceType') as string) || 'upload';

    // Read file content
    let content = '';
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      content = await extractTextFromPdf(buffer, {
        extractionMode: 'thorough',
      });
    } else {
      content = await file.text();
    }

    if (!content.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Validate source type
    const validSourceTypes = ['upload', 'reference', 'baseline', 'template'] as const;
    const validatedSourceType = validSourceTypes.includes(sourceType as any)
      ? (sourceType as (typeof validSourceTypes)[number])
      : 'upload';

    const result = await ingestDocument({
      content,
      fileName: file.name,
      sourceType: validatedSourceType,
      metadata: {
        cms,
        industry,
        documentType,
        businessUnit,
        confidence: 50,
      },
    });

    return NextResponse.json({
      success: true,
      chunkCount: result.chunkCount,
      chunkIds: result.chunkIds,
    });
  } catch (error) {
    console.error('[POST /api/pitches/knowledge/upload] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
