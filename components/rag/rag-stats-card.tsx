'use client';

/**
 * RAG Stats Card Component (DEA-10)
 *
 * Displays aggregated statistics about RAG data for an Pre-Qualification.
 * Shows: total embeddings, raw chunks, section data, and per-agent breakdown.
 */

import { Database, FileText, Layers, Bot, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RAGStats } from '@/lib/rag/types';

interface RAGStatsCardProps {
  stats: RAGStats | null;
  isLoading: boolean;
}

export function RAGStatsCard({ stats, isLoading }: RAGStatsCardProps) {
  if (isLoading) {
    return <RAGStatsCardSkeleton />;
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            RAG Statistiken
          </CardTitle>
          <CardDescription>Keine Daten verfügbar</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalData = stats.totalEmbeddings + stats.totalRawChunks + stats.totalSectionData;

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Outputs</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalEmbeddings.toLocaleString('de-DE')}
            </div>
            <p className="text-xs text-muted-foreground">von {stats.agentStats.length} Agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Raw Chunks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRawChunks.toLocaleString('de-DE')}</div>
            <p className="text-xs text-muted-foreground">Dokument-Fragmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Section Data</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalSectionData.toLocaleString('de-DE')}
            </div>
            <p className="text-xs text-muted-foreground">Synthesized Sections</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Outputs nach Agent
          </CardTitle>
          <CardDescription>
            {stats.totalEmbeddings} Chunks von {stats.agentStats.length} Agents gespeichert
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.agentStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Agent-Outputs vorhanden.</p>
          ) : (
            <div className="space-y-3">
              {stats.agentStats.map(agent => (
                <div key={agent.agentName} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {agent.agentName}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{agent.chunkCount} Chunks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {agent.chunkTypes.slice(0, 3).map(type => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                    {agent.chunkTypes.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{agent.chunkTypes.length - 3}
                      </span>
                    )}
                    {agent.lastUpdated && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(agent.lastUpdated)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chunk Type Distribution */}
      {Object.keys(stats.chunkTypeDistribution).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Chunk Type Verteilung
            </CardTitle>
            <CardDescription>Verteilung der verschiedenen Chunk-Typen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.chunkTypeDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-sm">
                    {type}: {count}
                    <span className="ml-1 text-muted-foreground">
                      ({Math.round((count / totalData) * 100)}%)
                    </span>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RAGStatsCardSkeleton() {
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
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'gerade';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  if (diffDays < 7) return `vor ${diffDays}d`;

  return date.toLocaleDateString('de-DE');
}
