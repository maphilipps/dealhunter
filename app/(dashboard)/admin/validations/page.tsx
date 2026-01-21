import { CompetencyValidationTable } from '@/components/admin/competency-validation-table';
import { CompetitorValidationTable } from '@/components/admin/competitor-validation-table';
import { ReferenceValidationTable } from '@/components/admin/reference-validation-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getPendingReferences,
  getPendingCompetencies,
  getPendingCompetitors,
} from '@/lib/admin/validation-actions';

export default async function AdminValidationsPage() {
  const [references, competencies, competitors] = await Promise.all([
    getPendingReferences(),
    getPendingCompetencies(),
    getPendingCompetitors(),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Master Data Validierung</h1>

      <Tabs defaultValue="references">
        <TabsList>
          <TabsTrigger value="references">Referenzen ({references.items?.length || 0})</TabsTrigger>
          <TabsTrigger value="competencies">
            Kompetenzen ({competencies.items?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="competitors">
            Wettbewerber ({competitors.items?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="references">
          <ReferenceValidationTable data={references.items || []} />
        </TabsContent>

        <TabsContent value="competencies">
          <CompetencyValidationTable data={competencies.items || []} />
        </TabsContent>

        <TabsContent value="competitors">
          <CompetitorValidationTable data={competitors.items || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
