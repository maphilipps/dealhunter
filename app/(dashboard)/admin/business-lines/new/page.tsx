'use client';

import { BusinessLineForm } from '@/components/admin/business-line-form';

export default function NewBusinessLinePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neue Business Line</h1>
          <p className="text-muted-foreground">
            Erstellen Sie eine neue Business Line für die Bid-Zuordnung
          </p>
        </div>

        <BusinessLineForm />
      </div>
    </div>
  );
}
