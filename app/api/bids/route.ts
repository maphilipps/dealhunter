import { eq, and, desc, or, like } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, accounts } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const accountId = searchParams.get('accountId');

    // Build filter conditions
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(rfps.status, status as (typeof rfps.status.enumValues)[0]));
    }

    if (source && source !== 'all') {
      conditions.push(eq(rfps.source, source as (typeof rfps.source.enumValues)[0]));
    }

    if (accountId) {
      conditions.push(eq(rfps.accountId, accountId));
    }

    // Add account name search to database query (DEA-114)
    // Note: JSON field search (customerName, projectDescription) still done in-memory
    // since SQLite doesn't efficiently search JSON fields in WHERE clause
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          like(accounts.name, searchTerm)
          // JSON fields (customerName, projectDescription) filtered in-memory below
        )
      );
    }

    // Execute query with filters
    let query = db
      .select({
        id: rfps.id,
        status: rfps.status,
        decision: rfps.decision,
        source: rfps.source,
        accountId: rfps.accountId,
        accountName: accounts.name,
        websiteUrl: rfps.websiteUrl,
        extractedRequirements: rfps.extractedRequirements,
        createdAt: rfps.createdAt,
        updatedAt: rfps.updatedAt,
      })
      .from(rfps)
      .leftJoin(accounts, eq(rfps.accountId, accounts.id))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    let results = await query.orderBy(desc(rfps.createdAt));

    // Apply additional search filter in-memory for JSON fields (DEA-114)
    // Note: accountName search is already done at database level above
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase().trim();
      results = results.filter(item => {
        let customerName = '';
        let projectDescription = '';

        if (item.extractedRequirements) {
          try {
            const parsed = JSON.parse(item.extractedRequirements) as {
              customerName?: string;
              projectDescription?: string;
            };
            customerName = parsed.customerName || '';
            projectDescription = parsed.projectDescription || '';
          } catch {
            // ignore parse errors
          }
        }

        // Only search JSON fields (accountName already filtered by DB)
        return (
          customerName.toLowerCase().includes(searchLower) ||
          projectDescription.toLowerCase().includes(searchLower)
        );
      });
    }

    // Calculate stats
    const totalBids = results.length;
    const activeBids = results.filter(r => !['archived', 'handed_off'].includes(r.status)).length;
    const pendingEvaluations = results.filter(r =>
      ['bit_pending', 'bl_reviewing'].includes(r.status)
    ).length;

    // Calculate bid rate
    const decidedBids = results.filter(r => r.decision !== 'pending');
    const bidCount = decidedBids.filter(r => r.decision === 'bid').length;
    const bidRate = decidedBids.length > 0 ? Math.round((bidCount / decidedBids.length) * 100) : 0;

    return NextResponse.json({
      opportunities: results,
      stats: {
        totalBids,
        activeBids,
        bidRate,
        pendingEvaluations,
      },
    });
  } catch (error) {
    console.error('[GET /api/bids] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
  }
}
