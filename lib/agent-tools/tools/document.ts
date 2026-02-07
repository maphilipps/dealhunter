import { eq, desc, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { documents, preQualifications } from '@/lib/db/schema';

/**
 * Document Management Tools for Agent Context
 *
 * Provides read-only access to documents (bid documents, RFPs).
 * - Access controlled via PreQualification ownership
 * - fileData (base64) excluded by default to keep responses small
 * - No create tool (documents require FormData upload, not agent-compatible)
 */

// ============================================================================
// Helper: Check access to Document via PreQualification ownership
// ============================================================================

async function checkDocumentAccess(
  documentId: string,
  context: ToolContext
): Promise<{ allowed: boolean; document?: typeof documents.$inferSelect; error?: string }> {
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);

  if (!document) {
    return { allowed: false, error: 'Document not found' };
  }

  // Admin can access all
  if (context.userRole === 'admin') {
    return { allowed: true, document };
  }

  // Check PreQualification ownership
  const [preQual] = await db
    .select({ userId: preQualifications.userId })
    .from(preQualifications)
    .where(eq(preQualifications.id, document.preQualificationId))
    .limit(1);

  if (!preQual || preQual.userId !== context.userId) {
    return { allowed: false, error: 'No access to this document' };
  }

  return { allowed: true, document };
}

// ============================================================================
// document.list - List documents with optional filters
// ============================================================================

const listDocumentsInputSchema = z.object({
  preQualificationId: z.string().optional(),
  uploadSource: z.enum(['initial_upload', 'additional_upload']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'document.list',
  description:
    'List documents, optionally filtered by preQualificationId or upload source. Use to understand what documents are attached to a bid.',
  category: 'document',
  inputSchema: listDocumentsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.preQualificationId) {
      conditions.push(eq(documents.preQualificationId, input.preQualificationId));
    }

    if (input.uploadSource) {
      conditions.push(eq(documents.uploadSource, input.uploadSource));
    }

    // Non-admin users can only see documents for their own PreQualifications
    if (context.userRole !== 'admin') {
      const userPreQuals = await db
        .select({ id: preQualifications.id })
        .from(preQualifications)
        .where(eq(preQualifications.userId, context.userId));

      const preQualIds = userPreQuals.map(p => p.id);

      if (preQualIds.length === 0) {
        return { success: true, data: [] };
      }

      conditions.push(inArray(documents.preQualificationId, preQualIds));
    }

    const results = await db
      .select({
        id: documents.id,
        preQualificationId: documents.preQualificationId,
        userId: documents.userId,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        uploadSource: documents.uploadSource,
        uploadedAt: documents.uploadedAt,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documents.createdAt))
      .limit(input.limit);

    return {
      success: true,
      data: results,
      metadata: {
        count: results.length,
        filters: {
          preQualificationId: input.preQualificationId,
          uploadSource: input.uploadSource,
        },
      },
    };
  },
});

// ============================================================================
// document.get - Get a single document by ID
// ============================================================================

const getDocumentInputSchema = z.object({
  id: z.string(),
  includeFileData: z.boolean().default(false),
});

registry.register({
  name: 'document.get',
  description:
    'Get document metadata by ID. Set includeFileData=true to get base64 content (warning: can be large).',
  category: 'document',
  inputSchema: getDocumentInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkDocumentAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const doc = access.document!;

    // Build response, optionally excluding fileData
    const response: Record<string, unknown> = {
      id: doc.id,
      preQualificationId: doc.preQualificationId,
      userId: doc.userId,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadSource: doc.uploadSource,
      uploadedAt: doc.uploadedAt,
      createdAt: doc.createdAt,
    };

    if (input.includeFileData) {
      response.fileData = doc.fileData;
    }

    return { success: true, data: response };
  },
});

// ============================================================================
// document.getByPreQualification - Get documents for a PreQualification
// ============================================================================

const getByPreQualInputSchema = z.object({
  preQualificationId: z.string(),
});

registry.register({
  /** @deprecated Use document.get_by_pre_qualification instead */
  name: 'document.getByPreQualification',
  description:
    '[DEPRECATED: use document.get_by_pre_qualification] Get all documents for a specific PreQualification. Returns metadata only (no file content).',
  category: 'document',
  inputSchema: getByPreQualInputSchema,
  async execute(input, context: ToolContext) {
    // Check PreQualification access
    if (context.userRole !== 'admin') {
      const [preQual] = await db
        .select({ userId: preQualifications.userId })
        .from(preQualifications)
        .where(eq(preQualifications.id, input.preQualificationId))
        .limit(1);

      if (!preQual) {
        return { success: false, error: 'PreQualification not found' };
      }

      if (preQual.userId !== context.userId) {
        return { success: false, error: 'No access to this PreQualification' };
      }
    }

    const results = await db
      .select({
        id: documents.id,
        preQualificationId: documents.preQualificationId,
        userId: documents.userId,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        uploadSource: documents.uploadSource,
        uploadedAt: documents.uploadedAt,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.preQualificationId, input.preQualificationId))
      .orderBy(desc(documents.createdAt));

    return {
      success: true,
      data: results,
      metadata: {
        preQualificationId: input.preQualificationId,
        count: results.length,
        totalSize: results.reduce((sum, doc) => sum + doc.fileSize, 0),
      },
    };
  },
});

// ============================================================================
// document.delete - Delete a document
// ============================================================================

const deleteDocumentInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'document.delete',
  description: 'Delete a document. Only document owner or admin can delete.',
  category: 'document',
  inputSchema: deleteDocumentInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkDocumentAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const doc = access.document!;

    // Additional check: only document uploader or admin can delete
    if (context.userRole !== 'admin' && doc.userId !== context.userId) {
      return { success: false, error: 'Only the document uploader or admin can delete' };
    }

    await db.delete(documents).where(eq(documents.id, input.id));

    return {
      success: true,
      data: {
        id: input.id,
        fileName: doc.fileName,
        deleted: true,
      },
    };
  },
});

// ============================================================================
// Snake_case aliases (canonical names per CLAUDE.md conventions)
// ============================================================================

registry.register({
  name: 'document.get_by_pre_qualification',
  description:
    'Get all documents for a specific PreQualification. Returns metadata only (no file content).',
  category: 'document',
  inputSchema: getByPreQualInputSchema,
  async execute(input, context: ToolContext) {
    return registry.execute('document.getByPreQualification', input, context);
  },
});
