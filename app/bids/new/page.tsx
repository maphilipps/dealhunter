import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UploadBidForm } from '@/components/bids/upload-bid-form';
import { getAccounts } from '@/lib/accounts-actions';

export default async function NewBidPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const accountsResult = await getAccounts();
  const accounts = accountsResult.success ? accountsResult.accounts : [];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Neuer Bid</h1>
        <p className="text-muted-foreground mt-2">
          Upload einer Anforderung als PDF, Freitext oder E-Mail
        </p>
      </div>

      <UploadBidForm userId={session.user.id} accounts={accounts} />
    </main>
  );
}
