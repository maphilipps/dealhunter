'use server';

import { eq, and, desc, asc } from 'drizzle-orm';

import { extractTextFromPdf } from './pdf-extractor';

import { auth } from '@/lib/auth';
import { addPreQualProcessingJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications, documents, users } from '@/lib/db/schema';
import type { PreQualification } from '@/lib/db/schema';
import { extractRequirements } from '@/lib/extraction/agent';
import { suggestWebsiteUrls } from '@/lib/extraction/url-suggestion-agent';
import { detectPII, cleanText } from '@/lib/pii/pii-cleaner';
import { triggerNextAgent } from '@/lib/workflow/orchestrator';

/**
 * Helper function to check if user has access to a bid
 * Admin can access all bids, other users only their own
 */
function canAccessBid(bid: PreQualification, userId: string, userRole: string): boolean {
  return userRole === 'admin' || bid.userId === userId;
}

/**
 * Get all bids for the current user
 */
export async function getBids(options?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', bids: [] };
  }

  const { sortBy = 'createdAt', sortOrder = 'desc' } = options || {};

  try {
    // Build base query with database sorting for direct fields
    let bidsWithUser;

    if (sortBy === 'phase') {
      bidsWithUser = await db
        .select({
          id: preQualifications.id,
          userId: preQualifications.userId,
          userName: users.name,
          source: preQualifications.source,
          stage: preQualifications.stage,
          status: preQualifications.status,
          decision: preQualifications.decision,
          extractedRequirements: preQualifications.extractedRequirements,
          createdAt: preQualifications.createdAt,
        })
        .from(preQualifications)
        .leftJoin(users, eq(preQualifications.userId, users.id))
        .where(eq(preQualifications.userId, session.user.id))
        .orderBy(
          sortOrder === 'asc' ? asc(preQualifications.stage) : desc(preQualifications.stage)
        );
    } else if (sortBy === 'entscheidung') {
      bidsWithUser = await db
        .select({
          id: preQualifications.id,
          userId: preQualifications.userId,
          userName: users.name,
          source: preQualifications.source,
          stage: preQualifications.stage,
          status: preQualifications.status,
          decision: preQualifications.decision,
          extractedRequirements: preQualifications.extractedRequirements,
          createdAt: preQualifications.createdAt,
        })
        .from(preQualifications)
        .leftJoin(users, eq(preQualifications.userId, users.id))
        .where(eq(preQualifications.userId, session.user.id))
        .orderBy(
          sortOrder === 'asc' ? asc(preQualifications.decision) : desc(preQualifications.decision)
        );
    } else if (sortBy === 'createdAt') {
      bidsWithUser = await db
        .select({
          id: preQualifications.id,
          userId: preQualifications.userId,
          userName: users.name,
          source: preQualifications.source,
          stage: preQualifications.stage,
          status: preQualifications.status,
          decision: preQualifications.decision,
          extractedRequirements: preQualifications.extractedRequirements,
          createdAt: preQualifications.createdAt,
        })
        .from(preQualifications)
        .leftJoin(users, eq(preQualifications.userId, users.id))
        .where(eq(preQualifications.userId, session.user.id))
        .orderBy(
          sortOrder === 'asc' ? asc(preQualifications.createdAt) : desc(preQualifications.createdAt)
        );
    } else {
      // For JSON field sorts (leadname, kunde), fetch with default ordering
      bidsWithUser = await db
        .select({
          id: preQualifications.id,
          userId: preQualifications.userId,
          userName: users.name,
          source: preQualifications.source,
          stage: preQualifications.stage,
          status: preQualifications.status,
          decision: preQualifications.decision,
          extractedRequirements: preQualifications.extractedRequirements,
          createdAt: preQualifications.createdAt,
        })
        .from(preQualifications)
        .leftJoin(users, eq(preQualifications.userId, users.id))
        .where(eq(preQualifications.userId, session.user.id))
        .orderBy(desc(preQualifications.createdAt));
    }

    // JavaScript sorting for JSON fields (leadname, kunde)
    if (sortBy === 'leadname' || sortBy === 'kunde') {
      bidsWithUser.sort((a, b) => {
        const aData = JSON.parse(a.extractedRequirements || '{}');
        const bData = JSON.parse(b.extractedRequirements || '{}');

        const aValue = sortBy === 'leadname' ? aData.projectName || '' : aData.customerName || '';
        const bValue = sortBy === 'leadname' ? bData.projectName || '' : bData.customerName || '';

        const comparison = aValue.localeCompare(bValue, 'de');
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return { success: true, bids: bidsWithUser };
  } catch (error) {
    console.error('Get bids error:', error);
    return { success: false, error: 'Fehler beim Laden der Bids', bids: [] };
  }
}

/**
 * Get all documents for a bid
 * Admins can access all bids, other users only their own
 */
export async function getBidDocuments(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', documents: [] };
  }

  try {
    // Get bid first to ensure user has access
    let bid;
    if (session.user.role === 'admin') {
      // Admin can access any bid
      bid = await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, bidId))
        .limit(1);
    } else {
      // Other users only their own bids
      bid = await db
        .select()
        .from(preQualifications)
        .where(and(eq(preQualifications.id, bidId), eq(preQualifications.userId, session.user.id)))
        .limit(1);
    }

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
      .where(eq(documents.preQualificationId, bidId))
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
  const stage =
    (formData.get('stage') as 'cold' | 'warm' | 'pre-qualification') || 'pre-qualification';
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
      .insert(preQualifications)
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
      preQualificationId: bidOpportunity.id,
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
  stage?: 'cold' | 'warm' | 'pre-qualification';
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
      .insert(preQualifications)
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
  stage?: 'cold' | 'warm' | 'pre-qualification';
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
      .insert(preQualifications)
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
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (!canAccessBid(bid, session.user.id, session.user.role)) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update status to extracting with optimistic locking
    const updated = await db
      .update(preQualifications)
      .set({
        status: 'extracting',
        version: bid.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(preQualifications.id, bidId), eq(preQualifications.version, bid.version)))
      .returning();

    if (!updated || updated.length === 0) {
      return {
        success: false,
        error: 'Bid wurde während der Bearbeitung geändert. Bitte aktualisieren Sie die Seite.',
      };
    }

    // Run extraction (preQualificationId enables RAG-based extraction)
    const metadata = bid.metadata ? JSON.parse(bid.metadata) : {};
    const extractionResult = await extractRequirements({
      preQualificationId: bidId,
      rawText: bid.rawInput,
      inputType: bid.inputType as 'pdf' | 'email' | 'freetext',

      metadata,
    });

    if (!extractionResult.success) {
      return { success: false, error: extractionResult.error || 'Extraktion fehlgeschlagen' };
    }

    // Save extracted requirements and update status to reviewing
    await db
      .update(preQualifications)
      .set({
        extractedRequirements: JSON.stringify(extractionResult.requirements),
        status: 'reviewing',
      })
      .where(eq(preQualifications.id, bidId));

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
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (!canAccessBid(bid, session.user.id, session.user.role)) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update requirements and move to processing status
    await db
      .update(preQualifications)
      .set({
        extractedRequirements: JSON.stringify(requirements),
        status: 'processing',
      })
      .where(eq(preQualifications.id, bidId));

    const docs = await db.select().from(documents).where(eq(documents.preQualificationId, bidId));

    const files = docs.map(doc => ({
      name: doc.fileName,
      base64: doc.fileData,
      size: doc.fileSize,
    }));

    const websiteUrls = bid.websiteUrl ? [bid.websiteUrl] : [];
    const additionalText =
      bid.rawInput && bid.rawInput !== 'Verarbeitung läuft...' ? bid.rawInput : '';

    const [qualificationJob] = await db
      .insert(backgroundJobs)
      .values({
        jobType: 'qualification',
        preQualificationId: bidId,
        userId: session.user.id,
        status: 'pending',
        progress: 0,
        currentStep: 'Warteschlange',
      })
      .returning();

    const qualificationBullmqJob = await addPreQualProcessingJob({
      preQualificationId: bidId,
      userId: session.user.id,
      backgroundJobId: qualificationJob.id,
      files,
      websiteUrls,
      additionalText,
      enableDSGVO: false,
      useExistingRequirements: true,
    });

    if (qualificationBullmqJob?.id) {
      await db
        .update(backgroundJobs)
        .set({ bullmqJobId: String(qualificationBullmqJob.id) })
        .where(eq(backgroundJobs.id, qualificationJob.id));
    }

    return { success: true };
  } catch (error) {
    console.error('Update requirements error:', error);
    return { success: false, error: 'Update fehlgeschlagen' };
  }
}

