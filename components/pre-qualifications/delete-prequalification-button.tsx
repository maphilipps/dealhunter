'use client';

import { StopCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deletePreQualificationHard } from '@/lib/pre-qualifications/actions';

type Props = {
  preQualificationId: string;
  label?: string;
  size?: 'default' | 'sm';
  isProcessing?: boolean;
};

export function DeletePreQualificationButton({
  preQualificationId,
  label,
  size = 'default',
  isProcessing = false,
}: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deletePreQualificationHard(preQualificationId);

    if (result.success) {
      toast.success(
        isProcessing ? 'Verarbeitung abgebrochen' : 'Pre-Qualification erfolgreich gelöscht'
      );
      router.push('/pre-qualifications');
    } else {
      toast.error(result.error || 'Fehler beim Löschen');
      setIsDeleting(false);
    }
  };

  const Icon = isProcessing ? StopCircle : Trash2;
  const buttonLabel = isProcessing ? 'Abbrechen' : 'Löschen';
  const dialogTitle = isProcessing
    ? 'Verarbeitung wirklich abbrechen?'
    : 'Pre-Qualification wirklich löschen?';
  const dialogDescription = isProcessing
    ? `Möchten Sie die Verarbeitung ${label ? `von "${label}"` : ''} wirklich abbrechen? Alle bisherigen Daten werden gelöscht.`
    : `Möchten Sie das Pre-Qualification ${label ? `"${label}"` : preQualificationId} wirklich löschen? Diese Aktion löscht alle Daten und kann nicht rückgängig gemacht werden.`;
  const confirmLabel = isProcessing ? 'Jetzt abbrechen' : 'Jetzt löschen';
  const loadingLabel = isProcessing ? 'Wird abgebrochen...' : 'Wird gelöscht...';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size={size} disabled={isDeleting}>
          <Icon className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zurück</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? loadingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
