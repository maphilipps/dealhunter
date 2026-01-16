import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AccountForm } from '@/components/account-form';

export default async function NewAccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Neuen Account erstellen</h1>
        <p className="text-muted-foreground mb-8">
          Fügen Sie einen neuen Kunden-Account hinzu
        </p>
        <AccountForm />
      </div>
    </div>
  );
}
