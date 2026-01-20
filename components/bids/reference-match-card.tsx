'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Building2, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceMatch } from './types';

interface ReferenceMatchCardProps {
  matches: ReferenceMatch[];
  className?: string;
}

export function ReferenceMatchCard({ matches, className }: ReferenceMatchCardProps) {
  if (!matches || matches.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Referenzen
          </CardTitle>
          <CardDescription>Keine passenden Referenzen gefunden</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getMatchVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Referenzen
        </CardTitle>
        <CardDescription>
          {matches.length} passende {matches.length === 1 ? 'Referenz' : 'Referenzen'} gefunden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.map((match, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold">{match.projectName}</h4>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{match.customerName}</span>
                  <span>•</span>
                  <Calendar className="h-3 w-3" />
                  <span>{match.year}</span>
                  {match.teamSize && (
                    <>
                      <span>•</span>
                      <Users className="h-3 w-3" />
                      <span>{match.teamSize} Personen</span>
                    </>
                  )}
                </div>
              </div>
              <Badge variant={getMatchVariant(match.matchScore)} className="shrink-0">
                {match.matchScore}% Match
              </Badge>
            </div>

            <Progress value={match.matchScore} className={cn('h-2 mb-3', getMatchColor(match.matchScore))} />

            {match.summary && (
              <p className="text-sm text-muted-foreground mb-3">{match.summary}</p>
            )}

            <div className="space-y-2">
              {match.matchingCriteria.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Übereinstimmungen:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {match.matchingCriteria.map((criterion, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span>{criterion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {match.technologies.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Technologien:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {match.technologies.map((tech, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
