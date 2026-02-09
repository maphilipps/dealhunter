'use client';

import { Check, FileSearch, Globe, Play, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';

import { Loader } from '@/components/ai-elements/loader';
import { ScanProgressChat } from '@/components/pitch-scan/scan-progress-chat';
import { ScanSectionGrid, type SectionData } from '@/components/pitch-scan/scan-section-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePitchScanProgress } from '@/hooks/use-pitch-scan-progress';
import { updateLeadWebsiteUrl, updateLeadClientUrl } from '@/lib/pitches/actions';

interface ScanHubClientProps {
  pitchId: string;
  websiteUrl: string;
  clientUrl: string;
  suggestedUrls?: Array<{ url: string; description?: string }>;
  completedSections: SectionData[];
  hasExistingRun: boolean;
  isRunning: boolean;
  runStatus: string | null;
}

export function ScanHubClient({
  pitchId,
  websiteUrl,
  clientUrl,
  suggestedUrls = [],
  completedSections,
  hasExistingRun,
  isRunning: initialIsRunning,
  runStatus,
}: ScanHubClientProps) {
  const [isScanning, setIsScanning] = useState(initialIsRunning);
  const [isStarting, setIsStarting] = useState(false);
  const [urlInput, setUrlInput] = useState(websiteUrl);
  const [clientUrlInput, setClientUrlInput] = useState(clientUrl);
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
      // Also save clientUrl if it was entered
      if (clientUrlInput && clientUrlInput !== clientUrl) {
        await updateLeadClientUrl(pitchId, clientUrlInput);
      }
      if (result.success) {
        router.refresh();
      }
    });
  };

  const handleSaveClientUrl = () => {
    startTransition(async () => {
      const result = await updateLeadClientUrl(pitchId, clientUrlInput);
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
            Bitte gib mindestens die Ziel-URL ein, bevor du den Pitch Scan startest.
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

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Auftraggeber-URL (optional)
              </label>
              <Input
                placeholder="https://organisation.de"
                value={clientUrlInput}
                onChange={e => setClientUrlInput(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Ziel-URL / Scan-URL (erforderlich)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://relaunch-ziel.de"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveUrl} disabled={isPending || !urlInput}>
                  {isPending ? <Loader size="sm" /> : 'Speichern'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls: Two URL fields + Start/Restart button */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">
            Auftraggeber
          </span>
          <Input
            value={clientUrlInput}
            onChange={e => setClientUrlInput(e.target.value)}
            placeholder="https://organisation.de"
            className="flex-1"
          />
          {clientUrlInput !== clientUrl && (
            <Button onClick={handleSaveClientUrl} disabled={isPending} size="sm" variant="outline">
              {isPending ? <Loader size="xs" /> : 'Speichern'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">
            Relaunch-Ziel
          </span>
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://relaunch-ziel.de"
            className="flex-1"
          />
          {urlInput !== websiteUrl && (
            <Button onClick={handleSaveUrl} disabled={isPending} size="sm" variant="outline">
              {isPending ? <Loader size="xs" /> : 'Speichern'}
            </Button>
          )}
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
      </div>
      {suggestedUrls.length > 0 && (
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
              <Check className="mr-1 h-3 w-3" />
              {suggestion.url}
            </Button>
          ))}
        </div>
      )}

      {/* Main layout: Grid + optional Pipeline sidebar */}
      {isScanning ? (
        <ScanProgressChat pitchId={pitchId} progress={progress} />
      ) : (
        <ScanSectionGrid pitchId={pitchId} completedSections={completedSections} />
      )}

      {/* Status: completed run summary + summary link */}
      {!isScanning && runStatus === 'completed' && completedSections.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {completedSections.length} Sektionen abgeschlossen. Klicke auf eine Sektion fuer
            Details.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => router.push(`/pitches/${pitchId}/pitch-scan/summary`)}
          >
            <FileSearch className="h-4 w-4" />
            Zusammenfassung anzeigen
          </Button>
        </div>
      )}
    </div>
  );
}
