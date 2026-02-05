import { BusinessUnitForm } from '@/components/admin/business-unit-form';

export default function NewBusinessUnitPage() {
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Neue Business Unit</h1>
        <p className="text-muted-foreground">
          Erstellen Sie eine neue Business Unit mit Leiter und Keywords
        </p>
      </div>

      <BusinessUnitForm />
    </div>
  );
}
