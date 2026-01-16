import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getEmployees } from '@/lib/admin/employees-actions';
import { EmployeeList } from '@/components/admin/employee-list';

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const result = await getEmployees();
  const employees = result.success ? result.employees : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mitarbeiter</h1>
            <p className="text-muted-foreground">Verwalten Sie die Mitarbeiter mit Skills und Rollen</p>
          </div>
          <a
            href="/admin/employees/new"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuer Mitarbeiter
          </a>
        </div>
        <EmployeeList employees={employees} />
      </div>
    </div>
  );
}
