'use client';

/**
 * RAG Data Client Component (DEA-10)
 *
 * Tab-based container for all RAG data visibility components.
 * Provides unified interface for viewing agent outputs, raw chunks,
 * section data, and testing similarity search.
 */

import { Database, Bot, FileText, Layers, Search, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback, startTransition } from 'react';

import { ChunkBrowser } from './chunk-browser';
import { RAGStatsCard } from './rag-stats-card';
import { SimilarityTester } from './similarity-tester';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRAGStats, getSectionData, getRfpIdForLead } from '@/lib/rag/actions';
import type { RAGStats, SectionDataResult } from '@/lib/rag/types';

interface RAGDataClientProps {
  leadId: string;
}

export function RAGDataClient({ leadId }: RAGDataClientProps) {
  const [rfpId, setRfpId] = useState<string | null>(null);
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [sectionData, setSectionData] = useState<SectionDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Load RFP ID and initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First get the RFP ID for this lead
      const rfpResult = await getRfpIdForLead(leadId);
      if (!rfpResult.success || !rfpResult.data) {
        setError('Keine RFP-Daten für diesen Lead gefunden.');
        setIsLoading(false);
        return;
      }

      const foundRfpId = rfpResult.data;
      setRfpId(foundRfpId);

      // Load stats and section data in parallel
      const [statsResult, sectionResult] = await Promise.all([
        getRAGStats({ rfpId: foundRfpId }),
        getSectionData({ leadId }),
      ]);

      if (statsResult.success) {
        setStats(statsResult.data);
      }
      if (sectionResult.success) {
        setSectionData(sectionResult.data);
      }
    } catch (err) {
      console.error('Failed to load RAG data:', err);
      setError('Fehler beim Laden der RAG-Daten.');
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    startTransition(() => {
      loadData();
    });
  };

  if (error && !rfpId) {
    return (
      <Alert variant="destructive">
        <Database className="h-4 w-4" />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">RAG Data Visibility</h2>
          <p className="text-muted-foreground">
            Alle gespeicherten RAG-Daten für diesen Lead
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Übersicht</span>
          </TabsTrigger>
          <TabsTrigger value="agent-outputs" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Agent Outputs</span>
          </TabsTrigger>
          <TabsTrigger value="raw-chunks" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Raw Chunks</span>
          </TabsTrigger>
          <TabsTrigger value="section-data" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Section Data</span>
          </TabsTrigger>
          <TabsTrigger value="similarity" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Similarity Test</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <RAGStatsCard stats={stats} isLoading={isLoading} />
        </TabsContent>

        {/* Agent Outputs Tab */}
        <TabsContent value="agent-outputs" className="mt-6">
          {rfpId ? (
            <ChunkBrowser rfpId={rfpId} mode="agent" />
          ) : (
            <NoDataPlaceholder message="Lade Agent Outputs..." />
          )}
        </TabsContent>

        {/* Raw Chunks Tab */}
        <TabsContent value="raw-chunks" className="mt-6">
          {rfpId ? (
            <ChunkBrowser rfpId={rfpId} mode="raw" />
          ) : (
            <NoDataPlaceholder message="Lade Raw Chunks..." />
          )}
        </TabsContent>

        {/* Section Data Tab */}
        <TabsContent value="section-data" className="mt-6">
          <SectionDataView data={sectionData} isLoading={isLoading} />
        </TabsContent>

        {/* Similarity Tester Tab */}
        <TabsContent value="similarity" className="mt-6">
          {rfpId ? (
            <SimilarityTester rfpId={rfpId} />
          ) : (
            <NoDataPlaceholder message="Lade Similarity Tester..." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoDataPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-muted-foreground">
      {message}
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

function SectionDataView({
  data,
  isLoading,
}: {
  data: SectionDataResult | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Section Data
          </CardTitle>
          <CardDescription>Keine Section Data vorhanden</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Section Data wird während des Deep Scan Prozesses generiert.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Section Data
        </CardTitle>
        <CardDescription>
          {data.total} Sections mit synthetisierten Inhalten
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.items.map(section => (
            <div key={section.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {section.sectionId}
                  </Badge>
                  {section.confidence && (
                    <Badge
                      variant={
                        section.confidence > 0.8
                          ? 'default'
                          : section.confidence > 0.5
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {Math.round(section.confidence * 100)}% Confidence
                    </Badge>
                  )}
                </div>
                {section.updatedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(section.updatedAt).toLocaleString('de-DE')}
                  </span>
                )}
              </div>
              <ScrollArea className="h-32">
                <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                  {typeof section.content === 'string'
                    ? section.content
                    : JSON.stringify(section.content, null, 2)}
                </pre>
              </ScrollArea>
              {section.sources && section.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {section.sources.slice(0, 5).map((source, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {source}
                    </Badge>
                  ))}
                  {section.sources.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{section.sources.length - 5} mehr
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
