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
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  icon: LucideIcon;
  url: string;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

export function getRfpNavigationSections(rfpId: string): NavigationSection[] {
  return [
    {
      label: 'Overview',
      items: [
        {
          title: 'Übersicht',
          icon: LayoutDashboard,
          url: `/rfps/${rfpId}`,
        },
      ],
    },
    {
      label: 'Details',
      items: [
        {
          title: 'Timing',
          icon: Clock,
          url: `/rfps/${rfpId}/timing`,
        },
        {
          title: 'Deliverables',
          icon: FileText,
          url: `/rfps/${rfpId}/deliverables`,
        },
        {
          title: 'Referenzen',
          icon: Trophy,
          url: `/rfps/${rfpId}/references`,
        },
        {
          title: 'Legal',
          icon: Scale,
          url: `/rfps/${rfpId}/legal`,
        },
      ],
    },
    {
      label: 'Analysis',
      items: [
        {
          title: 'Tech Stack',
          icon: Code,
          url: `/rfps/${rfpId}/tech`,
        },
        {
          title: 'Facts',
          icon: Info,
          url: `/rfps/${rfpId}/facts`,
        },
        {
          title: 'Kontakte',
          icon: Users,
          url: `/rfps/${rfpId}/contacts`,
        },
      ],
    },
    {
      label: 'Routing',
      items: [
        {
          title: 'BL Routing',
          icon: GitBranch,
          url: `/rfps/${rfpId}/routing`,
        },
      ],
    },
  ];
}
