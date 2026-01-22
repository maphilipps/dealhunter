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
  Menu,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface RfpMobileNavProps {
  rfpId: string;
  title?: string;
  status: string;
}

export function RfpMobileNav({ rfpId, title, status }: RfpMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 md:hidden"
          aria-label="RFP Navigation"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>RFP Navigation</SheetTitle>
          <SheetDescription>
            {title && <p className="font-medium">{title}</p>}
            <p className="text-xs">Status: {status}</p>
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-6">
          {navigationSections.map(section => (
            <div key={section.label}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{section.label}</h3>
              <div className="flex flex-col gap-1">
                {section.items.map(item => {
                  const isActive = pathname === item.url;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
