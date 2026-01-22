'use client';

import { Activity, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface BackgroundJob {
  id: string;
  jobType: 'deep-analysis' | 'team-notification' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface JobProgressCardProps {
  job: BackgroundJob | null;
  title?: string;
  description?: string;
  showDetails?: boolean;
  onRetry?: () => void;
}

export function JobProgressCard({
  job,
  title = 'Background Job Status',
  description,
  showDetails = true,
  onRetry,
}: JobProgressCardProps) {
  if (!job) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Noch kein Job gestartet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={getCardClassName(job.status)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <JobStatusIcon status={job.status} />
            {title}
          </CardTitle>
          <JobStatusBadge status={job.status} />
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {(job.status === 'running' || job.status === 'pending') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fortschritt</span>
              <span className="font-medium">{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-2" />
          </div>
        )}

        {/* Current Step */}
        {job.currentStep && (job.status === 'running' || job.status === 'pending') && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium text-muted-foreground mb-1">Aktueller Schritt</p>
            <p className="text-sm">{job.currentStep}</p>
          </div>
        )}

        {/* Success Message */}
        {job.status === 'completed' && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-sm font-medium">Job erfolgreich abgeschlossen</p>
          </div>
        )}

        {/* Error Message */}
        {job.status === 'failed' && job.errorMessage && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Fehler aufgetreten</p>
                <p className="text-xs mt-1">{job.errorMessage}</p>
              </div>
            </div>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm" className="w-full">
                Erneut versuchen
              </Button>
            )}
          </div>
        )}

        {/* Details */}
        {showDetails && (
          <div className="pt-2 border-t grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {job.startedAt && (
              <div>
                <p className="font-medium">Gestartet</p>
                <p>{new Date(job.startedAt).toLocaleString('de-DE')}</p>
              </div>
            )}
            {job.completedAt && (
              <div>
                <p className="font-medium">Abgeschlossen</p>
                <p>{new Date(job.completedAt).toLocaleString('de-DE')}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCardClassName(status: BackgroundJob['status']): string {
  switch (status) {
    case 'running':
      return 'border-blue-200 bg-blue-50/50';
    case 'completed':
      return 'border-green-200 bg-green-50/50';
    case 'failed':
      return 'border-destructive';
    case 'cancelled':
      return 'border-gray-200';
    default:
      return '';
  }
}

function JobStatusIcon({ status }: { status: BackgroundJob['status'] }) {
  switch (status) {
    case 'running':
      return <Activity className="h-5 w-5 animate-pulse text-blue-600" />;
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-gray-600" />;
    case 'cancelled':
      return <XCircle className="h-5 w-5 text-gray-600" />;
    default:
      return <Activity className="h-5 w-5" />;
  }
}

function JobStatusBadge({ status }: { status: BackgroundJob['status'] }) {
  const statusConfig = {
    pending: { label: 'Ausstehend', variant: 'outline' as const },
    running: { label: 'Läuft', variant: 'default' as const },
    completed: { label: 'Abgeschlossen', variant: 'default' as const },
    failed: { label: 'Fehlgeschlagen', variant: 'destructive' as const },
    cancelled: { label: 'Abgebrochen', variant: 'outline' as const },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
