'use client';

import { AlertCircle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { QuickScanRenderer, type RenderTree } from '@/components/json-render/quick-scan-registry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Extended Section Result with visualization tree (matches API response)
 */
interface SynthesizedSectionResult {
  sectionId: string;
  results: unknown[];
  confidence: number;
  status: 'success' | 'no_data' | 'error';
  errorMessage?: string;
  visualizationTree?: RenderTree;
  synthesisMethod?: 'ai' | 'fallback';
}

export interface SectionPageTemplateProps {
  leadId: string;
  sectionId: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Reusable Section Page Template (DEA-146)
 *
 * Provides consistent structure for all lead section pages:
 * - Header with title and description
 * - RAG query + AI synthesis on mount
 * - Confidence score display
 * - JSON Render Tree visualization (always)
 * - Refresh button to reload data
 */
export function SectionPageTemplate({
  leadId,
  sectionId,
  title,
  description,
  children,
}: SectionPageTemplateProps) {
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
      console.log(`[SectionPageTemplate] Fetching /api/leads/${leadId}/sections/${sectionId}`);
      const response = await fetch(`/api/leads/${leadId}/sections/${sectionId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SectionPageTemplate] API Error:', response.status, errorText);
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as SynthesizedSectionResult;
      console.log('[SectionPageTemplate] Response:', data);

      if (data.status === 'error') {
        setError(data.errorMessage || 'Unknown error occurred');
        setHasData(false);
      } else if (data.status === 'no_data') {
        setHasData(false);
        setConfidence(0);
        setVisualizationTree(null);
      } else {
        setHasData(true);
        setConfidence(data.confidence);
        setVisualizationTree(data.visualizationTree || null);
        setSynthesisMethod(data.synthesisMethod || null);

        // Debug: Log if we got a visualization tree
        if (data.visualizationTree) {
          console.log('[SectionPageTemplate] Visualization tree:', data.visualizationTree);
        } else {
          console.warn('[SectionPageTemplate] No visualization tree in response');
        }
      }
    } catch (err) {
      console.error('[SectionPageTemplate] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load section data');
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [leadId, sectionId]);

  // Fetch on mount
  useEffect(() => {
    void fetchSectionData();
  }, [fetchSectionData]);

  // Refresh handler
  const handleRefresh = () => {
    void fetchSectionData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>

        {/* Actions */}
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

      {/* Custom Content Slot */}
      {children && <div>{children}</div>}

      {/* Loading State */}
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

      {/* Error State */}
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

      {/* No Data State */}
      {!loading && !error && !hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Keine Daten verfügbar</CardTitle>
            <CardDescription>
              Für diese Sektion sind noch keine Analyse-Ergebnisse vorhanden. Starte einen Quick
              Scan oder Deep Scan, um Daten zu generieren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Daten prüfen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Visualization Tree (JSON Render) */}
      {!loading && !error && hasData && visualizationTree && (
        <QuickScanRenderer tree={visualizationTree} />
      )}

      {/* Data exists but no visualization tree - show debug info */}
      {!loading && !error && hasData && !visualizationTree && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Visualisierung nicht verfügbar</AlertTitle>
          <AlertDescription>
            Die RAG-Daten wurden geladen, aber die AI-Synthese hat keine Visualisierung erzeugt.
            <Button variant="link" className="ml-2 h-auto p-0" onClick={handleRefresh}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Confidence Score Badge Component
 */
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
