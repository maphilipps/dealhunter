import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAuditLogs } from '@/lib/admin/audit-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AuditTrailPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const result = await getAuditLogs(100);
  const auditLogs = result.success ? result.auditLogs : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Audit Trail</h1>
          <p className="text-muted-foreground">
            Systemweites Audit-Logs für Compliance und Nachverfolgbarkeit
          </p>
        </div>

        {!auditLogs || auditLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Noch keine Audit-Logs vorhanden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => {
              const changes = log.changes ? JSON.parse(log.changes) : null;

              return (
                <Card key={log.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium">
                        {log.action} - {log.entityType}
                      </CardTitle>
                      <Badge variant="outline">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('de-DE') : 'N/A'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Von: {log.userName || 'Unknown'} ({log.userEmail})
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="space-y-1">
                      <div>
                        <span className="text-muted-foreground">Entity ID:</span>
                        <code className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">{log.entityId}</code>
                      </div>
                      {changes && (
                        <div>
                          <span className="text-muted-foreground">Changes:</span>
                          <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(changes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
