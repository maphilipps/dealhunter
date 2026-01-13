import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyses } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const session = await auth();

  const userAnalyses = await db.query.analyses.findMany({
    where: (analyses, { eq }) => eq(analyses.userId, session.user.id),
    orderBy: [desc(analyses.createdAt)],
    limit: 20,
  });

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

  const getMaturityColor = (level: string | null) => {
    switch (level) {
      case 'leader':
        return 'bg-green-500 text-white';
      case 'mature':
        return 'bg-blue-500 text-white';
      case 'growing':
        return 'bg-yellow-500 text-white';
      case 'emerging':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Ihre Unternehmensanalysen
          </p>
        </div>
        <Button asChild>
          <a href="/analyze">Neue Analyse</a>
        </Button>
      </div>

      {userAnalyses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Noch keine Analysen vorhanden
            </p>
            <Button asChild>
              <a href="/analyze">Erste Analyse erstellen</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {userAnalyses.map((analysis) => (
            <Card key={analysis.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{analysis.companyName}</CardTitle>
                    <CardDescription>
                      {analysis.location && `${analysis.location} • `}
                      {new Date(analysis.createdAt).toLocaleDateString('de-DE')}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(analysis.status)}>
                    {analysis.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {analysis.maturityLevel && (
                      <Badge className={getMaturityColor(analysis.maturityLevel)}>
                        {analysis.maturityLevel}
                      </Badge>
                    )}
                    <Badge variant="outline">{analysis.type}</Badge>
                  </div>
                  {analysis.leadScore !== null && (
                    <div className="text-right">
                      <div className="text-sm text-slate-500">Lead Score</div>
                      <div className="text-2xl font-bold">{analysis.leadScore}</div>
                    </div>
                  )}
                </div>
                {analysis.completedAt && (
                  <Button variant="link" className="mt-4 px-0" asChild>
                    <a href={`/analyses/${analysis.id}`}>Details anzeigen →</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
