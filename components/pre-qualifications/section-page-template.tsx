'use client';

import { AlertCircle, Globe2, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { QuickScanRenderer, type RenderTree } from '@/components/json-render/quick-scan-registry';
import { QuickScanStatusBanner } from '@/components/pre-qualifications/quick-scan-status-banner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface SynthesizedSectionResult {
  sectionId: string;
  results: unknown[];
  confidence: number;
  status: 'success' | 'no_data' | 'error';
  errorMessage?: string;
  visualizationTree?: RenderTree;
  synthesisMethod?: 'ai' | 'fallback';
}

export interface PreQualificationSectionPageTemplateProps {
  preQualificationId: string;
  sectionId: string;
  title: string;
  description?: string;
}

export function PreQualificationSectionPageTemplate({
  preQualificationId,
  sectionId,
  title,
  description,
}: PreQualificationSectionPageTemplateProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [visualizationTree, setVisualizationTree] = useState<RenderTree | null>(null);
  const [synthesisMethod, setSynthesisMethod] = useState<'ai' | 'fallback' | null>(null);
  const [hasData, setHasData] = useState(false);

  const fetchSectionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/pre-qualifications/${preQualificationId}/sections/${sectionId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SynthesizedSectionResult;

      if (data.status === 'error') {
        setError(data.errorMessage || 'Unbekannter Fehler');
        setHasData(false);
      } else if (data.status === 'no_data') {
        setHasData(false);
        setConfidence(0);
        setVisualizationTree(null);
        setSynthesisMethod(null);
      } else {
        setHasData(true);
        setConfidence(data.confidence);
        setVisualizationTree(data.visualizationTree || null);
        setSynthesisMethod(data.synthesisMethod || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [preQualificationId, sectionId]);

  useEffect(() => {
    void fetchSectionData();
  }, [fetchSectionData]);

  const handleRefresh = () => {
    void fetchSectionData();
  };

  return (
    <div className="space-y-6">
      <QuickScanStatusBanner compact showWhenComplete={false} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {!loading && !error && hasData && <ConfidenceBadge confidence={confidence} />}
          {synthesisMethod && (
            <Badge variant={synthesisMethod === 'ai' ? 'default' : 'secondary'}>
              {synthesisMethod === 'ai' ? 'AI Synthese' : 'Fallback'}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Laden...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Aktualisieren
              </>
            )}
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="link" className="ml-2 h-auto p-0" onClick={handleRefresh}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && visualizationTree && <QuickScanRenderer tree={visualizationTree} />}

      {!loading && !error && !visualizationTree && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              Analyse wird automatisch erstellt
            </CardTitle>
            <CardDescription>
              {hasData
                ? 'Die Analyse wird als strukturierte JSON‑Render‑Ansicht erzeugt. Webquellen werden klar getrennt dargestellt.'
                : 'Die Analyse startet automatisch sobald Daten verfügbar sind.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Daten prüfen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 70) return 'default';
    if (score >= 40) return 'secondary';
    return 'destructive';
  };

  const getLabel = (score: number): string => {
    if (score >= 70) return 'Hoch';
    if (score >= 40) return 'Mittel';
    return 'Niedrig';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">Confidence:</span>
      <Badge variant={getVariant(confidence)}>
        <TrendingUp className="mr-1 h-3 w-3" />
        {getLabel(confidence)} ({confidence}%)
      </Badge>
      <Progress value={confidence} className="w-24" />
    </div>
  );
}
