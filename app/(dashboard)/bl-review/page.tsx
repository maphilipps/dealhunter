import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, businessUnits, users } from '@/lib/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { safeJsonParseOrNull } from '@/lib/utils/parse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Building2,
  Clock,
  FileText,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default async function BLReviewPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== 'bl' && session.user.role !== 'admin')
  ) {
    redirect('/');
  }

  // Get the user's business unit
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Get all business units for admin, or just the user's for BL
  let businessUnitIds: string[] = [];

  if (session.user.role === 'admin') {
    // Admin sees all
    const allBUs = await db.select({ id: businessUnits.id }).from(businessUnits);
    businessUnitIds = allBUs.map(bu => bu.id);
  } else if (user?.businessUnitId) {
    businessUnitIds = [user.businessUnitId];
  }

  // Get bids assigned to the user's business unit(s)
  const assignedBids = businessUnitIds.length > 0
    ? await db
        .select()
        .from(rfps)
        .where(
          and(
            inArray(rfps.assignedBusinessUnitId, businessUnitIds),
            inArray(rfps.status, ['routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'])
          )
        )
        .orderBy(desc(rfps.updatedAt))
    : [];

  // Get business unit details for display
  const busUnits = businessUnitIds.length > 0
    ? await db
        .select()
        .from(businessUnits)
        .where(inArray(businessUnits.id, businessUnitIds))
    : [];

  const buMap = new Map(busUnits.map(bu => [bu.id, bu]));

  // Group bids by status for overview
  const statusGroups = {
    pending: assignedBids.filter(b => ['routed', 'full_scanning', 'bl_reviewing'].includes(b.status)),
    teamAssigned: assignedBids.filter(b => b.status === 'team_assigned'),
    notified: assignedBids.filter(b => b.status === 'notified'),
    completed: assignedBids.filter(b => b.status === 'handed_off'),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BL Review</h1>
        <p className="mt-2 text-muted-foreground">
          Prüfen und genehmigen Sie RFPs für Ihren Bereich
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zu prüfen</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusGroups.pending.length}</div>
            <p className="text-xs text-muted-foreground">
              RFPs warten auf Review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team zugewiesen</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusGroups.teamAssigned.length}</div>
            <p className="text-xs text-muted-foreground">
              Bereit zur Benachrichtigung
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benachrichtigt</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusGroups.notified.length}</div>
            <p className="text-xs text-muted-foreground">
              Team wurde informiert
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abgeschlossen</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusGroups.completed.length}</div>
            <p className="text-xs text-muted-foreground">
              Workflow beendet
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Bids - Priority View */}
      {statusGroups.pending.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Zu prüfende RFPs
            </CardTitle>
            <CardDescription>
              Diese RFPs warten auf Ihre Prüfung und Team-Zuweisung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusGroups.pending.map((bid) => {
                const extractedData = safeJsonParseOrNull<{ customerName?: string }>(
                  bid.extractedRequirements
                );
                const bu = bid.assignedBusinessUnitId ? buMap.get(bid.assignedBusinessUnitId) : null;

                return (
                  <Link
                    key={bid.id}
                    href={`/bl-review/${bid.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {extractedData?.customerName || 'Unbekannter Kunde'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {bu && (
                              <>
                                <Building2 className="h-3 w-3" />
                                <span>{bu.name}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>
                              {bid.updatedAt
                                ? new Date(bid.updatedAt).toLocaleDateString('de-DE')
                                : 'Unbekannt'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={bid.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Other Bids */}
      {(statusGroups.teamAssigned.length > 0 || statusGroups.notified.length > 0 || statusGroups.completed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Weitere RFPs</CardTitle>
            <CardDescription>
              RFPs mit zugewiesenem Team oder abgeschlossene Workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...statusGroups.teamAssigned, ...statusGroups.notified, ...statusGroups.completed].map((bid) => {
                const extractedData = safeJsonParseOrNull<{ customerName?: string }>(
                  bid.extractedRequirements
                );
                const bu = bid.assignedBusinessUnitId ? buMap.get(bid.assignedBusinessUnitId) : null;

                return (
                  <Link
                    key={bid.id}
                    href={`/bl-review/${bid.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {extractedData?.customerName || 'Unbekannter Kunde'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {bu && (
                              <>
                                <Building2 className="h-3 w-3" />
                                <span>{bu.name}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>
                              {bid.updatedAt
                                ? new Date(bid.updatedAt).toLocaleDateString('de-DE')
                                : 'Unbekannt'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={bid.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {assignedBids.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Keine RFPs zugewiesen</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Es wurden noch keine RFPs an Ihren Bereich weitergeleitet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    routed: { label: 'Weitergeleitet', variant: 'default' },
    full_scanning: { label: 'Deep Analysis', variant: 'default' },
    bl_reviewing: { label: 'In Prüfung', variant: 'default' },
    team_assigned: { label: 'Team zugewiesen', variant: 'secondary' },
    notified: { label: 'Benachrichtigt', variant: 'outline' },
    handed_off: { label: 'Abgeschlossen', variant: 'outline' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
