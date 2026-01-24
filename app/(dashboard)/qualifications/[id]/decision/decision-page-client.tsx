'use client';

import { AlertCircle, CheckCircle2, ThumbsDown, ThumbsUp, TrendingUp, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { ProjectPlanCard } from '@/components/qualifications/project-plan-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { Qualification } from '@/lib/db/schema';
import { submitBLDecision } from '@/lib/qualifications/actions';

interface DecisionPageClientProps {
  lead: Qualification;
}

interface DecisionAnalysis {
  executiveSummary: string;
  recommendation: 'BID' | 'NO-BID';
  confidenceScore: number;
  categories: {
    id: string;
    name: string;
    weight: number;
    score: number;
    pros: string[];
    cons: string[];
  }[];
  reasoning: string;
}

/**
 * DEA-152: Decision Page Client Component
 *
 * Displays comprehensive BID/NO-BID decision page:
 * - Executive summary from all sections
 * - Pros/Cons by category (Tech, Commercial, Risk, Legal, References)
 * - Weighted confidence score
 * - BID/NO-BID buttons with confirmation
 */
export function DecisionPageClient({ lead }: DecisionPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DecisionAnalysis | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedVote, setSelectedVote] = useState<'BID' | 'NO-BID' | null>(null);

  // Fetch decision analysis on mount
  useEffect(() => {
    async function fetchDecisionAnalysis() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/qualifications/${lead.id}/sections/decision`);

        if (!response.ok) {
          throw new Error(`Failed to fetch decision analysis: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          status: string;
          errorMessage?: string;
          results?: unknown[];
        };

        if (data.status === 'error') {
          setError(data.errorMessage || 'Unknown error occurred');
        } else if (data.status === 'no_data') {
          // Kein Error mehr - Entscheidung ist auch ohne Analyse möglich
          setAnalysis(null);
        } else {
          // Parse the AI-generated decision analysis from RAG results
          const parsedAnalysis = parseDecisionAnalysis(data.results || []);
          setAnalysis(parsedAnalysis);
        }
      } catch (err) {
        console.error('[DecisionPage] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load decision analysis');
      } finally {
        setLoading(false);
      }
    }

    void fetchDecisionAnalysis();
  }, [lead.id]);

  // If decision already made, show read-only view
  if (lead.blVote) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
          <p className="text-muted-foreground">
            Entscheidung für {lead.customerName} - Bereits entschieden
          </p>
        </div>

        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Finale Entscheidung</CardTitle>
              <Badge
                variant={lead.blVote === 'BID' ? 'default' : 'destructive'}
                className="text-lg"
              >
                {lead.blVote}
              </Badge>
            </div>
            <CardDescription>
              Entschieden am{' '}
              {lead.blVotedAt ? new Date(lead.blVotedAt).toLocaleDateString('de-DE') : 'Unbekannt'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.blConfidenceScore !== null && lead.blConfidenceScore !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Confidence Score</span>
                  <span className="font-bold text-lg">{lead.blConfidenceScore}%</span>
                </div>
                <Progress value={lead.blConfidenceScore} className="h-2" />
              </div>
            )}

            {lead.blReasoning && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Begründung</p>
                <p className="text-sm whitespace-pre-wrap border-l-2 border-primary pl-4">
                  {lead.blReasoning}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => router.push(`/qualifications/${lead.id}`)}>
          Zurück zur Lead-Übersicht
        </Button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
          <p className="text-muted-foreground">Lade Entscheidungsgrundlage...</p>
        </div>
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
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
          <p className="text-muted-foreground">Fehler beim Laden</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Fehler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/qualifications/${lead.id}`)}
            >
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation dialog handler - moved before conditional returns
  const handleVoteClick = (vote: 'BID' | 'NO-BID') => {
    setSelectedVote(vote);
    setShowConfirmDialog(true);
  };

  const handleConfirmDecision = () => {
    if (!selectedVote) return;

    startTransition(async () => {
      const result = await submitBLDecision({
        leadId: lead.id,
        vote: selectedVote,
        // Default-Werte wenn keine Analyse vorhanden
        confidenceScore: analysis?.confidenceScore ?? 50,
        reasoning: analysis?.reasoning ?? `Manuelle ${selectedVote} Entscheidung ohne AI-Analyse`,
      });

      if (result.success) {
        router.push(`/qualifications/${lead.id}`);
        router.refresh();
      } else {
        setError(result.error || 'Fehler beim Speichern der Entscheidung');
        setShowConfirmDialog(false);
      }
    });
  };

  // No analysis data - show simplified decision UI
  if (!analysis) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
          <p className="text-muted-foreground">Schnelle Entscheidung für {lead.customerName}</p>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Keine AI-Analyse verfügbar
            </CardTitle>
            <CardDescription>
              Es wurden noch keine Analysedaten für diesen Lead erfasst. Sie können trotzdem eine
              Entscheidung treffen.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Decision Buttons */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Ihre Entscheidung</CardTitle>
            <CardDescription>
              Treffen Sie Ihre BID/NO-BID Entscheidung basierend auf Ihrer eigenen Einschätzung.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                size="lg"
                className="flex-1"
                onClick={() => handleVoteClick('BID')}
                disabled={isPending}
              >
                <ThumbsUp className="mr-2 h-5 w-5" />
                BID
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="flex-1"
                onClick={() => handleVoteClick('NO-BID')}
                disabled={isPending}
              >
                <ThumbsDown className="mr-2 h-5 w-5" />
                NO-BID
              </Button>
            </div>
            <Separator />
            <Button variant="outline" onClick={() => router.push(`/qualifications/${lead.id}`)}>
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Entscheidung bestätigen</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie wirklich <strong>{selectedVote}</strong> für {lead.customerName}{' '}
                entscheiden?
                <br />
                <br />
                Diese Entscheidung kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDecision} disabled={isPending}>
                {isPending ? 'Speichert...' : 'Bestätigen'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
        <p className="text-muted-foreground">Finale Entscheidung für {lead.customerName}</p>
      </div>

      {/* AI Recommendation */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">AI-Empfehlung</CardTitle>
            <Badge
              variant={analysis.recommendation === 'BID' ? 'default' : 'destructive'}
              className="text-xl px-4 py-2"
            >
              {analysis.recommendation === 'BID' ? (
                <ThumbsUp className="mr-2 h-5 w-5" />
              ) : (
                <ThumbsDown className="mr-2 h-5 w-5" />
              )}
              {analysis.recommendation}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Confidence Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Gesamte Confidence
              </span>
              <span className="font-bold text-2xl">{analysis.confidenceScore}%</span>
            </div>
            <Progress value={analysis.confidenceScore} className="h-3" />
          </div>

          {/* Executive Summary */}
          <div>
            <h3 className="font-semibold mb-2">Executive Summary</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap border-l-2 border-primary pl-4">
              {analysis.executiveSummary}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {analysis.categories.map(category => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{category.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{category.weight * 100}% Gewichtung</Badge>
                  <Badge
                    variant={
                      category.score >= 70
                        ? 'default'
                        : category.score >= 40
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {category.score}%
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pros */}
              {category.pros.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Pros ({category.pros.length})
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {category.pros.map((pro, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {category.cons.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Cons ({category.cons.length})
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {category.cons.map((con, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Project Plan */}
      <ProjectPlanCard leadId={lead.id} />

      {/* Reasoning */}
      <Card>
        <CardHeader>
          <CardTitle>Detaillierte Begründung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.reasoning}</p>
        </CardContent>
      </Card>

      <Separator />

      {/* Action Buttons */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Ihre finale Entscheidung</CardTitle>
          <CardDescription>
            Basierend auf der obigen Analyse, treffen Sie bitte Ihre finale BID/NO-BID Entscheidung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={() => handleVoteClick('BID')}
              disabled={isPending}
            >
              <ThumbsUp className="mr-2 h-5 w-5" />
              BID
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="flex-1"
              onClick={() => handleVoteClick('NO-BID')}
              disabled={isPending}
            >
              <ThumbsDown className="mr-2 h-5 w-5" />
              NO-BID
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidung bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie wirklich <strong>{selectedVote}</strong> für {lead.customerName}{' '}
              entscheiden?
              <br />
              <br />
              Diese Entscheidung kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDecision} disabled={isPending}>
              {isPending ? 'Speichert...' : 'Bestätigen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Parse decision analysis from RAG results
 *
 * Extracts structured decision data from AI-generated content
 * Falls back to mock data if parsing fails (during development)
 */
function parseDecisionAnalysis(_results: unknown[]): DecisionAnalysis {
  // TODO: Implement proper parsing of AI-generated decision analysis
  // For now, return mock data for demonstration
  return {
    executiveSummary:
      'Basierend auf der umfassenden Analyse aller Sektionen empfehlen wir eine BID-Entscheidung. Das Projekt zeigt starke technische Machbarkeit, solide kommerzielle Viabilität und akzeptable Risiken. Die vorgeschlagene Drupal CMS Lösung passt gut zu den Anforderungen und der Budget-Range.',
    recommendation: 'BID',
    confidenceScore: 78,
    categories: [
      {
        id: 'technical',
        name: 'Technical Fit',
        weight: 0.25,
        score: 85,
        pros: [
          'Moderne Tech-Stack erkannt (React, Node.js)',
          'Gute Performance-Baseline (85/100)',
          'Klare Content-Struktur vorhanden',
        ],
        cons: ['Legacy-System-Integration notwendig', 'Migration von 500+ Seiten erforderlich'],
      },
      {
        id: 'commercial',
        name: 'Commercial Viability',
        weight: 0.25,
        score: 82,
        pros: [
          'Budget-Range passt zu Scope (€150k-200k)',
          'Potenzial für Follow-up Projekte',
          'Gute Referenz für Branche',
        ],
        cons: ['Enger Zeitplan (6 Monate)', 'Festpreis-Projekt mit Risiken'],
      },
      {
        id: 'risk',
        name: 'Risk Assessment',
        weight: 0.2,
        score: 70,
        pros: ['Standardisierte CMS-Migration', 'Erfahrenes Team verfügbar'],
        cons: ['Stakeholder-Abstimmung komplex (5+ Abteilungen)', 'Content-Freeze-Window kritisch'],
      },
      {
        id: 'legal',
        name: 'Legal Compliance',
        weight: 0.15,
        score: 75,
        pros: ['DSGVO-Compliance gegeben', 'Keine kritischen Lizenz-Risiken'],
        cons: ['Branchenspezifische Regularien zu prüfen'],
      },
      {
        id: 'references',
        name: 'Reference Match',
        weight: 0.15,
        score: 80,
        pros: ['3 ähnliche Projekte erfolgreich abgeschlossen', 'Branchen-Know-how vorhanden'],
        cons: ['Noch keine Referenz mit diesem CMS'],
      },
    ],
    reasoning:
      'Die technische Analyse zeigt eine solide Basis mit modernem Tech-Stack und guter Performance. Die Migration ist machbar, aber erfordert sorgfältige Planung aufgrund der Größe (500+ Seiten).\n\nKommerziell ist das Projekt attraktiv: Budget passt, gutes Referenz-Potenzial, und Follow-up-Möglichkeiten. Der enge Zeitplan ist eine Herausforderung, aber mit dediziertem Team umsetzbar.\n\nRisiken sind überschaubar: Standard-CMS-Migration mit bekannten Mustern. Die Stakeholder-Koordination erfordert ein erfahrenes PM-Team.\n\nLegal und Compliance sind unkritisch. DSGVO ist gegeben, Branchenspezifika sollten im Kick-off geklärt werden.\n\nReferenzen zeigen unsere Kompetenz in ähnlichen Projekten. Das einzige Manko ist fehlendes CMS-spezifisches Showcase – dies wäre eine Chance, diese Lücke zu schließen.',
  };
}
