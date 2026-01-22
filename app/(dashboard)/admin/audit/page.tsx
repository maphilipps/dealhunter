import { Suspense } from 'react';

import { AuditTrailTable } from '@/components/admin/audit-trail-table';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuditPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground mt-2">
          Alle manuellen Overrides und Änderungen im System
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <AuditTrailTable />
      </Suspense>
    </div>
  );
}
