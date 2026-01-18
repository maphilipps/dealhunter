import Link from 'next/link';
import { getAccounts } from '@/lib/accounts-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function AccountsPage() {
  const result = await getAccounts();
  const accounts = result.success ? result.accounts : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Accounts</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Kunden-Accounts
          </p>
        </div>
        <Button asChild>
          <Link href="/accounts/new">
            <Plus className="h-4 w-4 mr-2" />
            Neuer Account
          </Link>
        </Button>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Noch keine Accounts vorhanden</p>
          <Button asChild>
            <Link href="/accounts/new">
              <Plus className="h-4 w-4 mr-2" />
              Ersten Account erstellen
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account: any) => (
            <Link key={account.id} href={`/accounts/${account.id}`} className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{account.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-muted-foreground text-sm">Branche:</span>
                    <p className="font-medium">{account.industry}</p>
                  </div>

                  {account.website && (
                    <div>
                      <span className="text-muted-foreground text-sm">Website:</span>
                      <p className="font-medium text-sm truncate">{account.website}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground text-sm">Erstellt am:</span>
                    <p className="font-medium text-sm">
                      {account.createdAt ? new Date(account.createdAt).toLocaleDateString('de-DE') : 'N/A'}
                    </p>
                  </div>

                  {account.notes && (
                    <div>
                      <span className="text-muted-foreground text-sm">Notizen:</span>
                      <p className="text-sm text-muted-foreground line-clamp-2">{account.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
