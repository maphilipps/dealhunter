'use client';

import { Send, CheckCircle2, XCircle, Mail, Clock, AlertCircle } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { sendTeamNotifications } from '@/lib/notifications/actions';
import type { TeamNotificationResult } from '@/lib/notifications/email';

interface NotificationCardProps {
  bidId: string;
  hasTeam: boolean;
  initialResults?: TeamNotificationResult[] | null;
  notifiedAt?: Date | null;
}

export function NotificationCard({
  bidId,
  hasTeam,
  initialResults,
  notifiedAt,
}: NotificationCardProps) {
  const [results, setResults] = useState<TeamNotificationResult[] | null>(initialResults || null);
  const [sentAt, setSentAt] = useState<Date | null>(notifiedAt || null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      const response = await sendTeamNotifications(bidId);
      if (response.success && response.results) {
        setResults(response.results);
        setSentAt(new Date());
      } else {
        setError(response.error || 'Unbekannter Fehler');
      }
    });
  };

  // Not ready state
  if (!hasTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Team-Benachrichtigung
          </CardTitle>
          <CardDescription>Team muss zuerst zugewiesen sein</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Weisen Sie zuerst ein Team zu, bevor Benachrichtigungen versendet werden können.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show results if already sent
  if (results && results.length > 0) {
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Team-Benachrichtigung
              </CardTitle>
              <CardDescription>
                {sentAt
                  ? `Versendet am ${new Date(sentAt).toLocaleDateString('de-DE')} um ${new Date(sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Versand-Status'}
              </CardDescription>
            </div>
            {failedCount === 0 ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Alle versendet
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="mr-1 h-3 w-3" />
                {failedCount} fehlgeschlagen
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {sentCount} versendet
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-4 w-4" />
                {failedCount} fehlgeschlagen
              </span>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-2">
            {results.map(result => (
              <div
                key={result.employeeId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {result.status === 'sent' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : result.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">{result.employeeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {result.status === 'sent' && result.sentAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(result.sentAt).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {result.status === 'failed' && result.error && (
                    <span className="text-xs text-red-600" title={result.error}>
                      Fehler
                    </span>
                  )}
                  <Badge
                    variant={result.status === 'sent' ? 'outline' : 'destructive'}
                    className="text-xs"
                  >
                    {result.status === 'sent'
                      ? 'Versendet'
                      : result.status === 'failed'
                        ? 'Fehler'
                        : 'Ausstehend'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Resend Button (only if there were failures) */}
          {failedCount > 0 && (
            <Button onClick={handleSend} disabled={isPending} variant="outline">
              {isPending ? (
                <>
                  <Loader size="sm" className="mr-2" />
                  Sende erneut...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Fehlgeschlagene erneut senden
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Not sent yet - show send button
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Team-Benachrichtigung
        </CardTitle>
        <CardDescription>Benachrichtige alle Team-Mitglieder über ihre Zuweisung</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sendet eine personalisierte E-Mail an jedes Team-Mitglied mit Projekt-Details, ihrer Rolle
          und den nächsten Schritten.
        </p>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <Button onClick={handleSend} disabled={isPending}>
          {isPending ? (
            <>
              <Loader size="sm" className="mr-2" />
              Sende Benachrichtigungen...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Team benachrichtigen
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
