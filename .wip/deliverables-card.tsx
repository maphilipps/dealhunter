'use client';

import { FileText, AlertCircle, Calendar, FileType, Copy } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RequiredDeliverable {
  name: string;
  description?: string;
  deadline?: string; // ISO format
  deadlineTime?: string; // HH:MM
  format?: string; // "PDF", "Word", "hardcopy"
  copies?: number;
  mandatory: boolean;
  confidence: number; // 0-100
}

interface DeliverablesCardProps {
  deliverables: RequiredDeliverable[];
}

/**
 * Deliverables Card - Einzureichende Unterlagen
 *
 * Zeigt alle requiredDeliverables aus extractedData an.
 * Gruppiert nach Mandatory vs Optional, sortiert nach Deadline.
 */
export function DeliverablesCard({ deliverables }: DeliverablesCardProps) {
  if (!deliverables || deliverables.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Einzureichende Unterlagen</CardTitle>
          </div>
          <CardDescription>Keine Angaben zu einzureichenden Unterlagen gefunden</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Gruppieren nach Mandatory vs Optional
  const mandatoryDeliverables = deliverables.filter(d => d.mandatory);
  const optionalDeliverables = deliverables.filter(d => !d.mandatory);

  // Sortieren nach Deadline (früheste zuerst)
  const sortByDeadline = (a: RequiredDeliverable, b: RequiredDeliverable) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  };

  mandatoryDeliverables.sort(sortByDeadline);
  optionalDeliverables.sort(sortByDeadline);

  // Helper: Deadline Badge mit Countdown
  const getDeadlineBadge = (deadline?: string, deadlineTime?: string) => {
    if (!deadline) {
      return <Badge variant="outline">Keine Frist angegeben</Badge>;
    }

    const deadlineDate = new Date(deadline);
    if (deadlineTime) {
      const [hours, minutes] = deadlineTime.split(':');
      deadlineDate.setHours(parseInt(hours), parseInt(minutes));
    }

    const now = new Date();
    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'outline';
    let label = deadlineDate.toLocaleDateString('de-DE');

    if (daysUntilDeadline < 0) {
      variant = 'destructive';
      label = `${label} (abgelaufen)`;
    } else if (daysUntilDeadline <= 7) {
      variant = 'destructive';
      label = `${label} (in ${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'Tag' : 'Tagen'})`;
    } else if (daysUntilDeadline <= 14) {
      variant = 'secondary';
      label = `${label} (in ${daysUntilDeadline} Tagen)`;
    }

    if (deadlineTime) {
      label = `${label} um ${deadlineTime} Uhr`;
    }

    return <Badge variant={variant}>{label}</Badge>;
  };

  // Helper: Render Deliverable Item
  const renderDeliverable = (deliverable: RequiredDeliverable, index: number) => {
    const hasDescription = deliverable.description && deliverable.description.trim().length > 0;

    // Check if deadline is critical (< 7 days)
    const isCritical = deliverable.deadline
      ? Math.ceil(
          (new Date(deliverable.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ) <= 7
      : false;

    return (
      <div key={index} className="space-y-2">
        {/* Deliverable Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{deliverable.name}</h4>
              {deliverable.mandatory && (
                <Badge variant="destructive" className="text-xs">
                  Pflicht
                </Badge>
              )}
              {deliverable.confidence < 70 && (
                <Badge variant="outline" className="text-xs">
                  {deliverable.confidence}% Verlässlichkeit
                </Badge>
              )}
            </div>

            {/* Metadata (Format, Copies) */}
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {deliverable.format && (
                <div className="flex items-center gap-1">
                  <FileType className="h-3 w-3" />
                  <span>{deliverable.format}</span>
                </div>
              )}
              {deliverable.copies && deliverable.copies > 1 && (
                <div className="flex items-center gap-1">
                  <Copy className="h-3 w-3" />
                  <span>{deliverable.copies}x</span>
                </div>
              )}
            </div>
          </div>

          {/* Deadline Badge */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {getDeadlineBadge(deliverable.deadline, deliverable.deadlineTime)}
          </div>
        </div>

        {/* Description (Accordion) */}
        {hasDescription && (
          <Accordion type="single" collapsible className="border-l-2 border-muted pl-4">
            <AccordionItem value={`deliverable-${index}`} className="border-0">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                Details anzeigen
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {deliverable.description}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Critical Deadline Alert */}
        {isCritical && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Frist läuft bald ab!</strong> Einreichung bis{' '}
              {new Date(deliverable.deadline!).toLocaleDateString('de-DE')}{' '}
              {deliverable.deadlineTime && `um ${deliverable.deadlineTime} Uhr`} erforderlich.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Einzureichende Unterlagen</CardTitle>
        </div>
        <CardDescription>
          {mandatoryDeliverables.length} Pflichtdokumente, {optionalDeliverables.length} optionale
          Dokumente
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Mandatory Deliverables */}
        {mandatoryDeliverables.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Pflichtdokumente</h3>
            <div className="space-y-4">{mandatoryDeliverables.map(renderDeliverable)}</div>
          </div>
        )}

        {/* Optional Deliverables */}
        {optionalDeliverables.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Optionale Dokumente</h3>
            <div className="space-y-4">{optionalDeliverables.map(renderDeliverable)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
