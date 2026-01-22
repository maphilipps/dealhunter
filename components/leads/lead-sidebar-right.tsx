import {
  LayoutDashboard,
  Zap,
  Target,
  Globe,
  Database,
  PieChart,
  Users,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface LeadSidebarRightProps {
  leadId: string;
  customerName: string;
  status: string;
}

export function LeadSidebarRight({ leadId, customerName, status }: LeadSidebarRightProps) {
  const navigationSections = [
    {
      label: 'Overview',
      items: [
        {
          title: 'Übersicht',
          icon: LayoutDashboard,
          url: `/leads/${leadId}`,
        },
      ],
    },
    {
      label: 'Analysis',
      items: [
        {
          title: 'Quick Scan',
          icon: Zap,
          url: `/leads/${leadId}/quick-scan`,
        },
        {
          title: 'BID Decision',
          icon: Target,
          url: `/leads/${leadId}/decision`,
        },
        {
          title: 'Website Audit',
          icon: Globe,
          url: `/leads/${leadId}/website-audit`,
        },
      ],
    },
    {
      label: 'Matching & Estimation',
      items: [
        {
          title: 'CMS Matching',
          icon: Database,
          url: `/leads/${leadId}/cms-matching`,
        },
        {
          title: 'Baseline Comparison',
          icon: PieChart,
          url: `/leads/${leadId}/baseline`,
        },
        {
          title: 'PT Estimation',
          icon: Users,
          url: `/leads/${leadId}/estimation`,
        },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        {
          title: 'References',
          icon: Trophy,
          url: `/leads/${leadId}/references`,
        },
        {
          title: 'Risiken & Mitigation',
          icon: AlertTriangle,
          url: `/leads/${leadId}/risks`,
        },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="right">
      <SidebarContent>
        {/* Lead Metadata */}
        <SidebarGroup>
          <SidebarGroupLabel>Lead Details</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-1">
              <p className="text-sm font-medium truncate">{customerName}</p>
              <p className="text-xs text-muted-foreground mt-1">Status: {status}</p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation Sections */}
        {navigationSections.map(section => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
