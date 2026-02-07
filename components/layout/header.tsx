import { Bot } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';

import { auth } from '@/lib/auth';

export async function Header() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const { role } = session.user;

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <MobileNav role={role} />

          <Link href="/dashboard" className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            <span className="text-xl font-bold">PHPXCOM Qualifier</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium hover:underline">
              Dashboard
            </Link>
            <Link href="/qualifications/new" className="text-sm font-medium hover:underline">
              Neuer Lead
            </Link>
            <Link href="/qualifications" className="text-sm font-medium hover:underline">
              Alle Leads
            </Link>
            <Link href="/accounts" className="text-sm font-medium hover:underline">
              Accounts
            </Link>

            <div className="relative group">
              <Button variant="link" className="h-auto p-0 text-sm font-medium hover:underline">
                Stammdaten
              </Button>
              <div className="absolute left-0 mt-2 hidden w-48 rounded-md bg-white shadow-lg group-hover:block">
                <div className="py-1">
                  <Link href="/references" className="block px-4 py-2 text-sm hover:bg-gray-100">
                    Referenzen
                  </Link>
                  <Link href="/competencies" className="block px-4 py-2 text-sm hover:bg-gray-100">
                    Kompetenzen
                  </Link>
                  <Link href="/competitors" className="block px-4 py-2 text-sm hover:bg-gray-100">
                    Wettbewerber
                  </Link>
                </div>
              </div>
            </div>

            {(role === 'bl' || role === 'admin') && (
              <Link href="/bl-review" className="text-sm font-medium hover:underline">
                BL Review
              </Link>
            )}

            {role === 'admin' && (
              <Link href="/admin" className="text-sm font-medium hover:underline">
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden sm:flex gap-1 text-xs text-muted-foreground font-mono cursor-default"
          >
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </Badge>
          <UserMenu user={session.user} />
        </div>
      </div>
    </header>
  );
}
