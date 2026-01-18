'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Star,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Target,
  Lightbulb,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

interface Technology {
  id: string;
  name: string;
  businessUnitId: string;
  baselineHours: number | null;
  baselineName: string | null;
  baselineEntityCounts: string | null;
  isDefault: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  // Extended metadata
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  category: string | null;
  license: string | null;
  latestVersion: string | null;
  githubUrl: string | null;
  githubStars: number | null;
  lastRelease: string | null;
  communitySize: string | null;
  pros: string | null;
  cons: string | null;
  usps: string | null;
  targetAudiences: string | null;
  useCases: string | null;
  adessoExpertise: string | null;
  adessoReferenceCount: number | null;
  lastResearchedAt: Date | null;
  researchStatus: string | null;
}

interface TechnologyDetailProps {
  technology: Technology;
}

export function TechnologyDetail({ technology }: TechnologyDetailProps) {
  const router = useRouter();
  const [isResearching, setIsResearching] = useState(false);

  const handleResearch = async () => {
    setIsResearching(true);
    toast.info(`Starte AI-Recherche für ${technology.name}...`);

    try {
      const response = await fetch(`/api/admin/technologies/${technology.id}/research`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Recherche abgeschlossen');
        router.refresh();
      } else {
        toast.error(result.error || 'Recherche fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Fehler bei der AI-Recherche');
      console.error('Research error:', error);
    } finally {
      setIsResearching(false);
    }
  };

  // Parse JSON fields safely
  const parseJsonArray = (json: string | null): string[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  const parseJsonObject = (json: string | null): Record<string, number> => {
    if (!json) return {};
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  };

  const pros = parseJsonArray(technology.pros);
  const cons = parseJsonArray(technology.cons);
  const usps = parseJsonArray(technology.usps);
  const targetAudiences = parseJsonArray(technology.targetAudiences);
  const useCases = parseJsonArray(technology.useCases);
  const entityCounts = parseJsonObject(technology.baselineEntityCounts);
  const hasBaseline = technology.baselineHours && technology.baselineHours > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/technologies">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            {technology.logoUrl ? (
              <img
                src={technology.logoUrl}
                alt={`${technology.name} logo`}
                className="h-12 w-12 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-lg font-medium">
                {technology.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{technology.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {technology.category && (
                  <Badge variant="outline">{technology.category}</Badge>
                )}
                {technology.latestVersion && (
                  <Badge variant="secondary">v{technology.latestVersion}</Badge>
                )}
                {technology.license && (
                  <Badge variant="secondary">{technology.license}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button onClick={handleResearch} disabled={isResearching}>
          {isResearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recherchiert...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              AI-Recherche
            </>
          )}
        </Button>
      </div>

      {/* Description */}
      {technology.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{technology.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              Website
            </div>
            {technology.websiteUrl ? (
              <a
                href={technology.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm mt-1 block truncate"
              >
                {technology.websiteUrl}
              </a>
            ) : (
              <p className="text-sm mt-1 text-muted-foreground">Nicht verfügbar</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4" />
              GitHub Stars
            </div>
            <p className="text-lg font-semibold mt-1">
              {technology.githubStars?.toLocaleString() || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Community
            </div>
            <p className="text-lg font-semibold mt-1 capitalize">
              {technology.communitySize || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Letztes Release
            </div>
            <p className="text-lg font-semibold mt-1">
              {technology.lastRelease || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pros & Cons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              Vorteile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pros.length > 0 ? (
              <ul className="space-y-2">
                {pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    {pro}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Nachteile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cons.length > 0 ? (
              <ul className="space-y-2">
                {cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    {con}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>

        {/* USPs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Unique Selling Points
            </CardTitle>
            <CardDescription>Für Verkaufsgespräche</CardDescription>
          </CardHeader>
          <CardContent>
            {usps.length > 0 ? (
              <ul className="space-y-2">
                {usps.map((usp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="font-bold text-primary">{i + 1}.</span>
                    {usp}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>

        {/* Target Audiences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Zielgruppen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {targetAudiences.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {targetAudiences.map((audience, i) => (
                  <Badge key={i} variant="secondary">
                    {audience}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Use Cases */}
      {useCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Typische Anwendungsfälle</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 md:grid-cols-2">
              {useCases.map((useCase, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {useCase}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* adesso Expertise */}
      {technology.adessoExpertise && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>adesso Expertise</CardTitle>
            <CardDescription>Positionierung und Kompetenz</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{technology.adessoExpertise}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Baseline Information */}
      <Card>
        <CardHeader>
          <CardTitle>Baseline-Daten</CardTitle>
          <CardDescription>Für PT-Schätzungen</CardDescription>
        </CardHeader>
        <CardContent>
          {hasBaseline ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Baseline Name</p>
                  <p className="font-medium">{technology.baselineName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Baseline Stunden</p>
                  <p className="font-medium">{technology.baselineHours}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Default</p>
                  <p className="font-medium">{technology.isDefault ? 'Ja' : 'Nein'}</p>
                </div>
              </div>
              {Object.keys(entityCounts).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Entity Counts</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entityCounts).map(([entity, count]) => (
                      <Badge key={entity} variant="outline">
                        {entity}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Keine Baseline-Daten konfiguriert
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Erstellt am</p>
              <p>{technology.createdAt ? new Date(technology.createdAt).toLocaleDateString('de-DE') : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Aktualisiert am</p>
              <p>{technology.updatedAt ? new Date(technology.updatedAt).toLocaleDateString('de-DE') : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Letzte AI-Recherche</p>
              <p>{technology.lastResearchedAt ? new Date(technology.lastResearchedAt).toLocaleDateString('de-DE') : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recherche-Status</p>
              {technology.researchStatus ? (
                <Badge
                  variant={
                    technology.researchStatus === 'completed' ? 'default' :
                    technology.researchStatus === 'pending' ? 'secondary' :
                    'destructive'
                  }
                >
                  {technology.researchStatus === 'completed' ? 'Abgeschlossen' :
                   technology.researchStatus === 'pending' ? 'Läuft...' :
                   'Fehlgeschlagen'}
                </Badge>
              ) : (
                <span>-</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
