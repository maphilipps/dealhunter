'use client';

import { useState, useEffect } from 'react';
import { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AuditStatus {
  hasAuditDirectory: boolean;
  hasAuditDataInRAG: boolean;
  auditPath: string | null;
  domain: string | null;
  chunksCount: number;
  status: 'not_available' | 'available' | 'ingested' | 'ingesting' | 'error';
  error?: string;
}

interface AuditStatusBadgeProps {
  leadId: string;
  variant?: 'badge' | 'card';
}

export function AuditStatusBadge({ leadId, variant = 'badge' }: AuditStatusBadgeProps) {
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch(`/api/leads/${leadId}/audit/status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching audit status:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatus();
  }, [leadId]);

  async function handleIngest() {
    setIsIngesting(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/audit/status`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refresh status after successful ingestion
        const statusResponse = await fetch(`/api/leads/${leadId}/audit/status`);
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          setStatus(data);
        }
      }
    } catch (error) {
      console.error('Error ingesting audit data:', error);
    } finally {
      setIsIngesting(false);
    }
  }

  if (isLoading) {
    return variant === 'badge' ? (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Prüfe Audit-Daten...
      </Badge>
    ) : null;
  }

  if (!status || status.status === 'not_available') {
    return null; // Don't show anything if no audit data available
  }

  if (status.status === 'error') {
    return variant === 'badge' ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Audit-Fehler
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{status.error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      <Card className="border-destructive">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Audit-Fehler</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{status.error}</p>
        </CardContent>
      </Card>
    );
  }

  if (status.status === 'available') {
    return variant === 'badge' ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-primary/10"
              onClick={handleIngest}
            >
              {isIngesting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Importiere...
                </>
              ) : (
                <>
                  <Database className="h-3 w-3" />
                  Audit-Daten verfügbar
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Audit-Daten für {status.domain} gefunden. Klicken zum Importieren in das RAG-System.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-base">Audit-Daten verfügbar</CardTitle>
            </div>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
              {status.domain}
            </Badge>
          </div>
          <CardDescription>
            Detaillierte Website-Analyse-Daten wurden gefunden und können importiert werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleIngest} disabled={isIngesting} size="sm">
            {isIngesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importiere Audit-Daten...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                In RAG-System importieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status.status === 'ingested') {
    return variant === 'badge' ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="default" className="gap-1 bg-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Audit-Daten geladen ({status.chunksCount} Chunks)
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Audit-Daten für {status.domain} sind im RAG-System verfügbar. {status.chunksCount}{' '}
              Chunks für semantische Suche.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Audit-Daten geladen</CardTitle>
            </div>
            <Badge variant="default" className="bg-green-600">
              {status.chunksCount} Chunks
            </Badge>
          </div>
          <CardDescription>
            Detaillierte Website-Analyse-Daten für {status.domain} sind im RAG-System verfügbar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return null;
}
