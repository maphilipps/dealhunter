'use client';

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
import { getRfpNavigationSections } from '@/lib/rfps/navigation';

interface RfpSidebarRightProps {
  rfpId: string;
  title?: string;
  status: string;
}

export function RfpSidebarRight({ rfpId, title, status }: RfpSidebarRightProps) {
  const pathname = usePathname();
  const navigationSections = getRfpNavigationSections(rfpId);

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