/**
 * Upload bid with combined inputs (Multiple PDFs + Multiple URLs + Additional Text)
 * This is the unified upload method that combines all sources into one holistic input
 *
 * Supports:
 * - Multiple PDF files (extracted in parallel)
 * - Multiple website URLs
 * - Additional freetext
 *
 * All sources are combined into a structured rawInput for downstream agents
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

  // Get multiple files and URLs
  const files = formData.getAll('files') as File[];
  const websiteUrls = (formData.getAll('websiteUrls') as string[]).filter(url => url.trim());
  const additionalText = (formData.get('additionalText') as string)?.trim() || '';
  const source = (formData.get('source') as 'reactive' | 'proactive') || 'reactive';
  const stage =
    (formData.get('stage') as 'cold' | 'warm' | 'pre-qualification') || 'pre-qualification';
  const enableDSGVO = formData.get('enableDSGVO') === 'true';
  const accountId = formData.get('accountId') as string | null;

  // At least one input is required
  if (files.length === 0 && websiteUrls.length === 0 && !additionalText) {
    return {
      success: false,
      error: 'Mindestens eine Eingabe (Datei oder Text) ist erforderlich',
    };
  }

  // Validate accountId if provided
  let validAccountId: string | undefined = undefined;
  if (accountId && accountId.trim() !== '' && accountId !== 'null') {
    const { accounts } = await import('@/lib/db/schema');
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (!account) {
      return { success: false, error: 'Ausgewählter Account existiert nicht' };
    }
    validAccountId = accountId;
  }

  try {
    const maxSize = 10 * 1024 * 1024; // 10 MB per file
    const extractedTexts: { fileName: string; text: string }[] = [];
    const fileBuffers: { file: File; buffer: Buffer }[] = [];
    let piiData: string | null = null;
    const allPiiMatches: Array<{ type: string; original: string; replacement: string }> = [];

    // Validate all files first
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        return { success: false, error: `${file.name}: Nur PDF-Dateien sind erlaubt` };
      }
      if (file.size > maxSize) {
        return { success: false, error: `${file.name}: Datei ist zu groß (max. 10 MB)` };
      }
    }

    // Convert all files to buffers (needed for both extraction and storage)
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fileBuffers.push({ file, buffer });
    }

    // Extract text from all PDFs in parallel
    if (fileBuffers.length > 0) {
      const extractionPromises = fileBuffers.map(async ({ file, buffer }) => {
        try {
          let text = await extractTextFromPdf(buffer);

          // Apply DSGVO cleaning if enabled
          if (enableDSGVO && text) {
            const piiMatches = detectPII(text);
            if (piiMatches.length > 0) {
              text = cleanText(text, piiMatches);
              allPiiMatches.push(
                ...piiMatches.map(m => ({
                  type: m.type,
                  original: m.original,
                  replacement: m.replacement,
                }))
              );
            }
          }

          return { fileName: file.name, text: text || '' };
        } catch (error) {
          console.error(`PDF extraction failed for ${file.name}:`, error);
          return { fileName: file.name, text: '' };
        }
      });

      const results = await Promise.all(extractionPromises);
      extractedTexts.push(...results.filter(r => r.text.trim().length > 0));
    }

    // Check if at least some content was extracted
    if (
      files.length > 0 &&
      extractedTexts.length === 0 &&
      !additionalText &&
      websiteUrls.length === 0
    ) {
      return { success: false, error: 'Aus keinem der PDFs konnte Text extrahiert werden' };
    }

    // Store PII data if any was found
    if (allPiiMatches.length > 0) {
      piiData = JSON.stringify(allPiiMatches);
    }

    // Build structured combined raw input
    const rawInputParts: string[] = [];

    // Add PDF sections
    if (extractedTexts.length === 1) {
      // Single PDF: No header needed
      rawInputParts.push(extractedTexts[0].text);
    } else if (extractedTexts.length > 1) {
      // Multiple PDFs: Add headers for each
      for (const { fileName, text } of extractedTexts) {
        rawInputParts.push(`=== DOKUMENT: ${fileName} ===\n\n${text}`);
      }
    }

    // Add website URLs section
    if (websiteUrls.length === 1) {
      rawInputParts.push(`Website-URL: ${websiteUrls[0]}`);
    } else if (websiteUrls.length > 1) {
      rawInputParts.push(
        `Website-URLs:\n${websiteUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
      );
    }

    // Add additional text section
    if (additionalText) {
      rawInputParts.push(`Zusätzliche Informationen:\n${additionalText}`);
    }

    const rawInput = rawInputParts.join('\n\n---\n\n');

    // Determine input type
    let inputType: 'pdf' | 'freetext' | 'combined' = 'freetext';
    const hasFiles = extractedTexts.length > 0;
    const hasUrls = websiteUrls.length > 0;
    const hasText = additionalText.length > 0;
    const sourceCount = [hasFiles, hasUrls, hasText].filter(Boolean).length;

    if (sourceCount > 1 || extractedTexts.length > 1 || websiteUrls.length > 1) {
      inputType = 'combined';
    } else if (hasFiles) {
      inputType = 'pdf';
    }

    // Validate minimum content
    if (rawInput.trim().length < 20) {
      return { success: false, error: 'Eingabe zu kurz (mindestens 20 Zeichen erforderlich)' };
    }

    // Create BidOpportunity record
    const [bidOpportunity] = await db
      .insert(preQualifications)
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

    // Save all PDF files to documents table
    for (const { file, buffer } of fileBuffers) {
      const base64Data = buffer.toString('base64');

      await db.insert(documents).values({
        preQualificationId: bidOpportunity.id,
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
      piiRemoved: enableDSGVO && allPiiMatches.length > 0,
      inputType,
      stats: {
        filesProcessed: extractedTexts.length,
        urlsAdded: websiteUrls.length,
        hasAdditionalText: hasText,
      },
    };
  } catch (error) {
    console.error('Combined upload error:', error);
    return { success: false, error: 'Upload fehlgeschlagen' };
  }
}

/**
 * Create a pending PreQualification and queue background processing
 *
 * This is the new async-first upload method that:
 * 1. Creates a minimal DB entry with status='processing' (< 500ms)
 * 2. Queues a BullMQ job for background processing
 * 3. Returns immediately so user can navigate to detail page
 *
 * The background worker handles:
 * - PDF text extraction
 * - DSGVO/PII cleaning
 * - Duplicate checking
 * - Quick scan (website analysis)
 * - Timeline generation (for BID decisions)
 */
