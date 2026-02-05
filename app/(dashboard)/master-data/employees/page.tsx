import Link from 'next/link';

import { EmployeeList } from '@/components/admin/employee-list';
import { Button } from '@/components/ui/button';
import { getUserEmployees } from '@/lib/master-data/actions';

export default async function EmployeesPage() {
  const employees = await getUserEmployees();

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mitarbeiter</h1>
          <p className="text-muted-foreground">
            Team-Datenbank für Ressourcenplanung und Pitch-Zuordnung
          </p>
        </div>
        <Button asChild>
          <Link href="/master-data/employees/new">Neuer Mitarbeiter</Link>
        </Button>
      </div>

      <EmployeeList employees={employees} />
    </div>
  );
}
