'use client';

import { Globe, Sparkles, Plus, X, ExternalLink, Check } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { suggestWebsiteUrlsAction } from '@/lib/bids/actions';

interface WebsiteUrl {
  url: string;
  type: 'primary' | 'product' | 'regional' | 'related' | 'corporate' | 'main' | 'other';
  description?: string;
  confidence?: number;
  selected: boolean;
}

interface WebsiteUrlInputProps {
  customerName: string;
  industry?: string;
  projectDescription?: string;
  technologies?: string[];
  onSubmit: (urls: WebsiteUrl[]) => void;
  isSubmitting?: boolean;
  autoLoadSuggestions?: boolean;
}

export function WebsiteUrlInput({
  customerName,
  industry,
  projectDescription,
  technologies,
  onSubmit,
  isSubmitting = false,
  autoLoadSuggestions = true,
}: WebsiteUrlInputProps) {
  const [urls, setUrls] = useState<WebsiteUrl[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadSuggestions = useCallback(async () => {
    if (!customerName) {
      toast.error('Kundenname nicht verfügbar');
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const result = await suggestWebsiteUrlsAction({
        customerName,
        industry,
        projectDescription,
        technologies,
      });

      if (result.success && result.suggestions.length > 0) {
        const newSuggestions: WebsiteUrl[] = result.suggestions.map(s => ({
          url: s.url,
          type: s.type,
          description: s.description,
          confidence: s.confidence,
          selected: false,
        }));
        setUrls(prev => [...prev, ...newSuggestions]);
        toast.success(`${result.suggestions.length} URL-Vorschläge generiert`);
      } else {
        toast.info('Keine URL-Vorschläge gefunden. Bitte manuell eingeben.');
      }
    } catch {
      toast.error('Fehler beim Generieren der Vorschläge');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [customerName, industry, projectDescription, technologies]);

  // Auto-load suggestions on mount
  useEffect(() => {
    if (autoLoadSuggestions && customerName && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void loadSuggestions();
    }
  }, [autoLoadSuggestions, customerName, loadSuggestions]);

  const handleAddManualUrl = () => {
    if (newUrl.trim()) {
      let url = newUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      setUrls(prev => [
        ...prev,
        {
          url,
          type: 'primary',
          description: 'Manuell hinzugefügt',
          selected: true,
        },
      ]);
      setNewUrl('');
    }
  };

  const handleToggleUrl = (index: number) => {
    setUrls(prev => prev.map((u, i) => (i === index ? { ...u, selected: !u.selected } : u)));
  };

  const handleRemoveUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const selectedUrls = urls.filter(u => u.selected);
    if (selectedUrls.length === 0) {
      toast.error('Bitte mindestens eine URL auswählen');
      return;
    }
    onSubmit(selectedUrls);
  };

  const selectedCount = urls.filter(u => u.selected).length;

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Website URL erforderlich
        </CardTitle>
        <CardDescription>
          Für die Qualification wird eine Website-URL benötigt. Sie können AI-Vorschläge generieren
          lassen oder URLs manuell eingeben.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Suggestions Button */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadSuggestions}
            disabled={isLoadingSuggestions}
          >
            {isLoadingSuggestions ? (
              <>
                <Loader size="sm" className="mr-2" />
                Lade Vorschläge...
              </>
            ) : urls.length > 0 ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Weitere Vorschläge laden
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI-Vorschläge für &quot;{customerName}&quot;
              </>
            )}
          </Button>
        </div>

        {/* URL List */}
        {urls.length > 0 && (
          <div className="space-y-2">
            {urls.map((urlItem, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  urlItem.selected ? 'border-primary bg-primary/5' : 'border-border bg-white'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {urlItem.confidence ? (
                    <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={urlItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline flex items-center gap-1"
                    >
                      {urlItem.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {urlItem.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {urlItem.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {urlItem.type}
                  </Badge>
                  {urlItem.confidence && (
                    <Badge variant="secondary" className="shrink-0">
                      {urlItem.confidence}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Button
                    type="button"
                    variant={urlItem.selected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleUrl(idx)}
                  >
                    {urlItem.selected ? <Check className="h-4 w-4" /> : 'Auswählen'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveUrl(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manual URL Entry */}
        <div className="flex gap-2">
          <Input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddManualUrl()}
            placeholder="https://www.beispiel.de"
            type="url"
            className="bg-white"
          />
          <Button type="button" onClick={handleAddManualUrl} variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Submit Button */}
        {urls.length > 0 && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSubmit} disabled={selectedCount === 0 || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader size="sm" className="mr-2" />
                  Wird gestartet...
                </>
              ) : (
                `Qualification starten (${selectedCount} URL${selectedCount !== 1 ? 's' : ''})`
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
