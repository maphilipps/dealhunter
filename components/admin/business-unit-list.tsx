'use client';

import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteBusinessUnit } from '@/lib/admin/business-units-actions';

interface BusinessUnit {
  id: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
  keywords: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface BusinessUnitListProps {
  businessUnits: BusinessUnit[] | undefined;
}

export function BusinessUnitList({ businessUnits }: BusinessUnitListProps) {
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      const result = await deleteBusinessUnit(id);

      if (result.success) {
        toast.success('Business Unit erfolgreich gelöscht');
        window.location.reload();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Delete error:', error);
    }
  };

  if (!businessUnits || businessUnits.length === 0) {
    return (
      <div className="text-center py-12 rounded-lg border bg-card">
        <p className="text-muted-foreground mb-4">Noch keine Business Units erfasst</p>
        <a href="/admin/business-units/new" className="text-primary hover:underline">
          Erste Business Unit erstellen →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {businessUnits.map(bu => {
        const keywords = JSON.parse(bu.keywords || '[]');

        return (
          <div key={bu.id} className="rounded-lg border bg-card p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{bu.name}</h3>
              <button
                onClick={() => handleDelete(bu.id, bu.name)}
                className="text-destructive hover:text-destructive/80"
                title="Löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Leiter:</span>
                <p className="font-medium">{bu.leaderName}</p>
                <p className="text-xs text-muted-foreground">{bu.leaderEmail}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Keywords:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {keywords.map((keyword: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Erstellt:{' '}
                {bu.createdAt ? new Date(bu.createdAt).toLocaleDateString('de-DE') : 'N/A'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
