'use client';

import { Loader2 } from 'lucide-react';
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
  getPreQualificationNavigationSections,
  isQualificationRunning,
  isNavigationItemEnabled,
  type QuickScanDataAvailability,
} from '@/lib/pre-qualifications/navigation';

interface PreQualificationSidebarRightProps {
  preQualificationId: string;
  title?: string;
  customerName?: string | null;
  status: string;
  dataAvailability: QuickScanDataAvailability;
}

export function PreQualificationSidebarRight({
  preQualificationId,
  title,
  customerName,
  status,
  dataAvailability,
}: PreQualificationSidebarRightProps) {
  const pathname = usePathname();
  const navigationSections = getPreQualificationNavigationSections(preQualificationId);
  const qualificationRunning = isQualificationRunning(status);

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" variant="sidebar" side="right" className="hidden md:flex">
        <SidebarContent>
          {/* Pre-Qualification Metadata */}
          <SidebarGroup>
            <SidebarGroupLabel>Lead Details</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-1 space-y-1">
                {title && <p className="text-sm font-medium break-words">{title}</p>}
                {customerName && (
                  <p className="text-xs text-muted-foreground break-words">{customerName}</p>
                )}
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
                    const isOverview = item.url === `/pre-qualifications/${preQualificationId}`;
                    const isEnabled =
                      !qualificationRunning || isOverview
                        ? isNavigationItemEnabled(item, dataAvailability)
                        : false;
                    const Icon = qualificationRunning && !isOverview ? Loader2 : item.icon;

                    if (isEnabled) {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={item.url}>
                              <Icon
                                className={`h-4 w-4${Icon === Loader2 ? ' animate-spin' : ''}`}
                              />
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
                              <Icon
                                className={`h-4 w-4${Icon === Loader2 ? ' animate-spin' : ''}`}
                              />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>
                              {qualificationRunning
                                ? 'Qualification läuft – bitte warten'
                                : 'Qualification Daten fehlen'}
                            </p>
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
