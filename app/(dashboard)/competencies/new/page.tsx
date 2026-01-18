import { CompetencyForm } from '@/components/competencies/competency-form';
import { Card, CardContent } from '@/components/ui/card';

export default function NewCompetencyPage() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold mb-2">Neue Kompetenz erstellen</h1>
        <p className="text-muted-foreground">
          Fügen Sie eine neue Kompetenz zur zentralen Datenbank hinzu
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CompetencyForm />
        </CardContent>
      </Card>
    </>
  );
}
