import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { BidDetailClient } from '@/components/bids/bid-detail-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps } from '@/lib/db/schema';

export default async function BidDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get bid opportunity
  const [bid] = await db.select().from(rfps).where(eq(rfps.id, id)).limit(1);

  if (!bid) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">RFP nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte RFP konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Check ownership
  if (bid.userId !== session.user.id) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Keine Berechtigung</h1>
        <p className="text-muted-foreground">
          Sie haben keine Berechtigung, diesen RFP anzuzeigen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RFP Details</h1>
        <p className="text-muted-foreground">ID: {bid.id}</p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Status</CardTitle>
            <StatusBadge status={bid.status} />
          </div>
          <CardDescription>
            Erstellt am{' '}
            {bid.createdAt ? new Date(bid.createdAt).toLocaleDateString('de-DE') : 'Unbekannt'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Quelle</p>
              <p className="font-medium">{bid.source === 'reactive' ? 'Reaktiv' : 'Proaktiv'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phase</p>
              <p className="font-medium">
                {bid.stage === 'cold' && 'Cold'}
                {bid.stage === 'warm' && 'Warm'}
                {bid.stage === 'rfp' && 'RFP'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eingabetyp</p>
              <p className="font-medium">
                {bid.inputType === 'pdf' && 'PDF Upload'}
                {bid.inputType === 'email' && 'E-Mail'}
                {bid.inputType === 'freetext' && 'Texteing abe'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Component for Interactive Features */}
      <BidDetailClient bid={bid} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    // Initial & Extraction
    draft: { label: 'Entwurf', variant: 'secondary' as const },
    extracting: { label: 'Extraktion läuft', variant: 'default' as const },
    reviewing: { label: 'Wird geprüft', variant: 'default' as const },
    // Evaluation
    quick_scanning: { label: 'Quick Scan', variant: 'default' as const },
    evaluating: { label: 'Wird bewertet', variant: 'default' as const },
    decision_made: { label: 'Entschieden', variant: 'default' as const },
    // NO BIT Path
    archived: { label: 'Archiviert', variant: 'outline' as const },
    // BIT Path
    routed: { label: 'Weitergeleitet', variant: 'default' as const },
    full_scanning: { label: 'Deep Analysis', variant: 'default' as const },
    bl_reviewing: { label: 'BL-Review', variant: 'default' as const },
    team_assigned: { label: 'Team zugewiesen', variant: 'default' as const },
    notified: { label: 'Team benachrichtigt', variant: 'default' as const },
    handed_off: { label: 'Abgeschlossen', variant: 'default' as const },
    // Legacy
    analysis_complete: { label: 'Analyse fertig', variant: 'default' as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: 'secondary' as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