export async function createPendingPreQualification(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Verify user exists in database (for FOREIGN KEY constraint)
  const { users } = await import('@/lib/db/schema');
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!user) {
    return { success: false, error: 'Benutzer nicht gefunden. Bitte melden Sie sich erneut an.' };
  }

  // Get form data
  const files = formData.getAll('files') as File[];
  const websiteUrls = (formData.getAll('websiteUrls') as string[]).filter(url => url.trim());
  const additionalText = (formData.get('additionalText') as string)?.trim() || '';
  const enableDSGVO = formData.get('enableDSGVO') === 'true';
  const accountId = formData.get('accountId') as string | null;

  // At least one input is required
  if (files.length === 0 && websiteUrls.length === 0 && !additionalText) {
    return {
      success: false,
      error: 'Mindestens eine Eingabe (Datei oder Text) ist erforderlich',
    };
  }

  // Validate accountId if provided
  let validAccountId: string | undefined = undefined;
  if (accountId && accountId.trim() !== '' && accountId !== 'null' && accountId !== 'none') {
    const { accounts } = await import('@/lib/db/schema');
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (!account) {
      return { success: false, error: 'Ausgewählter Account existiert nicht' };
    }
    validAccountId = accountId;
  }

  try {
    const maxSize = 10 * 1024 * 1024; // 10 MB per file
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];

    // Validate all files first
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return {
          success: false,
          error: `${file.name}: Nur PDF-, Excel- und Word-Dateien sind erlaubt`,
        };
      }
      if (file.size > maxSize) {
        return { success: false, error: `${file.name}: Datei ist zu groß (max. 10 MB)` };
      }
    }

    // Convert files to base64 for BullMQ (must be serializable)
    const filesBase64: Array<{ name: string; base64: string; size: number }> = [];
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      filesBase64.push({
        name: file.name,
        base64: buffer.toString('base64'),
        size: file.size,
      });
    }

    // Determine input type
    const hasFiles = files.length > 0;
    const hasUrls = websiteUrls.length > 0;
    const hasText = additionalText.length > 0;
    const sourceCount = [hasFiles, hasUrls, hasText].filter(Boolean).length;

    let inputType: 'pdf' | 'freetext' | 'combined' = 'freetext';
    if (sourceCount > 1 || files.length > 1 || websiteUrls.length > 1) {
      inputType = 'combined';
    } else if (hasFiles) {
      inputType = 'pdf';
    }

    // Build minimal raw input for initial storage
    // The full processing happens in the worker
    const rawInputParts: string[] = [];
    if (hasUrls) {
      rawInputParts.push(`Website-URLs: ${websiteUrls.join(', ')}`);
    }
    if (hasText) {
      rawInputParts.push(`Zusätzlicher Text: ${additionalText.substring(0, 200)}...`);
    }
    if (hasFiles) {
      rawInputParts.push(`PDFs: ${files.map(f => f.name).join(', ')}`);
    }
    const rawInput = rawInputParts.join('\n') || 'Verarbeitung läuft...';

    // Create PreQualification with status='processing' (synchronous, fast)
    const [bidOpportunity] = await db
      .insert(preQualifications)
      .values({
        userId: session.user.id,
        accountId: validAccountId,
        source: 'reactive',
        stage: 'pre-qualification',
        inputType,
        rawInput,
        status: 'processing', // New status for background processing
        decision: 'pending',
      })
      .returning();

    const [qualificationJob] = await db
      .insert(backgroundJobs)
      .values({
        jobType: 'qualification',
        preQualificationId: bidOpportunity.id,
        userId: session.user.id,
        status: 'pending',
        progress: 0,
        currentStep: 'Warteschlange',
      })
      .returning();

    // Save PDF files to documents table (for later reference)
    for (const fileData of filesBase64) {
      await db.insert(documents).values({
        preQualificationId: bidOpportunity.id,
        userId: session.user.id,
        fileName: fileData.name,
        fileType: 'application/pdf',
        fileSize: fileData.size,
        fileData: fileData.base64,
        uploadSource: 'initial_upload',
      });
    }

    // Queue BullMQ job for background processing
    const qualificationBullmqJob = await addPreQualProcessingJob({
      preQualificationId: bidOpportunity.id,
      userId: session.user.id,
      backgroundJobId: qualificationJob.id,
      files: filesBase64,
      websiteUrls,
      additionalText,
      enableDSGVO,
      accountId: validAccountId,
    });

    if (qualificationBullmqJob?.id) {
      await db
        .update(backgroundJobs)
        .set({ bullmqJobId: String(qualificationBullmqJob.id) })
        .where(eq(backgroundJobs.id, qualificationJob.id));
    }

    console.log(
      `[createPendingPreQualification] Created prequal ${bidOpportunity.id}, queued for processing`
    );

    return {
      success: true,
      bidId: bidOpportunity.id,
      status: 'processing',
    };
  } catch (error) {
    console.error('createPendingPreQualification error:', error);
    return { success: false, error: 'Fehler beim Erstellen der PreQualification' };
  }
}

