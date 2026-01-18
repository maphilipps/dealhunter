'use client';

import { BusinessUnitForm } from '@/components/admin/business-unit-form';

export default function NewBusinessUnitPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neue Business Unit</h1>
          <p className="text-muted-foreground">
            Erstellen Sie eine neue Business Unit für die Bid-Zuordnung
          </p>
        </div>

        <BusinessUnitForm />
      </div>
    </div>
  );
}
