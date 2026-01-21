import { AccountForm } from '@/components/account-form';

export default function NewAccountPage() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold mb-2">Neuen Account erstellen</h1>
        <p className="text-muted-foreground">Fügen Sie einen neuen Kunden-Account hinzu</p>
      </div>
      <AccountForm />
    </>
  );
}
