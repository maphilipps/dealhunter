import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getAuditStatus, checkAndIngestAuditData } from '@/lib/leads/actions';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id } = await params;
  const status = await getAuditStatus(id);

  return NextResponse.json(status);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id } = await params;
  const result = await checkAndIngestAuditData(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
