import { eq } from 'drizzle-orm';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, rfps, businessUnits } from '@/lib/db/schema';



export default async function LeadOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead with related data
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Get related RFP
  const [rfp] = lead.rfpId
    ? await db.select().from(rfps).where(eq(rfps.id, lead.rfpId)).limit(1)
    : [null];

  // Get business unit
  const [businessUnit] = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.id, lead.businessUnitId))
    .limit(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{lead.customerName}</h1>
        <p className="text-muted-foreground">Lead Overview</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Status</CardTitle>
            <StatusBadge status={lead.status} />
          </div>
          <CardDescription>
            Erstellt am{' '}
            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('de-DE') : 'Unbekannt'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Business Unit</p>
              <p className="font-medium">{businessUnit?.name || 'Nicht zugewiesen'}</p>
              {businessUnit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Leiter: {businessUnit.leaderName}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branche</p>
              <p className="font-medium">{lead.industry || 'Nicht bekannt'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Projektinformationen</CardTitle>
          <CardDescription>Details aus dem ursprünglichen RFP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lead.websiteUrl && (
            <div>
              <p className="text-sm text-muted-foreground">Website</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{lead.websiteUrl}</p>
                <Button variant="ghost" size="sm" asChild>
                  <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {lead.projectDescription && (
            <div>
              <p className="text-sm text-muted-foreground">Projektbeschreibung</p>
              <p className="mt-1 text-sm">{lead.projectDescription}</p>
            </div>
          )}

          {lead.budget && (
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-medium">{lead.budget}</p>
            </div>
          )}

          {lead.requirements && (
            <div>
              <p className="text-sm text-muted-foreground">Anforderungen</p>
              <div className="mt-2 space-y-1">
                {(() => {
                  try {
                    const reqs: unknown = JSON.parse(lead.requirements);
                    if (Array.isArray(reqs)) {
                      return (
                        <ul className="list-disc list-inside space-y-1">
                          {reqs.map((req: unknown, idx: number) => (
                            <li key={idx} className="text-sm">
                              {String(req)}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return <p className="text-sm">{JSON.stringify(reqs, null, 2)}</p>;
                  } catch {
                    return <p className="text-sm">{lead.requirements}</p>;
                  }
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BL Decision (if exists) */}
      {lead.blVote && (
        <Card>
          <CardHeader>
            <CardTitle>BL Entscheidung</CardTitle>
            <CardDescription>
              Entschieden am{' '}
              {lead.blVotedAt ? new Date(lead.blVotedAt).toLocaleDateString('de-DE') : 'Unbekannt'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vote</p>
              <Badge variant={lead.blVote === 'BID' ? 'default' : 'destructive'}>
                {lead.blVote}
              </Badge>
            </div>

            {lead.blConfidenceScore !== null && lead.blConfidenceScore !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Confidence Score</p>
                <p className="font-medium">{lead.blConfidenceScore}%</p>
              </div>
            )}

            {lead.blReasoning && (
              <div>
                <p className="text-sm text-muted-foreground">Begründung</p>
                <p className="mt-1 text-sm">{lead.blReasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigieren Sie zu den verschiedenen Analysen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/leads/${id}/quick-scan`}>Quick Scan ansehen</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/leads/${id}/website-audit`}>Website Audit</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/leads/${id}/estimation`}>PT Estimation</Link>
            </Button>
            {rfp && (
              <Button variant="outline" asChild>
                <Link href={`/rfps/${rfp.id}`}>Ursprüngliches RFP</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    routed: { label: 'Weitergeleitet', variant: 'default' as const },
    full_scanning: { label: 'Full Scan läuft', variant: 'default' as const },
    bl_reviewing: { label: 'BL prüft', variant: 'default' as const },
    bid_voted: { label: 'Entschieden', variant: 'default' as const },
    archived: { label: 'Archiviert', variant: 'outline' as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: 'secondary' as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
