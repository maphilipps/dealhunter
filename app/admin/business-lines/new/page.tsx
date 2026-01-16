import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BusinessLineForm } from '@/components/admin/business-line-form';

export default async function NewBusinessLinePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neuer Business Line</h1>
          <p className="text-muted-foreground">
            Erstellen Sie einen neuen Geschäftsbereich
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <BusinessLineForm />
        </div>
      </div>
    </div>
  );
}
