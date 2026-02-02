'use client';

/**
 * Executive Summary Card (DEA-140 Phase 1.1)
 *
 * Prominente Zusammenfassung als erstes Element auf der Lead-Seite.
 * Zeigt:
 * - Key Facts (Kunde, Branche, Budget)
 * - AI-generierte Executive Summary aus Overview Synthesizer
 * - Confidence Score + Quick Actions
 *
 * Folgt React Best Practices:
 * - Deferred State Updates (async-defer-await)
 * - SWR für client-side caching (client-swr-dedup)
 * - Optimistische UI mit Skeleton Loading
 */

import {
  AlertCircle,
  Building2,
  DollarSign,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ExecutiveSummaryData {
  headline: string;
  summary: string;
  keyInsights: string[];
  opportunities: string[];
  risks: string[];
  recommendation: {
    action: 'BID' | 'NO-BID' | 'MORE_INFO';
    confidence: number;
    reasoning: string;
  } | null;
}

interface SectionApiResponse {
  sectionId: string;
  results: unknown[];
  confidence: number;
  status: 'success' | 'no_data' | 'error';
  errorMessage?: string;
  visualizationTree?: {
    root: string;
    elements: Record<string, unknown>;
  };
  synthesisMethod?: 'ai' | 'fallback';
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCHER WITH PARSING
// ═══════════════════════════════════════════════════════════════════════════════

const fetcher = async (url: string): Promise<SectionApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.json() as Promise<SectionApiResponse>;
};

/**
 * Parse visualization tree to extract executive summary data
 */
function parseExecutiveSummary(response: SectionApiResponse): ExecutiveSummaryData | null {
  if (response.status !== 'success' || !response.visualizationTree) {
    return null;
  }

  const elements = response.visualizationTree.elements;
  if (!elements) return null;

  // Extract data from visualization tree
  // The tree structure varies by synthesizer, so we need flexible parsing
  const summaryData: ExecutiveSummaryData = {
    headline: 'Executive Summary',
    summary: '',
    keyInsights: [],
    opportunities: [],
    risks: [],
    recommendation: null,
  };

  // Walk through elements to find relevant content
  for (const [, element] of Object.entries(elements)) {
    const el = element as {
      type?: string;
      props?: {
        title?: string;
        description?: string;
        items?: Array<{ label?: string; value?: string }>;
        children?: string[];
        text?: string;
        metrics?: Array<{ label?: string; value?: string | number }>;
      };
    };

    // Look for summary or headline text
    if (el.type === 'Section' && el.props?.title?.toLowerCase().includes('summary')) {
      summaryData.headline = el.props.title;
      if (el.props.description) {
        summaryData.summary = el.props.description;
      }
    }

    // Look for key insights (often in InfoList or similar)
    if (el.type === 'InfoList' && el.props?.items) {
      const items = el.props.items
        .map((item: { label?: string; value?: string }) => item.value || item.label)
        .filter((v): v is string => Boolean(v));

      // Categorize based on context
      if (items.length > 0) {
        summaryData.keyInsights.push(...items.slice(0, 5));
      }
    }

    // Look for text blocks
    if (el.type === 'Text' && el.props?.text) {
      if (!summaryData.summary) {
        summaryData.summary = el.props.text;
      }
    }

    // Look for metrics
    if (el.type === 'MetricGrid' && el.props?.metrics) {
      for (const metric of el.props.metrics) {
        if (metric.label && metric.value) {
          summaryData.keyInsights.push(`${metric.label}: ${metric.value}`);
        }
      }
    }
  }

  // If we couldn't parse specific fields, use RAG results directly
  if (!summaryData.summary && response.results.length > 0) {
    const firstResult = response.results[0] as { content?: string };
    if (firstResult?.content) {
      summaryData.summary = firstResult.content.substring(0, 500) + '...';
    }
  }

  return summaryData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutiveSummaryCardProps {
  leadId: string;
  customerName: string;
  industry?: string | null;
  budget?: string | null;
  websiteUrl?: string | null;
  projectDescription?: string | null;
}

export function ExecutiveSummaryCard({
  leadId,
  customerName,
  industry,
  budget,
  websiteUrl,
  projectDescription,
}: ExecutiveSummaryCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // SWR for automatic caching and deduplication (client-swr-dedup)
  const { data, error, isLoading, mutate } = useSWR<SectionApiResponse>(
    `/api/pitches/${leadId}/sections/overview`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      errorRetryCount: 2,
    }
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await mutate();
    } finally {
      setIsRefreshing(false);
    }
  }, [mutate]);

  const parsedSummary = data ? parseExecutiveSummary(data) : null;
  const confidence = data?.confidence ?? 0;
  const synthesisMethod = data?.synthesisMethod;

  // Loading state
  if (isLoading) {
    return <ExecutiveSummarySkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Executive Summary konnte nicht geladen werden</AlertTitle>
        <AlertDescription>
          {error.message}
          <Button variant="link" className="ml-2 h-auto p-0" onClick={() => void handleRefresh()}>
            Erneut versuchen
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!data || data.status === 'no_data') {
    return (
      <Card className="border-dashed border-muted-foreground/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle>Executive Summary</CardTitle>
              <CardDescription>
                Noch keine AI-Analyse verfügbar. Starte einen Deep Scan für detaillierte Insights.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Show basic info from props while waiting for AI summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <InfoItem icon={Building2} label="Kunde" value={customerName} />
            <InfoItem icon={Target} label="Branche" value={industry || 'Nicht bekannt'} />
            <InfoItem icon={DollarSign} label="Budget" value={budget || 'Nicht spezifiziert'} />
          </div>
          {projectDescription && (
            <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{projectDescription}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {parsedSummary?.headline || 'Executive Summary'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                {customerName}
                {industry && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span>{industry}</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={confidence} />
            {synthesisMethod && (
              <Badge variant={synthesisMethod === 'ai' ? 'default' : 'secondary'} className="h-6">
                {synthesisMethod === 'ai' ? 'AI' : 'Fallback'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Facts Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <InfoItem icon={Building2} label="Kunde" value={customerName} />
          <InfoItem icon={Target} label="Branche" value={industry || 'N/A'} />
          <InfoItem icon={DollarSign} label="Budget" value={budget || 'N/A'} />
          {websiteUrl && (
            <InfoItem
              icon={Globe}
              label="Website"
              value={
                <a
                  href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate block max-w-[150px]"
                >
                  {websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              }
            />
          )}
        </div>

        {/* AI Summary */}
        {parsedSummary?.summary && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm leading-relaxed">{parsedSummary.summary}</p>
          </div>
        )}

        {/* Key Insights */}
        {parsedSummary?.keyInsights && parsedSummary.keyInsights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Key Insights
            </h4>
            <ul className="grid gap-1 md:grid-cols-2">
              {parsedSummary.keyInsights.slice(0, 6).map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">•</span>
                  <span className="line-clamp-1">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pitches/${leadId}/decision`}>
              <FileText className="mr-2 h-4 w-4" />
              Zur Entscheidung
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/pitches/${leadId}/zusammenfassung`}>Detaillierte Zusammenfassung</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm truncate">{value || 'N/A'}</p>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 70) return 'default';
    if (score >= 40) return 'secondary';
    return 'destructive';
  };

  return (
    <Badge variant={getVariant(confidence)} className="h-6 gap-1">
      <TrendingUp className="h-3 w-3" />
      {confidence}%
    </Badge>
  );
}

function ExecutiveSummarySkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-2 md:grid-cols-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
