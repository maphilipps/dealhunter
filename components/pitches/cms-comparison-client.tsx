'use client';

/**
 * CMS Comparison Client Components
 *
 * Rich UI components for displaying CMS advocate results and comparison matrix.
 * Used in the cms-comparison section of the Lead Terminal.
 */

import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Play,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CMSOption {
  name: string;
  fitScore: number;
  pitchSummary: string;
  estimatedHours?: number;
  topStrengths: string[];
  topWeaknesses: string[];
}

interface ComparisonCriterion {
  criterion: string;
  winner: string;
  scores: Record<string, number>;
}

interface CMSComparisonData {
  summary: {
    recommendedCMS: string;
    recommendationStrength: 'strong' | 'moderate' | 'weak';
    alternativeCMS?: string;
    reasoning: string;
    confidence: number;
  };
  cmsOptions: CMSOption[];
  comparisonMatrix: ComparisonCriterion[];
  decisionFactors: string[];
  nextSteps: string[];
  dataQuality: {
    hasAdvocateData: boolean;
    hasComparisonMatrix: boolean;
    sourcesCount: number;
    lastUpdated?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCHER
// ═══════════════════════════════════════════════════════════════════════════════

const fetcher = async (
  url: string
): Promise<{ data: CMSComparisonData | null; status: string; message?: string }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<{
    data: CMSComparisonData | null;
    status: string;
    message?: string;
  }>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CMSComparisonViewProps {
  leadId: string;
  selectedCmsId?: string | null;
  selectedCmsName?: string | null;
}

export function CMSComparisonView({
  leadId,
  selectedCmsId,
  selectedCmsName,
}: CMSComparisonViewProps) {
  const [isRunning, setIsRunning] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<
    { data: CMSComparisonData | null; status: string; message?: string },
    Error
  >(`/api/pitches/${leadId}/cms-advocates`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const runAdvocateAnalysis = useCallback(async () => {
    setIsRunning(true);
    try {
      const response = await fetch(`/api/pitches/${leadId}/cms-advocates/run`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to run analysis');
      // Revalidate data after analysis
      await mutate();
    } catch (err) {
      console.error('Failed to run CMS advocate analysis:', err);
    } finally {
      setIsRunning(false);
    }
  }, [leadId, mutate]);

  if (isLoading) {
    return <CMSComparisonSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Fehler beim Laden</CardTitle>
          <CardDescription>Die CMS-Vergleichsdaten konnten nicht geladen werden.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void mutate()} variant="outline">
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const comparisonData = data?.data;

  // No data yet - show CTA to run analysis
  if (!comparisonData || !comparisonData.dataQuality?.hasAdvocateData) {
    return (
      <NoDataView
        onRunAnalysis={runAdvocateAnalysis}
        isRunning={isRunning}
        hasPartialData={!!comparisonData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* CMS Decision Pending Banner (Phase 1.3) */}
      {!selectedCmsId && comparisonData && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">CMS Entscheidung ausstehend</AlertTitle>
          <AlertDescription className="text-amber-600">
            Die AI empfiehlt <strong>{comparisonData.summary.recommendedCMS}</strong>. Bitte wählen
            Sie das CMS für dieses Projekt aus, um fortzufahren.
            <Button variant="link" className="p-0 h-auto ml-2" asChild>
              <Link href={`/pitches/${leadId}/decision`}>Zur Entscheidung</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* CMS Selected Confirmation */}
      {selectedCmsId && selectedCmsName && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-700">CMS ausgewählt: {selectedCmsName}</AlertTitle>
          <AlertDescription className="text-green-600">
            Die CMS-Entscheidung wurde getroffen. Das Projekt wird mit {selectedCmsName} umgesetzt.
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Recommendation */}
      <RecommendationCard
        summary={comparisonData.summary}
        dataQuality={comparisonData.dataQuality}
        onRefresh={runAdvocateAnalysis}
        isRefreshing={isRunning}
      />

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="matrix">Vergleichsmatrix</TabsTrigger>
          <TabsTrigger value="details">CMS Details</TabsTrigger>
          <TabsTrigger value="next">Nächste Schritte</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <CMSOverviewGrid
            cmsOptions={comparisonData.cmsOptions}
            recommended={comparisonData.summary.recommendedCMS}
          />
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <ComparisonMatrixTable
            matrix={comparisonData.comparisonMatrix}
            cmsOptions={comparisonData.cmsOptions.map(c => c.name)}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <CMSDetailCards
            cmsOptions={comparisonData.cmsOptions}
            recommended={comparisonData.summary.recommendedCMS}
          />
        </TabsContent>

        <TabsContent value="next" className="space-y-4">
          <NextStepsCard
            decisionFactors={comparisonData.decisionFactors}
            nextSteps={comparisonData.nextSteps}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function NoDataView({
  onRunAnalysis,
  isRunning,
  hasPartialData,
}: {
  onRunAnalysis: () => void | Promise<void>;
  isRunning: boolean;
  hasPartialData: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <Scale className="mx-auto h-12 w-12 text-muted-foreground" />
        <CardTitle>CMS-Vergleich starten</CardTitle>
        <CardDescription>
          {hasPartialData
            ? 'Die vorhandenen Daten sind unvollständig. Starte eine neue Analyse für vollständige Ergebnisse.'
            : 'Noch keine CMS-Analyse durchgeführt. Starte die Advocate-Analyse um CMS-Optionen zu vergleichen.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button onClick={() => void onRunAnalysis()} disabled={isRunning} size="lg">
          {isRunning ? (
            <>
              <Loader size="sm" className="mr-2" />
              Analyse läuft...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              CMS Advocate Analyse starten
            </>
          )}
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Die Analyse vergleicht Drupal, Magnolia, Ibexa, FirstSpirit und Sulu basierend auf den
          Projektanforderungen.
        </p>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  summary,
  dataQuality,
  onRefresh,
  isRefreshing,
}: {
  summary: CMSComparisonData['summary'];
  dataQuality: CMSComparisonData['dataQuality'];
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
}) {
  const strengthColors = {
    strong: 'bg-green-500',
    moderate: 'bg-yellow-500',
    weak: 'bg-red-500',
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">Empfehlung: {summary.recommendedCMS}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={`${strengthColors[summary.recommendationStrength]} text-white`}
                >
                  {summary.recommendationStrength === 'strong'
                    ? 'Starke Empfehlung'
                    : summary.recommendationStrength === 'moderate'
                      ? 'Moderate Empfehlung'
                      : 'Schwache Empfehlung'}
                </Badge>
                {summary.alternativeCMS && (
                  <span className="text-muted-foreground">
                    Alternative: {summary.alternativeCMS}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onRefresh()}
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader size="sm" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{summary.reasoning}</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Confidence: {summary.confidence}%</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{dataQuality.sourcesCount} CMS analysiert</span>
          </div>
          {dataQuality.lastUpdated && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {new Date(dataQuality.lastUpdated).toLocaleDateString('de-DE')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CMSOverviewGrid({
  cmsOptions,
  recommended,
}: {
  cmsOptions: CMSOption[];
  recommended: string;
}) {
  // Sort by fitScore descending
  const sorted = [...cmsOptions].sort((a, b) => b.fitScore - a.fitScore);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sorted.map(cms => (
        <Card
          key={cms.name}
          className={cms.name === recommended ? 'border-primary ring-2 ring-primary/20' : ''}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{cms.name}</CardTitle>
              {cms.name === recommended && (
                <Badge variant="default">
                  <Award className="mr-1 h-3 w-3" />
                  Empfohlen
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Fit Score */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Fit-Score</span>
                <span className="font-medium">{cms.fitScore}%</span>
              </div>
              <Progress value={cms.fitScore} className="h-2" />
            </div>

            {/* Pitch Summary */}
            <p className="text-sm text-muted-foreground line-clamp-2">{cms.pitchSummary}</p>

            {/* Estimated Hours */}
            {cms.estimatedHours && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>~{cms.estimatedHours}h Projektaufwand</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ComparisonMatrixTable({
  matrix,
  cmsOptions,
}: {
  matrix: ComparisonCriterion[];
  cmsOptions: string[];
}) {
  if (matrix.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vergleichsmatrix</CardTitle>
          <CardDescription>
            Keine detaillierte Vergleichsmatrix verfügbar. Starte eine neue Analyse.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vergleichsmatrix</CardTitle>
        <CardDescription>Detaillierter Vergleich nach Kriterien</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kriterium</TableHead>
              {cmsOptions.map(cms => (
                <TableHead key={cms} className="text-center">
                  {cms}
                </TableHead>
              ))}
              <TableHead className="text-center">Gewinner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map(row => (
              <TableRow key={row.criterion}>
                <TableCell className="font-medium">{row.criterion}</TableCell>
                {cmsOptions.map(cms => {
                  const score = row.scores[cms] || 0;
                  const isWinner = cms === row.winner;
                  return (
                    <TableCell key={cms} className="text-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-sm ${
                          isWinner ? 'bg-primary/20 font-medium text-primary' : ''
                        }`}
                      >
                        {score}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <Badge variant="outline">{row.winner}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CMSDetailCards({
  cmsOptions,
  recommended,
}: {
  cmsOptions: CMSOption[];
  recommended: string;
}) {
  return (
    <div className="space-y-4">
      {cmsOptions.map(cms => (
        <Card key={cms.name} className={cms.name === recommended ? 'border-primary' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {cms.name}
                {cms.name === recommended && (
                  <Badge variant="default" className="ml-2">
                    Empfohlen
                  </Badge>
                )}
              </CardTitle>
              <div className="text-2xl font-bold text-primary">{cms.fitScore}%</div>
            </div>
            <CardDescription>{cms.pitchSummary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Strengths */}
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-green-600">
                  <ThumbsUp className="h-4 w-4" />
                  Stärken
                </h4>
                <ul className="space-y-1">
                  {cms.topStrengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-red-600">
                  <ThumbsDown className="h-4 w-4" />
                  Schwächen
                </h4>
                <ul className="space-y-1">
                  {cms.topWeaknesses.map((weakness, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NextStepsCard({
  decisionFactors,
  nextSteps,
}: {
  decisionFactors: string[];
  nextSteps: string[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Entscheidungsfaktoren
          </CardTitle>
          <CardDescription>Die wichtigsten Kriterien für die CMS-Entscheidung</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {decisionFactors.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {idx + 1}
                </span>
                <span className="text-sm">{factor}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Nächste Schritte
          </CardTitle>
          <CardDescription>Empfohlene Aktionen basierend auf der Analyse</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CMSComparisonSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-48 animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
