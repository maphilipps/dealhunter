import {
  LayoutDashboard,
  Clock,
  FileText,
  DollarSign,
  Scale,
  Package,
  Award,
  Trophy,
  GitBranch,
  Grid3X3,
  CheckCircle2,
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

const QUALIFICATION_RUNNING_STATUSES = new Set([
  'processing',
  'extracting',
  'duplicate_checking',
  'quick_scanning',
  'timeline_estimating',
  'evaluating',
]);

export function isQualificationRunning(status?: string | null): boolean {
  if (!status) return false;
  return QUALIFICATION_RUNNING_STATUSES.has(status);
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

export function getPreQualificationNavigationSections(
  preQualificationId: string
): NavigationSection[] {
  return [
    {
      label: 'Overview',
      items: [
        {
          title: 'Übersicht',
          icon: LayoutDashboard,
          url: `/pre-qualifications/${preQualificationId}`,
          alwaysEnabled: true, // Overview is always accessible
        },
      ],
    },
    {
      label: 'Ausschreibung',
      items: [
        {
          title: 'Budget',
          icon: DollarSign,
          url: `/pre-qualifications/${preQualificationId}/budget`,
          alwaysEnabled: true,
        },
        {
          title: 'Zeitplan / Verfahren',
          icon: Clock,
          url: `/pre-qualifications/${preQualificationId}/timing`,
          alwaysEnabled: true,
        },
        {
          title: 'Verträge',
          icon: Scale,
          url: `/pre-qualifications/${preQualificationId}/contracts`,
          alwaysEnabled: true,
        },
        {
          title: 'Leistungsumfang',
          icon: Package,
          url: `/pre-qualifications/${preQualificationId}/deliverables`,
          alwaysEnabled: true,
        },
        {
          title: 'Referenzen',
          icon: Trophy,
          url: `/pre-qualifications/${preQualificationId}/references`,
          alwaysEnabled: true,
        },
        {
          title: 'Zuschlagskriterien',
          icon: Award,
          url: `/pre-qualifications/${preQualificationId}/award-criteria`,
          alwaysEnabled: true,
        },
      ],
    },
    {
      label: 'Analyse',
      items: [
        {
          title: 'CMS Matrix',
          icon: Grid3X3,
          url: `/pre-qualifications/${preQualificationId}/routing/cms-matrix`,
          alwaysEnabled: true,
        },
      ],
    },
    {
      label: 'Entscheidung',
      items: [
        {
          title: 'BID / NO-BID',
          icon: CheckCircle2,
          url: `/pre-qualifications/${preQualificationId}/routing`,
          alwaysEnabled: true, // Decision is ALWAYS accessible
        },
      ],
    },
  ];
}
