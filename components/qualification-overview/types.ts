import type {
  TechStack,
  AccessibilityAudit,
  SEOAudit,
  PerformanceIndicators,
  ContentVolume,
  NavigationStructure,
  CompanyIntelligence,
} from '@/lib/qualification-scan/schema';

export interface OverviewData {
  companyIntelligence: CompanyIntelligence | null;
  techStack: TechStack | null;
  accessibilityAudit: AccessibilityAudit | null;
  seoAudit: SEOAudit | null;
  performanceIndicators: PerformanceIndicators | null;
  contentVolume: ContentVolume | null;
  navigationStructure: NavigationStructure | null;
}
