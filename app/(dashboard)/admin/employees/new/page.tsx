'use client';

import { useState, useEffect } from 'react';
import { getBusinessLinesForSelect } from '@/lib/admin/technologies-actions';
import { getCompetenciesForSelect } from '@/lib/admin/employees-actions';
import { EmployeeForm } from '@/components/admin/employee-form';

export default function NewEmployeePage() {
  const [businessLines, setBusinessLines] = useState<{ id: string; name: string }[]>([]);
  const [competencies, setCompetencies] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [blResult, compResult] = await Promise.all([
        getBusinessLinesForSelect(),
        getCompetenciesForSelect(),
      ]);

      if (blResult.success) {
        setBusinessLines(blResult.businessLines || []);
      }
      if (compResult.success) {
        setCompetencies(compResult.competencies || []);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neuer Mitarbeiter</h1>
          <p className="text-muted-foreground">
            Erfassen Sie einen neuen Mitarbeiter mit Skills und Verfügbarkeit
          </p>
        </div>

        <EmployeeForm businessLines={businessLines} competencies={competencies} />
      </div>
    </div>
  );
}
