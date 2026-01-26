'use client';

import {
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  GitBranch,
} from 'lucide-react';
import { useMemo } from 'react';

import { CompetitorWarning } from './competitor-warning';
import { ConfidenceIndicator, ConfidenceBreakdown } from './confidence-indicator';
import { DecisionTree } from './decision-tree';
import { RedFlagAlert } from './red-flag-alert';
import { ReferenceMatchCard } from './reference-match-card';
import type { RedFlag, Competitor, ReferenceMatch } from './types';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';

interface DecisionCardProps {
  result: BitEvaluationResult;
}

export function DecisionCard({ result }: DecisionCardProps) {
  const isBit = result.decision.decision === 'bit';
  const isLowConfidence = result.decision.overallConfidence < 70;

  // Extract red flags from legal and other agents (memoized)
  const redFlags: RedFlag[] = useMemo(() => {
    const flags: RedFlag[] = [];
    // TODO: Re-enable legal red flags once legal agent is implemented
    // if (result.legalAssessment?.fullCheck?.allRedFlags) {
    //   result.legalAssessment.fullCheck.allRedFlags.forEach((flag) => {
    //     if (flag.severity === 'critical' || flag.severity === 'warning') {
    //       flags.push({
    //         category: flag.category,
    //         severity: flag.severity as 'critical' | 'high' | 'medium',
    //         title: flag.category,
    //         description: flag.description,
    //       });
    //     }
    //   });
    // }
    return flags;
  }, []);

  // Extract competitors (memoized)
  const competitors: Competitor[] = useMemo(() => {
    const comps: Competitor[] = [];
    // TODO: Re-enable competition analysis once competition agent is implemented
    // if (result.competitionCheck?.competitiveAnalysis?.knownCompetitors) {
    //   result.competitionCheck.competitiveAnalysis.knownCompetitors.forEach((compName) => {
    //     comps.push({
    //       name: compName,
    //       strength: 'medium', // Would be calculated from competition agent
    //       advantages: [], // Would be populated from competition agent
    //       disadvantages: [], // Would be populated from competition agent
    //     });
    //   });
    // }
    return comps;
  }, []);

  // Extract reference matches (memoized)
  const referenceMatches: ReferenceMatch[] = useMemo(() => {
    const matches: ReferenceMatch[] = [];
    // TODO: Re-enable reference matching once reference agent is implemented
    // if (result.referenceMatch?.similarProjectsAnalysis?.similarProjects) {
    //   result.referenceMatch.similarProjectsAnalysis.similarProjects.forEach((proj) => {
    //     matches.push({
    //       projectName: proj.projectType,
    //       customerName: 'Unknown', // Would be populated from reference agent
    //       year: new Date().getFullYear().toString(),
    //       matchScore: proj.relevanceScore,
    //       matchingCriteria: proj.keyLearnings,
    //       technologies: [], // Would be populated from reference agent
    //       teamSize: 0, // Would be calculated from reference agent
    //       summary: proj.keyLearnings,
    //     });
    //   });
    // }
    return matches;
  }, []);

  // Confidence breakdown (memoized)
  const confidenceBreakdown = useMemo(
    () => [
      { label: 'Capability', confidence: result.capabilityMatch?.confidence || 0, weight: 0.25 },
      { label: 'Deal Quality', confidence: result.dealQuality?.confidence || 0, weight: 0.2 },
      { label: 'Strategic Fit', confidence: result.strategicFit?.confidence || 0, weight: 0.15 },
      { label: 'Competition', confidence: result.competitionCheck?.confidence || 0, weight: 0.15 },
      { label: 'Legal', confidence: result.legalAssessment?.confidence || 0, weight: 0.15 },
      { label: 'References', confidence: result.referenceMatch?.confidence || 0, weight: 0.1 },
    ],
    [
      result.capabilityMatch?.confidence,
      result.dealQuality?.confidence,
      result.strategicFit?.confidence,
      result.competitionCheck?.confidence,
      result.legalAssessment?.confidence,
      result.referenceMatch?.confidence,
    ]
  );

  return (
    <div className="space-y-6">
      {/* Main Decision Card */}
      <Card className={isBit ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isBit ? (
                <ThumbsUp className="h-8 w-8 text-green-600" />
              ) : (
                <ThumbsDown className="h-8 w-8 text-red-600" />
              )}
              <div>
                <CardTitle className={isBit ? 'text-green-900' : 'text-red-900'}>
                  {isBit ? 'BIT' : 'NO BIT'}
                </CardTitle>
                <CardDescription className={isBit ? 'text-green-700' : 'text-red-700'}>
                  Empfohlene Entscheidung
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                variant={isLowConfidence ? 'destructive' : 'secondary'}
                className={
                  isLowConfidence
                    ? ''
                    : isBit
                      ? 'bg-green-100 text-green-900'
                      : 'bg-red-100 text-red-900'
                }
              >
                {result.decision.overallConfidence}% Confidence
              </Badge>
              {isLowConfidence && (
                <span className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Niedrige Konfidenz
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-muted-foreground">Capability</p>
              <p className="text-2xl font-bold">{result.decision.scores.capability}</p>
              <p className="text-xs text-muted-foreground">30% Gewicht</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-muted-foreground">Deal Quality</p>
              <p className="text-2xl font-bold">{result.decision.scores.dealQuality}</p>
              <p className="text-xs text-muted-foreground">25% Gewicht</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-muted-foreground">Strategic Fit</p>
              <p className="text-2xl font-bold">{result.decision.scores.strategicFit}</p>
              <p className="text-xs text-muted-foreground">20% Gewicht</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-muted-foreground">Win Probability</p>
              <p className="text-2xl font-bold">{result.decision.scores.winProbability}</p>
              <p className="text-xs text-muted-foreground">25% Gewicht</p>
            </div>
          </div>

          {/* Overall Score */}
          <div className="rounded-lg bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Gesamt-Score</p>
              <p className="text-4xl font-bold">{result.decision.scores.overall.toFixed(1)}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm font-medium mb-2">Begründung</p>
            <p className="text-sm text-muted-foreground">{result.decision.reasoning}</p>
          </div>
        </CardContent>
      </Card>

      {/* Red Flags Alert (if any) */}
      {redFlags.length > 0 && <RedFlagAlert flags={redFlags} />}

      {/* Confidence Indicator */}
      <ConfidenceIndicator
        confidence={result.decision.overallConfidence}
        label="Gesamt-Confidence"
        showThreshold={true}
        threshold={70}
      />

      {/* Tabbed Views */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">Übersicht</TabsTrigger>
          <TabsTrigger value="tree">
            <GitBranch className="h-4 w-4 mr-2" />
            Entscheidungsbaum
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="competition">Wettbewerb</TabsTrigger>
          <TabsTrigger value="references">Referenzen</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          {/* Strengths & Risks */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.decision.keyStrengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Risks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Key Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.decision.keyRisks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Nächste Schritte</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2">
                {result.decision.nextSteps.map((step, idx) => (
                  <li key={idx} className="text-sm">
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tree">
          {result.coordinatorOutput?.decisionTree ? (
            <DecisionTree tree={result.coordinatorOutput.decisionTree} />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Kein Entscheidungsbaum verfügbar
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <ConfidenceBreakdown breakdown={confidenceBreakdown} />

          {/* Detailed Synthesis from Coordinator */}
          {result.coordinatorOutput?.synthesis && (
            <Card>
              <CardHeader>
                <CardTitle>AI-Synthese</CardTitle>
                <CardDescription>Detaillierte Analyse vom Coordinator Agent</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Executive Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      {result.coordinatorOutput.synthesis.executiveSummary}
                    </p>
                  </div>
                  {result.coordinatorOutput.synthesis.keyStrengths.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Key Strengths</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {result.coordinatorOutput.synthesis.keyStrengths.map((strength, i) => (
                          <li key={i}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.coordinatorOutput.synthesis.keyRisks.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Key Risks</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {result.coordinatorOutput.synthesis.keyRisks.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="competition">
          {competitors.length > 0 ? (
            <CompetitorWarning
              competitors={competitors}
              winProbability={result.decision.scores.winProbability}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Wettbewerber-Daten verfügbar
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="references">
          <ReferenceMatchCard matches={referenceMatches} />
        </TabsContent>
      </Tabs>

      {/* Alternative Recommendation (for NO BIT) */}
      {!isBit && result.alternative && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Alternativer Ansatz</CardTitle>
            <CardDescription className="text-amber-700">
              Empfohlene Alternative zum vollständigen NO BIT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-amber-900 mb-2">Empfehlung:</p>
              <Badge variant="outline" className="bg-amber-100">
                {result.alternative.recommendedAlternative.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-amber-900 mb-2">Begründung:</p>
              <p className="text-sm text-amber-800">{result.alternative.reasoning}</p>
            </div>

            {result.alternative.partnerSuggestions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-900 mb-2">Mögliche Partner:</p>
                <div className="flex flex-wrap gap-2">
                  {result.alternative.partnerSuggestions.map((partner, idx) => (
                    <Badge key={idx} variant="secondary">
                      {partner}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.alternative.reducedScopeOptions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-900 mb-2">
                  Reduzierter Scope Optionen:
                </p>
                <ul className="space-y-2">
                  {result.alternative.reducedScopeOptions.map((option, idx) => (
                    <li key={idx} className="text-sm">
                      <Badge variant="outline" className="mr-2">
                        {option.viability}
                      </Badge>
                      {option.scope}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Vorgeschlagene Kundenkommunikation:
              </p>
              <p className="text-sm text-amber-800 italic">
                {result.alternative.customerCommunication}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
