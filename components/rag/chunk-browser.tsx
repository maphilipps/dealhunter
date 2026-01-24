'use client';

/**
 * Chunk Browser Component (DEA-10)
 *
 * Paginated, searchable browser for agent outputs and raw chunks.
 * Uses Server Actions for data fetching with TanStack-like pagination.
 */

import { Search, ChevronLeft, ChevronRight, Bot, FileText, Eye, Filter } from 'lucide-react';
import { useState, useCallback, useEffect, startTransition } from 'react';

import { ChunkDetailDialog } from './chunk-detail-dialog';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { getAgentOutputs, getRawChunks, getAgentNames, getChunkTypes } from '@/lib/rag/actions';
import type {
  AgentOutput,
  RawChunkItem,
  AgentOutputsResult,
  RawChunksResult,
} from '@/lib/rag/types';

type BrowserMode = 'agent' | 'raw';

interface ChunkBrowserProps {
  rfpId: string;
  mode: BrowserMode;
}

const PAGE_SIZE = 20;

export function ChunkBrowser({ rfpId, mode }: ChunkBrowserProps) {
  const [data, setData] = useState<AgentOutputsResult | RawChunksResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<AgentOutput | RawChunkItem | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load filter options for agent mode
  useEffect(() => {
    if (mode === 'agent') {
      void Promise.all([getAgentNames(rfpId), getChunkTypes(rfpId)]).then(
        ([agentsResult, typesResult]) => {
          if (agentsResult.success) setAvailableAgents(agentsResult.data);
          if (typesResult.success) setAvailableTypes(typesResult.data);
        }
      );
    }
  }, [rfpId, mode]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    startTransition(async () => {
      try {
        if (mode === 'agent') {
          const result = await getAgentOutputs({
            rfpId,
            agentName: agentFilter,
            chunkType: typeFilter,
            search: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
          });
          if (result.success) {
            setData(result.data);
          }
        } else {
          const result = await getRawChunks({
            rfpId,
            search: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
          });
          if (result.success) {
            setData(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch chunks:', error);
      } finally {
        setIsLoading(false);
      }
    });
  }, [rfpId, mode, page, agentFilter, typeFilter, debouncedSearch]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && data && newPage <= data.totalPages) {
      setPage(newPage);
    }
  };

  const handleAgentFilterChange = (value: string) => {
    setAgentFilter(value === 'all' ? undefined : value);
    setPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value === 'all' ? undefined : value);
    setPage(1);
  };

  const isAgentMode = mode === 'agent';
  const items = data?.items || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isAgentMode ? (
            <>
              <Bot className="h-5 w-5" />
              Agent Outputs
            </>
          ) : (
            <>
              <FileText className="h-5 w-5" />
              Raw Document Chunks
            </>
          )}
        </CardTitle>
        <CardDescription>
          {data
            ? `${data.total} ${isAgentMode ? 'Agent Outputs' : 'Raw Chunks'} gefunden`
            : 'Lade Daten...'}
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

          {isAgentMode && (
            <>
              <Select value={agentFilter ?? 'all'} onValueChange={handleAgentFilterChange}>
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

              <Select value={typeFilter ?? 'all'} onValueChange={handleTypeFilterChange}>
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
            </>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <ChunkBrowserSkeleton isAgentMode={isAgentMode} />
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine Chunks gefunden.
            {debouncedSearch && ' Versuche andere Suchbegriffe.'}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {isAgentMode && <TableHead>Agent</TableHead>}
                    {isAgentMode && <TableHead>Type</TableHead>}
                    <TableHead>Inhalt (Vorschau)</TableHead>
                    {!isAgentMode && <TableHead className="w-24">Tokens</TableHead>}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const agentItem = isAgentMode ? (item as AgentOutput) : null;
                    const rawItem = !isAgentMode ? (item as RawChunkItem) : null;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.chunkIndex}</TableCell>
                        {isAgentMode && agentItem && (
                          <>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {agentItem.agentName}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {agentItem.chunkType}
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="max-w-md">
                          <p className="truncate text-sm">{item.content.slice(0, 150)}...</p>
                        </TableCell>
                        {!isAgentMode && rawItem && (
                          <TableCell className="text-xs text-muted-foreground">
                            {rawItem.tokenCount}
                          </TableCell>
                        )}
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedChunk(item)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Zurück
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= data.totalPages}
                  >
                    Weiter
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
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

function ChunkBrowserSkeleton({ isAgentMode }: { isAgentMode: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 border rounded-md">
          <Skeleton className="h-4 w-8" />
          {isAgentMode && <Skeleton className="h-6 w-24" />}
          {isAgentMode && <Skeleton className="h-6 w-20" />}
          <Skeleton className="h-4 flex-1" />
          {!isAgentMode && <Skeleton className="h-4 w-16" />}
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}
