import { CompetitorForm } from '@/components/admin/competitor-form';

export default function NewCompetitorPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neuer Wettbewerber</h1>
          <p className="text-muted-foreground">
            Erfassen Sie einen neuen Wettbewerber mit Stärken, Schwächen und Marktinformationen
          </p>
        </div>

        <CompetitorForm />
      </div>
    </div>
  );
}
