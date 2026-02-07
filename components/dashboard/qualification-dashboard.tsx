'use client';

import {
  DollarSign,
  Clock,
  Scale,
  Package,
  Trophy,
  Award,
  FileText,
  LayoutDashboard,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

import { BURoutingCard } from './bu-routing-card';
import { ManagementSummaryCard } from './management-summary-card';
import { SectionCard } from './section-card';
import { SectionGroup } from './section-group';

import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { SECTION_BY_ID, BID_SECTION_IDS } from '@/lib/dashboard/sections';
import type { DashboardSummaryResponse, SectionHighlight } from '@/lib/dashboard/types';

/**
 * Section icons by ID
 */
const SECTION_ICONS: Record<string, typeof DollarSign> = {
  facts: LayoutDashboard,
  budget: DollarSign,
  timing: Clock,
  contracts: Scale,
  deliverables: Package,
  references: Trophy,
  'award-criteria': Award,
  'offer-structure': FileText,
  risks: ShieldAlert,
};

/**
 * Get section URL
 */
function getSectionUrl(preQualificationId: string, sectionId: string): string {
  if (sectionId === 'facts') {
    return `/qualifications/${preQualificationId}`;
  }
  return `/qualifications/${preQualificationId}/${sectionId}`;
}

export interface QualificationDashboardProps {
  preQualificationId: string;
  initialSummary?: ManagementSummary | null;
}

/**
 * Qualification Dashboard Component
 *
 * Displays a structured dashboard with:
 * - Management Summary (top)
 * - Section Groups with Cards (middle)
 * - BU Routing Recommendation (bottom)
 */
export function QualificationDashboard({
  preQualificationId,
  initialSummary,
}: QualificationDashboardProps) {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDashboard() {
      try {
        const response = await fetch(
          `/api/qualifications/${preQualificationId}/dashboard-summary`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const dashboardData = (await response.json()) as DashboardSummaryResponse;
        setData(dashboardData);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[Dashboard] Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchDashboard();
    return () => controller.abort();
  }, [preQualificationId]);

  const sectionsMap = useMemo(() => {
    const map = new Map<string, SectionHighlight>();
    for (const section of data?.sectionHighlights ?? []) {
      map.set(section.sectionId, section);
    }
    return map;
  }, [data?.sectionHighlights]);

  const managementSummary = data?.managementSummary ?? initialSummary ?? null;

  return (
    <div className="space-y-8">
      {/* Management Summary */}
      <ManagementSummaryCard summary={managementSummary} isLoading={isLoading && !initialSummary} />

      {/* Overview Group - Facts removed from dashboard */}

      {/* Ausschreibung Group */}
      <SectionGroup title="Ausschreibung">
        {BID_SECTION_IDS.map(sectionId => {
          const section = sectionsMap.get(sectionId);
          const config = SECTION_BY_ID.get(sectionId);
          return (
            <SectionCard
              key={sectionId}
              title={section?.sectionTitle ?? config?.title ?? sectionId}
              icon={SECTION_ICONS[sectionId] ?? FileText}
              href={getSectionUrl(preQualificationId, sectionId)}
              highlights={section?.highlights ?? []}
              status={section?.status ?? 'no_data'}
            />
          );
        })}
      </SectionGroup>

      {/* BU Routing Recommendation */}
      <BURoutingCard
        preQualificationId={preQualificationId}
        recommendedBusinessUnit={data?.buRouting.recommendedBusinessUnit ?? null}
        confidence={data?.buRouting.confidence ?? null}
        reasoning={data?.buRouting.reasoning ?? null}
      />
    </div>
  );
}
