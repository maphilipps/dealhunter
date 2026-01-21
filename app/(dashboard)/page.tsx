'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { QuickStats } from '@/components/bids/quick-stats';
import { FilterBar } from '@/components/bids/filter-bar';
import { AccountGroupedList } from '@/components/bids/account-grouped-list';
import { PipelineOverview } from '@/components/bids/pipeline-overview';
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
  extractedRequirements?: any;
}

interface Stats {
  totalBids: number;
  activeBids: number;
  bidRate: number;
  pendingEvaluations: number;
}

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<BidOpportunity[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBids: 0,
    activeBids: 0,
    bidRate: 0,
    pendingEvaluations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (searchQuery.trim()) params.set('search', searchQuery);

        const response = await fetch(`/api/bids?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch bids');

        const data = await response.json();
        setOpportunities(data.opportunities);
        setStats(data.stats);
      } catch (error) {
        console.error('Error fetching bids:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [statusFilter, sourceFilter, searchQuery]);

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
