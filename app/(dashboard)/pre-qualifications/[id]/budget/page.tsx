import { DollarSign, Clock } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { getCachedPreQualification } from '@/lib/pre-qualifications/cached-queries';
import { parseJsonField } from '@/lib/utils/json';

function formatBudget(
  budget?: ExtractedRequirements['budgetRange']
): { value: string; confidence?: number; rawText?: string } {
  if (!budget || (!budget.min && !budget.max)) {
    return { value: 'Nicht genannt' };
  }
  const min = budget.min ? new Intl.NumberFormat('de-DE').format(budget.min) : '0';
  const max = budget.max ? new Intl.NumberFormat('de-DE').format(budget.max) : '∞';
  return {
    value: `${min} - ${max} ${budget.currency || 'EUR'}`,
    confidence: budget.confidence,
    rawText: budget.rawText,
  };
}

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const preQualification = await getCachedPreQualification(id);

  if (!preQualification) {
    notFound();
  }

  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  const extractedReqs = parseJsonField<ExtractedRequirements | null>(
    preQualification.extractedRequirements,
    null
  );
  const budget = formatBudget(extractedReqs?.budgetRange);
  const duration = extractedReqs?.contractDuration || extractedReqs?.timeline;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Budget</h1>
        <p className="text-muted-foreground">Angaben zum Budget und zur Laufzeit</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget (Dokumente)
            </CardTitle>
            <Badge variant="outline">Quelle: Dokumente</Badge>
          </div>
          <CardDescription>Nur aus den bereitgestellten Unterlagen</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Budgetrahmen</p>
            <p className="text-xl font-semibold">{budget.value}</p>
            {budget.confidence !== undefined && (
              <Badge variant="secondary" className="mt-2">
                Konfidenz: {budget.confidence}%
              </Badge>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Laufzeit</p>
            <p className="text-xl font-semibold">{duration || 'Nicht genannt'}</p>
          </div>
          {budget.rawText && budget.rawText !== 'nicht gefunden' && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Originaltext</p>
              <p className="text-sm">{budget.rawText}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {budget.value === 'Nicht genannt' && !duration && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Keine Budgetangaben gefunden</AlertTitle>
          <AlertDescription>
            Die Dokumente enthalten keine expliziten Budget- oder Laufzeitangaben. Bitte manuell
            prüfen.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
