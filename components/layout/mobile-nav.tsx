'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

interface MobileNavProps {
  role: string;
}

export function MobileNav({ role }: MobileNavProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menü öffnen</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-4">
          <Link
            href="/dashboard"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Dashboard
          </Link>
          <Link
            href="/qualifications/new"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Neuer Lead
          </Link>
          <Link
            href="/qualifications"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Alle Leads
          </Link>
          <Link
            href="/accounts"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Accounts
          </Link>

          <div className="my-2 border-t" />
          <span className="px-3 text-xs font-semibold text-muted-foreground uppercase">
            Stammdaten
          </span>
          <Link
            href="/references"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Referenzen
          </Link>
          <Link
            href="/competencies"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Kompetenzen
          </Link>
          <Link
            href="/competitors"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Wettbewerber
          </Link>

          {(role === 'bl' || role === 'admin') && (
            <>
              <div className="my-2 border-t" />
              <Link
                href="/bl-review"
                onClick={close}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                BL Review
              </Link>
            </>
          )}

          {role === 'admin' && (
            <Link
              href="/admin"
              onClick={close}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Admin
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
