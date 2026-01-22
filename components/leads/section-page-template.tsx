'use client';

import { AlertCircle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeadRAGResult, SectionQueryResult } from '@/lib/rag/lead-retrieval-service';

export interface SectionPageTemplateProps {
  leadId: string;
  sectionId: string;
  title: string;
  description?: string;
  children?: React.ReactNode; // Optional: for custom content above RAG results
}

/**
 * Reusable Section Page Template (DEA-146)
 *
 * Provides consistent structure for all lead section pages:
 * - Header with title and description
 * - RAG query on mount with loading/error states
 * - Confidence score display
 * - Web research trigger button
 * - Content slots for RAG results or custom content
 *
 * Usage:
 * ```tsx
 * <SectionPageTemplate
 *   leadId={leadId}
 *   sectionId="technology"
 *   title="Aktuelle Technologie"
 *   description="Tech-Stack Analyse der Kundenwebsite"
 * >
 *   <CustomContent /> // Optional
 * </SectionPageTemplate>
 * ```
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
  const [results, setResults] = useState<LeadRAGResult[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [researching, setResearching] = useState(false);

  // Fetch RAG data on mount
  useEffect(() => {
    async function fetchSectionData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/leads/${leadId}/sections/${sectionId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch section data: ${response.statusText}`);
        }

        const data = (await response.json()) as SectionQueryResult;

        if (data.status === 'error') {
          setError(data.errorMessage || 'Unknown error occurred');
        } else if (data.status === 'no_data') {
          setResults([]);
          setConfidence(0);
        } else {
          setResults(data.results);
          setConfidence(data.confidence);
        }
      } catch (err) {
        console.error('[SectionPageTemplate] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load section data');
      } finally {
        setLoading(false);
      }
    }

    void fetchSectionData();
  }, [leadId, sectionId]);

  // Trigger web research
  async function handleWebResearch() {
    setResearching(true);

    try {
      const response = await fetch(`/api/leads/${leadId}/sections/${sectionId}/research`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Web research failed');
      }

      // Refresh section data after research
      const data = (await response.json()) as SectionQueryResult;

      if (data.status === 'success') {
        setResults(data.results);
        setConfidence(data.confidence);
      }
    } catch (err) {
      console.error('[SectionPageTemplate] Web research error:', err);
      setError('Web research failed. Please try again.');
    } finally {
      setResearching(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>

        {/* Confidence Score Badge */}
        {!loading && !error && (
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={confidence} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleWebResearch()}
              disabled={researching}
            >
              {researching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Mehr recherchieren
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Custom Content Slot */}
      {children && <div>{children}</div>}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* No Data State */}
      {!loading && !error && results.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Keine Daten verfügbar</CardTitle>
            <CardDescription>
              Für diese Sektion sind noch keine Analyse-Ergebnisse vorhanden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => void handleWebResearch()}
              disabled={researching}
            >
              {researching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Web-Recherche starten
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* RAG Results Display */}
      {!loading && !error && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, index) => (
            <Card key={result.chunkId || index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {result.chunkType === 'summary' ? 'Summary' : result.agentName}
                    </CardTitle>
                    <CardDescription>
                      Agent: {result.agentName} | Relevance: {Math.round(result.similarity * 100)}%
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{result.chunkType}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{result.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
      <span className="text-sm text-muted-foreground">Confidence:</span>
      <Badge variant={getVariant(confidence)}>
        <TrendingUp className="mr-1 h-3 w-3" />
        {getLabel(confidence)} ({confidence}%)
      </Badge>
      <Progress value={confidence} className="w-24" />
    </div>
  );
}
