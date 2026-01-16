'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { confirmLowConfidenceDecision } from '@/lib/bit-evaluation/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface LowConfidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidId: string;
  decision: 'bit' | 'no_bit';
  confidence: number;
  reasoning: string;
}

export function LowConfidenceDialog({
  open,
  onOpenChange,
  bidId,
  decision,
  confidence,
  reasoning,
}: LowConfidenceDialogProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    toast.info('Bestätige Entscheidung...');

    try {
      const result = await confirmLowConfidenceDecision(bidId, true);

      if (result.success) {
        toast.success('Entscheidung bestätigt');
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Bestätigung fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReject = async () => {
    setIsConfirming(true);
    toast.info('Entscheidung wird zurückgesetzt...');

    try {
      const result = await confirmLowConfidenceDecision(bidId, false);

      if (result.success) {
        toast.success('Status zurückgesetzt. Sie können die Anforderungen erneut überprüfen.');
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Zurücksetzen fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Niedrige Konfidenz - Bestätigung erforderlich
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="flex items-center gap-2">
              <span>Die AI empfiehlt:</span>
              <Badge variant={decision === 'bit' ? 'default' : 'destructive'}>
                {decision === 'bit' ? 'BIT' : 'NO BIT'}
              </Badge>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm font-medium text-amber-900 mb-1">Konfidenz-Level:</p>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{confidence}%</Badge>
                <span className="text-sm text-amber-700">
                  (unter 70% Schwellenwert)
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Begründung:</p>
              <p className="text-sm text-muted-foreground">{reasoning}</p>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-900">
                <strong>Wichtig:</strong> Eine niedrige Konfidenz bedeutet, dass die AI unsicher ist.
                Dies kann folgende Gründe haben:
              </p>
              <ul className="mt-2 text-sm text-blue-800 list-disc list-inside space-y-1">
                <li>Unvollständige oder vage Anforderungen</li>
                <li>Widersprüchliche Informationen</li>
                <li>Fehlende kritische Details (Budget, Timeline, etc.)</li>
                <li>Unklare Kundenpriorität oder -typ</li>
              </ul>
            </div>

            <div className="text-sm text-muted-foreground">
              Möchten Sie diese Entscheidung trotz niedriger Konfidenz akzeptieren,
              oder die Anforderungen erneut überprüfen und korrigieren?
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleReject} disabled={isConfirming}>
            Anforderungen überprüfen
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming ? 'Wird bestätigt...' : 'Entscheidung akzeptieren'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
