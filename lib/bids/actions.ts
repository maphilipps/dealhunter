'use server';

import { eq, and, desc } from 'drizzle-orm';

import { extractTextFromPdf } from './pdf-extractor';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, documents } from '@/lib/db/schema';
import { extractRequirements } from '@/lib/extraction/agent';
import { suggestWebsiteUrls } from '@/lib/extraction/url-suggestion-agent';
import { detectPII, cleanText } from '@/lib/pii/pii-cleaner';
import { startQuickScan } from '@/lib/quick-scan/actions';
import { triggerNextAgent } from '@/lib/workflow/orchestrator';

/**
 * Get all bids for the current user
 */
export async function getBids() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', bids: [] };
  }

  try {
    const bids = await db
      .select()
      .from(rfps)
      .where(eq(rfps.userId, session.user.id))
      .orderBy(desc(rfps.createdAt));

    return { success: true, bids };
  } catch (error) {
    console.error('Get bids error:', error);
    return { success: false, error: 'Fehler beim Laden der Bids', bids: [] };
  }
}

/**
 * Get all documents for a bid
 */
export async function getBidDocuments(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', documents: [] };
  }

  try {
    // Get bid first to ensure user has access
    const bid = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, bidId), eq(rfps.userId, session.user.id)))
      .limit(1);

    if (!bid.length) {
      return { success: false, error: 'Bid nicht gefunden', documents: [] };
    }

    // Get documents (without fileData to avoid large responses)
    const docs = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        uploadSource: documents.uploadSource,
        uploadedAt: documents.uploadedAt,
      })
      .from(documents)
      .where(eq(documents.rfpId, bidId))
      .orderBy(desc(documents.uploadedAt));

    return { success: true, documents: docs };
  } catch (error) {
    console.error('Get bid documents error:', error);
    return { success: false, error: 'Fehler beim Laden der Dokumente', documents: [] };
  }
}

export async function uploadPdfBid(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const file = formData.get('file') as File | null;
  const source = (formData.get('source') as 'reactive' | 'proactive') || 'reactive';
  const stage = (formData.get('stage') as 'cold' | 'warm' | 'rfp') || 'rfp';
  const enableDSGVO = formData.get('enableDSGVO') === 'true';
  const accountId = formData.get('accountId') as string | null;

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
        piiData = JSON.stringify(
          piiMatches.map(m => ({
            type: m.type,
            original: m.original,
            replacement: m.replacement,
          }))
        );
      }
    }

    // Create BidOpportunity record
    const [bidOpportunity] = await db
      .insert(rfps)
      .values({
        userId: session.user.id,
        accountId: accountId || undefined,
        source,
        stage,
        inputType: 'pdf',
        rawInput: extractedText,
        metadata: piiData,
        status: 'draft',
        decision: 'pending',
      })
      .returning();

    // Save PDF file to documents table
    const base64Data = buffer.toString('base64');
    await db.insert(documents).values({
      rfpId: bidOpportunity.id,
      userId: session.user.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: base64Data,
      uploadSource: 'initial_upload',
    });

    // DEA-90: Auto-trigger Duplicate Check after upload
    await triggerNextAgent(bidOpportunity.id, 'draft');

    return {
      success: true,
      bidId: bidOpportunity.id,
      piiRemoved: enableDSGVO && piiData !== null,
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
  accountId?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const { projectDescription, customerName, source = 'reactive', stage = 'warm', accountId } = data;

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
      .insert(rfps)
      .values({
        userId: session.user.id,
        accountId: accountId || undefined,
        source,
        stage,
        inputType: 'freetext',
        rawInput,
        status: 'draft',
        decision: 'pending',
      })
      .returning();

    // DEA-90: Auto-trigger Duplicate Check after upload
    await triggerNextAgent(bidOpportunity.id, 'draft');

    return {
      success: true,
      bidId: bidOpportunity.id,
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
  accountId?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const { emailContent, source = 'reactive', stage = 'warm', accountId } = data;

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
      .insert(rfps)
      .values({
        userId: session.user.id,
        accountId: accountId || undefined,
        source,
        stage,
        inputType: 'email',
        rawInput: emailContent,
        status: 'draft',
        decision: 'pending',
        metadata: JSON.stringify(metadata),
      })
      .returning();

    return {
      success: true,
      bidId: bidOpportunity.id,
      metadata,
    };
  } catch (error) {
    console.error('Email upload error:', error);
    return { success: false, error: 'Speichern fehlgeschlagen' };
  }
}

