import Link from 'next/link';

import { BusinessUnitList } from '@/components/admin/business-unit-list';
import { Button } from '@/components/ui/button';
import { getBusinessUnits } from '@/lib/master-data/actions';

export default async function BusinessUnitsPage() {
  const result = await getBusinessUnits();
  const businessUnits = result.success ? result.businessUnits || [] : [];

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Business Units</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Business Units und deren Zuordnungen
          </p>
        </div>
        <Button asChild>
          <Link href="/master-data/business-units/new">Neue Business Unit</Link>
        </Button>
      </div>

      <BusinessUnitList businessUnits={businessUnits} />
    </div>
  );
}
