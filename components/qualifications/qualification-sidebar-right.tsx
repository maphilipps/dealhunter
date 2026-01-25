'use client';

import * as Icons from 'lucide-react';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useDeepScan,
  SECTION_TO_EXPERT,
  ALL_EXPERTS,
  EXPERT_DISPLAY_NAMES,
} from '@/contexts/deep-scan-context';
import { QUALIFICATION_NAVIGATION_SECTIONS } from '@/lib/qualifications/navigation-config';

interface LeadSidebarRightProps {
  leadId: string;
  customerName: string;
  status: string;
  blVote: 'BID' | 'NO-BID' | null;
  /** Deep scan status from database (for initial state before polling) */
  deepScanStatus?: 'pending' | 'running' | 'completed' | 'failed' | null;
}

type SectionStatus = 'loading' | 'ready' | 'warning' | 'error' | 'running' | 'blocked';

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
    blocked: {
      variant: 'outline',
      label: '',
      icon: <Lock className="h-3 w-3" />,
    },
  };

  const config = variants[status];
  return (
    <Badge variant={config.variant} className="ml-auto text-xs flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function LeadSidebarRight({
  leadId,
  customerName,
  status,
  deepScanStatus,
}: LeadSidebarRightProps) {
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

  // Sections that are always functional (no waiting status, never blocked)
  const ALWAYS_READY_SECTIONS = ['overview', 'rag-data'];

  // Check if navigation should be blocked (scan not completed)
  const isNavigationBlocked =
    deepScan.status === 'idle' ||
    deepScan.status === 'pending' ||
    deepScan.status === 'running' ||
    (deepScanStatus && !['completed'].includes(deepScanStatus));

  // Get section status from DeepScan context or fallback to static status
  const getSectionStatus = (sectionId: string): SectionStatus | null => {
    // These sections don't wait for anything - they're functional pages
    if (ALWAYS_READY_SECTIONS.includes(sectionId)) return null;

    // If navigation is blocked and this is not an always-ready section
    if (isNavigationBlocked && !ALWAYS_READY_SECTIONS.includes(sectionId)) {
      // Still show running status for active sections during scan
      if (deepScan.status === 'running' || deepScan.status === 'pending') {
        const expertName = SECTION_TO_EXPERT[sectionId];
        if (expertName) {
          const expertStatus = deepScan.getExpertStatus(expertName);
          if (expertStatus === 'complete') return 'ready';
          if (expertStatus === 'running') return 'running';
        }
        return 'loading';
      }
      return 'blocked';
    }

    // Check if this section corresponds to a Deep Scan expert
    const expertName = SECTION_TO_EXPERT[sectionId];
    if (expertName && deepScan.isInProgress) {
      const expertStatus = deepScan.getExpertStatus(expertName);
      if (expertStatus === 'complete') return 'ready';
      if (expertStatus === 'running') return 'running';
      if (expertStatus === 'error') return 'error';
      return 'loading'; // pending
    }

    // If not in progress, check if expert has completed previously
    if (expertName) {
      const expertStatus = deepScan.getExpertStatus(expertName);
      if (expertStatus === 'complete') return 'ready';
      if (expertStatus === 'error') return 'error';
    }

    // Default: no badge (status unknown/not scanned yet)
    return null;
  };

  // Check if a section is clickable
  const isSectionClickable = (sectionId: string): boolean => {
    // Always-ready sections are always clickable
    if (ALWAYS_READY_SECTIONS.includes(sectionId)) return true;

    // If navigation is blocked, only completed sections are clickable
    if (isNavigationBlocked) {
      const expertName = SECTION_TO_EXPERT[sectionId];
      if (expertName) {
        const expertStatus = deepScan.getExpertStatus(expertName);
        return expertStatus === 'complete';
      }
      return false;
    }

    return true;
  };

  // Calculate scan progress for the header
  const scanProgress =
    deepScan.isInProgress && ALL_EXPERTS.length > 0
      ? (deepScan.completedExperts.length / ALL_EXPERTS.length) * 100
      : 0;

  // Current expert display name
  const currentExpertDisplay = deepScan.currentExpert
    ? EXPERT_DISPLAY_NAMES[deepScan.currentExpert] || deepScan.currentExpert
    : null;

  return (
    <Sidebar collapsible="none" variant="sidebar" side="right">
      <SidebarContent>
        {/* Deep Scan Progress Header (only when scanning) */}
        {deepScan.isInProgress && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2 py-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg mx-2">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {currentExpertDisplay || 'Initialisiere...'}
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

        {/* Deep Scan Required Warning (when not scanned) */}
        {deepScan.status === 'idle' && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2 py-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg mx-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    DeepScan erforderlich
                  </span>
                </div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Starten Sie den DeepScan für vollständige Navigation
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
              <TooltipProvider>
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
                  const isClickable = isSectionClickable(section.id);

                  // Wrapper for blocked items
                  const BlockedWrapper = ({ children }: { children: React.ReactNode }) => {
                    if (isClickable) return <>{children}</>;

                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="opacity-50 cursor-not-allowed">{children}</div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>DeepScan erforderlich</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  };

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
                                const isSubClickable = isSectionClickable(subsection.id);

                                if (!isSubClickable) {
                                  return (
                                    <SidebarMenuSubItem key={subsection.id}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="opacity-50 cursor-not-allowed px-2 py-1.5">
                                            <span className="text-sm">{subsection.label}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          <p>DeepScan erforderlich</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </SidebarMenuSubItem>
                                  );
                                }

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
                        <BlockedWrapper>
                          {isClickable ? (
                            <SidebarMenuButton asChild isActive={isActive}>
                              <Link href={sectionRoute}>
                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                <span>{section.label}</span>
                                {getStatusBadge(sectionStatus)}
                              </Link>
                            </SidebarMenuButton>
                          ) : (
                            <SidebarMenuButton isActive={false}>
                              {IconComponent && <IconComponent className="h-4 w-4" />}
                              <span>{section.label}</span>
                              {getStatusBadge(sectionStatus)}
                            </SidebarMenuButton>
                          )}
                        </BlockedWrapper>
                        <SidebarMenuSub>
                          {section.subsections?.map(subsection => {
                            const subsectionRoute = `/qualifications/${leadId}/${subsection.route}`;
                            const isSubActive = pathname === subsectionRoute;
                            const isSubClickable = isSectionClickable(subsection.id);

                            if (!isSubClickable) {
                              return (
                                <SidebarMenuSubItem key={subsection.id}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="opacity-50 cursor-not-allowed px-2 py-1.5">
                                        <span className="text-sm">{subsection.label}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p>DeepScan erforderlich</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </SidebarMenuSubItem>
                              );
                            }

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
                        <BlockedWrapper>
                          {isClickable ? (
                            <SidebarMenuButton asChild isActive={isActive}>
                              <Link href={sectionRoute}>
                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                <span>{section.label}</span>
                                {getStatusBadge(sectionStatus)}
                              </Link>
                            </SidebarMenuButton>
                          ) : (
                            <SidebarMenuButton isActive={false}>
                              {IconComponent && <IconComponent className="h-4 w-4" />}
                              <span>{section.label}</span>
                              {getStatusBadge(sectionStatus)}
                            </SidebarMenuButton>
                          )}
                        </BlockedWrapper>
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
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
