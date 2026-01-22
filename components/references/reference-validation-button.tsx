'use client';

import { Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { validateReference } from '@/lib/references/actions';

interface ReferenceValidationButtonProps {
  referenceId: string;
  isValidated: boolean;
}

export function ReferenceValidationButton({
  referenceId,
  isValidated,
}: ReferenceValidationButtonProps) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async () => {
    if (isValidated) return;

    setIsValidating(true);

    try {
      const result = await validateReference(referenceId);

      if (result.success) {
        toast.success('Referenz erfolgreich validiert');
        router.refresh();
      } else {
        toast.error(result.error || 'Validieren fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  if (isValidated) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <Check className="h-5 w-5" />
        <span className="font-medium">Validiert</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleValidate}
      disabled={isValidating}
      className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {isValidating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird validiert...
        </>
      ) : (
        <>
          <Check className="h-4 w-4" />
          Referenz validieren
        </>
      )}
    </button>
  );
}
