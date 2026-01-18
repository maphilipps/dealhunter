import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { documents, bidOpportunities } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { id: documentId } = await params;

    // Get document with bid information
    const [doc] = await db
      .select({
        document: documents,
        bid: bidOpportunities,
      })
      .from(documents)
      .innerJoin(bidOpportunities, eq(documents.bidOpportunityId, bidOpportunities.id))
      .where(and(
        eq(documents.id, documentId),
        eq(bidOpportunities.userId, session.user.id) // Ensure user owns this bid
      ))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 });
    }

    // Convert Base64 to buffer
    const fileBuffer = Buffer.from(doc.document.fileData, 'base64');

    // Return file as downloadable attachment
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': doc.document.fileType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.document.fileName)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Document download error:', error);
    return NextResponse.json({ error: 'Download fehlgeschlagen' }, { status: 500 });
  }
}
