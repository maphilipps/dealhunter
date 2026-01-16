'use client';

import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteBusinessLine } from '@/lib/admin/business-lines-actions';

interface BusinessLine {
  id: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
  keywords: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface BusinessLineListProps {
  businessLines: BusinessLine[] | undefined;
}

export function BusinessLineList({ businessLines }: BusinessLineListProps) {
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      const result = await deleteBusinessLine(id);

      if (result.success) {
        toast.success('Business Line erfolgreich gelöscht');
        window.location.reload();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Delete error:', error);
    }
  };

  if (!businessLines || businessLines.length === 0) {
    return (
      <div className="text-center py-12 rounded-lg border bg-card">
        <p className="text-muted-foreground mb-4">
          Noch keine Business Lines erfasst
        </p>
        <a
          href="/admin/business-lines/new"
          className="text-primary hover:underline"
        >
          Erste Business Line erstellen →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {businessLines.map((bl) => {
        const keywords = JSON.parse(bl.keywords || '[]');

        return (
          <div key={bl.id} className="rounded-lg border bg-card p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{bl.name}</h3>
              <button
                onClick={() => handleDelete(bl.id, bl.name)}
                className="text-destructive hover:text-destructive/80"
                title="Löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Leiter:</span>
                <p className="font-medium">{bl.leaderName}</p>
                <p className="text-xs text-muted-foreground">{bl.leaderEmail}</p>
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
                Erstellt: {bl.createdAt ? new Date(bl.createdAt).toLocaleDateString('de-DE') : 'N/A'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
