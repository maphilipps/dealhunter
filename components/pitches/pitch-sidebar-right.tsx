'use client';

import * as Icons from 'lucide-react';
import { Bot, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { PipelineProgress } from '@/components/pitches/pipeline-progress';
import { PitchChat } from '@/components/pitches/pitch-chat';
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

interface LeadSidebarRightProps {
  leadId: string;
  customerName: string;
  status: string;
  blVote: 'BID' | 'NO-BID' | null;
}

export function LeadSidebarRight({ leadId, customerName, status }: LeadSidebarRightProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));
  const [chatOpen, setChatOpen] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

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
      <SidebarContent className="flex flex-col">
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
        <SidebarGroup className="flex-1 overflow-auto">
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

        {/* Pipeline Progress (when active) */}
        {runId && (
          <SidebarGroup className="shrink-0 border-t">
            <SidebarGroupLabel>Pipeline-Fortschritt</SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <PipelineProgress
                pitchId={leadId}
                runId={runId}
                compact
                onComplete={() => router.push(`/pitches/${leadId}`)}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Collapsible Chat Panel */}
        <div className="shrink-0 border-t">
          <button
            onClick={() => setChatOpen(prev => !prev)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-sidebar-accent transition-colors"
          >
            <Bot className="h-4 w-4 text-primary" />
            <span className="flex-1 text-left">Pitch-Interview</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${chatOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {chatOpen && (
            <div className="h-[350px]">
              <PitchChat pitchId={leadId} compact onPipelineStarted={id => setRunId(id)} />
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
