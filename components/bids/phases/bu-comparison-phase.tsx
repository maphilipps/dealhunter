'use client';

import {
  BarChart3,
  CheckCircle2,
  Loader2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { QuickScan } from '@/lib/db/schema';

interface BUComparisonPhaseProps {
  quickScan: QuickScan;
  preQualificationId: string;
}

interface BUMatchCriteria {
  techStackScore: number;
  featuresScore: number;
  referencesScore: number;
  industryScore: number;
  keywordsScore: number;
}

interface BUMatch {
  businessUnit: {
    id: string;
    name: string;
    shortName: string;
    color: string;
  };
  totalScore: number;
  criteria: BUMatchCriteria;
  matchedTechnologies: string[];
  matchedReferences: Array<{ id: string; projectName: string }>;
  reasoning: string;
}

const criteriaLabels: Record<keyof BUMatchCriteria, string> = {
  techStackScore: 'Tech Stack',
  featuresScore: 'Features',
  referencesScore: 'Referenzen',
  industryScore: 'Branche',
  keywordsScore: 'Keywords',
};

function ScoreTrend({ score, baseline }: { score: number; baseline: number }) {
  const diff = score - baseline;
  if (Math.abs(diff) < 5) {
    return <Minus className="h-4 w-4 text-slate-400" />;
  }
  if (diff > 0) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}

export function BUComparisonPhase({ quickScan, preQualificationId }: BUComparisonPhaseProps) {
  const [buMatches, setBuMatches] = useState<BUMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBU, setSelectedBU] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBUMatches() {
      try {
        const res = await fetch(`/api/pre-qualifications/${preQualificationId}/bu-matching`);
        if (res.ok) {
          const data = (await res.json()) as { matches?: BUMatch[] };
          setBuMatches(data.matches || []);
        }
      } catch (error) {
        console.error('Error fetching BU matches:', error);
      } finally {
        setLoading(false);
      }
    }
    void fetchBUMatches();
  }, [preQualificationId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Berechne BU-Matches...</p>
        </CardContent>
      </Card>
    );
  }

  if (buMatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Keine Business Units für Vergleich gefunden</p>
        </CardContent>
      </Card>
    );
  }

  const bestMatch = buMatches[0];
  const otherMatches = buMatches.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <CardTitle>Business Unit Vergleich</CardTitle>
          </div>
          <CardDescription>
            Detaillierter Vergleich aller Business Units mit Begründung
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Best Match - Highlighted */}
      <Card className="border-2 border-green-500 bg-green-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <CardTitle className="text-green-900">{bestMatch.businessUnit.name}</CardTitle>
                <CardDescription className="text-green-700">Beste Übereinstimmung</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-green-700">
                {Math.round(bestMatch.totalScore)}%
              </div>
              <Badge className="bg-green-600">Empfohlen</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Criteria Breakdown */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {(Object.keys(criteriaLabels) as Array<keyof BUMatchCriteria>).map(key => (
              <div key={key} className="text-center">
                <p className="text-xs text-green-700 mb-2">{criteriaLabels[key]}</p>
                <div className="relative h-24 bg-green-200 rounded-lg overflow-hidden">
                  <div
                    className="absolute bottom-0 w-full bg-green-600 transition-all"
                    style={{ height: `${bestMatch.criteria[key]}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center font-bold text-white">
                    {Math.round(bestMatch.criteria[key])}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Reasoning */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-green-800 mb-2">
              Warum {bestMatch.businessUnit.shortName}?
            </p>
            <p className="text-sm text-green-900">{bestMatch.reasoning}</p>
          </div>

          {/* Matched Technologies */}
          {bestMatch.matchedTechnologies.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-green-700 mb-2">Gematchte Technologien</p>
              <div className="flex flex-wrap gap-1">
                {bestMatch.matchedTechnologies.map(tech => (
                  <Badge key={tech} className="bg-green-100 text-green-800 border-green-300">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => setSelectedBU(bestMatch.businessUnit.id)}
          >
            An {bestMatch.businessUnit.shortName} weiterleiten
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Comparison with other BUs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Warum nicht die anderen?</CardTitle>
          <CardDescription>
            Vergleich mit {bestMatch.businessUnit.shortName} ({Math.round(bestMatch.totalScore)}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {otherMatches.map(match => {
              const scoreDiff = bestMatch.totalScore - match.totalScore;

              return (
                <div
                  key={match.businessUnit.id}
                  className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold">{match.businessUnit.name}</h3>
                        <Badge variant="outline">{match.businessUnit.shortName}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-600">
                        {Math.round(match.totalScore)}%
                      </div>
                      <p className="text-xs text-red-600">
                        -{Math.round(scoreDiff)}% vs. {bestMatch.businessUnit.shortName}
                      </p>
                    </div>
                  </div>

                  {/* Criteria Comparison */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {(Object.keys(criteriaLabels) as Array<keyof BUMatchCriteria>).map(key => {
                      const score = match.criteria[key];
                      const bestScore = bestMatch.criteria[key];

                      return (
                        <div key={key} className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            {criteriaLabels[key]}
                          </p>
                          <div className="flex items-center justify-center gap-1">
                            <Progress value={score} className="h-2 w-12" />
                            <span className="text-xs font-medium">{Math.round(score)}%</span>
                            <ScoreTrend score={score} baseline={bestScore} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Why not this BU */}
                  <div className="text-sm text-muted-foreground bg-white rounded p-2">
                    <strong>Grund:</strong>{' '}
                    {scoreDiff > 20
                      ? `Deutlich schlechtere Übereinstimmung bei ${
                          (Object.keys(criteriaLabels) as Array<keyof BUMatchCriteria>)
                            .filter(k => bestMatch.criteria[k] - match.criteria[k] > 15)
                            .map(k => criteriaLabels[k])
                            .join(', ') || 'mehreren Kriterien'
                        }`
                      : scoreDiff > 10
                        ? `Weniger passend bei ${
                            (Object.keys(criteriaLabels) as Array<keyof BUMatchCriteria>)
                              .filter(k => bestMatch.criteria[k] - match.criteria[k] > 10)
                              .map(k => criteriaLabels[k])
                              .join(', ') || 'einigen Kriterien'
                          }`
                        : 'Knapp hinter der Top-Empfehlung, aber nicht optimal'}
                  </div>

                  {/* Alternative selection */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setSelectedBU(match.businessUnit.id)}
                  >
                    Trotzdem an {match.businessUnit.shortName} weiterleiten
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selection Summary */}
      {selectedBU && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-orange-900">Weiterleitung ausgewählt</h3>
                <p className="text-sm text-orange-700">
                  {buMatches.find(m => m.businessUnit.id === selectedBU)?.businessUnit.name}
                </p>
              </div>
              <Button className="bg-orange-600 hover:bg-orange-700">
                Weiter zur Entscheidung
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
