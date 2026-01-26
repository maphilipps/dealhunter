'use client';

/**
 * Similarity Tester Component (DEA-10)
 *
 * Allows testing RAG queries with adjustable similarity threshold.
 * Shows results with similarity scores for debugging retrieval.
 */

import { Search, Loader2, Bot, FileText, Clock, AlertCircle } from 'lucide-react';
import { useState, useCallback } from 'react';

import { ChunkDetailDialog } from './chunk-detail-dialog';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { searchSimilar } from '@/lib/rag/actions';
import type { SimilarityResult, SimilaritySearchResult } from '@/lib/rag/types';

interface SimilarityTesterProps {
  preQualificationId?: string;
  leadId?: string;
}

export function SimilarityTester({ preQualificationId, leadId }: SimilarityTesterProps) {
  const [query, setQuery] = useState('');
  const [threshold, setThreshold] = useState(0.5);
  const [maxResults, setMaxResults] = useState(10);
  const [includeRaw, setIncludeRaw] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimilaritySearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<SimilarityResult | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchResult = await searchSimilar({
        preQualificationId,
        leadId,
        query: query.trim(),
        threshold,
        maxResults,
        includeRawChunks: includeRaw,
      });

      if (searchResult.success) {
        setResult(searchResult.data);
      } else {
        setError(searchResult.error);
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      console.error('Similarity search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [preQualificationId, leadId, query, threshold, maxResults, includeRaw]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      void handleSearch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Similarity Tester
        </CardTitle>
        <CardDescription>
          Teste RAG-Queries und prüfe die Similarity-Scores der Ergebnisse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Query Input */}
        <div className="space-y-2">
          <Label htmlFor="query">Query</Label>
          <div className="flex gap-2">
            <Input
              id="query"
              placeholder="z.B. 'Welche CMS-Technologie wird verwendet?'"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Suchen</span>
            </Button>
          </div>
        </div>

        {/* Options */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Threshold Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Similarity Threshold</Label>
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {(threshold * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={([value]) => setThreshold(value)}
              min={0}
              max={1}
              step={0.05}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Nur Ergebnisse mit Similarity &gt;= {(threshold * 100).toFixed(0)}% anzeigen
            </p>
          </div>

          {/* Max Results Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max. Ergebnisse</Label>
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{maxResults}</span>
            </div>
            <Slider
              value={[maxResults]}
              onValueChange={([value]) => setMaxResults(value)}
              min={1}
              max={50}
              step={1}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Include Raw Chunks */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeRaw"
            checked={includeRaw}
            onCheckedChange={checked => setIncludeRaw(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="includeRaw" className="text-sm">
            Raw Document Chunks einschließen
          </Label>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fehler</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Result Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{result.results.length} Ergebnisse</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.searchTime}ms
              </span>
              {!result.queryEmbeddingGenerated && (
                <Badge variant="destructive">Embedding-Generierung fehlgeschlagen</Badge>
              )}
            </div>

            {/* Results List */}
            {result.results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Keine Ergebnisse über dem Threshold von {(threshold * 100).toFixed(0)}%.
                <br />
                <span className="text-sm">Versuche einen niedrigeren Threshold.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {result.results.map((item, index) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedChunk(item)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-mono text-muted-foreground">
                            #{index + 1}
                          </span>
                          {item.source === 'agent' ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              <Bot className="h-3 w-3 mr-1" />
                              {item.agentName}
                            </Badge>
                          ) : item.source === 'lead' ? (
                            <Badge variant="default" className="font-mono text-xs bg-green-600">
                              <Bot className="h-3 w-3 mr-1" />
                              {item.agentName || 'Lead'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              Raw Chunk
                            </Badge>
                          )}
                          {item.chunkType && (
                            <Badge variant="secondary" className="text-xs">
                              {item.chunkType}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm truncate">{item.content.slice(0, 200)}...</p>
                      </div>
                      <div className="flex-shrink-0">
                        <SimilarityBadge similarity={item.similarity} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detail Dialog */}
        <ChunkDetailDialog
          chunk={selectedChunk}
          open={!!selectedChunk}
          onOpenChange={open => !open && setSelectedChunk(null)}
        />
      </CardContent>
    </Card>
  );
}

function SimilarityBadge({ similarity }: { similarity: number }) {
  const percent = Math.round(similarity * 100);
  let variant: 'default' | 'secondary' | 'outline' = 'outline';
  let colorClass = '';

  if (percent >= 80) {
    variant = 'default';
    colorClass = 'bg-green-600';
  } else if (percent >= 60) {
    variant = 'secondary';
    colorClass = '';
  }

  return (
    <Badge variant={variant} className={`font-mono text-sm ${colorClass}`}>
      {percent}%
    </Badge>
  );
}
