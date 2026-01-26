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
  getPreQualificationNavigationSections,
  isNavigationItemEnabled,
  type QuickScanDataAvailability,
} from '@/lib/pre-qualifications/navigation';

interface PreQualificationSidebarRightProps {
  preQualificationId: string;
  title?: string;
  status: string;
  dataAvailability: QuickScanDataAvailability;
}

const ANALYSIS_INTRO = {
  title: 'Ausschreibung analysieren (nur Dokumente).',
  subtitle: 'Diese Navigation bildet die relevanten Detailseiten ab.',
};

const ANALYSIS_SECTIONS = [
  {
    group: 'Ausschreibung',
    items: [
      { label: 'Budget', hint: 'Budgetrahmen & Laufzeit' },
      { label: 'Zeitplan / Verfahren', hint: 'Timeline, Shortlisting, Portal' },
      { label: 'Verträge', hint: 'Vertragstyp & Modell' },
      { label: 'Leistungsumfang', hint: 'Umfang & Unterlagen' },
      { label: 'Referenzen', hint: 'Anzahl, Branchen, Technologien' },
      { label: 'Zuschlagskriterien', hint: 'Kriterien & Gewichtung' },
    ],
  },
];

export function PreQualificationSidebarRight({
  preQualificationId,
  title,
  status,
  dataAvailability,
}: PreQualificationSidebarRightProps) {
  const pathname = usePathname();
  const navigationSections = getPreQualificationNavigationSections(preQualificationId);

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" variant="sidebar" side="right" className="hidden md:flex">
        <SidebarContent>
          {/* Analysis Briefing */}
          <SidebarGroup>
            <SidebarGroupLabel>Analyseauftrag</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-1 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p className="text-sm font-medium text-foreground">{ANALYSIS_INTRO.title}</p>
                <p>{ANALYSIS_INTRO.subtitle}</p>
                <p className="text-[11px] text-muted-foreground">
                  Websuche zur Anreicherung ist erlaubt, Quellen werden klar gekennzeichnet.
                </p>
                <div className="space-y-2">
                  {ANALYSIS_SECTIONS.map(section => (
                    <div key={section.group}>
                      <p className="text-foreground text-xs font-semibold">{section.group}</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {section.items.map(item => (
                          <li key={item.label}>
                            <span className="text-foreground font-medium">{item.label}</span>
                            {item.hint && (
                              <span className="text-muted-foreground"> — {item.hint}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Pre-Qualification Metadata */}
          <SidebarGroup>
            <SidebarGroupLabel>Pre-Qualification Details</SidebarGroupLabel>
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
