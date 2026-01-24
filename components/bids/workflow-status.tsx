'use client';

import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PreQualification } from '@/lib/db/schema';

interface WorkflowStatusProps {
  rfp: PreQualification;
}

/**
 * Workflow Status Component (DEA-90)
 *
 * Displays current workflow status and next agent in the pipeline.
 * Shows agent timeline with completed, running, and pending states.
 */
export function WorkflowStatus({ rfp }: WorkflowStatusProps) {
  const { status } = rfp;

  // Define workflow steps
  const steps = [
    { name: 'Extract', statuses: ['draft', 'extracting'], icon: 'document' },
    { name: 'Review', statuses: ['reviewing'], icon: 'user' },
    {
      name: 'Duplicate Check',
      statuses: ['duplicate_checking', 'duplicate_warning'],
      icon: 'search',
    },
    { name: 'Quick Scan', statuses: ['quick_scanning'], icon: 'scan' },
    { name: 'BID/NO-BID', statuses: ['bit_pending'], icon: 'decision' },
    { name: 'Timeline', statuses: ['timeline_estimating'], icon: 'calendar' },
    { name: 'Routing', statuses: ['decision_made'], icon: 'route' },
  ];

  // Determine current step
  const currentStepIndex = steps.findIndex(step => step.statuses.includes(status));

  // Status labels
  const statusLabels: Record<string, string> = {
    draft: 'Entwurf',
    extracting: 'Extraktion läuft',
    reviewing: 'Prüfung erforderlich',
    duplicate_checking: 'Duplikat-Prüfung läuft',
    duplicate_warning: 'Duplikat gefunden',
    quick_scanning: 'Quick Scan läuft',
    timeline_estimating: 'Timeline-Schätzung läuft',
    bit_pending: 'BID/NO-BID Entscheidung',
    decision_made: 'Entscheidung getroffen',
    archived: 'Archiviert (NO-BID)',
    routed: 'An BL weitergeleitet',
  };

  // Determine if processing
  const isProcessing = [
    'extracting',
    'duplicate_checking',
    'quick_scanning',
    'timeline_estimating',
  ].includes(status);

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Workflow Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center gap-4">
          <Badge variant={isProcessing ? 'default' : 'secondary'} className="text-xs">
            {statusLabels[status] || status}
          </Badge>

          {isProcessing && (
            <>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            </>
          )}
        </div>

        {/* Workflow Steps */}
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            return (
              <div key={step.name} className="flex items-center gap-3">
                {/* Status Icon */}
                {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {isCurrent && isProcessing && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
                {isCurrent && !isProcessing && <AlertCircle className="h-4 w-4 text-amber-600" />}
                {isPending && <Clock className="h-4 w-4 text-gray-400" />}

                {/* Step Name */}
                <span
                  className={`text-sm ${
                    isCompleted
                      ? 'text-green-700'
                      : isCurrent
                        ? 'font-medium text-blue-900'
                        : 'text-gray-500'
                  }`}
                >
                  {step.name}
                </span>

                {/* Current Status Detail */}
                {isCurrent && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {isProcessing ? 'läuft...' : 'wartet'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Duplicate Warning */}
        {status === 'duplicate_warning' && (
          <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-medium">Duplikat gefunden</p>
            <p className="mt-1 text-amber-700">
              Ein ähnliches RFP existiert bereits. Bitte prüfen Sie die Duplikate und entscheiden
              Sie, ob Sie fortfahren möchten.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
