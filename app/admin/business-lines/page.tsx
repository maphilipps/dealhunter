import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function BusinessLinesPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Business Lines Management</h1>
        <p className="mt-2 text-muted-foreground">
          Create and manage business lines
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          Business lines management interface coming soon...
        </p>
      </div>
    </div>
  );
}
