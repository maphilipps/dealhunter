'use client';

import { TrendingUp, Clock, Target, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';

interface AnalyticsData {
  summary: {
    totalRfps: number;
    bidRate: number;
    avgTimeToDecision: number;
    activeBids: number;
  };
  bidDecision: {
    bid: number;
    noBid: number;
    pending: number;
  };
  source: {
    reactive: number;
    proactive: number;
  };
  stage: {
    cold: number;
    warm: number;
    preQualification: number;
  };
  funnel: {
    draft: number;
    evaluating: number;
    decisionMade: number;
    routed: number;
    assigned: number;
    archived: number;
  };
  blDistribution: Array<{
    name: string;
    count: number;
  }>;
  timeline: Array<{
    date: string;
    bids: number;
    noBids: number;
  }>;
}

const COLORS = {
  bid: 'hsl(142, 76%, 36%)',
  noBid: 'hsl(0, 84%, 60%)',
  pending: 'hsl(47, 96%, 53%)',
  reactive: 'hsl(221, 83%, 53%)',
  proactive: 'hsl(142, 71%, 45%)',
  cold: 'hsl(217, 91%, 60%)',
  warm: 'hsl(27, 96%, 61%)',
  preQualification: 'hsl(142, 76%, 36%)',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/analytics/overview');
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const analyticsData = (await response.json()) as unknown;
        if (
          analyticsData &&
          typeof analyticsData === 'object' &&
          'summary' in analyticsData &&
          'bidDecision' in analyticsData
        ) {
          setData(analyticsData as AnalyticsData);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Failed to load analytics data</p>
      </div>
    );
  }

  const bidDecisionData = [
    { name: 'Bid', value: data.bidDecision.bid, fill: COLORS.bid },
    { name: 'No Bid', value: data.bidDecision.noBid, fill: COLORS.noBid },
    { name: 'Pending', value: data.bidDecision.pending, fill: COLORS.pending },
  ].filter(item => item.value > 0);

  const sourceData = [
    { name: 'Reactive', value: data.source.reactive, fill: COLORS.reactive },
    { name: 'Proactive', value: data.source.proactive, fill: COLORS.proactive },
  ].filter(item => item.value > 0);

  const stageData = [
    { name: 'Cold', value: data.stage.cold, fill: COLORS.cold },
    { name: 'Warm', value: data.stage.warm, fill: COLORS.warm },
    { name: 'Pre-Qualification', value: data.stage.preQualification, fill: COLORS.preQualification },
  ].filter(item => item.value > 0);

  const funnelData = [
    { stage: 'Draft', count: data.funnel.draft },
    { stage: 'Evaluating', count: data.funnel.evaluating },
    { stage: 'Decision Made', count: data.funnel.decisionMade },
    { stage: 'Routed to BL', count: data.funnel.routed },
    { stage: 'Team Assigned', count: data.funnel.assigned },
    { stage: 'Archived', count: data.funnel.archived },
  ].filter(item => item.count > 0);

  const chartConfig = {
    bid: { label: 'Bid', color: COLORS.bid },
    noBid: { label: 'No Bid', color: COLORS.noBid },
    pending: { label: 'Pending', color: COLORS.pending },
    reactive: { label: 'Reactive', color: COLORS.reactive },
    proactive: { label: 'Proactive', color: COLORS.proactive },
    cold: { label: 'Cold', color: COLORS.cold },
    warm: { label: 'Warm', color: COLORS.warm },
    preQualification: { label: 'Pre-Qualification', color: COLORS.rfp },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track your performance metrics and insights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pre-Qualifications</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalRfps}</div>
            <p className="text-xs text-muted-foreground">{data.summary.activeBids} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bid Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.bidRate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.bidDecision.bid} bids of {data.bidDecision.bid + data.bidDecision.noBid} decided
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time to Decision</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.avgTimeToDecision}h</div>
            <p className="text-xs text-muted-foreground">Average processing time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bids</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.activeBids}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Pie Charts */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Bid/No Bid Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Bid Decision Distribution</CardTitle>
            <CardDescription>Bid vs No Bid breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={chartConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={bidDecisionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry: unknown) => {
                    const e = entry as { name?: string; value?: number };
                    return `${e.name}: ${e.value}`;
                  }}
                >
                  {bidDecisionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Source Distribution</CardTitle>
            <CardDescription>Reactive vs Proactive</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={chartConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry: unknown) => {
                    const e = entry as { name?: string; value?: number };
                    return `${e.name}: ${e.value}`;
                  }}
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Stage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Stage Distribution</CardTitle>
            <CardDescription>Cold, Warm, Pre-Qualification breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={chartConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={stageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry: unknown) => {
                    const e = entry as { name?: string; value?: number };
                    return `${e.name}: ${e.value}`;
                  }}
                >
                  {stageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Funnel and BL Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>Pre-Qualification workflow stages</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={chartConfig}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Business Line Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Business Line Distribution</CardTitle>
            <CardDescription>Pre-Qualifications by Business Line</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={chartConfig}>
              <BarChart data={data.blDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Bids Over Time</CardTitle>
          <CardDescription>Last 30 days activity</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ChartContainer config={chartConfig}>
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: unknown) => {
                  const dateStr = typeof value === 'string' ? value : String(value);
                  const date = new Date(dateStr);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="bids"
                stroke={COLORS.bid}
                name="Bids"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="noBids"
                stroke={COLORS.noBid}
                name="No Bids"
                strokeWidth={2}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
