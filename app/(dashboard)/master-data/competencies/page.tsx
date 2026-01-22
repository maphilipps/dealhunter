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
import { getUserCompetencies } from '@/lib/master-data/actions';

export default async function CompetenciesPage() {
  const competencies = await getUserCompetencies();

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Kompetenzen</h1>
          <p className="text-muted-foreground">
            Crowdsourced Kompetenzdatenbank mit Admin-Validierung
          </p>
        </div>
        <Button asChild>
          <Link href="/master-data/competencies/new">Neue Kompetenz</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competencies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Keine Kompetenzen vorhanden. Erstelle eine neue Kompetenz.
              </TableCell>
            </TableRow>
          ) : (
            competencies.map(comp => (
              <TableRow key={comp.id}>
                <TableCell className="font-medium">{comp.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {comp.category === 'technology' && 'Technologie'}
                    {comp.category === 'methodology' && 'Methodik'}
                    {comp.category === 'industry' && 'Industrie'}
                    {comp.category === 'soft_skill' && 'Soft Skill'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      comp.level === 'expert'
                        ? 'default'
                        : comp.level === 'advanced'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {comp.level === 'basic' && 'Basis'}
                    {comp.level === 'advanced' && 'Fortgeschritten'}
                    {comp.level === 'expert' && 'Experte'}
                  </Badge>
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
