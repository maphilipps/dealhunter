import { Eye, FileText } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auth } from '@/lib/auth';
import { getLeads } from '@/lib/leads/actions';

export default async function LeadsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Redirect BD users to RFPs page - they work with RFPs, not leads
  if (session.user.role === 'bd') {
    redirect('/rfps');
  }

  const result = await getLeads();
  const leads = result.leads || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">
          Leads aus dem RFP-Qualifizierungsprozess für Ihre Business Unit
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gesamt</CardDescription>
            <CardTitle className="text-3xl">{leads.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Neu weitergeleitet</CardDescription>
            <CardTitle className="text-3xl">
              {leads.filter(l => l.status === 'routed').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Analyse</CardDescription>
            <CardTitle className="text-3xl">
              {
                leads.filter(l => ['full_scanning', 'bl_reviewing'].includes(l.status || 'routed'))
                  .length
              }
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>BID entschieden</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {leads.filter(l => l.blVote === 'BID').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alle Leads</CardTitle>
          <CardDescription>Klicken Sie auf einen Lead, um Details zu sehen</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Keine Leads vorhanden</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {session.user.role === 'bl'
                  ? 'Für Ihre Business Unit wurden noch keine Leads weitergeleitet.'
                  : 'Es gibt aktuell keine Leads im System.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Branche</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>BL Decision</TableHead>
                  <TableHead>Weitergeleitet</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.customerName}</TableCell>
                    <TableCell>
                      {lead.industry ? (
                        <Badge variant="outline">{lead.industry}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Nicht bekannt</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell>
                      {lead.blVote ? (
                        <VoteBadge vote={lead.blVote} />
                      ) : (
                        <Badge variant="secondary">Ausstehend</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.routedAt
                        ? new Date(lead.routedAt).toLocaleDateString('de-DE')
                        : lead.createdAt
                          ? new Date(lead.createdAt).toLocaleDateString('de-DE')
                          : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/leads/${lead.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    routed: { label: 'Neu weitergeleitet', variant: 'default' },
    full_scanning: { label: 'Deep Scan läuft', variant: 'default' },
    bl_reviewing: { label: 'Review', variant: 'default' },
    bid_voted: { label: 'Entschieden', variant: 'outline' },
    archived: { label: 'Archiviert', variant: 'secondary' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function VoteBadge({ vote }: { vote: string }) {
  if (vote === 'BID') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">BID</Badge>;
  }

  if (vote === 'NO-BID') {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">NO-BID</Badge>;
  }

  return <Badge variant="secondary">{vote}</Badge>;
}
