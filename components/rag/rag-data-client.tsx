'use client';

/**
 * RAG Data Client Component (DEA-10)
 *
 * Tab-based container for all RAG data visibility components.
 * Provides unified interface for viewing agent outputs, raw chunks,
 * section data, and testing similarity search.
 */

import {
  Database,
  Bot,
  FileText,
  Layers,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useCallback, startTransition } from 'react';

import { ChunkBrowser } from './chunk-browser';
import { SimilarityTester } from './similarity-tester';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getRAGStats,
  getSectionData,
  getRfpIdForLead,
  getLeadEmbeddingsStats,
  getLeadEmbeddings,
  getLeadEmbeddingAgents,
  getLeadEmbeddingTypes,
  type LeadEmbeddingsResult,
} from '@/lib/rag/actions';
import type { RAGStats, SectionDataResult } from '@/lib/rag/types';

interface CombinedStats {
  rfpStats: RAGStats | null;
  leadStats: {
    total: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
  } | null;
}

interface RAGDataClientProps {
  leadId: string;
}

export function RAGDataClient({ leadId }: RAGDataClientProps) {
  const [preQualificationId, setRfpId] = useState<string | null>(null);
  const [combinedStats, setCombinedStats] = useState<CombinedStats>({
    rfpStats: null,
    leadStats: null,
  });
  const [sectionData, setSectionData] = useState<SectionDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Load Pre-Qualification ID and initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get Pre-Qualification ID (may be null)
      const rfpResult = await getRfpIdForLead(leadId);
      const foundRfpId = rfpResult.success ? rfpResult.data : null;
      setRfpId(foundRfpId);

      // Load all data in parallel
      const promises: Promise<unknown>[] = [
        getSectionData({ leadId }),
        getLeadEmbeddingsStats(leadId),
      ];

      // Only fetch pre-qualification stats if we have a pre-qualification
      if (foundRfpId) {
        promises.push(getRAGStats({ preQualificationId: foundRfpId }));
      }

      const results = await Promise.all(promises);
      const sectionResult = results[0] as Awaited<ReturnType<typeof getSectionData>>;
      const leadStatsResult = results[1] as Awaited<ReturnType<typeof getLeadEmbeddingsStats>>;
      const rfpStatsResult = foundRfpId
        ? (results[2] as Awaited<ReturnType<typeof getRAGStats>>)
        : null;

      setCombinedStats({
        rfpStats: rfpStatsResult?.success ? rfpStatsResult.data : null,
        leadStats: leadStatsResult.success ? leadStatsResult.data : null,
      });

      if (sectionResult.success) {
        setSectionData(sectionResult.data);
      }

      // Only show error if we have NO data at all
      const hasRfpData = rfpStatsResult?.success && rfpStatsResult.data.totalEmbeddings > 0;
      const hasLeadData = leadStatsResult.success && leadStatsResult.data.total > 0;

      if (!hasRfpData && !hasLeadData) {
        setError('Keine RAG-Daten für diesen Lead gefunden.');
      }
    } catch (err) {
      console.error('Failed to load RAG data:', err);
      setError('Fehler beim Laden der RAG-Daten.');
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = () => {
    startTransition(() => {
      void loadData();
    });
  };

  // Only show error if we have NO data sources at all
  const hasAnyData = combinedStats.rfpStats || combinedStats.leadStats;
  if (error && !hasAnyData && !isLoading) {
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
          <p className="text-muted-foreground">Alle gespeicherten RAG-Daten für diesen Lead</p>
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
          <CombinedStatsCard stats={combinedStats} isLoading={isLoading} />
        </TabsContent>

        {/* Agent Outputs Tab - shows Pre-Qualification embeddings if available */}
        <TabsContent value="agent-outputs" className="mt-6">
          {rfpId ? (
            <ChunkBrowser rfpId={preQualificationId} mode="agent" />
          ) : (
            <NoDataPlaceholder message="Keine Pre-Qualification-Daten - Agent Outputs nur mit Pre-Qualification verfügbar" />
          )}
        </TabsContent>

        {/* Raw Chunks Tab - shows Lead Embeddings (Audit Data) */}
        <TabsContent value="raw-chunks" className="mt-6">
          <LeadEmbeddingsBrowser leadId={leadId} />
        </TabsContent>

        {/* Section Data Tab */}
        <TabsContent value="section-data" className="mt-6">
          <SectionDataView data={sectionData} isLoading={isLoading} />
        </TabsContent>

        {/* Similarity Tester Tab */}
        <TabsContent value="similarity" className="mt-6">
          <SimilarityTester rfpId={rfpId ?? undefined} leadId={leadId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoDataPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-muted-foreground">{message}</div>
  );
}

// ============================================================================
// Combined Stats Card
// ============================================================================

function CombinedStatsCard({ stats, isLoading }: { stats: CombinedStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const preQualification = stats.rfpStats;
  const lead = stats.leadStats;

  const totalRfpEmbeddings = preQualification?.totalEmbeddings ?? 0;
  const totalRfpRawChunks = preQualification?.totalRawChunks ?? 0;
  const totalLeadEmbeddings = lead?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pre-Qualification Agent Outputs</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRfpEmbeddings.toLocaleString('de-DE')}</div>
            <p className="text-xs text-muted-foreground">{preQualification?.agentStats.length ?? 0} Agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pre-Qualification Raw Chunks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRfpRawChunks.toLocaleString('de-DE')}</div>
            <p className="text-xs text-muted-foreground">Dokument-Fragmente</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Embeddings</CardTitle>
            <Layers className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {totalLeadEmbeddings.toLocaleString('de-DE')}
            </div>
            <p className="text-xs text-muted-foreground">Audit / Deep Scan Daten</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Embeddings Breakdown */}
      {lead && lead.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Lead Embeddings nach Agent
            </CardTitle>
            <CardDescription>
              {lead.total} Chunks von {Object.keys(lead.byAgent).length} Quellen gespeichert
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(lead.byAgent).map(([agent, agentCount]) => (
                <div key={agent} className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono">
                    {agent}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{agentCount} Chunks</span>
                </div>
              ))}
            </div>

            {/* Chunk Types */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Chunk Types:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(lead.byType).map(([type, typeCount]) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}: {typeCount}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-Qualification Agent Breakdown */}
      {rfp && preQualification.agentStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Pre-Qualification Agent Outputs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {preQualification.agentStats.map(agent => (
                <div key={agent.agentName} className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono">
                    {agent.agentName}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{agent.chunkCount} Chunks</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Lead Embeddings Browser
// ============================================================================

const PAGE_SIZE = 20;

function LeadEmbeddingsBrowser({ leadId }: { leadId: string }) {
  const [data, setData] = useState<LeadEmbeddingsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load filter options
  useEffect(() => {
    void Promise.all([getLeadEmbeddingAgents(leadId), getLeadEmbeddingTypes(leadId)]).then(
      ([agentsResult, typesResult]) => {
        if (agentsResult.success) setAvailableAgents(agentsResult.data);
        if (typesResult.success) setAvailableTypes(typesResult.data);
      }
    );
  }, [leadId]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getLeadEmbeddings({
        qualificationId: leadId,
        agentName: agentFilter,
        chunkType: typeFilter,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch lead embeddings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [leadId, agentFilter, typeFilter, debouncedSearch, page]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const items = data?.items || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Lead Embeddings (Audit / Deep Scan)
        </CardTitle>
        <CardDescription>
          {data ? `${data.total} Einträge gefunden` : 'Lade Daten...'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suchen in Inhalten..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={agentFilter ?? 'all'}
            onValueChange={v => {
              setAgentFilter(v === 'all' ? undefined : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Agent Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Agents</SelectItem>
              {availableAgents.map(agent => (
                <SelectItem key={agent} value={agent}>
                  {agent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={typeFilter ?? 'all'}
            onValueChange={v => {
              setTypeFilter(v === 'all' ? undefined : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Types</SelectItem>
              {availableTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border rounded-md">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine Lead Embeddings gefunden.
            {debouncedSearch && ' Versuche andere Suchbegriffe.'}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Inhalt (Vorschau)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.chunkIndex}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.agentName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {item.chunkType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="truncate text-sm">{item.content.slice(0, 150)}...</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Seite {data.page} von {data.totalPages} ({data.total} Einträge)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" /> Zurück
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= data.totalPages}
                  >
                    Weiter <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section Data View
// ============================================================================

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
        <CardDescription>{data.total} Sections mit synthetisierten Inhalten</CardDescription>
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
