'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { BusinessUnitList } from '@/components/admin/business-unit-list';
import { Button } from '@/components/ui/button';
import {
  getBusinessUnits,
  type getBusinessUnits as GetBusinessUnitsType,
} from '@/lib/admin/business-units-actions';

type GetBusinessUnitsResult = Awaited<ReturnType<typeof GetBusinessUnitsType>>;
type BusinessUnit = NonNullable<GetBusinessUnitsResult['businessUnits']>[number];

export default function BusinessUnitsPage() {
  const router = useRouter();
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const result = await getBusinessUnits();
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
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Business Units</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre Business Units und deren Zuordnungen
            </p>
          </div>
          <Button onClick={() => router.push('/admin/business-units/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Business Unit
          </Button>
        </div>

        <BusinessUnitList businessUnits={businessUnits} />
      </div>
    </div>
  );
}
