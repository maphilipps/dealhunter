'use client';

import { AlertCircle, Calendar, CheckCircle2, Circle, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Milestone, TimingAnalysis } from '@/lib/agents/expert-agents/timing-schema';
import { cn } from '@/lib/utils';

export interface MilestoneTimelineProps {
  timing: TimingAnalysis;
  className?: string;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '–';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function getDaysUntil(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function getUrgencyVariant(
  days: number | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (days === null) return 'outline';
  if (days < 0) return 'destructive';
  if (days <= 7) return 'destructive';
  if (days <= 14) return 'default';
  return 'secondary';
}

interface TimelineItemProps {
  milestone: Milestone;
  isLast: boolean;
  isDeadline?: boolean;
}

function TimelineItem({ milestone, isLast, isDeadline = false }: TimelineItemProps) {
  const daysUntil = getDaysUntil(milestone.date);
  const isPast = daysUntil !== null && daysUntil < 0;

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-[11px] top-6 h-[calc(100%+8px)] w-0.5',
            isPast ? 'bg-muted' : 'bg-border'
          )}
        />
      )}

      {/* Timeline dot */}
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
        {isPast ? (
          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
        ) : isDeadline ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <Circle
            className={cn(
              'h-5 w-5',
              milestone.mandatory ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p
              className={cn(
                'font-medium leading-tight',
                isPast && 'text-muted-foreground line-through',
                isDeadline && !isPast && 'text-destructive'
              )}
            >
              {milestone.name}
            </p>
            {milestone.description && (
              <p className="text-sm text-muted-foreground">{milestone.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {milestone.date && (
              <Badge variant={isDeadline ? getUrgencyVariant(daysUntil) : 'outline'}>
                <Calendar className="mr-1 h-3 w-3" />
                {formatDate(milestone.date)}
              </Badge>
            )}
            {daysUntil !== null && daysUntil >= 0 && (
              <Badge variant={getUrgencyVariant(daysUntil)}>
                <Clock className="mr-1 h-3 w-3" />
                {daysUntil === 0 ? 'Heute' : `${daysUntil} Tage`}
              </Badge>
            )}
            <Badge variant={milestone.mandatory ? 'default' : 'secondary'}>
              {milestone.mandatory ? 'Pflicht' : 'Geschätzt'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MilestoneTimeline({ timing, className }: MilestoneTimelineProps) {
  // Build timeline items from timing data
  const timelineItems: (Milestone & { isDeadline?: boolean })[] = [];

  // Add submission deadline as prominent item
  if (timing.submissionDeadline?.date) {
    timelineItems.push({
      name: 'Abgabefrist',
      date: timing.submissionDeadline.date,
      dateType: 'exact',
      description: timing.submissionDeadline.rawText || null,
      mandatory: true,
      confidence: timing.submissionDeadline.confidence,
      isDeadline: true,
    });
  }

  // Add clarification deadline
  if (timing.clarificationDeadline) {
    timelineItems.push({
      name: 'Frist für Rückfragen',
      date: timing.clarificationDeadline,
      dateType: 'exact',
      description: null,
      mandatory: true,
      confidence: 70,
    });
  }

  // Add Q&A sessions
  timing.qaSessionDates?.forEach((date, index) => {
    timelineItems.push({
      name: `Q&A Session ${timing.qaSessionDates.length > 1 ? index + 1 : ''}`.trim(),
      date,
      dateType: 'exact',
      description: null,
      mandatory: false,
      confidence: 60,
    });
  });

  // Add milestones from the timing analysis
  timing.milestones.forEach(milestone => {
    timelineItems.push(milestone);
  });

  // Add award date
  if (timing.awardDate) {
    timelineItems.push({
      name: 'Zuschlagserteilung',
      date: timing.awardDate,
      dateType: 'estimated',
      description: null,
      mandatory: false,
      confidence: 50,
    });
  }

  // Add contract signing
  if (timing.contractSigningDate) {
    timelineItems.push({
      name: 'Vertragsunterzeichnung',
      date: timing.contractSigningDate,
      dateType: 'estimated',
      description: null,
      mandatory: false,
      confidence: 50,
    });
  }

  // Add project start
  if (timing.projectStart) {
    timelineItems.push({
      name: 'Projektstart',
      date: timing.projectStart,
      dateType: 'estimated',
      description: null,
      mandatory: false,
      confidence: 50,
    });
  }

  // Add project end
  if (timing.projectEnd) {
    timelineItems.push({
      name: 'Projektende',
      date: timing.projectEnd,
      dateType: 'estimated',
      description: null,
      mandatory: false,
      confidence: 50,
    });
  }

  // Sort by date
  timelineItems.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  if (timelineItems.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {timelineItems.map((item, index) => (
            <TimelineItem
              key={`${item.name}-${item.date}-${index}`}
              milestone={item}
              isLast={index === timelineItems.length - 1}
              isDeadline={'isDeadline' in item && item.isDeadline}
            />
          ))}
        </div>

        {/* Project duration summary */}
        {timing.projectDurationMonths && (
          <div className="mt-6 border-t pt-4">
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">Projektdauer</span>
              <span className="font-medium">{timing.projectDurationMonths} Monate</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
