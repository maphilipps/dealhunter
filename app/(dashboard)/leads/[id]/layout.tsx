import { eq } from 'drizzle-orm';
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
import { redirect } from 'next/navigation';

import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';

export default async function LeadDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Navigation sections for the lead dashboard
  const navigationSections = [
    {
      label: 'Overview',
      items: [
        {
          title: 'Übersicht',
          icon: LayoutDashboard,
          url: `/leads/${id}`,
        },
      ],
    },
    {
      label: 'Analysis',
      items: [
        {
          title: 'Quick Scan',
          icon: Zap,
          url: `/leads/${id}/quick-scan`,
        },
        {
          title: 'BIT Decision',
          icon: Target,
          url: `/leads/${id}/decision`,
        },
        {
          title: 'Website Audit',
          icon: Globe,
          url: `/leads/${id}/website-audit`,
        },
      ],
    },
    {
      label: 'Matching & Estimation',
      items: [
        {
          title: 'CMS Matching',
          icon: Database,
          url: `/leads/${id}/cms-matching`,
        },
        {
          title: 'Baseline Comparison',
          icon: PieChart,
          url: `/leads/${id}/baseline`,
        },
        {
          title: 'PT Estimation',
          icon: Users,
          url: `/leads/${id}/estimation`,
        },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        {
          title: 'References',
          icon: Trophy,
          url: `/leads/${id}/references`,
        },
        {
          title: 'Risiken & Mitigation',
          icon: AlertTriangle,
          url: `/leads/${id}/risks`,
        },
      ],
    },
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarContent>
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

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center gap-2">
            <div>
              <h2 className="text-sm font-semibold">{lead.customerName}</h2>
              <p className="text-xs text-muted-foreground">Lead Dashboard</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
