import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EmployeeForm } from '@/components/admin/employee-form';
import { getBusinessLinesForSelect } from '@/lib/admin/technologies-actions';
import { getCompetenciesForSelect } from '@/lib/admin/employees-actions';

export default async function NewEmployeePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const [blResult, compResult] = await Promise.all([
    getBusinessLinesForSelect(),
    getCompetenciesForSelect()
  ]);

  const businessLines = blResult.success ? blResult.businessLines : [];
  const competencies = compResult.success ? compResult.competencies : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neuer Mitarbeiter</h1>
          <p className="text-muted-foreground">Erstellen Sie einen neuen Mitarbeiter mit Skills und Rollen</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <EmployeeForm businessLines={businessLines} competencies={competencies} />
        </div>
      </div>
    </div>
  );
}
