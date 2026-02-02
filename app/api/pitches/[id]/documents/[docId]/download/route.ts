import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchDocuments } from '@/lib/db/schema';

/**
 * GET /api/pitches/[id]/documents/[docId]/download
 *
 * Download a generated document by ID.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId, docId } = await context.params;

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

    const [doc] = await db
      .select()
      .from(pitchDocuments)
      .where(and(eq(pitchDocuments.id, docId), eq(pitchDocuments.pitchId, pitchId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // HTML content — return as HTML
    if (doc.format === 'html' && doc.content) {
      return new Response(doc.content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${doc.fileName || 'indication.html'}"`,
        },
      });
    }

    // Binary content (Base64) — decode and return
    if (doc.fileData) {
      const buffer = Buffer.from(doc.fileData, 'base64');
      const mimeTypes: Record<string, string> = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeTypes[doc.format] || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${doc.fileName || `document.${doc.format}`}"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    return NextResponse.json({ error: 'No content available' }, { status: 404 });
  } catch (error) {
    console.error('[GET /api/pitches/:id/documents/:docId/download] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
