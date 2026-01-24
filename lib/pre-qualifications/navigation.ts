import {
  LayoutDashboard,
  Clock,
  FileText,
  Trophy,
  Scale,
  Code,
  Info,
  Users,
  GitBranch,
  Grid3X3,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  icon: LucideIcon;
  url: string;
  /** Field in quickScan that must be present for this item to be enabled */
  requiredField?: keyof QuickScanDataAvailability;
  /** Whether this item is always enabled regardless of data availability */
  alwaysEnabled?: boolean;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

/**
 * Data availability flags from QuickScan
 * Used to determine which navigation items should be enabled
 */
export interface QuickScanDataAvailability {
  hasQuickScan: boolean;
  hasTimeline: boolean;
  hasTechStack: boolean;
  hasContentVolume: boolean;
  hasDecisionMakers: boolean;
  hasDeliverables: boolean;
  hasTenQuestions: boolean;
  hasRecommendation: boolean;
}

/**
 * Extract data availability from a quickScan object
 */
export function getQuickScanDataAvailability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quickScan: any
): QuickScanDataAvailability {
  if (!quickScan) {
    return {
      hasQuickScan: false,
      hasTimeline: false,
      hasTechStack: false,
      hasContentVolume: false,
      hasDecisionMakers: false,
      hasDeliverables: false,
      hasTenQuestions: false,
      hasRecommendation: false,
    };
  }

  return {
    hasQuickScan: true,
    hasTimeline: !!quickScan.timeline,
    hasTechStack: !!quickScan.techStack,
    hasContentVolume: !!quickScan.contentVolume,
    hasDecisionMakers: !!quickScan.decisionMakers,
    hasDeliverables: !!quickScan.deliverables,
    hasTenQuestions: !!quickScan.tenQuestions,
    hasRecommendation: !!quickScan.recommendedBusinessUnit,
  };
}

/**
 * Check if a navigation item is enabled based on data availability
 */
export function isNavigationItemEnabled(
  item: NavigationItem,
  dataAvailability: QuickScanDataAvailability
): boolean {
  // Always enabled items don't need data
  if (item.alwaysEnabled) return true;

  // If no required field specified, check if quickScan exists
  if (!item.requiredField) {
    return dataAvailability.hasQuickScan;
  }

  // Check specific field availability
  return dataAvailability[item.requiredField] === true;
}

export function getRfpNavigationSections(rfpId: string): NavigationSection[] {
  return [
    {
      label: 'Overview',
      items: [
        {
          title: 'Übersicht',
          icon: LayoutDashboard,
          url: `/pre-qualifications/${rfpId}`,
          alwaysEnabled: true, // Overview is always accessible
        },
      ],
    },
    {
      label: 'Details',
      items: [
        {
          title: 'Timing',
          icon: Clock,
          url: `/pre-qualifications/${rfpId}/timing`,
        },
        {
          title: 'Deliverables',
          icon: FileText,
          url: `/pre-qualifications/${rfpId}/deliverables`,
        },
        {
          title: 'Referenzen',
          icon: Trophy,
          url: `/pre-qualifications/${rfpId}/references`,
          alwaysEnabled: true, // References may come from RFP extraction, not quickScan
        },
        {
          title: 'Legal',
          icon: Scale,
          url: `/pre-qualifications/${rfpId}/legal`,
          alwaysEnabled: true, // Legal may come from RFP extraction, not quickScan
        },
      ],
    },
    {
      label: 'Analysis',
      items: [
        {
          title: 'Tech Stack',
          icon: Code,
          url: `/pre-qualifications/${rfpId}/tech`,
        },
        {
          title: 'Facts',
          icon: Info,
          url: `/pre-qualifications/${rfpId}/facts`,
        },
        {
          title: 'Kontakte',
          icon: Users,
          url: `/pre-qualifications/${rfpId}/contacts`,
        },
      ],
    },
    {
      label: 'Routing',
      items: [
        {
          title: 'BL Routing',
          icon: GitBranch,
          url: `/pre-qualifications/${rfpId}/routing`,
          alwaysEnabled: true, // Routing is ALWAYS accessible (manual routing)
        },
        {
          title: 'CMS Matrix',
          icon: Grid3X3,
          url: `/pre-qualifications/${rfpId}/routing/cms-matrix`,
          alwaysEnabled: true,
        },
      ],
    },
  ];
}
