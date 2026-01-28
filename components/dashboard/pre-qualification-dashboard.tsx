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
import { useEffect, useState, useCallback } from 'react';

import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';

import { BURoutingCard } from './bu-routing-card';
import { ManagementSummaryCard } from './management-summary-card';
import { SectionCard } from './section-card';
import { SectionGroup } from './section-group';

/**
 * Dashboard data types matching the API response
 */
interface SectionHighlight {
  sectionId: string;
  sectionTitle: string;
  highlights: string[];
  confidence?: number;
  status: 'available' | 'pending' | 'no_data';
}

interface BURoutingRecommendation {
  recommendedBusinessUnit: string | null;
  confidence: number | null;
  reasoning: string | null;
}

interface DashboardSummaryResponse {
  managementSummary: ManagementSummary | null;
  sectionHighlights: SectionHighlight[];
  buRouting: BURoutingRecommendation;
  processingStatus: {
    isProcessing: boolean;
    currentStep?: string;
  };
}

/**
 * Section configuration with icons and URLs
 */
const SECTION_CONFIG: Record<
  string,
  { icon: typeof DollarSign; group: 'overview' | 'bid' | 'decision' }
> = {
  facts: { icon: LayoutDashboard, group: 'overview' },
  budget: { icon: DollarSign, group: 'bid' },
  timing: { icon: Clock, group: 'bid' },
  contracts: { icon: Scale, group: 'bid' },
  deliverables: { icon: Package, group: 'bid' },
  references: { icon: Trophy, group: 'bid' },
  'award-criteria': { icon: Award, group: 'bid' },
  'offer-structure': { icon: FileText, group: 'bid' },
};

/**
 * Get section URL
 */
function getSectionUrl(preQualificationId: string, sectionId: string): string {
  // Facts section goes to overview
  if (sectionId === 'facts') {
    return `/pre-qualifications/${preQualificationId}`;
  }
  return `/pre-qualifications/${preQualificationId}/${sectionId}`;
}

export interface PreQualificationDashboardProps {
  preQualificationId: string;
  /** Initial summary data from server-side rendering */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSummary?: any;
  isProcessing?: boolean;
}

/**
 * Pre-Qualification Dashboard Component
 *
 * Displays a structured dashboard with:
 * - Management Summary (top)
 * - Section Groups with Cards (middle)
 * - BU Routing Recommendation (bottom)
 *
 * Supports progressive loading during processing.
 */
export function PreQualificationDashboard({
  preQualificationId,
  initialSummary,
  isProcessing: initialIsProcessing = false,
}: PreQualificationDashboardProps) {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(initialIsProcessing);

  /**
   * Fetch dashboard data from API
   */
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
      setIsProcessing(dashboardData.processingStatus.isProcessing);
    } catch (error) {
      console.error('[Dashboard] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [preQualificationId]);

  /**
   * Initial fetch and polling during processing
   */
  useEffect(() => {
    void fetchDashboard();

    // Poll while processing
    if (isProcessing) {
      const interval = setInterval(() => {
        void fetchDashboard();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [fetchDashboard, isProcessing]);

  // Build sections map for easy lookup
  const sectionsMap = new Map<string, SectionHighlight>();
  if (data?.sectionHighlights) {
    for (const section of data.sectionHighlights) {
      sectionsMap.set(section.sectionId, section);
    }
  }

  // Group sections
  const overviewSections = ['facts'].filter(id => sectionsMap.has(id) || SECTION_CONFIG[id]);
  const bidSections = [
    'budget',
    'timing',
    'contracts',
    'deliverables',
    'references',
    'award-criteria',
    'offer-structure',
  ];
  const managementSummary = data?.managementSummary || initialSummary;

  return (
    <div className="space-y-8">
      {/* Management Summary */}
      <ManagementSummaryCard summary={managementSummary} isLoading={isLoading && !initialSummary} />

      {/* Overview Group - Facts */}
      {overviewSections.length > 0 && (
        <SectionGroup title="Übersicht">
          {overviewSections.map(sectionId => {
            const section = sectionsMap.get(sectionId);
            const config = SECTION_CONFIG[sectionId];
            return (
              <SectionCard
                key={sectionId}
                title={section?.sectionTitle || 'Key Facts'}
                icon={config?.icon || LayoutDashboard}
                href={getSectionUrl(preQualificationId, sectionId)}
                highlights={section?.highlights || []}
                status={section?.status || (isProcessing ? 'pending' : 'no_data')}
              />
            );
          })}
        </SectionGroup>
      )}

      {/* Ausschreibung Group */}
      <SectionGroup title="Ausschreibung">
        {bidSections.map(sectionId => {
          const section = sectionsMap.get(sectionId);
          const config = SECTION_CONFIG[sectionId];
          const titles: Record<string, string> = {
            budget: 'Budget',
            timing: 'Zeitplan / Verfahren',
            contracts: 'Verträge',
            deliverables: 'Leistungsumfang',
            references: 'Referenzen',
            'award-criteria': 'Zuschlagskriterien',
            'offer-structure': 'Angebotsstruktur',
          };
          return (
            <SectionCard
              key={sectionId}
              title={section?.sectionTitle || titles[sectionId] || sectionId}
              icon={config?.icon || FileText}
              href={getSectionUrl(preQualificationId, sectionId)}
              highlights={section?.highlights || []}
              status={section?.status || (isProcessing ? 'pending' : 'no_data')}
            />
          );
        })}
      </SectionGroup>

      {/* BU Routing Recommendation */}
      <BURoutingCard
        preQualificationId={preQualificationId}
        recommendedBusinessUnit={data?.buRouting.recommendedBusinessUnit || null}
        confidence={data?.buRouting.confidence || null}
        reasoning={data?.buRouting.reasoning || null}
        isProcessing={isProcessing}
      />
    </div>
  );
}
