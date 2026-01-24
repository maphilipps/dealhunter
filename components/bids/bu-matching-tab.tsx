'use client';

import { Loader2, TrendingUp, FileText, Building2, Tags, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { BUMatchResult } from '@/lib/business-units/matching';
import type { QuickScan } from '@/lib/db/schema';

interface BUMatchingTabProps {
  quickScan: QuickScan;
  bidId: string;
}

/**
 * BU Matching Tab
 * - Zeigt detaillierten Vergleich aller Business Units
 * - Multi-Kriterien Match mit Prozentsätzen
 * - Visualisierung mit Progress Bars
 */
export function BUMatchingTab({ quickScan, bidId }: BUMatchingTabProps) {
  const [matches, setMatches] = useState<BUMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatches() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/pre-qualifications/${bidId}/bu-matching`);

        if (!response.ok) {
          throw new Error('Fehler beim Laden der BU Matches');
        }

        const data = await response.json();
        setMatches(data.matches || []);
      } catch (err) {
        console.error('Error loading BU matches:', err);
        setError('BU Matching konnte nicht geladen werden');
      } finally {
        setIsLoading(false);
      }
    }

    void loadMatches();
  }, [bidId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Berechne Business Unit Matching...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6">
          <p className="text-sm text-red-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">Keine Business Units gefunden</p>
        </CardContent>
      </Card>
    );
  }

  // Top match
  const topMatch = matches[0];

  return (
    <div className="space-y-6">
      {/* Top Match Highlight */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-900">Top Match</CardTitle>
            </div>
            <Badge variant="default" className="bg-green-600 text-white">
              {Math.round(topMatch.totalScore)}% Match
            </Badge>
          </div>
          <CardDescription className="text-green-700">{topMatch.businessUnit.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-green-800">{topMatch.reasoning}</p>

          {/* Criteria Breakdown */}
          <div className="space-y-3 pt-4 border-t border-green-200">
            <CriteriaRow
              icon={<Zap className="h-4 w-4" />}
              label="Tech Stack"
              score={topMatch.criteria.techStackScore}
              color="green"
            />
            <CriteriaRow
              icon={<Tags className="h-4 w-4" />}
              label="Features"
              score={topMatch.criteria.featuresScore}
              color="green"
            />
            <CriteriaRow
              icon={<FileText className="h-4 w-4" />}
              label="Referenzen"
              score={topMatch.criteria.referencesScore}
              color="green"
              detail={`${topMatch.matchedReferences.length} passende Referenzen`}
            />
            <CriteriaRow
              icon={<Building2 className="h-4 w-4" />}
              label="Branche"
              score={topMatch.criteria.industryScore}
              color="green"
            />
            <CriteriaRow
              icon={<Tags className="h-4 w-4" />}
              label="Keywords"
              score={topMatch.criteria.keywordsScore}
              color="green"
            />
          </div>

          {/* Matched Technologies */}
          {topMatch.matchedTechnologies.length > 0 && (
            <div className="pt-4 border-t border-green-200">
              <p className="text-sm font-medium text-green-900 mb-2">Matching Technologien:</p>
              <div className="flex flex-wrap gap-2">
                {topMatch.matchedTechnologies.map((tech, idx) => (
                  <Badge key={idx} variant="outline" className="border-green-300 text-green-700">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Matches */}
      <Card>
        <CardHeader>
          <CardTitle>Alle Business Units</CardTitle>
          <CardDescription>
            Vollständiger Vergleich aller {matches.length} Business Units
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {matches.map((match, idx) => (
            <BUMatchCard key={match.businessUnit.id} match={match} rank={idx + 1} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Criteria Row Component
 */
function CriteriaRow({
  icon,
  label,
  score,
  color,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  color: 'green' | 'blue' | 'gray';
  detail?: string;
}) {
  const colorClasses = {
    green: 'text-green-700',
    blue: 'text-blue-700',
    gray: 'text-gray-700',
  };

  const progressColorClasses = {
    green: '[&>div]:bg-green-600',
    blue: '[&>div]:bg-blue-600',
    gray: '[&>div]:bg-gray-600',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className={`flex items-center gap-2 ${colorClasses[color]}`}>
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-medium ${colorClasses[color]}`}>{Math.round(score)}%</span>
      </div>
      <Progress value={score} className={progressColorClasses[color]} />
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/**
 * BU Match Card Component
 */
function BUMatchCard({ match, rank }: { match: BUMatchResult; rank: number }) {
  const isTopThree = rank <= 3;
  const borderColor = isTopThree ? 'border-blue-200' : 'border-gray-200';
  const bgColor = isTopThree ? 'bg-blue-50/50' : 'bg-gray-50/50';

  return (
    <Card className={`${borderColor} ${bgColor}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">#{rank}</span>
            <div>
              <CardTitle className="text-base">{match.businessUnit.name}</CardTitle>
              <CardDescription className="text-xs">
                {match.businessUnit.leaderName} • {match.businessUnit.leaderEmail}
              </CardDescription>
            </div>
          </div>
          <Badge variant={isTopThree ? 'default' : 'outline'}>
            {Math.round(match.totalScore)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-5 gap-2">
          <CriteriaColumn
            label="Tech"
            score={match.criteria.techStackScore}
            isHighlighted={match.criteria.techStackScore >= 80}
          />
          <CriteriaColumn
            label="Features"
            score={match.criteria.featuresScore}
            isHighlighted={match.criteria.featuresScore >= 80}
          />
          <CriteriaColumn
            label="Refs"
            score={match.criteria.referencesScore}
            isHighlighted={match.criteria.referencesScore >= 80}
          />
          <CriteriaColumn
            label="Industry"
            score={match.criteria.industryScore}
            isHighlighted={match.criteria.industryScore >= 80}
          />
          <CriteriaColumn
            label="Keywords"
            score={match.criteria.keywordsScore}
            isHighlighted={match.criteria.keywordsScore >= 80}
          />
        </div>

        {match.matchedTechnologies.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Matching Tech:</p>
            <div className="flex flex-wrap gap-1">
              {match.matchedTechnologies.slice(0, 3).map((tech, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {match.matchedTechnologies.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{match.matchedTechnologies.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Criteria Column Component (compact)
 */
function CriteriaColumn({
  label,
  score,
  isHighlighted,
}: {
  label: string;
  score: number;
  isHighlighted: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className={`text-sm font-medium ${isHighlighted ? 'text-green-600' : 'text-gray-600'}`}>
        {Math.round(score)}%
      </div>
    </div>
  );
}
