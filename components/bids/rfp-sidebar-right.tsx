'use client';

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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

interface RfpSidebarRightProps {
  rfpId: string;
  title?: string;
  status: string;
}

export function RfpSidebarRight({ rfpId, title, status }: RfpSidebarRightProps) {
  const pathname = usePathname();

  const navigationSections = [
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

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="right" className="hidden md:flex">
      <SidebarContent>
        {/* RFP Metadata */}
        <SidebarGroup>
          <SidebarGroupLabel>RFP Details</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-1">
              {title && <p className="text-sm font-medium truncate">{title}</p>}
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
                {section.items.map(item => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