/**
 * Trigger background processing for an existing bid (extraction + quick scan)
 */
export async function startPreQualProcessing(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const [bid] = await db
    .select()
    .from(preQualifications)
    .where(and(eq(preQualifications.id, bidId), eq(preQualifications.userId, session.user.id)))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  const processingStates = ['processing', 'extracting', 'duplicate_checking', 'quick_scanning'];

  if (processingStates.includes(bid.status)) {
    return { success: false, error: 'Verarbeitung läuft bereits' };
  }

  const docs = await db.select().from(documents).where(eq(documents.preQualificationId, bidId));

  const files = docs.map(doc => ({
    name: doc.fileName,
    base64: doc.fileData,
    size: doc.fileSize,
  }));

  const websiteUrls = bid.websiteUrl ? [bid.websiteUrl] : [];
  const additionalText =
    bid.rawInput && bid.rawInput !== 'Verarbeitung läuft...' ? bid.rawInput : '';

  await db
    .update(preQualifications)
    .set({
      status: 'processing',
      updatedAt: new Date(),
    })
    .where(eq(preQualifications.id, bidId));

  const [qualificationJob] = await db
    .insert(backgroundJobs)
    .values({
      jobType: 'qualification',
      preQualificationId: bidId,
      userId: session.user.id,
      status: 'pending',
      progress: 0,
      currentStep: 'Warteschlange',
    })
    .returning();

  const qualificationBullmqJob = await addPreQualProcessingJob({
    preQualificationId: bidId,
    userId: session.user.id,
    backgroundJobId: qualificationJob.id,
    files,
    websiteUrls,
    additionalText,
    enableDSGVO: false,
  });

  if (qualificationBullmqJob?.id) {
    await db
      .update(backgroundJobs)
      .set({ bullmqJobId: String(qualificationBullmqJob.id) })
      .where(eq(backgroundJobs.id, qualificationJob.id));
  }

  return { success: true };
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
 * Updates the Pre-Qualification status and assigns the business unit
 */
export async function forwardToBusinessLeader(bidId: string, businessUnitId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (!canAccessBid(bid, session.user.id, session.user.role)) {
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

    // Update Pre-Qualification with business unit assignment and status
    await db
      .update(preQualifications)
      .set({
        assignedBusinessUnitId: businessUnitId,
        status: 'bl_reviewing',
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, bidId));

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
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (!canAccessBid(bid, session.user.id, session.user.role)) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update Pre-Qualification with decision
    await db
      .update(preQualifications)
      .set({
        decision: decision,
        status: decision === 'bid' ? 'routed' : 'archived',
        alternativeRecommendation: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, bidId));

    return {
      success: true,
      decision,
    };
  } catch (error) {
    console.error('Make bit decision error:', error);
    return { success: false, error: 'Entscheidung fehlgeschlagen' };
  }
}
