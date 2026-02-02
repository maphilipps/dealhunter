import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchDocuments } from '@/lib/db/schema';

/**
 * GET /api/pitches/[id]/documents
 *
 * List all generated documents for a pitch.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    const [lead] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await db
      .select({
        id: pitchDocuments.id,
        runId: pitchDocuments.runId,
        documentType: pitchDocuments.documentType,
        format: pitchDocuments.format,
        cmsVariant: pitchDocuments.cmsVariant,
        fileName: pitchDocuments.fileName,
        fileSize: pitchDocuments.fileSize,
        confidence: pitchDocuments.confidence,
        generatedAt: pitchDocuments.generatedAt,
        createdAt: pitchDocuments.createdAt,
      })
      .from(pitchDocuments)
      .where(eq(pitchDocuments.pitchId, pitchId))
      .orderBy(desc(pitchDocuments.createdAt));

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error('[GET /api/pitches/:id/documents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
