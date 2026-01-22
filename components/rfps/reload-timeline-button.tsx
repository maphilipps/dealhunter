'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { reloadTimeline } from '@/lib/rfps/actions';

interface ReloadTimelineButtonProps {
  rfpId: string;
}

export function ReloadTimelineButton({ rfpId }: ReloadTimelineButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleReload = () => {
    startTransition(async () => {
      const result = await reloadTimeline(rfpId);
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <Button onClick={handleReload} disabled={isPending} variant="outline" size="sm">
      <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Timeline wird geladen...' : 'Timeline nachladen'}
    </Button>
  );
}
