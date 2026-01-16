'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';

interface DecisionCardProps {
  result: BitEvaluationResult;
}

export function DecisionCard({ result }: DecisionCardProps) {
  const isBit = result.decision.decision === 'bit';
  const isLowConfidence = result.decision.overallConfidence < 70;

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
                className={isLowConfidence ? '' : isBit ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}
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

      {/* Critical Blockers (if any) */}
      {result.decision.criticalBlockers.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Kritische Blocker gefunden:</p>
            <ul className="list-disc list-inside space-y-1">
              {result.decision.criticalBlockers.map((blocker, idx) => (
                <li key={idx} className="text-sm">{blocker}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Nächste Schritte</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            {result.decision.nextSteps.map((step, idx) => (
              <li key={idx} className="text-sm">{step}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

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
                    <Badge key={idx} variant="secondary">{partner}</Badge>
                  ))}
                </div>
              </div>
            )}

            {result.alternative.reducedScopeOptions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-900 mb-2">Reduzierter Scope Optionen:</p>
                <ul className="space-y-2">
                  {result.alternative.reducedScopeOptions.map((option, idx) => (
                    <li key={idx} className="text-sm">
                      <Badge variant="outline" className="mr-2">{option.viability}</Badge>
                      {option.scope}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">Vorgeschlagene Kundenkommunikation:</p>
              <p className="text-sm text-amber-800 italic">{result.alternative.customerCommunication}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
