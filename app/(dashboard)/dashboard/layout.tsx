import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Dealhunter</h1>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Company Intelligence Platform
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">{session.user.email}</span>
            <form action={async () => { await signOut({ redirectTo: '/login' }); }}>
              <Button variant="outline" size="sm" type="submit">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="flex gap-6">
            <a
              href="/dashboard"
              className="py-3 text-sm font-medium border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600"
            >
              Dashboard
            </a>
            <a
              href="/analyze"
              className="py-3 text-sm font-medium border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600"
            >
              Neue Analyse
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
