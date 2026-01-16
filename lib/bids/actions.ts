'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { extractTextFromPdf } from './pdf-extractor';

export async function uploadPdfBid(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const file = formData.get('file') as File | null;
  const source = formData.get('source') as 'reactive' | 'proactive' || 'reactive';
  const stage = formData.get('stage') as 'cold' | 'warm' | 'rfp' || 'rfp';

  if (!file) {
    return { success: false, error: 'Keine Datei ausgewählt' };
  }

  // Validate file type
  if (file.type !== 'application/pdf') {
    return { success: false, error: 'Nur PDF-Dateien sind erlaubt' };
  }

  // Validate file size (10 MB limit)
  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return { success: false, error: 'Datei ist zu groß (max. 10 MB)' };
  }

  try {
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const extractedText = await extractTextFromPdf(buffer);

    if (!extractedText || extractedText.trim().length === 0) {
      return { success: false, error: 'PDF-Text konnte nicht extrahiert werden' };
    }

    // Create BidOpportunity record
    const [bidOpportunity] = await db
      .insert(bidOpportunities)
      .values({
        userId: session.user.id,
        source,
        stage,
        inputType: 'pdf',
        rawInput: extractedText,
        status: 'draft',
        bitDecision: 'pending',
      })
      .returning();

    return {
      success: true,
      bidId: bidOpportunity.id
    };
  } catch (error) {
    console.error('PDF upload error:', error);
    return { success: false, error: 'Upload fehlgeschlagen' };
  }
}

export async function uploadFreetextBid(data: {
  projectDescription: string;
  customerName: string;
  source?: 'reactive' | 'proactive';
  stage?: 'cold' | 'warm' | 'rfp';
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const { projectDescription, customerName, source = 'reactive', stage = 'warm' } = data;

  // Validate inputs
  if (!projectDescription || projectDescription.trim().length < 50) {
    return { success: false, error: 'Projektbeschreibung muss mindestens 50 Zeichen lang sein' };
  }

  if (!customerName || customerName.trim().length === 0) {
    return { success: false, error: 'Kundenname ist erforderlich' };
  }

  try {
    // Format raw input
    const rawInput = `Kunde: ${customerName}\n\nProjektbeschreibung:\n${projectDescription}`;

    // Create BidOpportunity record
    const [bidOpportunity] = await db
      .insert(bidOpportunities)
      .values({
        userId: session.user.id,
        source,
        stage,
        inputType: 'freetext',
        rawInput,
        status: 'draft',
        bitDecision: 'pending',
      })
      .returning();

    return {
      success: true,
      bidId: bidOpportunity.id
    };
  } catch (error) {
    console.error('Freetext upload error:', error);
    return { success: false, error: 'Speichern fehlgeschlagen' };
  }
}
