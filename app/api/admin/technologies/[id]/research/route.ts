import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { runTechnologyResearch } from '@/lib/technology-research/agent';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/technologies/[id]/research
 * Triggers AI research for a technology
 * Security: Requires admin role
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Verify authentication and admin role
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin role required' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    // 2. Fetch technology data
    const [technology] = await db
      .select()
      .from(technologies)
      .where(eq(technologies.id, id));

    if (!technology) {
      return NextResponse.json({ error: 'Technology not found' }, { status: 404 });
    }

    // 3. Mark as pending
    await db
      .update(technologies)
      .set({ researchStatus: 'pending' })
      .where(eq(technologies.id, id));

    // 4. Run research agent
    const { result, activityLog } = await runTechnologyResearch({
      name: technology.name,
      existingData: {
        logoUrl: technology.logoUrl,
        websiteUrl: technology.websiteUrl,
        description: technology.description,
        category: technology.category,
        license: technology.license,
        latestVersion: technology.latestVersion,
        githubUrl: technology.githubUrl,
        githubStars: technology.githubStars,
        lastRelease: technology.lastRelease,
        communitySize: technology.communitySize,
        pros: technology.pros,
        cons: technology.cons,
        usps: technology.usps,
        targetAudiences: technology.targetAudiences,
        useCases: technology.useCases,
        adessoExpertise: technology.adessoExpertise,
        lastResearchedAt: technology.lastResearchedAt,
      },
    });

    // 5. Update technology with research results
    const updateData: Record<string, unknown> = {
      lastResearchedAt: new Date(),
      researchStatus: 'completed',
      updatedAt: new Date(),
    };

    // Only update fields that have new values
    if (result.logoUrl) updateData.logoUrl = result.logoUrl;
    if (result.websiteUrl) updateData.websiteUrl = result.websiteUrl;
    if (result.description) updateData.description = result.description;
    if (result.category) updateData.category = result.category;
    if (result.license) updateData.license = result.license;
    if (result.latestVersion) updateData.latestVersion = result.latestVersion;
    if (result.githubUrl) updateData.githubUrl = result.githubUrl;
    if (result.githubStars !== undefined) updateData.githubStars = result.githubStars;
    if (result.lastRelease) updateData.lastRelease = result.lastRelease;
    if (result.communitySize) updateData.communitySize = result.communitySize;
    if (result.pros) updateData.pros = JSON.stringify(result.pros);
    if (result.cons) updateData.cons = JSON.stringify(result.cons);
    if (result.usps) updateData.usps = JSON.stringify(result.usps);
    if (result.targetAudiences) updateData.targetAudiences = JSON.stringify(result.targetAudiences);
    if (result.useCases) updateData.useCases = JSON.stringify(result.useCases);
    if (result.adessoExpertise) updateData.adessoExpertise = result.adessoExpertise;

    await db
      .update(technologies)
      .set(updateData)
      .where(eq(technologies.id, id));

    // 6. Fetch updated technology
    const [updatedTechnology] = await db
      .select()
      .from(technologies)
      .where(eq(technologies.id, id));

    revalidatePath('/admin/technologies');

    return NextResponse.json({
      success: true,
      technology: updatedTechnology,
      activityLog,
      updatedFields: Object.keys(result),
    });
  } catch (error) {
    console.error('Research error:', error);

    // Mark as failed
    await db
      .update(technologies)
      .set({ researchStatus: 'failed' })
      .where(eq(technologies.id, id));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research failed' },
      { status: 500 }
    );
  }
}
