'use client';

import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteTechnology } from '@/lib/admin/technologies-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Technology {
  id: string;
  name: string;
  baselineHours: number;
  baselineName: string;
  baselineEntityCounts: string;
  isDefault: boolean;
  createdAt: Date | null;
  businessLineId: string;
  businessLineName: string | null;
}

interface TechnologyListProps {
  technologies: Technology[] | undefined;
}

export function TechnologyList({ technologies }: TechnologyListProps) {
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      const result = await deleteTechnology(id);

      if (result.success) {
        toast.success('Technologie erfolgreich gelöscht');
        window.location.reload();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Delete error:', error);
    }
  };

  if (!technologies || technologies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Noch keine Technologien erfasst
        </p>
        <a
          href="/admin/technologies/new"
          className="text-primary hover:underline"
        >
          Erste Technologie erstellen →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {technologies.map((tech) => {
        const entityCounts = JSON.parse(tech.baselineEntityCounts || '{}');

        return (
          <Card key={tech.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">{tech.name}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(tech.id, tech.name)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Business Line:</span>
                <p className="font-medium">{tech.businessLineName || 'N/A'}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Baseline:</span>
                <p className="font-medium">{tech.baselineName}</p>
                <p className="text-xs text-muted-foreground">{tech.baselineHours}h</p>
              </div>

              {Object.keys(entityCounts).length > 0 && (
                <div>
                  <span className="text-muted-foreground">Entities:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(entityCounts).map(([entity, count], i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {entity}: {count as number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {tech.isDefault && (
                <Badge variant="default" className="w-fit">Default</Badge>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Erstellt: {tech.createdAt ? new Date(tech.createdAt).toLocaleDateString('de-DE') : 'N/A'}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
