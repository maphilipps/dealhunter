'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { approveReference, rejectReference } from '@/lib/admin/validation-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Reference {
  id: string;
  projectName: string;
  customerName: string;
  industry: string;
  technologies: string;
  scope: string;
  teamSize: number;
  durationMonths: number;
  budgetRange: string;
  outcome: string;
  createdAt: Date | null;
  userId: string;
}

interface ReferenceValidationTableProps {
  data: Reference[];
}

export function ReferenceValidationTable({ data }: ReferenceValidationTableProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async (id: string, projectName: string) => {
    if (!confirm(`"${projectName}" genehmigen?`)) {
      return;
    }

    setIsSubmitting(true);
    const result = await approveReference(id);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Referenz genehmigt');
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
    const result = await rejectReference(selectedId, feedback);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Referenz abgelehnt');
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
              <TableHead>Projekt</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Technologien</TableHead>
              <TableHead>Team / Dauer</TableHead>
              <TableHead>Eingereicht</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(ref => {
              const technologies = JSON.parse(ref.technologies || '[]');
              return (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium">{ref.projectName}</TableCell>
                  <TableCell>{ref.customerName}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {technologies.slice(0, 2).map((tech: string) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                      {technologies.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{technologies.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{ref.teamSize} Personen</div>
                      <div className="text-muted-foreground">{ref.durationMonths} Monate</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString('de-DE') : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(ref.id, ref.projectName)}
                        disabled={isSubmitting}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Genehmigen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectClick(ref.id)}
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
            <DialogTitle>Referenz ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie Feedback für den Nutzer, damit er die Referenz überarbeiten kann.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="z.B. 'Bitte ergänzen Sie den Kundennamen und die Projektergebnisse.'"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleRejectSubmit} disabled={isSubmitting || !feedback.trim()}>
              {isSubmitting ? 'Ablehne...' : 'Ablehnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
