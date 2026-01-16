import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function BLReviewPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== 'bl' && session.user.role !== 'admin')
  ) {
    redirect('/dashboard');
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">BL Review</h1>
        <p className="mt-2 text-muted-foreground">
          Review and approve bids assigned to your business line
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          BL review interface coming soon...
        </p>
      </div>
    </div>
  );
}
