'use client';

import { Play, RefreshCw, Globe, Check } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateLeadWebsiteUrl } from '@/lib/pitches/actions';

interface AuditClientProps {
  leadId: string;
  websiteUrl: string;
  suggestedUrls?: Array<{ url: string; description?: string }>;
  existingNavigation: Array<{
    category: string;
    title: string;
    items: { slug: string; title: string }[];
  }>;
}

export function AuditClient({
  leadId,
  websiteUrl,
  suggestedUrls = [],
  existingNavigation,
}: AuditClientProps) {
  const [showStream, setShowStream] = useState(false);
  const [urlInput, setUrlInput] = useState(websiteUrl);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasResults = existingNavigation.length > 0;

  const handleStart = () => {
    setShowStream(true);
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
      {/* Start Button - only show when not scanning */}
      {!showStream && (
        <Card>
          <CardHeader>
            <CardTitle>Website Audit</CardTitle>
            <CardDescription>
              Analysiere {websiteUrl} für Tech-Stack, Seitentypen, Komponenten und mehr.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleStart}>
              {hasResults ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Audit neu starten
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Audit starten
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Activity Stream */}
      {showStream && (
        <ActivityStream
          streamUrl={`/api/pitches/${leadId}/audit/stream`}
          title="Website Audit"
          autoStart={true}
          grouped={true}
          onComplete={handleComplete}
        />
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
                          router.push(`/pitches/${leadId}/audit/${section.category}/${item.slug}`)
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
