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
} from 'lucide-react';
import { useEffect, useState, useCallback, useMemo } from 'react';

import { BURoutingCard } from './bu-routing-card';
import { ManagementSummaryCard } from './management-summary-card';
import { SectionCard } from './section-card';
import { SectionGroup } from './section-group';

import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { SECTION_BY_ID, OVERVIEW_SECTION_IDS, BID_SECTION_IDS } from '@/lib/dashboard/sections';
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
};

/**
 * Get section URL
 */
function getSectionUrl(preQualificationId: string, sectionId: string): string {
  if (sectionId === 'facts') {
    return `/pre-qualifications/${preQualificationId}`;
  }
  return `/pre-qualifications/${preQualificationId}/${sectionId}`;
}

export interface PreQualificationDashboardProps {
  preQualificationId: string;
  initialSummary?: ManagementSummary | null;
}

/**
 * Pre-Qualification Dashboard Component
 *
 * Displays a structured dashboard with:
 * - Management Summary (top)
 * - Section Groups with Cards (middle)
 * - BU Routing Recommendation (bottom)
 */
export function PreQualificationDashboard({
  preQualificationId,
  initialSummary,
}: PreQualificationDashboardProps) {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/pre-qualifications/${preQualificationId}/dashboard-summary`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const dashboardData = (await response.json()) as DashboardSummaryResponse;
      setData(dashboardData);
    } catch (error) {
      console.error('[Dashboard] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [preQualificationId]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

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

      {/* Overview Group - Facts */}
      <SectionGroup title="Übersicht">
        {OVERVIEW_SECTION_IDS.map(sectionId => {
          const section = sectionsMap.get(sectionId);
          const config = SECTION_BY_ID.get(sectionId);
          return (
            <SectionCard
              key={sectionId}
              title={section?.sectionTitle ?? config?.title ?? sectionId}
              icon={SECTION_ICONS[sectionId] ?? LayoutDashboard}
              href={getSectionUrl(preQualificationId, sectionId)}
              highlights={section?.highlights ?? []}
              status={section?.status ?? 'no_data'}
            />
          );
        })}
      </SectionGroup>

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
