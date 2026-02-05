'use client';

import { AlertCircle, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Loader } from '@/components/ai-elements/loader';
import { QuickScanRenderer, type RenderTree } from '@/components/json-render/quick-scan-registry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

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
  /** The API base path, e.g. `/api/pitches/{id}` or `/api/pre-qualifications/{id}` */
  apiBasePath: string;
  sectionId: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Content rendered above the header (e.g. status banners) */
  banner?: React.ReactNode;
  /** Enable visualization generation UI when data exists but no viz tree */
  enableVisualizationGeneration?: boolean;
  /** Text for the no-data state card title */
  noDataTitle?: string;
  /** Text for the no-data state card description */
  noDataDescription?: string;
}

/**
 * Generic Section Page Template
 *
 * Provides consistent structure for all section pages:
 * - Header with title and description
 * - RAG query + AI synthesis on mount
 * - Confidence score display
 * - JSON Render Tree visualization
 * - Optional visualization generation UI
 * - Refresh button to reload data
 */
export function SectionPageTemplate({
  apiBasePath,
  sectionId,
  title,
  description,
  children,
  banner,
  enableVisualizationGeneration = false,
  noDataTitle = 'Keine Daten verfügbar',
  noDataDescription = 'Für diese Sektion sind noch keine Analyse-Ergebnisse vorhanden.',
}: SectionPageTemplateProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [visualizationTree, setVisualizationTree] = useState<RenderTree | null>(null);
  const [synthesisMethod, setSynthesisMethod] = useState<'ai' | 'fallback' | null>(null);
  const [hasData, setHasData] = useState(false);

  // Visualization generation state
  const [isGeneratingViz, setIsGeneratingViz] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [vizError, setVizError] = useState<string | null>(null);

  const fetchSectionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBasePath}/sections/${sectionId}`);

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
  }, [apiBasePath, sectionId]);

  useEffect(() => {
    void fetchSectionData();
  }, [fetchSectionData]);

  const handleRefresh = () => {
    void fetchSectionData();
  };

  const handleGenerateVisualization = useCallback(async () => {
    setIsGeneratingViz(true);
    setVizError(null);

    try {
      const response = await fetch(`${apiBasePath}/sections/${sectionId}/visualize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refinementPrompt: refinementPrompt.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Visualisierung konnte nicht generiert werden');
      }

      if (data.visualizationTree) {
        setVisualizationTree(data.visualizationTree);
        setConfidence(data.confidence || 50);
        setSynthesisMethod('ai');
        setRefinementPrompt('');
      }
    } catch (err) {
      setVizError(err instanceof Error ? err.message : 'Fehler bei der Visualisierung');
    } finally {
      setIsGeneratingViz(false);
    }
  }, [apiBasePath, sectionId, refinementPrompt]);

  return (
    <div className="space-y-6">
      {/* Optional Banner (e.g. QuickScanStatusBanner) */}
      {banner}

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
                <Loader size="sm" className="mr-2" />
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
            <CardTitle>{noDataTitle}</CardTitle>
            <CardDescription>{noDataDescription}</CardDescription>
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
      {!loading && !error && visualizationTree && <QuickScanRenderer tree={visualizationTree} />}

      {/* Data exists but no visualization tree - show generation UI (if enabled) */}
      {enableVisualizationGeneration && !loading && !error && hasData && !visualizationTree && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Visualisierung generieren
            </CardTitle>
            <CardDescription>
              Generiere eine KI-gestützte Visualisierung basierend auf den Analysedaten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {vizError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{vizError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Textarea
                placeholder="Optional: Verfeinerung, z.B. 'Fokus auf technische Details'..."
                value={refinementPrompt}
                onChange={e => setRefinementPrompt(e.target.value)}
                disabled={isGeneratingViz}
                rows={1}
                className="min-h-[40px] resize-none"
              />
              <Button
                onClick={handleGenerateVisualization}
                disabled={isGeneratingViz}
                className="shrink-0"
              >
                {isGeneratingViz ? <Loader size="sm" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data exists but no visualization tree - no generation UI */}
      {!enableVisualizationGeneration && !loading && !error && hasData && !visualizationTree && (
        <Card>
          <CardHeader>
            <CardTitle>{noDataTitle}</CardTitle>
            <CardDescription>
              Die Analyse wird als strukturierte JSON-Render-Ansicht erzeugt.
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
