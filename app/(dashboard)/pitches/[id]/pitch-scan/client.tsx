'use client';

import { Check, Globe, Play, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';

import { Loader } from '@/components/ai-elements/loader';
import { ScanProgressChat } from '@/components/pitch-scan/scan-progress-chat';
import { ScanSectionGrid, type SectionData } from '@/components/pitch-scan/scan-section-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePitchScanProgress } from '@/hooks/use-pitch-scan-progress';
import { updateLeadWebsiteUrl } from '@/lib/pitches/actions';

interface ScanHubClientProps {
  pitchId: string;
  websiteUrl: string;
  suggestedUrls?: Array<{ url: string; description?: string }>;
  completedSections: SectionData[];
  hasExistingRun: boolean;
  isRunning: boolean;
  runStatus: string | null;
}

export function ScanHubClient({
  pitchId,
  websiteUrl,
  suggestedUrls = [],
  completedSections,
  hasExistingRun,
  isRunning: initialIsRunning,
  runStatus,
}: ScanHubClientProps) {
  const [isScanning, setIsScanning] = useState(initialIsRunning);
  const [isStarting, setIsStarting] = useState(false);
  const [urlInput, setUrlInput] = useState(websiteUrl);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // SSE progress hook — only connect when scanning
  const progress = usePitchScanProgress(isScanning ? pitchId : null, {
    onComplete: useCallback(() => {
      setIsScanning(false);
      router.refresh();
    }, [router]),
  });

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/pitches/${pitchId}/pitch-scan/start`, { method: 'POST' });
      if (res.ok) {
        setIsScanning(true);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveUrl = () => {
    startTransition(async () => {
      const result = await updateLeadWebsiteUrl(pitchId, urlInput);
      if (result.success) {
        router.refresh();
      }
    });
  };

  const handleSelectSuggestion = (url: string) => {
    setUrlInput(url);
    startTransition(async () => {
      const result = await updateLeadWebsiteUrl(pitchId, url);
      if (result.success) {
        router.refresh();
      }
    });
  };

  // URL not yet set — show URL input first
  if (!websiteUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website-URL erforderlich
          </CardTitle>
          <CardDescription>
            Bitte wähle oder gib eine Website-URL ein, bevor du den Pitch Scan startest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestedUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Vorschläge aus dem Pre-Qualification:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedUrls.map(suggestion => (
                  <Button
                    key={suggestion.url}
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSelectSuggestion(suggestion.url)}
                    title={suggestion.description}
                  >
                    {isPending ? (
                      <Loader size="xs" className="mr-2" />
                    ) : (
                      <Check className="mr-2 h-3 w-3" />
                    )}
                    {suggestion.url}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSaveUrl} disabled={isPending || !urlInput}>
              {isPending ? <Loader size="sm" /> : 'Speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls: Start/Restart button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{websiteUrl}</div>
        <Button onClick={handleStart} disabled={isScanning || isStarting} size="sm">
          {isStarting ? (
            <>
              <Loader size="xs" className="mr-2" />
              Wird gestartet…
            </>
          ) : hasExistingRun ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Scan neu starten
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Scan starten
            </>
          )}
        </Button>
      </div>

      {/* Main layout: Grid + optional Pipeline sidebar */}
      {isScanning ? (
        <ScanProgressChat pitchId={pitchId} progress={progress} />
      ) : (
        <ScanSectionGrid pitchId={pitchId} completedSections={completedSections} />
      )}

      {/* Status: completed run summary */}
      {!isScanning && runStatus === 'completed' && completedSections.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {completedSections.length} von 13 Sektionen abgeschlossen. Klicke auf eine Sektion für
          Details.
        </p>
      )}
    </div>
  );
}
