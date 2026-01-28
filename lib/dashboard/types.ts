import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';

export interface SectionHighlight {
  sectionId: string;
  sectionTitle: string;
  highlights: string[];
  confidence?: number;
  status: 'available' | 'pending' | 'no_data';
}

export interface BURoutingRecommendation {
  recommendedBusinessUnit: string | null;
  confidence: number | null;
  reasoning: string | null;
}

export interface DashboardSummaryResponse {
  managementSummary: ManagementSummary | null;
  sectionHighlights: SectionHighlight[];
  buRouting: BURoutingRecommendation;
  processingStatus: {
    isProcessing: boolean;
    currentStep?: string;
  };
}
