import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchScanResults, type NewPitchScanResult } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const createAuditResultSchema = z.object({
  runId: z.string().min(1).max(50),
  websiteUrl: z.string().url().max(2000),
  techStack: z.record(z.string(), z.unknown()).optional(),
  performance: z.record(z.string(), z.unknown()).optional(),
  accessibility: z.record(z.string(), z.unknown()).optional(),
  architecture: z.record(z.string(), z.unknown()).optional(),
  hosting: z.record(z.string(), z.unknown()).optional(),
  integrations: z.record(z.string(), z.unknown()).optional(),
  componentLibrary: z.record(z.string(), z.unknown()).optional(),
  screenshots: z.record(z.string(), z.unknown()).optional(),
  performanceScore: z.number().int().min(0).max(100).optional(),
  accessibilityScore: z.number().int().min(0).max(100).optional(),
  migrationComplexity: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  complexityScore: z.number().int().min(0).max(100).optional(),
});

const querySchema = z.object({
  runId: z.string().optional(),
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
// GET /api/pitches/[id]/audit-results
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

    const { runId } = parsed.data;

    // Build WHERE conditions
    const conditions = [eq(pitchScanResults.pitchId, pitchId)];
    if (runId) conditions.push(eq(pitchScanResults.runId, runId));

    const auditResults = await db
      .select({
        id: pitchScanResults.id,
        runId: pitchScanResults.runId,
        websiteUrl: pitchScanResults.websiteUrl,
        performanceScore: pitchScanResults.performanceScore,
        accessibilityScore: pitchScanResults.accessibilityScore,
        migrationComplexity: pitchScanResults.migrationComplexity,
        complexityScore: pitchScanResults.complexityScore,
        shareToken: pitchScanResults.shareToken,
        shareExpiresAt: pitchScanResults.shareExpiresAt,
        startedAt: pitchScanResults.startedAt,
        completedAt: pitchScanResults.completedAt,
        createdAt: pitchScanResults.createdAt,
      })
      .from(pitchScanResults)
      .where(and(...conditions))
      .orderBy(desc(pitchScanResults.createdAt));

    return NextResponse.json({ success: true, auditResults });
  } catch (error) {
    console.error('[GET /api/pitches/:id/audit-results] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/pitches/[id]/audit-results
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
    const parsed = createAuditResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const newAuditResult: NewPitchScanResult = {
      pitchId,
      runId: parsed.data.runId,
      websiteUrl: parsed.data.websiteUrl,
      techStack: parsed.data.techStack ? JSON.stringify(parsed.data.techStack) : null,
      performance: parsed.data.performance ? JSON.stringify(parsed.data.performance) : null,
      accessibility: parsed.data.accessibility ? JSON.stringify(parsed.data.accessibility) : null,
      architecture: parsed.data.architecture ? JSON.stringify(parsed.data.architecture) : null,
      hosting: parsed.data.hosting ? JSON.stringify(parsed.data.hosting) : null,
      integrations: parsed.data.integrations ? JSON.stringify(parsed.data.integrations) : null,
      componentLibrary: parsed.data.componentLibrary
        ? JSON.stringify(parsed.data.componentLibrary)
        : null,
      screenshots: parsed.data.screenshots ? JSON.stringify(parsed.data.screenshots) : null,
      performanceScore: parsed.data.performanceScore ?? null,
      accessibilityScore: parsed.data.accessibilityScore ?? null,
      migrationComplexity: parsed.data.migrationComplexity ?? null,
      complexityScore: parsed.data.complexityScore ?? null,
      startedAt: new Date(),
    };

    const [created] = await db.insert(pitchScanResults).values(newAuditResult).returning();

    return NextResponse.json({ success: true, auditResult: created }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/pitches/:id/audit-results] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
