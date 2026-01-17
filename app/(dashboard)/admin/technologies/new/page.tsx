'use client';

import { useState, useEffect } from 'react';
import { getBusinessLinesForSelect } from '@/lib/admin/technologies-actions';
import { TechnologyForm } from '@/components/admin/technology-form';

export default function NewTechnologyPage() {
  const [businessLines, setBusinessLines] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const result = await getBusinessLinesForSelect();
      if (result.success) {
        setBusinessLines(result.businessLines || []);
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
          <h1 className="text-3xl font-bold mb-2">Neue Technologie</h1>
          <p className="text-muted-foreground">
            Erstellen Sie eine neue Technologie mit Baseline-Konfiguration
          </p>
        </div>

        <TechnologyForm businessLines={businessLines} />
      </div>
    </div>
  );
}
