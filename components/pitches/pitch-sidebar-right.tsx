'use client';

import * as Icons from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { QUALIFICATION_NAVIGATION_SECTIONS } from '@/lib/pitches/navigation-config';
import type { GeneratedNavigation, GeneratedNavSection } from '@/lib/pitch-scan/navigation';
import { cn } from '@/lib/utils';

interface LeadSidebarRightProps {
  leadId: string;
  customerName: string;
  status: string;
  blVote: 'BID' | 'NO-BID' | null;
  pitchScanNavigation?: GeneratedNavigation | null;
  pitchScanIsRunning?: boolean;
}

export function LeadSidebarRight({
  leadId,
  customerName,
  status,
  pitchScanNavigation,
  pitchScanIsRunning = false,
}: LeadSidebarRightProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <Sidebar collapsible="none" variant="sidebar" side="right">
      <SidebarContent>
        {/* Lead Metadata */}
        <SidebarGroup>
          <SidebarGroupLabel>Lead Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-1">
              <p className="text-sm font-medium truncate">{customerName}</p>
              <p className="text-xs text-muted-foreground mt-1">Status: {status}</p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation Sections */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {QUALIFICATION_NAVIGATION_SECTIONS.map(section => {
                const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[
                  section.icon
                ];
                const sectionRoute = `/pitches/${leadId}${section.route ? `/${section.route}` : ''}`;
                const isActive = pathname === sectionRoute;
                const hasSubsections = section.subsections && section.subsections.length > 0;
                const isOpen = openSections.has(section.id);
                const isDecisionSection = section.id === 'decision';

                if (section.id === 'pitch-scan' && pitchScanNavigation) {
                  const overviewRoute = `/pitches/${leadId}/pitch-scan`;
                  const isActive = pathname === overviewRoute;

                  const dynamicSubsections: GeneratedNavSection[] =
                    pitchScanNavigation.sections.filter(s => s.id !== 'ps-overview');

                  return (
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={overviewRoute}>
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                          <span>{section.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {dynamicSubsections.length > 0 && (
                        <SidebarMenuSub>
                          {dynamicSubsections.map(sub => {
                            const route = pitchScanIsRunning
                              ? `/pitches/${leadId}/pitch-scan#section-${sub.id}`
                              : `/pitches/${leadId}/${sub.route}`;
                            const isSubActive = pathname === `/pitches/${leadId}/${sub.route}`;
                            return (
                              <SidebarMenuSubItem key={sub.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isSubActive}
                                  className={cn(!sub.hasContent && 'text-muted-foreground')}
                                >
                                  <Link href={route}>
                                    <span className="truncate">{sub.label}</span>
                                    {!sub.hasContent && (
                                      <span className="ml-auto text-[10px] opacity-70">
                                        pending
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                // Content to render (collapsible, always-expanded, or single item)
                const content =
                  hasSubsections && section.collapsed ? (
                    // Collapsible section (can be toggled)
                    <Collapsible
                      key={section.id}
                      open={isOpen}
                      onOpenChange={() => toggleSection(section.id)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton>
                            {IconComponent && <IconComponent className="h-4 w-4" />}
                            <span>{section.label}</span>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {section.subsections?.map(subsection => {
                              const subsectionRoute = `/pitches/${leadId}/${subsection.route}`;
                              const isSubActive = pathname === subsectionRoute;

                              return (
                                <SidebarMenuSubItem key={subsection.id}>
                                  <SidebarMenuSubButton asChild isActive={isSubActive}>
                                    <Link href={subsectionRoute}>
                                      <span>{subsection.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : hasSubsections && !section.collapsed ? (
                    // Always-expanded section (subsections always visible)
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={sectionRoute}>
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                          <span>{section.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuSub>
                        {section.subsections?.map(subsection => {
                          const subsectionRoute = `/pitches/${leadId}/${subsection.route}`;
                          const isSubActive = pathname === subsectionRoute;

                          return (
                            <SidebarMenuSubItem key={subsection.id}>
                              <SidebarMenuSubButton asChild isActive={isSubActive}>
                                <Link href={subsectionRoute}>
                                  <span>{subsection.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  ) : (
                    // Single item without subsections
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={sectionRoute}>
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                          <span>{section.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );

                // Add separator before Decision section
                if (isDecisionSection) {
                  return (
                    <div key={section.id}>
                      <div className="my-4 border-t border-border" />
                      {content}
                    </div>
                  );
                }

                return content;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
