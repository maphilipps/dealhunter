'use client';

import { Trash2, RefreshCw, ExternalLink, Github, Star } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteTechnology } from '@/lib/master-data/actions';

interface Technology {
  id: string;
  name: string;
  baselineHours: number | null;
  baselineName: string | null;
  baselineEntityCounts: string | null;
  isDefault: boolean;
  createdAt: Date | null;
  businessUnitId: string;
  businessLineName: string | null;
  // Extended metadata
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  category: string | null;
  license: string | null;
  latestVersion: string | null;
  githubUrl: string | null;
  githubStars: number | null;
  communitySize: string | null;
  researchStatus: string | null;
  lastResearchedAt: Date | null;
}

interface TechnologyListProps {
  technologies: Technology[] | undefined;
}

export function TechnologyList({ technologies }: TechnologyListProps) {
  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set());

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

  const handleResearch = async (id: string, name: string) => {
    setResearchingIds(prev => new Set(prev).add(id));
    toast.info(`Starte AI-Recherche für ${name}...`);

    try {
      const response = await fetch(`/api/admin/technologies/${id}/research`, {
        method: 'POST',
      });

      const result = (await response.json()) as { success: boolean; error?: string };

      if (result.success) {
        toast.success(`Recherche für ${name} abgeschlossen`);
        window.location.reload();
      } else {
        toast.error(result.error || 'Recherche fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Fehler bei der AI-Recherche');
      console.error('Research error:', error);
    } finally {
      setResearchingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (!technologies || technologies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Noch keine Technologien erfasst</p>
        <a href="/master-data/technologies/new" className="text-primary hover:underline">
          Erste Technologie erstellen →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {technologies.map(tech => {
        const entityCounts = JSON.parse(tech.baselineEntityCounts || '{}') as Record<
          string,
          number
        >;
        const hasBaseline = tech.baselineHours && tech.baselineHours > 0;
        const isResearching = researchingIds.has(tech.id);

        return (
          <Card key={tech.id} className="relative">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                {tech.logoUrl ? (
                  <img
                    src={tech.logoUrl}
                    alt={`${tech.name} logo`}
                    className="h-8 w-8 object-contain"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-medium">
                    {tech.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <Link href={`/master-data/technologies/${tech.id}`}>
                    <CardTitle className="text-lg font-medium hover:underline cursor-pointer">
                      {tech.name}
                    </CardTitle>
                  </Link>
                  {tech.category && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {tech.category}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleResearch(tech.id, tech.name)}
                  disabled={isResearching}
                  title="AI-Recherche starten"
                >
                  {isResearching ? (
                    <Loader size="sm" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-primary" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(tech.id, tech.name)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {tech.description && (
                <p className="text-muted-foreground text-xs line-clamp-2">{tech.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {tech.websiteUrl && (
                  <a
                    href={tech.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Website
                  </a>
                )}
                {tech.githubUrl && (
                  <a
                    href={tech.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Github className="h-3 w-3" />
                    GitHub
                  </a>
                )}
                {tech.githubStars && tech.githubStars > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {tech.githubStars.toLocaleString()}
                  </span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground">Business Unit:</span>
                <p className="font-medium">{tech.businessLineName || 'N/A'}</p>
              </div>

              {hasBaseline && (
                <div>
                  <span className="text-muted-foreground">Baseline:</span>
                  <p className="font-medium">{tech.baselineName}</p>
                  <p className="text-xs text-muted-foreground">{tech.baselineHours}h</p>
                </div>
              )}

              {Object.keys(entityCounts).length > 0 && (
                <div>
                  <span className="text-muted-foreground">Entities:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(entityCounts)
                      .slice(0, 4)
                      .map(([entity, count], i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {entity}: {count}
                        </Badge>
                      ))}
                    {Object.keys(entityCounts).length > 4 && (
                      <Badge variant="secondary" className="text-xs">
                        +{Object.keys(entityCounts).length - 4}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {tech.isDefault && (
                  <Badge variant="default" className="text-xs">
                    Default
                  </Badge>
                )}
                {tech.license && (
                  <Badge variant="outline" className="text-xs">
                    {tech.license}
                  </Badge>
                )}
                {tech.latestVersion && (
                  <Badge variant="outline" className="text-xs">
                    v{tech.latestVersion}
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t flex justify-between">
                <span>
                  Erstellt:{' '}
                  {tech.createdAt ? new Date(tech.createdAt).toLocaleDateString('de-DE') : 'N/A'}
                </span>
                {tech.researchStatus && (
                  <Badge
                    variant={
                      tech.researchStatus === 'completed'
                        ? 'default'
                        : tech.researchStatus === 'pending'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="text-[10px]"
                  >
                    {tech.researchStatus === 'completed'
                      ? 'Recherchiert'
                      : tech.researchStatus === 'pending'
                        ? 'Läuft...'
                        : 'Fehlgeschlagen'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
