'use client';

import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

interface SectionStatus {
  sectionId: string;
  hasRagData: boolean;
  hasVisualization: boolean;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
}

interface BulkVisualizationGeneratorProps {
  leadId: string;
}

export function BulkVisualizationGenerator({ leadId }: BulkVisualizationGeneratorProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [focusPrompt, setFocusPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sectionStatus, setSectionStatus] = useState<SectionStatus[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [job, setJob] = useState<JobStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/pitches/${leadId}/visualize-all`);
      const data = await response.json();

      if (response.ok) {
        setSectionStatus(data.sections || []);
        setMissingCount(data.missingVisualizations || 0);
        setJob(data.job || null);
      }
    } catch (err) {
      console.error('Failed to fetch visualization status:', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Poll for job status when running
  useEffect(() => {
    if (!job || (job.status !== 'pending' && job.status !== 'running')) return;

    const interval = setInterval(() => {
      void fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [job, fetchStatus]);

  const handleGenerateAll = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/pitches/${leadId}/visualize-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusPrompt: focusPrompt.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Starten');
      }

      setFocusPrompt('');

      if (data.status === 'already_running') {
        setSuccess('Eine Generierung läuft bereits');
      } else {
        setSuccess('Generierung gestartet');
      }

      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  }, [leadId, focusPrompt, fetchStatus]);

  // Don't show if loading
  if (loading) {
    return null;
  }

  // Don't show if no RAG data yet
  if (sectionStatus.length === 0) {
    return null;
  }

  // Job is running - show progress
  if (job && (job.status === 'pending' || job.status === 'running')) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader size="md" />
            Visualisierungen werden generiert...
          </CardTitle>
          <CardDescription>
            {job.status === 'pending' ? 'Job in Warteschlange' : `${job.progress}% abgeschlossen`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={job.progress} />
        </CardContent>
      </Card>
    );
  }

  // All visualizations exist - don't show
  if (missingCount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          Visualisierungen generieren
        </CardTitle>
        <CardDescription>
          {missingCount} von {sectionStatus.length} Sektionen ohne Visualisierung
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Textarea
            placeholder="Optional: Fokus für alle Visualisierungen, z.B. 'Konzentriere dich auf Migration und technische Risiken'..."
            value={focusPrompt}
            onChange={e => setFocusPrompt(e.target.value)}
            disabled={submitting}
            rows={1}
            className="min-h-[40px] resize-none"
          />
          <Button onClick={handleGenerateAll} disabled={submitting} className="shrink-0">
            {submitting ? <Loader size="sm" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
