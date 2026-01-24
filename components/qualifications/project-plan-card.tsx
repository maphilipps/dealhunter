'use client';

import { Calendar, Clock, DollarSign, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectPlanCardProps {
  leadId: string;
}

interface PhaseData {
  phase: string;
  hours: number;
  cost: number;
  percentage: number;
}

interface ProjectPlanData {
  totalHours: number;
  totalPT: number;
  totalCost: number;
  costBreakdown: PhaseData[];
  roi?: {
    paybackPeriod: string;
    mainBenefits: string[];
  };
  assumptions: string[];
}

/**
 * Project Plan Card
 *
 * Displays project timeline, phases, and resource allocation
 * Data sourced from Costs Agent analysis
 */
export function ProjectPlanCard({ leadId }: ProjectPlanCardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProjectPlanData | null>(null);

  useEffect(() => {
    async function fetchProjectPlan() {
      setLoading(true);
      try {
        const response = await fetch(`/api/qualifications/${leadId}/sections/costs`);

        if (!response.ok) {
          setData(null);
          return;
        }

        const result = (await response.json()) as {
          status: string;
          results?: Array<{ content?: string }>;
        };

        if (result.status === 'success' && result.results?.[0]?.content) {
          // Parse the content - it may be JSON or text
          const content = result.results[0].content;
          try {
            // Try to extract structured data from content
            const parsed = extractProjectData(content);
            setData(parsed);
          } catch {
            setData(null);
          }
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void fetchProjectPlan();
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Projektplan
          </CardTitle>
          <CardDescription>Projektplanung basierend auf Kostenanalyse</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Projektplandaten verfügbar. Führen Sie zuerst den Deep Scan durch.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate project duration estimate (assuming 8h/day, 80% capacity)
  const effectiveHoursPerDay = 8 * 0.8;
  const estimatedDays = Math.ceil(data.totalHours / effectiveHoursPerDay);
  const estimatedWeeks = Math.ceil(estimatedDays / 5);
  const estimatedMonths = Math.ceil(estimatedWeeks / 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Projektplan
        </CardTitle>
        <CardDescription>Projektplanung basierend auf Kostenanalyse</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{data.totalPT}</div>
            <div className="text-xs text-muted-foreground">Personentage</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">~{estimatedMonths}</div>
            <div className="text-xs text-muted-foreground">Monate Laufzeit</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{(data.totalCost / 1000).toFixed(0)}k€</div>
            <div className="text-xs text-muted-foreground">Gesamtkosten</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">
              {Math.ceil(data.totalPT / (estimatedWeeks * 5))}
            </div>
            <div className="text-xs text-muted-foreground">Team FTE</div>
          </div>
        </div>

        {/* Phase Timeline */}
        <div>
          <h4 className="font-semibold mb-3">Projektphasen</h4>
          <div className="space-y-3">
            {data.costBreakdown.map((phase, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{phase.phase}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{phase.hours}h</Badge>
                    <span className="text-muted-foreground w-16 text-right">
                      {phase.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <Progress value={phase.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Visual Timeline (Gantt-style) */}
        <div>
          <h4 className="font-semibold mb-3">Timeline-Übersicht</h4>
          <div className="relative">
            {/* Timeline header */}
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Projektstart</span>
              <span>~{estimatedWeeks} Wochen</span>
              <span>Go-Live</span>
            </div>
            {/* Timeline bars */}
            <div className="space-y-1 border rounded-lg p-2 bg-muted/30">
              {data.costBreakdown.map((phase, index) => {
                // Calculate visual position based on cumulative percentage
                const cumulativeStart = data.costBreakdown
                  .slice(0, index)
                  .reduce((sum, p) => sum + p.percentage, 0);

                return (
                  <div key={index} className="flex items-center gap-2 h-6">
                    <span className="text-xs w-32 truncate">{phase.phase}</span>
                    <div className="flex-1 relative h-4">
                      <div
                        className="absolute h-full rounded-sm bg-primary/80"
                        style={{
                          left: `${cumulativeStart}%`,
                          width: `${phase.percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ROI */}
        {data.roi && (
          <div>
            <h4 className="font-semibold mb-2">ROI & Benefits</h4>
            <div className="text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Payback Period:</span>{' '}
                <span className="font-medium">{data.roi.paybackPeriod}</span>
              </p>
              {data.roi.mainBenefits.length > 0 && (
                <ul className="list-disc list-inside text-muted-foreground">
                  {data.roi.mainBenefits.slice(0, 3).map((benefit, idx) => (
                    <li key={idx}>{benefit}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Extract project data from costs analysis content
 */
function extractProjectData(content: string): ProjectPlanData | null {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(content) as ProjectPlanData;
    if (parsed.totalHours && parsed.costBreakdown) {
      return parsed;
    }
  } catch {
    // Not JSON, try text parsing
  }

  // Text parsing fallback - extract numbers from formatted text
  const totalHoursMatch = content.match(/Total Hours?:\s*(\d+)/i);
  const totalCostMatch = content.match(/Total Cost?:\s*[\d.,]+|(\d+).*€/i);
  const totalPTMatch = content.match(/(\d+)\s*PT/i);

  if (totalHoursMatch) {
    const totalHours = parseInt(totalHoursMatch[1], 10);
    const totalPT = totalPTMatch ? parseInt(totalPTMatch[1], 10) : Math.round(totalHours / 8);
    const totalCost = totalCostMatch
      ? parseInt(totalCostMatch[1]?.replace(/[.,]/g, '') || '0', 10)
      : totalHours * 120;

    // Default phases if not found in text
    return {
      totalHours,
      totalPT,
      totalCost,
      costBreakdown: [
        { phase: 'Foundation Setup', hours: totalHours * 0.3, cost: 0, percentage: 30 },
        { phase: 'Custom Development', hours: totalHours * 0.35, cost: 0, percentage: 35 },
        { phase: 'Integrations', hours: totalHours * 0.1, cost: 0, percentage: 10 },
        { phase: 'Content Migration', hours: totalHours * 0.15, cost: 0, percentage: 15 },
        { phase: 'Testing & QA', hours: totalHours * 0.1, cost: 0, percentage: 10 },
      ],
      assumptions: [],
    };
  }

  return null;
}
