'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface RunExpertAgentsButtonProps {
  preQualificationId: string;
  hasResults?: boolean;
}

export function RunExpertAgentsButton({ preQualificationId, hasResults }: RunExpertAgentsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/pre-qualifications/${preQualificationId}/run-expert-agents`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to run expert agents');
        }

        const result = await response.json();

        if (result.success) {
          toast.success('Expert-Analyse abgeschlossen');
        } else {
          toast.warning(`Teilweise erfolgreich: ${result.errors.length} Fehler`);
        }

        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error('Fehler bei der Expert-Analyse');
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending} variant={hasResults ? 'outline' : 'default'}>
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analysiere...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          {hasResults ? 'Expert-Analyse neu starten' : 'Expert-Analyse starten'}
        </>
      )}
    </Button>
  );
}
