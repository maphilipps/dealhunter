'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { approveCompetency, rejectCompetency } from '@/lib/admin/validation-actions';
import type { Competency } from '@/lib/db/schema';

interface CompetencyValidationTableProps {
  data: Competency[];
}

export function CompetencyValidationTable({ data }: CompetencyValidationTableProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async (id: string, title: string) => {
    if (!confirm(`"${title}" genehmigen?`)) {
      return;
    }

    setIsSubmitting(true);
    const result = await approveCompetency(id);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Kompetenz genehmigt');
      window.location.reload();
    } else {
      toast.error(result.error || 'Fehler beim Genehmigen');
    }
  };

  const handleRejectClick = (id: string) => {
    setSelectedId(id);
    setFeedback('');
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedId || !feedback.trim()) {
      toast.error('Bitte geben Sie Feedback ein');
      return;
    }

    setIsSubmitting(true);
    const result = await rejectCompetency(selectedId, feedback);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Kompetenz abgelehnt');
      setRejectDialogOpen(false);
      window.location.reload();
    } else {
      toast.error(result.error || 'Fehler beim Ablehnen');
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">Keine ausstehenden Validierungen 🎉</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kompetenz</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Eingereicht</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(comp => {
              const certifications = JSON.parse(comp.certifications || '[]');
              return (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{comp.name}</div>
                      {certifications.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {certifications.join(', ')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {comp.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {comp.description || (
                        <span className="text-muted-foreground">Keine Beschreibung</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{comp.level}</div>
                      {certifications.length > 0 && (
                        <div className="text-muted-foreground">
                          {certifications.length} Zertifikate
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {comp.createdAt ? new Date(comp.createdAt).toLocaleDateString('de-DE') : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleApprove(comp.id, comp.name)}
                        disabled={isSubmitting}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Genehmigen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRejectClick(comp.id)}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Ablehnen
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kompetenz ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie Feedback für den Nutzer, damit er die Kompetenz überarbeiten kann.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="z.B. 'Bitte ergänzen Sie spezifische Projekterfahrungen und Zertifizierungen.'"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => void handleRejectSubmit()}
              disabled={isSubmitting || !feedback.trim()}
            >
              {isSubmitting ? 'Ablehne...' : 'Ablehnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
