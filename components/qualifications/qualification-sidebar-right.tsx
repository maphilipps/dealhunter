'use client';

import * as Icons from 'lucide-react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
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
import { useDeepScan, SECTION_TO_EXPERT_MAP, ALL_EXPERTS } from '@/contexts/deep-scan-context';
import { QUALIFICATION_NAVIGATION_SECTIONS } from '@/lib/qualifications/navigation-config';

interface LeadSidebarRightProps {
  leadId: string;
  customerName: string;
  status: string;
  blVote: 'BID' | 'NO-BID' | null;
}

type SectionStatus = 'loading' | 'ready' | 'warning' | 'error' | 'running';

function getStatusBadge(status: SectionStatus | null) {
  // No badge for sections that don't need status
  if (status === null) return null;

  const variants: Record<
    SectionStatus,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      label: string;
      icon?: React.ReactNode;
    }
  > = {
    loading: { variant: 'outline', label: 'Warten' },
    running: {
      variant: 'secondary',
      label: '',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    ready: { variant: 'default', label: 'Bereit' },
    warning: { variant: 'secondary', label: 'Warnung' },
    error: { variant: 'destructive', label: 'Fehler' },
  };

  const config = variants[status];
  return (
    <Badge variant={config.variant} className="ml-auto text-xs flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function LeadSidebarRight({ leadId, customerName, status }: LeadSidebarRightProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));

  // Get DeepScan context for live status updates
  const deepScan = useDeepScan();

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

  // Sections that are always functional (no waiting status)
  const ALWAYS_READY_SECTIONS = ['overview', 'decision', 'rag-data', 'audit'];

  // Get section status from DeepScan context or fallback to static status
  const getSectionStatus = (sectionId: string): SectionStatus | null => {
    // These sections don't wait for anything - they're functional pages
    if (ALWAYS_READY_SECTIONS.includes(sectionId)) return null;

    // Check if this section corresponds to a Deep Scan expert
    const expertName = SECTION_TO_EXPERT_MAP[sectionId];
    if (expertName && deepScan.isStreaming) {
      const expertStatus = deepScan.getExpertStatus(expertName);
      if (expertStatus === 'complete') return 'ready';
      if (expertStatus === 'running') return 'running';
      if (expertStatus === 'error') return 'error';
      return 'loading'; // pending
    }

    // If not streaming, check if expert has completed previously
    if (expertName) {
      const expertStatus = deepScan.getExpertStatus(expertName);
      if (expertStatus === 'complete') return 'ready';
      if (expertStatus === 'error') return 'error';
    }

    // Default: no badge (status unknown/not scanned yet)
    return null;
  };

  // Calculate scan progress for the header
  const scanProgress =
    deepScan.isStreaming && ALL_EXPERTS.length > 0
      ? (deepScan.completedExperts.length / ALL_EXPERTS.length) * 100
      : 0;

  return (
    <Sidebar collapsible="none" variant="sidebar" side="right">
      <SidebarContent>
        {/* Deep Scan Progress Header (only when scanning) */}
        {deepScan.isStreaming && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2 py-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg mx-2">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {deepScan.activeAgent || 'Initialisiere...'}
                  </span>
                </div>
                <Progress value={scanProgress} className="h-1.5" />
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {deepScan.completedExperts.length} / {ALL_EXPERTS.length} Experten abgeschlossen
                </p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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

        {/* Navigation Sections - All 13 sections */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {QUALIFICATION_NAVIGATION_SECTIONS.map(section => {
                const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[
                  section.icon
                ];
                const sectionRoute = `/qualifications/${leadId}${section.route ? `/${section.route}` : ''}`;
                const isActive = pathname === sectionRoute;
                const sectionStatus = getSectionStatus(section.id);
                const hasSubsections = section.subsections && section.subsections.length > 0;
                const isOpen = openSections.has(section.id);
                const isDecisionSection = section.id === 'decision';

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
                            {getStatusBadge(sectionStatus)}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {section.subsections?.map(subsection => {
                              const subsectionRoute = `/qualifications/${leadId}/${subsection.route}`;
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
                          {getStatusBadge(sectionStatus)}
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuSub>
                        {section.subsections?.map(subsection => {
                          const subsectionRoute = `/qualifications/${leadId}/${subsection.route}`;
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
                          {getStatusBadge(sectionStatus)}
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
