import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {session.user.name}!
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Pipeline Overview</h2>
          <p className="mt-2 text-muted-foreground">
            View your current bid pipeline and status
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Recent Bids</h2>
          <p className="mt-2 text-muted-foreground">
            Your most recent bid submissions
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <p className="mt-2 text-muted-foreground">
            Create new bids or manage accounts
          </p>
        </div>
      </div>

      {session.user.role === 'admin' && (
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-blue-900">Admin Panel</h2>
          <p className="mt-2 text-blue-700">
            You have admin access. Visit the{' '}
            <a href="/admin" className="underline">
              admin dashboard
            </a>{' '}
            to manage users and settings.
          </p>
        </div>
      )}

      {(session.user.role === 'bl' || session.user.role === 'admin') && (
        <div className="mt-8 rounded-lg border border-purple-200 bg-purple-50 p-6">
          <h2 className="text-xl font-semibold text-purple-900">
            BL Review Panel
          </h2>
          <p className="mt-2 text-purple-700">
            You have BL access. Visit the{' '}
            <a href="/bl-review" className="underline">
              BL review panel
            </a>{' '}
            to review and approve bids.
          </p>
        </div>
      )}
    </div>
  );
}
