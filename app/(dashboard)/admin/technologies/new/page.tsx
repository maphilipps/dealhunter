'use client';

import { useState, useEffect } from 'react';

import { TechnologyForm } from '@/components/admin/technology-form';
import { getBusinessUnitsForSelect } from '@/lib/admin/technologies-actions';

export default function NewTechnologyPage() {
  const [businessUnits, setBusinessUnits] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const result = await getBusinessUnitsForSelect();
      if (result.success) {
        setBusinessUnits(result.businessUnits || []);
      }
      setIsLoading(false);
    }
    void loadData();
  }, []);

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neue Technologie</h1>
          <p className="text-muted-foreground">
            Erstellen Sie eine neue Technologie mit Baseline-Konfiguration
          </p>
        </div>

        <TechnologyForm businessUnits={businessUnits} />
      </div>
    </div>
  );
}
