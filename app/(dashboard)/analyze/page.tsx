import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Validation utilities
type ActionResult =
  | { success: true }
  | { success: false; error: string };

export default async function AnalyzePage() {
  const session = await auth();

  async function createAnalysis(formData: FormData): Promise<ActionResult> {
    'use server';
    const { db } = await import('@/lib/db');
    const { analyses } = await import('@/lib/db/schema');
    const { revalidatePath } = await import('next/cache');
    const { createAnalysisSchema } = await import('@/lib/validation');

    // Extract and validate form data
    const rawData = {
      companyName: formData.get('companyName'),
      location: formData.get('location'),
      type: formData.get('type'),
    };

    // Validate with Zod schema
    const validationResult = createAnalysisSchema.safeParse(rawData);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Ungültige Eingabe';
      return { success: false, error: firstError };
    }

    const data = validationResult.data;

    // Type is now validated
    const analysis = await db.insert(analyses).values({
      userId: session.user.id,
      companyName: data.companyName,
      location: data.location || null,
      type: data.type,
      status: 'pending',
      progress: 0,
      currentPhase: 'discovery',
    }).returning();

    // Start analysis via API
    const apiUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: analysis[0].id }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Analyse konnte nicht gestartet werden' };
    }

    revalidatePath('/dashboard');
    redirect(`/analyses/${analysis[0].id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Neue Analyse</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Unternehmen analysieren und Insights erhalten
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
          <CardDescription>
            Geben Sie den Namen des Unternehmens ein, das Sie analysieren möchten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAnalysis} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Unternehmensname *</Label>
              <Input
                id="companyName"
                name="companyName"
                placeholder="z.B. adesso SE"
                required
                minLength={2}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Standort (optional)</Label>
              <Input
                id="location"
                name="location"
                placeholder="z.B. Köln, Deutschland"
                maxLength={255}
              />
              <p className="text-xs text-slate-500">
                Hilft bei der Disambiguierung von Unternehmen mit gleichem Namen
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Analyse-Typ</Label>
              <Select name="type" defaultValue="quick_scan">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick_scan">Quick Scan (~30 Sekunden)</SelectItem>
                  <SelectItem value="deep_dive">Deep Dive (~2 Minuten)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1">
                Analyse starten
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href="/dashboard">Abbrechen</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
