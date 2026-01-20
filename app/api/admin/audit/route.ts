import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const filters = {
    entityId: searchParams.get('entityId') || undefined,
    entityType: searchParams.get('entityType') || undefined,
    action: searchParams.get('action') || undefined,
    userId: searchParams.get('userId') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
  };

  const result = await getAuditLogs(filters);

  return NextResponse.json(result);
}
