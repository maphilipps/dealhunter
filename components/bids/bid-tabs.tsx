'use client';

import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, LayoutGrid } from 'lucide-react';

interface BidTabsProps {
  factsContent: React.ReactNode;
  matrixContent: React.ReactNode;
}

/**
 * Tab Navigation Container für Bid Detail
 * - URL-State für aktiven Tab (via searchParams ?tab=fakten|matrix)
 * - 2 Tabs: Fakten (alle Audit-Daten), Entscheidungsmatrix (CMS-Eval + BL-Forwarding)
 */
export function BidTabs({ factsContent, matrixContent }: BidTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get active tab from URL or default to 'fakten'
  // Also support old tab names for backwards compatibility
  const urlTab = searchParams.get('tab');
  let activeTab = 'fakten';
  if (urlTab === 'matrix' || urlTab === 'bu-matching') {
    activeTab = 'matrix';
  } else if (urlTab === 'fakten' || urlTab === 'overview' || urlTab === 'questions') {
    activeTab = 'fakten';
  }

  // Handle tab change
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="fakten" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Fakten
        </TabsTrigger>
        <TabsTrigger value="matrix" className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Entscheidungsmatrix
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="fakten"
        className="space-y-4 mt-6"
        role="tabpanel"
        aria-labelledby="fakten-tab"
      >
        {factsContent}
      </TabsContent>

      <TabsContent
        value="matrix"
        className="space-y-4 mt-6"
        role="tabpanel"
        aria-labelledby="matrix-tab"
      >
        {matrixContent}
      </TabsContent>
    </Tabs>
  );
}
