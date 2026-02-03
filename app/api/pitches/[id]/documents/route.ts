import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchDocuments, type NewPitchDocument } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const createDocumentSchema = z.object({
  runId: z.string().min(1).max(50),
  documentType: z.enum(['indication', 'calculation', 'presentation', 'proposal']),
  format: z.enum(['html', 'xlsx', 'pptx', 'docx']),
  cmsVariant: z.string().max(100).optional(),
  technologyId: z.string().max(50).optional(),
  content: z.string().optional(),
  fileData: z.string().optional(), // Base64
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().min(0).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  flags: z.array(z.string()).optional(),
});

const querySchema = z.object({
  runId: z.string().optional(),
  documentType: z.enum(['indication', 'calculation', 'presentation', 'proposal']).optional(),
  format: z.enum(['html', 'xlsx', 'pptx', 'docx']).optional(),
});

// ============================================================================
// Helper: Check Pitch Access
// ============================================================================

async function checkPitchAccess(pitchId: string, userId: string) {
  const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

  if (!pitch) {
    return { error: 'Pitch not found', status: 404 };
  }

  const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!currentUser) {
    return { error: 'User not found', status: 401 };
  }

  if (currentUser.role !== 'admin' && currentUser.businessUnitId !== pitch.businessUnitId) {
    return { error: 'Forbidden: You can only access pitches in your Business Unit', status: 403 };
  }

  return { pitch, currentUser };
}

// ============================================================================
// GET /api/pitches/[id]/documents
// ============================================================================

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error },
        { status: 400 }
      );
    }

    const { runId, documentType, format } = parsed.data;

    // Build WHERE conditions
    const conditions = [eq(pitchDocuments.pitchId, pitchId)];
    if (runId) conditions.push(eq(pitchDocuments.runId, runId));
    if (documentType) conditions.push(eq(pitchDocuments.documentType, documentType));
    if (format) conditions.push(eq(pitchDocuments.format, format));

    const documents = await db
      .select({
        id: pitchDocuments.id,
        runId: pitchDocuments.runId,
        documentType: pitchDocuments.documentType,
        format: pitchDocuments.format,
        cmsVariant: pitchDocuments.cmsVariant,
        technologyId: pitchDocuments.technologyId,
        fileName: pitchDocuments.fileName,
        fileSize: pitchDocuments.fileSize,
        confidence: pitchDocuments.confidence,
        flags: pitchDocuments.flags,
        generatedAt: pitchDocuments.generatedAt,
        createdAt: pitchDocuments.createdAt,
      })
      .from(pitchDocuments)
      .where(and(...conditions))
      .orderBy(desc(pitchDocuments.createdAt));

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error('[GET /api/pitches/:id/documents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/pitches/[id]/documents
// ============================================================================

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await request.json()) as unknown;
    const parsed = createDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const newDocument: NewPitchDocument = {
      pitchId,
      runId: parsed.data.runId,
      documentType: parsed.data.documentType,
      format: parsed.data.format,
      cmsVariant: parsed.data.cmsVariant ?? null,
      technologyId: parsed.data.technologyId ?? null,
      content: parsed.data.content ?? null,
      fileData: parsed.data.fileData ?? null,
      fileName: parsed.data.fileName ?? null,
      fileSize: parsed.data.fileSize ?? null,
      confidence: parsed.data.confidence ?? null,
      flags: parsed.data.flags ? JSON.stringify(parsed.data.flags) : null,
      generatedAt: new Date(),
    };

    const [created] = await db.insert(pitchDocuments).values(newDocument).returning();

    return NextResponse.json({ success: true, document: created }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/pitches/:id/documents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
