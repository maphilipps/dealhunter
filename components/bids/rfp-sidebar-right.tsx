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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getRfpNavigationSections,
  isNavigationItemEnabled,
  type QuickScanDataAvailability,
} from '@/lib/rfps/navigation';

interface RfpSidebarRightProps {
  rfpId: string;
  title?: string;
  status: string;
  dataAvailability: QuickScanDataAvailability;
}

export function RfpSidebarRight({ rfpId, title, status, dataAvailability }: RfpSidebarRightProps) {
  const pathname = usePathname();
  const navigationSections = getRfpNavigationSections(rfpId);

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" variant="sidebar" side="right" className="hidden md:flex">
        <SidebarContent>
          {/* RFP Metadata */}
          <SidebarGroup>
            <SidebarGroupLabel>RFP Details</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-1">
                {title && <p className="truncate text-sm font-medium">{title}</p>}
                <p className="text-muted-foreground mt-1 text-xs">Status: {status}</p>
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
                    const isEnabled = isNavigationItemEnabled(item, dataAvailability);

                    if (isEnabled) {
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
                    }

                    // Disabled item with tooltip
                    return (
                      <SidebarMenuItem key={item.title}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton className="cursor-not-allowed opacity-50" disabled>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Quick Scan Daten fehlen</p>
                          </TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
    </TooltipProvider>
  );
}