/**
 * Start AI extraction of requirements from bid document
 * This changes status to 'extracting' and triggers the extraction agent
 */
export async function startExtraction(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update status to extracting with optimistic locking
    const updated = await db
      .update(rfps)
      .set({
        status: 'extracting',
        version: bid.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(rfps.id, bidId), eq(rfps.version, bid.version)))
      .returning();

    if (!updated || updated.length === 0) {
      return {
        success: false,
        error: 'Bid wurde während der Bearbeitung geändert. Bitte aktualisieren Sie die Seite.',
      };
    }

    // Run extraction
    const metadata = bid.metadata ? JSON.parse(bid.metadata) : {};
    const extractionResult = await extractRequirements({
      rawText: bid.rawInput,
      inputType: bid.inputType as 'pdf' | 'email' | 'freetext',
      metadata,
    });

    if (!extractionResult.success) {
      return { success: false, error: extractionResult.error || 'Extraktion fehlgeschlagen' };
    }

    // Save extracted requirements and update status to reviewing
    await db
      .update(rfps)
      .set({
        extractedRequirements: JSON.stringify(extractionResult.requirements),
        status: 'reviewing',
      })
      .where(eq(rfps.id, bidId));

    return {
      success: true,
      requirements: extractionResult.requirements,
    };
  } catch (error) {
    console.error('Extraction error:', error);
    return { success: false, error: 'Extraktion fehlgeschlagen' };
  }
}

/**
 * Update extracted requirements after user review
 * This allows BD Manager to correct AI-extracted data
 */
export async function updateExtractedRequirements(bidId: string, requirements: any) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update requirements and move to quick_scanning status
    await db
      .update(rfps)
      .set({
        extractedRequirements: JSON.stringify(requirements),
        status: 'quick_scanning',
      })
      .where(eq(rfps.id, bidId));

    // Auto-launch Quick Scan (fire-and-forget)
    // Don't await - let it run in background while user sees success
    startQuickScan(bidId).catch(error => {
      console.error('Auto Quick Scan launch failed:', error);
    });

    return { success: true, quickScanStarted: true };
  } catch (error) {
    console.error('Update requirements error:', error);
    return { success: false, error: 'Update fehlgeschlagen' };
  }
}

/**
 * Upload bid with combined inputs (PDF + Website URL + Additional Text)
 * This is the new unified upload method that replaces separate PDF/Freetext/Email uploads
 */
