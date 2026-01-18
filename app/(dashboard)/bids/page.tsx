import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getBids } from '@/lib/bids/actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, FileText, Eye } from 'lucide-react';

export default async function BidsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const result = await getBids();
  const bids = result.bids || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bid Opportunities</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Angebotsanfragen und Ausschreibungen
          </p>
        </div>
        <Link href="/bids/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Bid
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gesamt</CardDescription>
            <CardTitle className="text-3xl">{bids.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Bearbeitung</CardDescription>
            <CardTitle className="text-3xl">
              {bids.filter(b => ['draft', 'extracting', 'reviewing', 'quick_scanning', 'evaluating'].includes(b.status)).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>BIT</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {bids.filter(b => b.bitDecision === 'bit').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NO BIT</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {bids.filter(b => b.bitDecision === 'no_bit').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bids Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alle Bids</CardTitle>
          <CardDescription>
            Klicken Sie auf einen Bid, um Details zu sehen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bids.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Keine Bids vorhanden</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Erstellen Sie Ihren ersten Bid, um loszulegen.
              </p>
              <Link href="/bids/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer Bid
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entscheidung</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((bid) => {
                  // Parse extracted requirements to get customer name
                  let customerName = 'Unbekannt';
                  try {
                    if (bid.extractedRequirements) {
                      const extracted = JSON.parse(bid.extractedRequirements);
                      customerName = extracted.customerName || 'Unbekannt';
                    }
                  } catch {
                    // Ignore parse errors
                  }

                  return (
                    <TableRow key={bid.id}>
                      <TableCell className="font-medium">{customerName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {bid.source === 'reactive' ? 'Reaktiv' : 'Proaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {bid.stage === 'cold' && 'Cold'}
                          {bid.stage === 'warm' && 'Warm'}
                          {bid.stage === 'rfp' && 'RFP'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={bid.status} />
                      </TableCell>
                      <TableCell>
                        <DecisionBadge decision={bid.bitDecision} />
                      </TableCell>
                      <TableCell>
                        {bid.createdAt
                          ? new Date(bid.createdAt).toLocaleDateString('de-DE')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/bids/${bid.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    // Initial & Extraction
    draft: { label: 'Entwurf', variant: 'secondary' },
    extracting: { label: 'Extraktion', variant: 'default' },
    reviewing: { label: 'Review', variant: 'default' },
    // Evaluation
    quick_scanning: { label: 'Quick Scan', variant: 'default' },
    evaluating: { label: 'Evaluierung', variant: 'default' },
    bit_decided: { label: 'Entschieden', variant: 'outline' },
    // NO BIT Path
    archived: { label: 'Archiviert', variant: 'secondary' },
    // BIT Path
    routed: { label: 'Weitergeleitet', variant: 'outline' },
    full_scanning: { label: 'Deep Analysis', variant: 'default' },
    bl_reviewing: { label: 'BL-Review', variant: 'default' },
    team_assigned: { label: 'Team zugewiesen', variant: 'outline' },
    notified: { label: 'Benachrichtigt', variant: 'outline' },
    handed_off: { label: 'Abgeschlossen', variant: 'outline' },
    // Legacy
    analysis_complete: { label: 'Analyse fertig', variant: 'outline' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision || decision === 'pending') {
    return <Badge variant="secondary">Ausstehend</Badge>;
  }

  if (decision === 'bit') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">BIT</Badge>;
  }

  if (decision === 'no_bit') {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">NO BIT</Badge>;
  }

  return <Badge variant="secondary">{decision}</Badge>;
}
