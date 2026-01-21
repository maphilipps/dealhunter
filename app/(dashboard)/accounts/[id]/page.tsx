import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAccountWithOpportunities } from '@/lib/accounts-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, ExternalLink, ArrowLeft, FileText } from 'lucide-react';
import { DeleteAccountButton } from '@/components/delete-account-button';

type Props = {
  params: Promise<{ id: string }>;
};

const statusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  extracting: { label: 'Extrahiere', variant: 'default' },
  reviewing: { label: 'Wird geprüft', variant: 'default' },
  quick_scanning: { label: 'Quick Scan', variant: 'default' },
  bit_pending: { label: 'Entscheidung ausstehend', variant: 'outline' },
  evaluating: { label: 'Wird evaluiert', variant: 'default' },
  decision_made: { label: 'Entscheidung getroffen', variant: 'default' },
  archived: { label: 'Archiviert', variant: 'destructive' },
  routed: { label: 'Weitergeleitet', variant: 'default' },
  full_scanning: { label: 'Deep Scan', variant: 'default' },
  bl_reviewing: { label: 'BL Review', variant: 'default' },
  team_assigned: { label: 'Team zugewiesen', variant: 'default' },
  notified: { label: 'Team benachrichtigt', variant: 'default' },
  handed_off: { label: 'Abgeschlossen', variant: 'default' },
  analysis_complete: { label: 'Analyse abgeschlossen', variant: 'default' },
};

const sourceMap = {
  reactive: 'Reaktiv',
  proactive: 'Proaktiv',
};

const stageMap = {
  cold: 'Cold',
  warm: 'Warm',
  rfp: 'RFP',
};

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getAccountWithOpportunities(id);

  if (!result.success || !result.account) {
    notFound();
  }

  const { account, opportunities = [] } = result;

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/accounts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{account.name}</h1>
          <p className="text-muted-foreground">Account Details & Opportunities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/accounts/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Bearbeiten
            </Link>
          </Button>
          <DeleteAccountButton accountId={id} accountName={account.name} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Kundenname</span>
              <p className="font-medium">{account.name}</p>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Branche</span>
              <p className="font-medium">{account.industry}</p>
            </div>

            {account.website && (
              <div>
                <span className="text-sm text-muted-foreground">Website</span>
                <a
                  href={account.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  {account.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div>
              <span className="text-sm text-muted-foreground">Erstellt am</span>
              <p className="font-medium">
                {account.createdAt
                  ? new Date(account.createdAt).toLocaleDateString('de-DE')
                  : 'N/A'}
              </p>
            </div>

            {account.notes && (
              <div>
                <span className="text-sm text-muted-foreground">Notizen</span>
                <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistiken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Anzahl Opportunities</span>
              <p className="text-3xl font-bold">{opportunities.length}</p>
            </div>

            {opportunities.length > 0 && (
              <>
                <div>
                  <span className="text-sm text-muted-foreground">Letzte Opportunity</span>
                  <p className="font-medium">
                    {opportunities[0]?.createdAt
                      ? new Date(opportunities[0].createdAt).toLocaleDateString('de-DE')
                      : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Opportunities ({opportunities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Noch keine Opportunities für diesen Account
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Input Typ</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map(opp => (
                  <TableRow key={opp.id}>
                    <TableCell>
                      <Badge variant={statusMap[opp.status]?.variant || 'default'}>
                        {statusMap[opp.status]?.label || opp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sourceMap[opp.source as keyof typeof sourceMap] || opp.source}
                    </TableCell>
                    <TableCell>
                      {stageMap[opp.stage as keyof typeof stageMap] || opp.stage}
                    </TableCell>
                    <TableCell className="uppercase">{opp.inputType}</TableCell>
                    <TableCell>
                      {opp.createdAt ? new Date(opp.createdAt).toLocaleDateString('de-DE') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/rfps/${opp.id}`}>Details</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
