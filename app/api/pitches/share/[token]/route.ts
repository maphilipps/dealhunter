import { eq, and, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { pitchScanResults } from '@/lib/db/schema';

/**
 * GET /api/pitches/share/[token]
 *
 * Public endpoint — no auth required.
 * Returns read-only audit data for a shared link.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const [audit] = await db
      .select({
        id: pitchScanResults.id,
        websiteUrl: pitchScanResults.websiteUrl,
        techStack: pitchScanResults.techStack,
        performance: pitchScanResults.performance,
        accessibility: pitchScanResults.accessibility,
        architecture: pitchScanResults.architecture,
        hosting: pitchScanResults.hosting,
        integrations: pitchScanResults.integrations,
        componentLibrary: pitchScanResults.componentLibrary,
        performanceScore: pitchScanResults.performanceScore,
        accessibilityScore: pitchScanResults.accessibilityScore,
        migrationComplexity: pitchScanResults.migrationComplexity,
        complexityScore: pitchScanResults.complexityScore,
        completedAt: pitchScanResults.completedAt,
      })
      .from(pitchScanResults)
      .where(
        and(
          eq(pitchScanResults.shareToken, token),
          gte(pitchScanResults.shareExpiresAt, new Date())
        )
      )
      .limit(1);

    if (!audit) {
      return NextResponse.json({ error: 'Link expired or not found' }, { status: 404 });
    }

    // Parse JSON fields for the response
    const parseJson = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    return NextResponse.json({
      success: true,
      audit: {
        ...audit,
        techStack: parseJson(audit.techStack),
        performance: parseJson(audit.performance),
        accessibility: parseJson(audit.accessibility),
        architecture: parseJson(audit.architecture),
        hosting: parseJson(audit.hosting),
        integrations: parseJson(audit.integrations),
        componentLibrary: parseJson(audit.componentLibrary),
      },
    });
  } catch (error) {
    console.error('[GET /api/pitches/share/:token] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
