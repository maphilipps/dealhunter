'use client';

import { Pencil, Trash2 } from 'lucide-react';
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
import { deleteCompetency } from '@/lib/master-data/actions';

interface Competency {
  id: string;
  name: string;
  category: 'technology' | 'methodology' | 'industry' | 'soft_skill';
  level: 'basic' | 'advanced' | 'expert';
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  createdAt: Date | null;
}

const CATEGORY_LABELS: Record<Competency['category'], string> = {
  technology: 'Technologie',
  methodology: 'Methodik',
  industry: 'Industrie',
  soft_skill: 'Soft Skill',
};

const LEVEL_LABELS: Record<Competency['level'], string> = {
  basic: 'Basis',
  advanced: 'Fortgeschritten',
  expert: 'Experte',
};

const STATUS_LABELS: Record<Competency['status'], string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  needs_revision: 'Überarbeiten',
};

export function CompetencyList({ competencies }: { competencies: Competency[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = competencies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    CATEGORY_LABELS[c.category].toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) return;

    const result = await deleteCompetency(id);
    if (result.success) {
      toast.success('Kompetenz gelöscht');
      router.refresh();
    } else {
      toast.error(result.error || 'Fehler beim Löschen');
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Kompetenzen durchsuchen..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
            <TableHead className="w-[100px]">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {search ? 'Keine Treffer gefunden.' : 'Keine Kompetenzen vorhanden.'}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map(comp => (
              <TableRow key={comp.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/master-data/competencies/${comp.id}`}
                    className="hover:underline"
                  >
                    {comp.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{CATEGORY_LABELS[comp.category]}</Badge>
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
                    {LEVEL_LABELS[comp.level]}
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
                    {STATUS_LABELS[comp.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {comp.createdAt
                    ? new Date(comp.createdAt).toLocaleDateString('de-DE')
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/master-data/competencies/${comp.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(comp.id, comp.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
