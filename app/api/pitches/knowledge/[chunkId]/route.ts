import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { deleteKnowledgeChunk } from '@/lib/pitch/rag/knowledge-service';

/**
 * DELETE /api/pitches/knowledge/[chunkId]
 *
 * Admin-only: Delete a single knowledge chunk by ID.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ chunkId: string }> }) {
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

    const { chunkId } = await context.params;

    await deleteKnowledgeChunk(chunkId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pitches/knowledge/:chunkId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