export async function uploadCombinedBid(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Verify user exists in database (for FOREIGN KEY constraint)
  const { users } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!user) {
    return { success: false, error: 'Benutzer nicht gefunden. Bitte melden Sie sich erneut an.' };
  }

  const file = formData.get('file') as File | null;
  const websiteUrl = (formData.get('websiteUrl') as string)?.trim() || '';
  const additionalText = (formData.get('additionalText') as string)?.trim() || '';
  const source = (formData.get('source') as 'reactive' | 'proactive') || 'reactive';
  const stage = (formData.get('stage') as 'cold' | 'warm' | 'rfp') || 'rfp';
  const enableDSGVO = formData.get('enableDSGVO') === 'true';
  const accountId = formData.get('accountId') as string | null;

  // At least one input is required
  if (!file && !websiteUrl && !additionalText) {
    return {
      success: false,
      error: 'Mindestens eine Eingabe (PDF, URL oder Text) ist erforderlich',
    };
  }

  // Validate accountId if provided
  let validAccountId: string | undefined = undefined;
  if (accountId && accountId.trim() !== '' && accountId !== 'null') {
    // Check if account exists
    const { accounts } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (!account) {
      return { success: false, error: 'Ausgewählter Account existiert nicht' };
    }
    validAccountId = accountId;
  }

  try {
    let extractedText = '';
    let piiData = null;
    let inputType: 'pdf' | 'freetext' | 'combined' = 'freetext';

    // Process PDF if provided
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        return { success: false, error: 'Nur PDF-Dateien sind erlaubt' };
      }

      // Validate file size (10 MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return { success: false, error: 'Datei ist zu groß (max. 10 MB)' };
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text from PDF
      extractedText = await extractTextFromPdf(buffer);

      if (!extractedText || extractedText.trim().length === 0) {
        return { success: false, error: 'PDF-Text konnte nicht extrahiert werden' };
      }

      // Apply DSGVO cleaning if enabled
      if (enableDSGVO) {
        const piiMatches = detectPII(extractedText);
        if (piiMatches.length > 0) {
          extractedText = cleanText(extractedText, piiMatches);
          piiData = JSON.stringify(
            piiMatches.map(m => ({
              type: m.type,
              original: m.original,
              replacement: m.replacement,
            }))
          );
        }
      }

      inputType = 'pdf';
    }

    // Build combined raw input
    let rawInput = extractedText;

    // Add website URL section
    if (websiteUrl) {
      rawInput += rawInput ? '\n\n' : '';
      rawInput += `Website-URL: ${websiteUrl}`;
    }

    // Add additional text section
    if (additionalText) {
      rawInput += rawInput ? '\n\n' : '';
      rawInput += `Zusätzliche Informationen:\n${additionalText}`;
    }

    // If multiple inputs provided, mark as combined
    const inputCount = [!!file, !!websiteUrl, !!additionalText].filter(Boolean).length;
    if (inputCount > 1) {
      inputType = 'combined';
    }

    // Validate minimum content
    if (rawInput.trim().length < 20) {
      return { success: false, error: 'Eingabe zu kurz (mindestens 20 Zeichen erforderlich)' };
    }

    // Create BidOpportunity record
    const [bidOpportunity] = await db
      .insert(rfps)
      .values({
        userId: session.user.id,
        accountId: validAccountId,
        source,
        stage,
        inputType,
        rawInput,
        metadata: piiData,
        status: 'draft',
        decision: 'pending',
      })
      .returning();

    // Save PDF file to documents table if provided
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');

      await db.insert(documents).values({
        rfpId: bidOpportunity.id,
        userId: session.user.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64Data,
        uploadSource: 'initial_upload',
      });
    }

    return {
      success: true,
      bidId: bidOpportunity.id,
      piiRemoved: enableDSGVO && piiData !== null,
      inputType,
    };
  } catch (error) {
    console.error('Combined upload error:', error);
    return { success: false, error: 'Upload fehlgeschlagen' };
  }
}

/**
 * Suggest website URLs based on customer information
 * Uses AI to suggest likely URLs when none are found in the document
 */
export async function suggestWebsiteUrlsAction(data: {
  customerName: string;
  industry?: string;
  projectDescription?: string;
  technologies?: string[];
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', suggestions: [] };
  }

  try {
    const result = await suggestWebsiteUrls({
      ...data,
      useWebSearch: true, // Explicitly enable web search
    });

    return {
      success: true,
      suggestions: result.suggestions.map(s => ({
        url: s.url,
        type: s.type,
        description: s.description,
        confidence: s.confidence,
        extractedFromDocument: false,
      })),
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('URL suggestion error:', error);
    return { success: false, error: 'Vorschläge konnten nicht generiert werden', suggestions: [] };
  }
}

/**
 * Forward a bid to a business leader for review
 * Updates the RFP status and assigns the business unit
 */
export async function forwardToBusinessLeader(bidId: string, businessUnitId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Get the business unit
    const { businessUnits } = await import('@/lib/db/schema');
    const [businessUnit] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, businessUnitId))
      .limit(1);

    if (!businessUnit) {
      return { success: false, error: 'Business Unit nicht gefunden' };
    }

    // Update RFP with business unit assignment and status
    await db
      .update(rfps)
      .set({
        assignedBusinessUnitId: businessUnitId,
        status: 'bl_reviewing',
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, bidId));

    return {
      success: true,
      businessUnit: businessUnit.name,
      leaderName: businessUnit.leaderName,
    };
  } catch (error) {
    console.error('Forward to business leader error:', error);
    return { success: false, error: 'Weiterleitung fehlgeschlagen' };
  }
}

/**
 * Make a BIT or NO BIT decision for a bid
 */
export async function makeBitDecision(bidId: string, decision: 'bid' | 'no_bid', reason?: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update RFP with decision
    await db
      .update(rfps)
      .set({
        decision: decision,
        status: decision === 'bid' ? 'routed' : 'archived',
        alternativeRecommendation: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, bidId));

    return {
      success: true,
      decision,
    };
  } catch (error) {
    console.error('Make bit decision error:', error);
    return { success: false, error: 'Entscheidung fehlgeschlagen' };
  }
}
