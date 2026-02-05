'use client';

import { StopCircle } from 'lucide-react';
import { memo, useState } from 'react';

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
import { Button } from '@/components/ui/button';

interface AbortButtonProps {
  onAbort: () => void;
  disabled?: boolean;
}

/**
 * TRANS-006: Abort Button
 * Allows user to cancel running analysis with confirmation dialog
 * Best practice: Use state sparingly, prefer props (rerender-defer-reads)
 */
export const AbortButton = memo(function AbortButton({
  onAbort,
  disabled = false,
}: AbortButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  const handleConfirm = () => {
    setShowDialog(false);
    onAbort();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={disabled}
        className="gap-2"
      >
        <StopCircle className="h-4 w-4" />
        Analyse abbrechen
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Analyse abbrechen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dies stoppt die aktuelle Auswertung. Bisherige Teilergebnisse gehen verloren. Möchten
              Sie wirklich fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter ausführen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-red-600">
              Ja, abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

AbortButton.displayName = 'AbortButton';
