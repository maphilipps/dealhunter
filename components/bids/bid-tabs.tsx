'use client';

import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { QuickScan } from '@/lib/db/schema';

interface BidTabsProps {
  quickScan: QuickScan;
  bidId: string;
  overviewContent: React.ReactNode;
  buMatchingContent: React.ReactNode;
  questionsContent: React.ReactNode;
}

/**
 * Tab Navigation Container für Bid Detail
 * - URL-State für aktiven Tab (via searchParams ?tab=overview|bu-matching|questions)
 * - 3 Tabs: Übersicht, BU Matching, 10 Fragen
 */
export function BidTabs({
  quickScan,
  bidId,
  overviewContent,
  buMatchingContent,
  questionsContent,
}: BidTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get active tab from URL or default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview';

  // Handle tab change
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">
          Übersicht
        </TabsTrigger>
        <TabsTrigger value="bu-matching">
          BU Matching
        </TabsTrigger>
        <TabsTrigger value="questions">
          10 Fragen
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4 mt-6">
        {overviewContent}
      </TabsContent>

      <TabsContent value="bu-matching" className="space-y-4 mt-6">
        {buMatchingContent}
      </TabsContent>

      <TabsContent value="questions" className="space-y-4 mt-6">
        {questionsContent}
      </TabsContent>
    </Tabs>
  );
}
