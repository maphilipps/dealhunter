'use client';

import { Calendar, Target } from 'lucide-react';

import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ManagementSummaryCardProps {
  summary: ManagementSummary | null;
  isLoading?: boolean;
  className?: string;
}

/**
 * Management Summary Card Component
 *
 * Displays the AI-generated management summary at the top of the dashboard.
 * Read-only, generated at qualification completion.
 */
export function ManagementSummaryCard({
  summary,
  isLoading = false,
  className,
}: ManagementSummaryCardProps) {
  if (isLoading) {
    return <ManagementSummaryCardSkeleton className={className} />;
  }

  if (!summary) {
    return null;
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Management Summary
        </CardTitle>
        <CardDescription className="text-base">{summary.executiveSummary}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Assessment */}
          <div className="space-y-4">
            <h4 className="font-semibold">Bewertung</h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>Fit Score</span>
                  <span className="font-medium">{summary.assessment.fitScore}/10</span>
                </div>
                <Progress value={summary.assessment.fitScore * 10} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>Komplexität</span>
                  <span className="font-medium">{summary.assessment.complexityScore}/10</span>
                </div>
                <Progress value={summary.assessment.complexityScore * 10} className="h-2" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    summary.assessment.recommendation === 'pursue'
                      ? 'default'
                      : summary.assessment.recommendation === 'consider'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {summary.assessment.recommendation === 'pursue' && 'Verfolgen'}
                  {summary.assessment.recommendation === 'consider' && 'Prüfen'}
                  {summary.assessment.recommendation === 'decline' && 'Ablehnen'}
                </Badge>
                <Badge
                  variant={
                    summary.assessment.urgencyLevel === 'critical'
                      ? 'destructive'
                      : summary.assessment.urgencyLevel === 'high'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {summary.assessment.urgencyLevel === 'critical' && 'Kritisch'}
                  {summary.assessment.urgencyLevel === 'high' && 'Hoch'}
                  {summary.assessment.urgencyLevel === 'medium' && 'Mittel'}
                  {summary.assessment.urgencyLevel === 'low' && 'Niedrig'}
                </Badge>
              </div>
              {summary.assessment.reasoning && (
                <p className="text-sm text-muted-foreground">{summary.assessment.reasoning}</p>
              )}
            </div>
          </div>

          {/* Key Facts */}
          <div className="space-y-4">
            <h4 className="font-semibold">Key Facts</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kunde</span>
                <span className="font-medium">{summary.keyFacts.customer}</span>
              </div>
              {summary.keyFacts.industry && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branche</span>
                  <span>{summary.keyFacts.industry}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projekttyp</span>
                <span>{summary.keyFacts.projectType}</span>
              </div>
              {summary.keyFacts.estimatedValue && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geschätzter Wert</span>
                  <span>{summary.keyFacts.estimatedValue}</span>
                </div>
              )}
              {summary.keyFacts.submissionDeadline && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {summary.keyFacts.submissionDeadline}
                    {summary.keyFacts.daysRemaining !== undefined &&
                      summary.keyFacts.daysRemaining !== null && (
                        <Badge variant="outline" className="ml-1">
                          {summary.keyFacts.daysRemaining} Tage
                        </Badge>
                      )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risks & Opportunities */}
        {(summary.topRisks.length > 0 || summary.topOpportunities.length > 0) && (
          <div className="mt-6 grid gap-4 border-t pt-4 md:grid-cols-2">
            {summary.topRisks.length > 0 && (
              <div>
                <h5 className="mb-2 text-sm font-medium text-destructive">Top Risiken</h5>
                <ul className="space-y-1">
                  {summary.topRisks.map((risk, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.topOpportunities.length > 0 && (
              <div>
                <h5 className="mb-2 text-sm font-medium text-green-600 dark:text-green-500">
                  Top Chancen
                </h5>
                <ul className="space-y-1">
                  {summary.topOpportunities.map((opportunity, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-500" />
                      {opportunity}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManagementSummaryCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="mt-2 h-12 w-full" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
