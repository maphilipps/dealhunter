'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Competitor } from './types';

interface CompetitorWarningProps {
  competitors: Competitor[];
  winProbability: number;
  className?: string;
}

export function CompetitorWarning({ competitors, winProbability, className }: CompetitorWarningProps) {
  if (!competitors || competitors.length === 0) {
    return (
      <Alert className={className}>
        <TrendingUp className="h-4 w-4 text-green-600" />
        <AlertTitle>Wettbewerbssituation günstig</AlertTitle>
        <AlertDescription>
          Keine starken Wettbewerber identifiziert. Win Probability: {winProbability}%
        </AlertDescription>
      </Alert>
    );
  }

  const strongCompetitors = competitors.filter((c) => c.strength === 'strong');
  const mediumCompetitors = competitors.filter((c) => c.strength === 'medium');
  const weakCompetitors = competitors.filter((c) => c.strength === 'weak');

  const getAlertVariant = () => {
    if (strongCompetitors.length > 0) return 'destructive';
    if (winProbability < 50) return 'destructive';
    return 'default';
  };

  const strengthConfig = {
    strong: {
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
      label: 'Starker Wettbewerber',
    },
    medium: {
      icon: Minus,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
      label: 'Mittlerer Wettbewerber',
    },
    weak: {
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
      label: 'Schwacher Wettbewerber',
    },
  };

  const renderCompetitors = (competitorList: Competitor[], strength: 'strong' | 'medium' | 'weak') => {
    if (competitorList.length === 0) return null;

    const config = strengthConfig[strength];
    const Icon = config.icon;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.color)} />
          <span className="font-semibold text-sm">{config.label}</span>
          <Badge variant="outline" className="text-xs">
            {competitorList.length}
          </Badge>
        </div>
        <div className="space-y-3 ml-6">
          {competitorList.map((competitor, index) => (
            <div key={index} className={cn('p-3 rounded-lg border', config.bgColor)}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="font-semibold">{competitor.name}</h4>
                {competitor.marketShare !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    {competitor.marketShare}% Marktanteil
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {competitor.advantages.length > 0 && (
                  <div>
                    <span className="font-medium text-muted-foreground">Vorteile:</span>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      {competitor.advantages.map((adv, i) => (
                        <li key={i} className="text-muted-foreground">{adv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {competitor.disadvantages && competitor.disadvantages.length > 0 && (
                  <div>
                    <span className="font-medium text-muted-foreground">Nachteile:</span>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      {competitor.disadvantages.map((dis, i) => (
                        <li key={i} className="text-muted-foreground">{dis}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Alert variant={getAlertVariant()} className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Wettbewerb erkannt ({competitors.length})
        <Badge variant="outline" className="text-xs">
          Win Probability: {winProbability}%
        </Badge>
      </AlertTitle>
      <AlertDescription className="space-y-4 mt-3">
        <div>
          <span className="text-sm font-medium">Gewinnwahrscheinlichkeit</span>
          <Progress value={winProbability} className="h-2 mt-2" />
        </div>

        {renderCompetitors(strongCompetitors, 'strong')}
        {renderCompetitors(mediumCompetitors, 'medium')}
        {renderCompetitors(weakCompetitors, 'weak')}
      </AlertDescription>
    </Alert>
  );
}
