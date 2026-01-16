import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getBusinessLines } from '@/lib/admin/business-lines-actions';
import { BusinessLineList } from '@/components/admin/business-line-list';

export default async function BusinessLinesPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const result = await getBusinessLines();
  const businessLines = result.success ? result.businessLines : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Business Lines</h1>
            <p className="text-muted-foreground">
              Verwalten Sie die Geschäftsbereiche und Zuordnungen
            </p>
          </div>
          <a
            href="/admin/business-lines/new"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuer Bereich
          </a>
        </div>

        <BusinessLineList businessLines={businessLines} />
      </div>
    </div>
  );
}
