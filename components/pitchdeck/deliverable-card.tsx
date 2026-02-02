'use client';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { RefreshCw, Loader2, Check, FileText, MessageSquare, Lightbulb, Eye } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getDeadlineStatus } from '@/lib/pitchdeck/timeline-calculator';

// Types for solution sketches
interface OutlineSection {
  title: string;
  keyPoints: string[];
  estimatedDuration?: string;
}

interface TalkingPoint {
  topic: string;
  keyMessages: string[];
  anticipatedQuestions?: string[];
}

interface VisualIdea {
  concept: string;
  description: string;
  suggestedFormat?: string;
}

interface DeliverableCardProps {
  deliverable: {
    id: string;
    deliverableName: string;
    status: string;
    internalDeadline: Date | null;
    outline: string | null;
    draft: string | null;
    talkingPoints: string | null;
    visualIdeas: string | null;
    generatedAt: Date | null;
  };
  leadId: string;
}

/**
 * DeliverableCard Component
 *
 * Displays a single deliverable with solution sketches and regenerate functionality.
 * Uses 2-click confirmation pattern: "Regenerieren" → "Erneut klicken zum Überschreiben" (3s timeout)
 */
export function DeliverableCard({ deliverable, leadId }: DeliverableCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirmState, setConfirmState] = useState<'idle' | 'confirming'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse solution sketches
  const outline = deliverable.outline
    ? (JSON.parse(deliverable.outline) as { outline: OutlineSection[] })
    : null;
  const talkingPoints = deliverable.talkingPoints
    ? (JSON.parse(deliverable.talkingPoints) as { talkingPoints: TalkingPoint[] })
    : null;
  const visualIdeas = deliverable.visualIdeas
    ? (JSON.parse(deliverable.visualIdeas) as { visualIdeas: VisualIdea[] })
    : null;

  const hasSolutionSketches = outline || deliverable.draft || talkingPoints || visualIdeas;

  // Calculate deadline status
  const deadlineStatus = deliverable.internalDeadline
    ? getDeadlineStatus(new Date(deliverable.internalDeadline))
    : null;

  // Reset confirm state after 3 seconds
  useEffect(() => {
    if (confirmState === 'confirming') {
      const timer = setTimeout(() => {
        setConfirmState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmState]);

  // Handle regenerate click
  const handleRegenerate = useCallback(async () => {
    if (confirmState === 'idle') {
      // First click - show confirmation
      setConfirmState('confirming');
      return;
    }

    // Second click - execute regeneration
    setIsRegenerating(true);
    setConfirmState('idle');

    try {
      const response = await fetch(
        `/api/pitches/${leadId}/pitchdeck/deliverables/${deliverable.id}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || 'Regeneration fehlgeschlagen');
      }

      toast.success(`"${deliverable.deliverableName}" wurde erfolgreich regeneriert`);

      // Refresh the page to show new data
      window.location.reload();
    } catch (error) {
      console.error('Regeneration error:', error);
      toast.error(error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsRegenerating(false);
    }
  }, [confirmState, deliverable.id, deliverable.deliverableName, leadId]);

  // Status badge colors
  const statusColors: Record<string, string> = {
    done: 'bg-green-100 text-green-700',
    review: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    draft: 'bg-gray-100 text-gray-700',
  };

  // Deadline badge colors
  const deadlineBadgeColors: Record<string, string> = {
    overdue: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    ok: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-lg border">
        {/* Header Row */}
        <div className="flex items-center justify-between p-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{deliverable.deliverableName}</p>
              {deadlineStatus && deliverable.internalDeadline && (
                <Badge variant="outline" className={deadlineBadgeColors[deadlineStatus]}>
                  {deadlineStatus === 'overdue' && 'Überfällig'}
                  {deadlineStatus === 'warning' && 'Bald fällig'}
                  {deadlineStatus === 'ok' &&
                    format(new Date(deliverable.internalDeadline), 'dd. MMM', { locale: de })}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>Status: {deliverable.status}</span>
              {deliverable.generatedAt && (
                <>
                  <span>•</span>
                  <span>
                    Generiert:{' '}
                    {format(new Date(deliverable.generatedAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Regenerate Button with 2-click confirmation */}
            <Button
              variant={confirmState === 'confirming' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => void handleRegenerate()}
              disabled={isRegenerating}
              className="min-w-[180px]"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regeneriert...
                </>
              ) : confirmState === 'confirming' ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Erneut klicken zum Überschreiben
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerieren
                </>
              )}
            </Button>

            {/* Status Badge */}
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusColors[deliverable.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {deliverable.status}
            </div>

            {/* Expand/Collapse Toggle */}
            {hasSolutionSketches && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                  <span className="ml-1">{isExpanded ? 'Verbergen' : 'Details'}</span>
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        {/* Collapsible Content - Solution Sketches */}
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Outline */}
              {outline && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Gliederung
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <ol className="list-inside list-decimal space-y-1 text-sm">
                      {outline.outline.map((section, idx) => (
                        <li key={idx} className="text-muted-foreground">
                          <span className="text-foreground">{section.title}</span>
                          {section.estimatedDuration && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({section.estimatedDuration})
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* Draft Preview */}
              {deliverable.draft && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Entwurf
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="line-clamp-4 text-sm text-muted-foreground">
                      {deliverable.draft.substring(0, 300)}
                      {deliverable.draft.length > 300 && '...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Talking Points */}
              {talkingPoints && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    Talking Points ({talkingPoints.talkingPoints.length})
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <ul className="space-y-1 text-sm">
                      {talkingPoints.talkingPoints.slice(0, 3).map((tp, idx) => (
                        <li key={idx} className="text-muted-foreground">
                          • <span className="text-foreground">{tp.topic}</span>
                        </li>
                      ))}
                      {talkingPoints.talkingPoints.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          + {talkingPoints.talkingPoints.length - 3} weitere...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Visual Ideas */}
              {visualIdeas && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="h-4 w-4" />
                    Visualisierungs-Ideen ({visualIdeas.visualIdeas.length})
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <ul className="space-y-1 text-sm">
                      {visualIdeas.visualIdeas.slice(0, 3).map((vi, idx) => (
                        <li key={idx} className="text-muted-foreground">
                          • <span className="text-foreground">{vi.concept}</span>
                          {vi.suggestedFormat && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {vi.suggestedFormat}
                            </Badge>
                          )}
                        </li>
                      ))}
                      {visualIdeas.visualIdeas.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          + {visualIdeas.visualIdeas.length - 3} weitere...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
