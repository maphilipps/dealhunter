'use client';

import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';

import { AccountGroupedList } from '@/components/bids/account-grouped-list';
import { FilterBar } from '@/components/bids/filter-bar';
import { PipelineOverview } from '@/components/bids/pipeline-overview';
import { QuickStats } from '@/components/bids/quick-stats';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BidOpportunity {
  id: string;
  status: string;
  decision: string;
  source: string;
  accountId?: string;
  accountName?: string;
  projectName?: string;
  createdAt: Date;
  websiteUrl?: string;
  extractedRequirements?: Record<string, unknown>;
}

interface Stats {
  totalBids: number;
  activeBids: number;
  bidRate: number;
  pendingEvaluations: number;
}

interface DashboardData {
  opportunities: BidOpportunity[];
  stats: Stats;
}

// Fetcher function for SWR
const fetcher = (url: string): Promise<DashboardData> =>
  fetch(url).then(res => res.json()) as Promise<DashboardData>;

export default function DashboardPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build cache key from filters
  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (sourceFilter !== 'all') params.set('source', sourceFilter);
  if (searchQuery.trim()) params.set('search', searchQuery);
  const cacheKey = `/api/bids?${params.toString()}`;

  // Fetch data with SWR
  const { data, error, isLoading } = useSWR<DashboardData | undefined>(cacheKey, fetcher, {
    dedupingInterval: 2000, // Deduplicate requests within 2 seconds
    refreshInterval: 0, // Don't auto-refresh
    revalidateOnFocus: false, // Don't refresh on window focus
    revalidateOnReconnect: false, // Don't refresh on reconnect
  });

  // Handle error state
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-500">Error loading dashboard: {errorMessage}</p>
      </div>
    );
  }

  const opportunities = data?.opportunities || [];
  const stats = data?.stats || {
    totalBids: 0,
    activeBids: 0,
    bidRate: 0,
    pendingEvaluations: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">AI-powered BD decision platform</p>
        </div>
        <Button asChild>
          <Link href="/rfps/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New RFP
          </Link>
        </Button>
      </div>

      <QuickStats
        totalBids={stats.totalBids}
        activeBids={stats.activeBids}
        bidRate={stats.bidRate}
        pendingEvaluations={stats.pendingEvaluations}
      />

      <FilterBar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="accounts">By Account</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <AccountGroupedList opportunities={opportunities} />
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <PipelineOverview opportunities={opportunities} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
