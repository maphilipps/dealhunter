import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getUserReferences } from '@/lib/master-data/actions';

export default async function ReferencesPage() {
  const references = await getUserReferences();

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Referenzen</h1>
        <Button asChild>
          <Link href="/master-data/references/new">Neue Referenz</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projektname</TableHead>
            <TableHead>Kunde</TableHead>
            <TableHead>Industrie</TableHead>
            <TableHead>Technologien</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {references.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Keine Referenzen vorhanden. Erstelle eine neue Referenz.
              </TableCell>
            </TableRow>
          ) : (
            references.map(ref => {
              const technologies = ref.technologies
                ? (JSON.parse(ref.technologies) as string[])
                : [];

              return (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium">{ref.projectName}</TableCell>
                  <TableCell>{ref.customerName}</TableCell>
                  <TableCell>{ref.industry}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {technologies.slice(0, 3).map((tech: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {tech}
                        </Badge>
                      ))}
                      {technologies.length > 3 && (
                        <Badge variant="outline">+{technologies.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ref.status === 'approved'
                          ? 'default'
                          : ref.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {ref.status === 'pending' && 'Ausstehend'}
                      {ref.status === 'approved' && 'Genehmigt'}
                      {ref.status === 'rejected' && 'Abgelehnt'}
                      {ref.status === 'needs_revision' && 'Überarbeiten'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString('de-DE') : '-'}
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
