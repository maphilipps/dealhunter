import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Manage system settings and users
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/business-lines"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Business Lines</h2>
          <p className="mt-2 text-muted-foreground">
            Manage business lines and assignments
          </p>
        </Link>

        <Link
          href="/admin/employees"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Employees</h2>
          <p className="mt-2 text-muted-foreground">
            Manage employee records and roles
          </p>
        </Link>

        <Link
          href="/admin/technologies"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Technologies</h2>
          <p className="mt-2 text-muted-foreground">
            Manage technology stack and baselines
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Users</h2>
          <p className="mt-2 text-muted-foreground">Manage user accounts</p>
        </Link>

        <Link
          href="/admin/analytics"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Analytics</h2>
          <p className="mt-2 text-muted-foreground">
            View system analytics and reports
          </p>
        </Link>

        <Link
          href="/admin/audit-trail"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Audit Trail</h2>
          <p className="mt-2 text-muted-foreground">
            Review system audit logs
          </p>
        </Link>
      </div>
    </div>
  );
}
