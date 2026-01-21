import { getUserCompetitors } from '@/lib/master-data/actions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function CompetitorsPage() {
  const competitors = await getUserCompetitors();

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Wettbewerber</h1>
          <p className="text-muted-foreground">
            Bekannte Mitbieter mit Stärken/Schwächen und Encounter-Notizen
          </p>
        </div>
        <Button asChild>
          <Link href="/master-data/competitors/new">Neuer Wettbewerber</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Firma</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Industrien</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitors.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Keine Wettbewerber vorhanden. Erstelle einen neuen Wettbewerber.
              </TableCell>
            </TableRow>
          ) : (
            competitors.map(comp => {
              const industries = comp.industry ? JSON.parse(comp.industry) : [];

              return (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">{comp.companyName}</TableCell>
                  <TableCell>
                    {comp.website ? (
                      <a
                        href={comp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {industries.slice(0, 2).map((ind: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {ind}
                        </Badge>
                      ))}
                      {industries.length > 2 && (
                        <Badge variant="outline">+{industries.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        comp.status === 'approved'
                          ? 'default'
                          : comp.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {comp.status === 'pending' && 'Ausstehend'}
                      {comp.status === 'approved' && 'Genehmigt'}
                      {comp.status === 'rejected' && 'Abgelehnt'}
                      {comp.status === 'needs_revision' && 'Überarbeiten'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {comp.createdAt ? new Date(comp.createdAt).toLocaleDateString('de-DE') : '-'}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
