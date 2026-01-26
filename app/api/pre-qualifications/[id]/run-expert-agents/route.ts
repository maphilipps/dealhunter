import { NextRequest, NextResponse } from 'next/server';

import { runExpertAgents } from '@/lib/agents/expert-agents/orchestrator';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/pre-qualifications/cached-queries';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const preQualification = await getCachedPreQualification(id);
  if (!rfp || preQualification.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await runExpertAgents({ preQualificationId: id });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Expert Agents API] Error:', error);
    return NextResponse.json({ error: 'Failed to run expert agents' }, { status: 500 });
  }
}
