import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DeleteQualificationButton } from '@/components/qualifications/delete-qualification-button';
import { QualificationsEmptyStateClient } from '@/components/qualifications/qualifications-empty-state-client';
import { SortableTableHead } from '@/components/qualifications/sortable-table-head';
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
import { getBids } from '@/lib/bids/actions';

interface PreQualificationsPageProps {
  searchParams: Promise<{ sort?: string; order?: 'asc' | 'desc' }>;
}

export default async function BidsPage({ searchParams }: PreQualificationsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Extract and validate searchParams
  const params = await searchParams;
  const { sort = 'createdAt', order = 'desc' } = params;

  const validSortColumns = ['leadname', 'kunde', 'phase', 'entscheidung', 'createdAt'];
  const sortBy = validSortColumns.includes(sort) ? sort : 'createdAt';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  // Get bids with sorting
  const result = await getBids({ sortBy, sortOrder });
  const bids = result.bids || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Angebotsanfragen und Ausschreibungen
          </p>
        </div>
        <Link href="/qualifications/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Lead
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
              {
                bids.filter(b =>
                  [
                    'draft',
                    'processing',
                    'extracting',
                    'reviewing',
                    'qualification_scanning',
                    'evaluating',
                  ].includes(b.status)
                ).length
              }
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>BID</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {bids.filter(b => b.decision === 'bid').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NO BID</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {bids.filter(b => b.decision === 'no_bid').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bids Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alle Leads</CardTitle>
          <CardDescription>Klicken Sie auf einen Lead, um Details zu sehen</CardDescription>
        </CardHeader>
        <CardContent>
          {bids.length === 0 ? (
            <QualificationsEmptyStateClient />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="leadname" label="Leadname" />
                  <SortableTableHead column="kunde" label="Kunde" />
                  <SortableTableHead column="phase" label="Phase" />
                  <SortableTableHead column="entscheidung" label="Entscheidung" />
                  <SortableTableHead column="createdAt" label="Erstellt" />
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map(bid => {
                  // Parse customer name AND project name from extractedRequirements
                  let customerName = 'Unbekannt';
                  let projectName = 'Unbekannt';
                  try {
                    if (bid.extractedRequirements) {
                      const extracted = JSON.parse(bid.extractedRequirements) as Record<
                        string,
                        unknown
                      >;
                      if (typeof extracted.customerName === 'string') {
                        customerName = extracted.customerName;
                      }
                      if (typeof extracted.projectName === 'string') {
                        projectName = extracted.projectName;
                      }
                    }
                  } catch {
                    // Ignore parse errors
                  }

                  return (
                    <TableRow key={bid.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link href={`/qualifications/${bid.id}`} className="block w-full">
                          {projectName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/qualifications/${bid.id}`} className="block w-full">
                          {customerName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/qualifications/${bid.id}`} className="block w-full">
                          <Badge variant="secondary">
                            {bid.stage === 'cold' && 'Cold'}
                            {bid.stage === 'warm' && 'Warm'}
                            {bid.stage === 'pre-qualification' && 'Lead'}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/qualifications/${bid.id}`} className="block w-full">
                          <DecisionBadge decision={bid.decision} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/qualifications/${bid.id}`} className="block w-full">
                          {bid.createdAt
                            ? new Date(bid.createdAt).toLocaleDateString('de-DE')
                            : '-'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <DeleteQualificationButton
                            preQualificationId={bid.id}
                            label={customerName}
                            size="sm"
                          />
                        </div>
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

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision || decision === 'pending') {
    return <Badge variant="secondary">Ausstehend</Badge>;
  }

  if (decision === 'bid') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">BID</Badge>;
  }

  if (decision === 'no_bid') {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">NO BID</Badge>;
  }

  return <Badge variant="secondary">{decision}</Badge>;
}
