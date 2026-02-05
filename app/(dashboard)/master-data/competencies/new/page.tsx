import { CompetencyForm } from '@/components/admin/competency-form';

export default function NewCompetencyPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neue Kompetenz</h1>
          <p className="text-muted-foreground">
            Erfassen Sie eine neue Kompetenz mit Kategorie und Level
          </p>
        </div>

        <CompetencyForm />
      </div>
    </div>
  );
}
