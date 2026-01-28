'use client';

import { Building2, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface BURoutingCardProps {
  preQualificationId: string;
  recommendedBusinessUnit: string | null;
  confidence: number | null;
  reasoning: string | null;
  isProcessing?: boolean;
  className?: string;
}

/**
 * BU Routing Card Component
 *
 * Displays the recommended Business Unit with confidence score.
 * Shown at the bottom of the dashboard.
 */
export function BURoutingCard({
  preQualificationId,
  recommendedBusinessUnit,
  confidence,
  reasoning,
  isProcessing = false,
  className,
}: BURoutingCardProps) {
  const confidenceLabel =
    confidence !== null && confidence >= 80
      ? 'Hohe Konfidenz'
      : confidence !== null && confidence >= 50
        ? 'Mittlere Konfidenz'
        : 'Niedrige Konfidenz';

  const confidenceVariant =
    confidence !== null && confidence >= 80
      ? 'default'
      : confidence !== null && confidence >= 50
        ? 'secondary'
        : 'outline';

  return (
    <Link href={`/pre-qualifications/${preQualificationId}/routing`} className="block">
      <Card
        className={cn(
          'group transition-colors',
          'cursor-pointer hover:border-primary hover:bg-muted/50',
          className
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">BU-Routing-Empfehlung</CardTitle>
                <CardDescription>Empfohlene Business Unit für diesen Lead</CardDescription>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardHeader>
        <CardContent>
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyse läuft, Empfehlung wird erstellt...</span>
            </div>
          )}

          {!isProcessing && !recommendedBusinessUnit && (
            <p className="text-sm text-muted-foreground">Noch keine Routing-Empfehlung verfügbar</p>
          )}

          {!isProcessing && recommendedBusinessUnit && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{recommendedBusinessUnit}</span>
                <Badge variant={confidenceVariant}>{confidenceLabel}</Badge>
              </div>

              {confidence !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Konfidenz</span>
                    <span className="font-medium">{confidence}%</span>
                  </div>
                  <Progress value={confidence} className="h-2" />
                </div>
              )}

              {reasoning && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{reasoning}</p>
              )}

              <div className="flex items-center gap-1 text-xs font-medium text-primary">
                <span>Zur Routing-Entscheidung</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
