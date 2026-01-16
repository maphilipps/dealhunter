'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { StopCircle } from 'lucide-react';

interface AbortButtonProps {
  onAbort: () => void;
  disabled?: boolean;
}

/**
 * TRANS-006: Abort Button
 * Allows user to cancel running analysis with confirmation dialog
 * Best practice: Use state sparingly, prefer props (rerender-defer-reads)
 */
export function AbortButton({ onAbort, disabled = false }: AbortButtonProps) {
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
        Cancel Analysis
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the current evaluation. Any partial results will be
              lost. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-red-600">
              Yes, cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
