'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { extractTextFromPdf } from './pdf-extractor';
import { detectPII, cleanText } from '@/lib/pii/pii-cleaner';

export async function uploadPdfBid(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const file = formData.get('file') as File | null;
  const source = formData.get('source') as 'reactive' | 'proactive' || 'reactive';
  const stage = formData.get('stage') as 'cold' | 'warm' | 'rfp' || 'rfp';
  const enableDSGVO = formData.get('enableDSGVO') === 'true';

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
    let extractedText = await extractTextFromPdf(buffer);

    if (!extractedText || extractedText.trim().length === 0) {
      return { success: false, error: 'PDF-Text konnte nicht extrahiert werden' };
    }

    // Apply DSGVO cleaning if enabled
    let piiData = null;
    if (enableDSGVO) {
      const piiMatches = detectPII(extractedText);
      if (piiMatches.length > 0) {
        extractedText = cleanText(extractedText, piiMatches);
        piiData = JSON.stringify(piiMatches.map(m => ({
          type: m.type,
          original: m.original,
          replacement: m.replacement
        })));
      }
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
        metadata: piiData,
        status: 'draft',
        bitDecision: 'pending',
      })
      .returning();

    return {
      success: true,
      bidId: bidOpportunity.id,
      piiRemoved: enableDSGVO && (piiData !== null)
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

export async function uploadEmailBid(data: {
  emailContent: string;
  source?: 'reactive' | 'proactive';
  stage?: 'cold' | 'warm' | 'rfp';
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const { emailContent, source = 'reactive', stage = 'warm' } = data;

  // Validate input
  if (!emailContent || emailContent.trim().length < 50) {
    return { success: false, error: 'E-Mail-Inhalt muss mindestens 50 Zeichen lang sein' };
  }

  try {
    // Extract email headers (simple regex parsing)
    const fromMatch = emailContent.match(/^From:\s*(.+)$/im);
    const subjectMatch = emailContent.match(/^Subject:\s*(.+)$/im);
    const dateMatch = emailContent.match(/^Date:\s*(.+)$/im);

    const metadata = {
      from: fromMatch?.[1]?.trim() || 'Unbekannt',
      subject: subjectMatch?.[1]?.trim() || 'Kein Betreff',
      date: dateMatch?.[1]?.trim() || new Date().toISOString(),
    };

    // Create BidOpportunity record
    const [bidOpportunity] = await db
      .insert(bidOpportunities)
      .values({
        userId: session.user.id,
        source,
        stage,
        inputType: 'email',
        rawInput: emailContent,
        status: 'draft',
        bitDecision: 'pending',
        metadata: JSON.stringify(metadata),
      })
      .returning();

    return {
      success: true,
      bidId: bidOpportunity.id,
      metadata
    };
  } catch (error) {
    console.error('Email upload error:', error);
    return { success: false, error: 'Speichern fehlgeschlagen' };
  }
}
