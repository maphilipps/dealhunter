'use client';

import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deleteCompetitor } from '@/lib/master-data/actions';

interface Competitor {
  id: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  createdAt: Date | null;
}

const STATUS_LABELS: Record<Competitor['status'], string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  needs_revision: 'Überarbeiten',
};

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = competitors.filter(
    c =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) return;

    const result = await deleteCompetitor(id);
    if (result.success) {
      toast.success('Wettbewerber gelöscht');
      router.refresh();
    } else {
      toast.error(result.error || 'Fehler beim Löschen');
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Wettbewerber durchsuchen..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Firma</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Industrien</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
            <TableHead className="w-[100px]">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {search ? 'Keine Treffer gefunden.' : 'Keine Wettbewerber vorhanden.'}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map(comp => {
              const industries = comp.industry ? (JSON.parse(comp.industry) as string[]) : [];

              return (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">
                    <Link href={`/master-data/competitors/${comp.id}`} className="hover:underline">
                      {comp.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {comp.website ? (
                      <a
                        href={comp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
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
                      {STATUS_LABELS[comp.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {comp.createdAt ? new Date(comp.createdAt).toLocaleDateString('de-DE') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/master-data/competitors/${comp.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(comp.id, comp.companyName)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
