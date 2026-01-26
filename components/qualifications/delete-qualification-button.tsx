'use client';

import { Trash2 } from 'lucide-react';
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
import { deleteQualificationHard } from '@/lib/qualifications/actions';

type Props = {
  leadId: string;
  label?: string;
  size?: 'default' | 'sm';
};

export function DeleteQualificationButton({ leadId, label, size = 'default' }: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteQualificationHard(leadId);

    if (result.success) {
      toast.success('Lead erfolgreich gelöscht');
      router.push('/qualifications');
    } else {
      toast.error(result.error || 'Fehler beim Löschen');
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size={size} disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          Löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lead wirklich löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie den Lead {label ? `"${label}"` : leadId} wirklich löschen? Diese Aktion
            löscht alle Daten und kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Wird gelöscht...' : 'Jetzt löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
