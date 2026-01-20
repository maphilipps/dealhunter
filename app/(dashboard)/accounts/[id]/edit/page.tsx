import { notFound } from 'next/navigation';
import { getAccountById } from '@/lib/accounts-actions';
import { EditAccountForm } from '@/components/edit-account-form';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAccountPage({ params }: Props) {
  const { id } = await params;
  const result = await getAccountById(id);

  if (!result.success || !result.account) {
    notFound();
  }

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold mb-2">Account bearbeiten</h1>
        <p className="text-muted-foreground">Aktualisieren Sie die Account-Informationen</p>
      </div>
      <EditAccountForm account={result.account} />
    </>
  );
}
