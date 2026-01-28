'use client';

import { AlertCircle, Globe2, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { QuickScanRenderer, type RenderTree } from '@/components/json-render/quick-scan-registry';
import { MilestoneTimeline } from '@/components/pre-qualifications/milestone-timeline';
import { QuickScanStatusBanner } from '@/components/pre-qualifications/quick-scan-status-banner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TypographyH1 } from '@/components/ui/typography';
import type { TimingAnalysis } from '@/lib/agents/expert-agents/timing-schema';

interface SynthesizedSectionResult {
  sectionId: string;
  results: unknown[];
  confidence: number;
  status: 'success' | 'no_data' | 'error';
  errorMessage?: string;
  visualizationTree?: RenderTree;
  synthesisMethod?: 'ai' | 'fallback';
}

export interface TimingPageContentProps {
  preQualificationId: string;
}

export function TimingPageContent({ preQualificationId }: TimingPageContentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [visualizationTree, setVisualizationTree] = useState<RenderTree | null>(null);
  const [synthesisMethod, setSynthesisMethod] = useState<'ai' | 'fallback' | null>(null);
  const [hasData, setHasData] = useState(false);
  const [timingData, setTimingData] = useState<TimingAnalysis | null>(null);

  const fetchSectionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pre-qualifications/${preQualificationId}/sections/timing`);

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
        setTimingData(null);
      } else {
        setHasData(true);
        setConfidence(data.confidence);
        setVisualizationTree(data.visualizationTree || null);
        setSynthesisMethod(data.synthesisMethod || null);

        // Extract timing data from results
        const timing = extractTimingFromResults(data.results);
        setTimingData(timing);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [preQualificationId]);

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
          <TypographyH1 className="text-3xl lg:text-3xl">Zeitplan / Verfahren</TypographyH1>
          <p className="text-muted-foreground mt-1">
            Wie lautet die Timeline? Gibt es einen Shortlistingprozess oder ein direktes
            Vergabeverfahren?
          </p>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
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

      {!loading && !error && hasData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Timeline Component */}
          {timingData && <MilestoneTimeline timing={timingData} />}

          {/* Visualization Tree from QuickScan */}
          {visualizationTree && (
            <div className="lg:col-span-1">
              <QuickScanRenderer tree={visualizationTree} />
            </div>
          )}
        </div>
      )}

      {!loading && !error && !hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              Analyse wird automatisch erstellt
            </CardTitle>
            <CardDescription>
              Die Analyse startet automatisch sobald Daten verfügbar sind.
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

/**
 * Extract TimingAnalysis from RAG results
 * Looks for timing data in the results array
 */
function extractTimingFromResults(results: unknown[]): TimingAnalysis | null {
  if (!results || results.length === 0) return null;

  // Try to find timing data in results
  for (const result of results) {
    if (typeof result === 'object' && result !== null) {
      const obj = result as Record<string, unknown>;

      // Check if this is a RAG chunk with timing metadata
      if (obj.metadata && typeof obj.metadata === 'object') {
        const metadata = obj.metadata as Record<string, unknown>;
        if (metadata.sectionId === 'timing' && obj.content) {
          try {
            const parsed: unknown = JSON.parse(obj.content as string);
            if (isTimingAnalysis(parsed)) {
              return parsed;
            }
          } catch {
            // Continue searching
          }
        }
      }

      // Check if the result itself is a TimingAnalysis
      if (isTimingAnalysis(obj)) {
        return obj as unknown as TimingAnalysis;
      }

      // Check nested content field
      if (obj.content && typeof obj.content === 'string') {
        try {
          const parsed: unknown = JSON.parse(obj.content);
          if (isTimingAnalysis(parsed)) {
            return parsed;
          }
        } catch {
          // Continue searching
        }
      }
    }
  }

  return null;
}

/**
 * Type guard for TimingAnalysis
 */
function isTimingAnalysis(obj: unknown): obj is TimingAnalysis {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;

  // Check for characteristic fields of TimingAnalysis
  return (
    ('submissionDeadline' in candidate ||
      'milestones' in candidate ||
      'projectStart' in candidate ||
      'projectEnd' in candidate ||
      'daysUntilSubmission' in candidate) &&
    !('executiveSummary' in candidate) // Exclude ManagementSummary
  );
}
