'use client';

import { Calendar, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { queryRagAction } from '@/lib/rag/actions';

interface TimelineCardProps {
  preQualificationId: string;
}

/**
 * Timeline Card - RAG-basierte Projekt-Timeline
 *
 * Nutzt RAG Query um Projekt-Phasen und Timeline aus QualificationScan-Daten zu generieren.
 * Zeigt horizontale Timeline mit Milestones, Total Duration, Confidence.
 */
export function TimelineCard({ preQualificationId }: TimelineCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<{
    answer: string;
    confidence: number;
    sources: string[];
  } | null>(null);

  useEffect(() => {
    async function loadTimeline() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await queryRagAction(
          preQualificationId,
          'Welche Projekt-Phasen und Timeline werden für die Migration geschätzt? ' +
            'Liste alle Phasen mit Wochen-Angaben, Tasks und Milestones. ' +
            'Gib auch die Gesamt-Dauer in Wochen an.',
          {
            maxTokens: 600,
            temperature: 0.3,
          }
        );

        if (!response.success) {
          setError(response.error);
        } else if (!response.data) {
          setError('Fehler beim Laden der Timeline-Daten.');
        } else if (response.data.confidence < 20) {
          setError('Nicht genügend Daten für Timeline-Schätzung verfügbar.');
        } else {
          setTimelineData(response.data);
        }
      } catch (err) {
        console.error('Timeline Card Error:', err);
        setError('Fehler beim Laden der Timeline-Daten.');
      } finally {
        setIsLoading(false);
      }
    }

    loadTimeline();
  }, [preQualificationId]);

  // Loading State
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Projekt-Timeline</CardTitle>
          </div>
          <CardDescription>Lädt Timeline-Schätzung...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error State
  if (error || !timelineData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Projekt-Timeline</CardTitle>
          </div>
          <CardDescription>Timeline-Schätzung</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Keine Timeline-Daten verfügbar'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Extract total duration from answer (simple regex)
  const durationMatch = timelineData.answer.match(/(\d+)\s*Wochen?/i);
  const totalWeeks = durationMatch ? parseInt(durationMatch[1]) : null;

  // Confidence Badge
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 70) {
      return <Badge variant="default">Hohe Verlässlichkeit ({confidence}%)</Badge>;
    } else if (confidence >= 40) {
      return <Badge variant="secondary">Mittlere Verlässlichkeit ({confidence}%)</Badge>;
    } else {
      return <Badge variant="outline">Geringe Verlässlichkeit ({confidence}%)</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <CardTitle>Projekt-Timeline</CardTitle>
        </div>
        <CardDescription>
          Geschätzte Projektdauer und Phasen
          {totalWeeks && (
            <span className="ml-2">
              <Badge variant="secondary" className="ml-2">
                {totalWeeks} Wochen
              </Badge>
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Confidence Indicator */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Schätzungs-Verlässlichkeit</span>
          {getConfidenceBadge(timelineData.confidence)}
        </div>

        {/* Timeline Content (RAG-generated) */}
        <div className="prose prose-sm max-w-none">
          <div
            className="text-sm space-y-3"
            dangerouslySetInnerHTML={{
              __html: timelineData.answer
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br />')
                .replace(/^(.+)$/, '<p>$1</p>'),
            }}
          />
        </div>

        {/* Data Sources */}
        {timelineData.sources.length > 0 && (
          <div className="pt-3 border-t">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <span>Datenquellen ({timelineData.sources.length})</span>
                <span className="text-xs">▼</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {timelineData.sources.map((source, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {source}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Low Confidence Warning */}
        {timelineData.confidence < 40 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Hinweis:</strong> Die Timeline-Schätzung basiert auf begrenzten Daten und
              sollte als grobe Orientierung betrachtet werden. Eine detaillierte Projektplanung nach
              Auftragserteilung empfohlen.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
