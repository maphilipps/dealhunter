'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
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
    <Button onClick={handleValidate} disabled={isValidating} size="lg" className="px-6">
      {isValidating ? (
        <>
          <Loader size="sm" />
          Wird validiert...
        </>
      ) : (
        <>
          <Check className="h-4 w-4" />
          Referenz validieren
        </>
      )}
    </Button>
  );
}
