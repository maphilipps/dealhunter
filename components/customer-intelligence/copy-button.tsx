'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export function CopyButton({ value, label = 'Kopieren' }: { value: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success('Kopiert');
        } catch {
          toast.error('Kopieren fehlgeschlagen');
        }
      }}
    >
      <Copy className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
