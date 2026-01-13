import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyses } from '@/lib/db/schema';
import { assertValidUuid } from '@/lib/validation';
import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import LiveProgress from '@/components/analysis/live-progress';

export default async function AnalysisDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  // UUID validation
  assertValidUuid(params.id, 'analysisId');

  const analysis = await db.query.analyses.findFirst({
    where: and(eq(analyses.id, params.id), eq(analyses.userId, session.user.id)),
  });

  if (!analysis) {
    notFound();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'failed':
        return 'bg-red-500 text-white';
      case 'analyzing':
      case 'generating':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{analysis.companyName}</h2>
          <p className="text-slate-500 dark:text-slate-400">
            {analysis.location && `${analysis.location} • `}
            Analyse erstellt am {new Date(analysis.createdAt).toLocaleDateString('de-DE')}
          </p>
        </div>
        <Badge className={getStatusColor(analysis.status)}>
          {analysis.status}
        </Badge>
      </div>

      {analysis.status !== 'completed' && analysis.status !== 'failed' ? (
        <Card>
          <CardHeader>
            <CardTitle>Analyse läuft</CardTitle>
            <CardDescription>
              Aktuelle Phase: {analysis.currentPhase}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={analysis.progress} />
            <p className="text-sm text-slate-500 text-center">
              {analysis.progress}% abgeschlossen
            </p>
            <LiveProgress analysisId={analysis.id} />
          </CardContent>
        </Card>
      ) : analysis.status === 'failed' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Analyse fehlgeschlagen</CardTitle>
            <CardDescription>
              {analysis.errorMessage || 'Ein unerwarteter Fehler ist aufgetreten'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/analyze">Neue Analyse</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Analyse abgeschlossen</CardTitle>
            <CardDescription>
              Fertiggestellt am {analysis.completedAt ? new Date(analysis.completedAt).toLocaleDateString('de-DE') : 'kürzlich'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-500 mb-4">
              Die vollständigen Ergebnisse werden hier angezeigt.
            </p>
            {analysis.leadScore !== null && (
              <div className="text-center py-8">
                <div className="text-sm text-slate-500 mb-2">Lead Score</div>
                <div className="text-4xl font-bold">{analysis.leadScore}/100</div>
              </div>
            )}
            <Button asChild className="mt-4">
              <a href="/dashboard">Zurück zum Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
