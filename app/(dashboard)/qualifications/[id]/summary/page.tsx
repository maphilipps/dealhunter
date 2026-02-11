'use client';

import {
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Clock,
  Scale,
  Package,
  Trophy,
  Award,
  FileText,
  Upload,
  LayoutDashboard,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BURoutingCard } from '@/components/dashboard/bu-routing-card';
import { ManagementSummaryCard } from '@/components/dashboard/management-summary-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SECTION_BY_ID, BID_SECTION_IDS } from '@/lib/dashboard/sections';
import type { DashboardSummaryResponse, SectionHighlight } from '@/lib/dashboard/types';

const SECTION_ICONS: Record<string, typeof DollarSign> = {
  facts: LayoutDashboard,
  budget: DollarSign,
  timing: Clock,
  contracts: Scale,
  deliverables: Package,
  submission: Upload,
  references: Trophy,
  'award-criteria': Award,
  'offer-structure': FileText,
  risks: ShieldAlert,
};

function getSectionUrl(preQualificationId: string, sectionId: string): string {
  if (sectionId === 'facts') {
    return `/qualifications/${preQualificationId}`;
  }
  return `/qualifications/${preQualificationId}/${sectionId}`;
}

function StatusBadge({ status }: { status: SectionHighlight['status'] }) {
  if (status === 'available') {
    return <Badge variant="default">Verfuegbar</Badge>;
  }
  if (status === 'pending') {
    return <Badge variant="secondary">In Bearbeitung</Badge>;
  }
  return <Badge variant="outline">Keine Daten</Badge>;
}

export default function QualificationSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const [preQualificationId, setPreQualificationId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void params.then(p => setPreQualificationId(p.id));
  }, [params]);

  const fetchDashboard = useCallback(
    async (options?: { signal?: AbortSignal; setLoading?: boolean }) => {
      if (!preQualificationId) return;
      const setLoading = options?.setLoading ?? false;
      if (setLoading) setIsLoading(true);

      try {
        const response = await fetch(
          `/api/qualifications/${preQualificationId}/dashboard-summary`,
          {
            signal: options?.signal,
          }
        );
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const dashboardData = (await response.json()) as DashboardSummaryResponse;
        setData(dashboardData);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[Summary] Fetch error:', error);
      } finally {
        if (setLoading) setIsLoading(false);
      }
    },
    [preQualificationId]
  );

  useEffect(() => {
    if (!preQualificationId) return;
    const controller = new AbortController();
    void fetchDashboard({ signal: controller.signal, setLoading: true });
    return () => controller.abort();
  }, [preQualificationId, fetchDashboard]);

  const sectionsMap = useMemo(() => {
    const map = new Map<string, SectionHighlight>();
    for (const section of data?.sectionHighlights ?? []) {
      map.set(section.sectionId, section);
    }
    return map;
  }, [data?.sectionHighlights]);

  if (!preQualificationId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/qualifications/${preQualificationId}`}>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Button>
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Zusammenfassung</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Qualification — Zusammenfassung</h1>
        {data?.managementSummary?.keyFacts.customer && (
          <p className="mt-1 text-sm text-muted-foreground">
            {data.managementSummary.keyFacts.customer}
          </p>
        )}
      </div>

      {/* Management Summary */}
      <ManagementSummaryCard
        preQualificationId={preQualificationId}
        summary={data?.managementSummary ?? null}
        onRegenerated={() => void fetchDashboard()}
      />

      {/* BU Routing */}
      <BURoutingCard
        preQualificationId={preQualificationId}
        recommendedBusinessUnit={data?.buRouting.recommendedBusinessUnit ?? null}
        confidence={data?.buRouting.confidence ?? null}
        reasoning={data?.buRouting.reasoning ?? null}
      />

      {/* All Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Sektionen</h2>
        <div className="grid gap-4">
          {BID_SECTION_IDS.map(sectionId => {
            const section = sectionsMap.get(sectionId);
            const config = SECTION_BY_ID.get(sectionId);
            const Icon = SECTION_ICONS[sectionId] ?? FileText;
            const title = section?.sectionTitle ?? config?.title ?? sectionId;

            return (
              <Card key={sectionId}>
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{title}</h3>
                      <StatusBadge status={section?.status ?? 'no_data'} />
                    </div>
                    {section?.highlights && section.highlights.length > 0 ? (
                      <ul className="space-y-1">
                        {section.highlights.slice(0, 3).map((highlight, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                            <span className="line-clamp-2">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Keine Highlights verfuegbar
                      </p>
                    )}
                  </div>
                  <Link href={getSectionUrl(preQualificationId, sectionId)}>
                    <Button variant="ghost" size="sm" className="shrink-0 gap-1">
                      Details
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Central Bidder Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Bieterfragen (zentral)</h2>
        <Card>
          <CardContent className="py-4">
            {data?.bidderQuestions && data.bidderQuestions.length > 0 ? (
              <ul className="space-y-3">
                {data.bidderQuestions.map((item, idx) => (
                  <li key={`${item.sectionId}-${idx}`} className="text-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline">{item.sectionTitle}</Badge>
                      <Link href={getSectionUrl(preQualificationId, item.sectionId)}>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          Section öffnen
                        </Button>
                      </Link>
                    </div>
                    <p className="text-muted-foreground">{item.question}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Keine Bieterfragen verfügbar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="border-t pt-4">
        <Link href={`/qualifications/${preQualificationId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurueck zum Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
