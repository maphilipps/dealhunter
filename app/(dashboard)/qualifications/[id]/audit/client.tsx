'use client';

import { Play, RefreshCw, Globe, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';

import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { DeepScanResultsPreview } from '@/components/qualifications/deep-scan-results-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDeepScan } from '@/contexts/deep-scan-context';
import { updateLeadWebsiteUrl } from '@/lib/qualifications/actions';

interface DeepScanClientProps {
  leadId: string;
  websiteUrl: string;
  suggestedUrls?: Array<{ url: string; description?: string }>;
  existingNavigation: Array<{
    category: string;
    title: string;
    items: { slug: string; title: string }[];
  }>;
}

export function DeepScanClient({
  leadId,
  websiteUrl,
  suggestedUrls = [],
  existingNavigation,
}: DeepScanClientProps) {
  const [showStream, setShowStream] = useState(false);
  const [urlInput, setUrlInput] = useState(websiteUrl);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Use DeepScan context for stream state
  const deepScan = useDeepScan();
  const isScanning = deepScan.status === 'running' || deepScan.status === 'pending';
  const hasResults = existingNavigation.length > 0 || deepScan.completedExperts.length > 0;

  // Show stream when scanning
  useEffect(() => {
    if (deepScan.status === 'running') {
      setShowStream(true);
    }
  }, [deepScan.status]);

  const handleStart = () => {
    setShowStream(true);
    deepScan.startDeepScan();
  };

  const handleComplete = () => {
    // Refresh the page to get updated navigation from DB
    router.refresh();
  };

  const handleSaveUrl = () => {
    startTransition(async () => {
      const result = await updateLeadWebsiteUrl(leadId, urlInput);
      if (result.success) {
        router.refresh();
      }
    });
  };

  const handleSelectSuggestion = (url: string) => {
    setUrlInput(url);
    startTransition(async () => {
      const result = await updateLeadWebsiteUrl(leadId, url);
      if (result.success) {
        router.refresh();
      }
    });
  };

  if (!websiteUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website-URL erforderlich
          </CardTitle>
          <CardDescription>
            Bitte wähle oder gib eine Website-URL ein, bevor du den Audit startest.
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
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
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
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Start Button - only show when not scanning */}
      {!showStream && (
        <Card>
          <CardHeader>
            <CardTitle>DeepScan Audit</CardTitle>
            <CardDescription>
              Analysiere {websiteUrl} für Tech-Stack, Seitentypen, Komponenten und mehr.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleStart} disabled={isScanning}>
              {hasResults ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Audit neu starten
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  DeepScan starten
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Activity Stream - connected to Context */}
      {showStream && (
        <ActivityStream
          streamUrl={`/api/qualifications/${leadId}/deep-scan/stream`}
          title="DeepScan Audit"
          autoStart={true}
          grouped={true}
          onComplete={handleComplete}
        />
      )}

      {/* Progressive Results Preview - shows completed experts during scan */}
      {showStream && deepScan.completedExperts.length > 0 && (
        <DeepScanResultsPreview leadId={leadId} />
      )}

      {/* Existing Navigation (if results exist and not scanning) */}
      {hasResults && !showStream && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Ergebnisse</CardTitle>
            <CardDescription>Vorhandene Analyse-Ergebnisse</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {existingNavigation.map(section => (
                <div key={section.category}>
                  <h4 className="font-medium mb-2">{section.title}</h4>
                  <div className="flex flex-wrap gap-2">
                    {section.items.map(item => (
                      <Button
                        key={item.slug}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/qualifications/${leadId}/audit/${section.category}/${item.slug}`
                          )
                        }
                      >
                        {item.title}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
