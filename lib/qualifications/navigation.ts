import {
  LayoutDashboard,
  Clock,
  FileText,
  DollarSign,
  Scale,
  Package,
  Award,
  Trophy,
  Grid3X3,
  Building2,
  CheckCircle2,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  icon: LucideIcon;
  url: string;
  /** Field in qualificationScan that must be present for this item to be enabled */
  requiredField?: keyof QualificationScanDataAvailability;
  /** Whether this item is always enabled regardless of data availability */
  alwaysEnabled?: boolean;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

/**
 * Data availability flags from QualificationScan
 * Used to determine which navigation items should be enabled
 */
export interface QualificationScanDataAvailability {
  hasQualificationScan: boolean;
  hasTimeline: boolean;
  hasTechStack: boolean;
  hasContentVolume: boolean;
  hasDecisionMakers: boolean;
  hasCustomerIntelligence: boolean;
  hasDeliverables: boolean;
  hasTenQuestions: boolean;
  hasRecommendation: boolean;
}

const QUALIFICATION_RUNNING_STATUSES = new Set([
  'processing',
  'extracting',
  'duplicate_checking',
  'qualification_scanning',
  'timeline_estimating',
  'evaluating',
]);

export function isQualificationRunning(status?: string | null): boolean {
  if (!status) return false;
  return QUALIFICATION_RUNNING_STATUSES.has(status);
}

/**
 * Extract data availability from a qualificationScan object
 */
export function getQualificationScanDataAvailability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qualificationScan: any
): QualificationScanDataAvailability {
  if (!qualificationScan) {
    return {
      hasQualificationScan: false,
      hasTimeline: false,
      hasTechStack: false,
      hasContentVolume: false,
      hasDecisionMakers: false,
      hasCustomerIntelligence: false,
      hasDeliverables: false,
      hasTenQuestions: false,
      hasRecommendation: false,
    };
  }

  return {
    hasQualificationScan: true,
    hasTimeline: !!qualificationScan.timeline,
    hasTechStack: !!qualificationScan.techStack,
    hasContentVolume: !!qualificationScan.contentVolume,
    hasDecisionMakers: !!qualificationScan.decisionMakers,
    hasCustomerIntelligence:
      Boolean(qualificationScan.companyIntelligence) ||
      Boolean(qualificationScan.decisionMakers) ||
      Boolean(qualificationScan.techStack),
    hasDeliverables: !!qualificationScan.deliverables,
    hasTenQuestions: !!qualificationScan.tenQuestions,
    hasRecommendation: !!qualificationScan.recommendedBusinessUnit,
  };
}

/**
 * Check if a navigation item is enabled based on data availability
 */
export function isNavigationItemEnabled(
  item: NavigationItem,
  dataAvailability: QualificationScanDataAvailability
): boolean {
  // Always enabled items don't need data
  if (item.alwaysEnabled) return true;

  // If no required field specified, check if qualificationScan exists
  if (!item.requiredField) {
    return dataAvailability.hasQualificationScan;
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
          url: `/qualifications/${preQualificationId}`,
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
          url: `/qualifications/${preQualificationId}/budget`,
          alwaysEnabled: true,
        },
        {
          title: 'Zeitplan / Verfahren',
          icon: Clock,
          url: `/qualifications/${preQualificationId}/timing`,
          alwaysEnabled: true,
        },
        {
          title: 'Verträge',
          icon: Scale,
          url: `/qualifications/${preQualificationId}/contracts`,
          alwaysEnabled: true,
        },
        {
          title: 'Lieferumfang',
          icon: Package,
          url: `/qualifications/${preQualificationId}/deliverables`,
          alwaysEnabled: true,
        },
        {
          title: 'Abgabe',
          icon: FileText,
          url: `/qualifications/${preQualificationId}/submission`,
          alwaysEnabled: true,
        },
        {
          title: 'Referenzen',
          icon: Trophy,
          url: `/qualifications/${preQualificationId}/references`,
          alwaysEnabled: true,
        },
        {
          title: 'Zuschlagskriterien',
          icon: Award,
          url: `/qualifications/${preQualificationId}/award-criteria`,
          alwaysEnabled: true,
        },
        {
          title: 'Angebotsstruktur',
          icon: FileText,
          url: `/qualifications/${preQualificationId}/offer-structure`,
          alwaysEnabled: true,
        },
      ],
    },
    {
      label: 'Analyse',
      items: [
        {
          title: 'Kundenprofil',
          icon: Building2,
          url: `/qualifications/${preQualificationId}/customer`,
          requiredField: 'hasCustomerIntelligence',
        },
        {
          title: 'CMS Matrix',
          icon: Grid3X3,
          url: `/qualifications/${preQualificationId}/routing/cms-matrix`,
          alwaysEnabled: true,
        },
        {
          title: 'Risiken',
          icon: ShieldAlert,
          url: `/qualifications/${preQualificationId}/risks`,
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
          url: `/qualifications/${preQualificationId}/routing`,
          alwaysEnabled: true, // Decision is ALWAYS accessible
        },
      ],
    },
  ];
}
