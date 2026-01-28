'use client';

import { StopCircle } from 'lucide-react';
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
};

export function DeletePreQualificationButton({
  preQualificationId,
  label,
  size = 'default',
}: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deletePreQualificationHard(preQualificationId);

    if (result.success) {
      toast.success('Pre-Qualification wurde abgebrochen');
      router.push('/pre-qualifications');
    } else {
      toast.error(result.error || 'Fehler beim Abbrechen');
      setIsDeleting(false);
    }
  };

  const dialogTitle = 'Pre-Qualification wirklich abbrechen?';
  const dialogDescription = `Möchten Sie die Pre-Qualification ${label ? `"${label}"` : ''} wirklich abbrechen? Alle Daten werden unwiderruflich gelöscht.`;
  const confirmLabel = 'Jetzt abbrechen';
  const loadingLabel = 'Wird abgebrochen...';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size={size} disabled={isDeleting}>
          <StopCircle className="h-4 w-4 mr-2" />
          Abbrechen
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
