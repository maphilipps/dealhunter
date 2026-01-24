'use client';

import { Check, X, ExternalLink } from 'lucide-react';
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
import { approveCompetitor, rejectCompetitor } from '@/lib/admin/validation-actions';
import type { Competitor } from '@/lib/db/schema';

interface CompetitorValidationTableProps {
  data: Competitor[];
}

export function CompetitorValidationTable({ data }: CompetitorValidationTableProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async (id: string, companyName: string) => {
    if (!confirm(`"${companyName}" genehmigen?`)) {
      return;
    }

    setIsSubmitting(true);
    const result = await approveCompetitor(id);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Wettbewerber genehmigt');
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
    const result = await rejectCompetitor(selectedId, feedback);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Wettbewerber abgelehnt');
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
              <TableHead>Unternehmen</TableHead>
              <TableHead>Branchen</TableHead>
              <TableHead>Stärken / Schwächen</TableHead>
              <TableHead>Märkte</TableHead>
              <TableHead>Eingereicht</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(comp => {
              const industries = JSON.parse(comp.industry || '[]');
              const strengths = JSON.parse(comp.strengths || '[]');
              const weaknesses = JSON.parse(comp.weaknesses || '[]');
              const markets = JSON.parse(comp.typicalMarkets || '[]');

              return (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{comp.companyName}</span>
                        {comp.website && (
                          <a
                            href={comp.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {comp.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {comp.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {industries.slice(0, 2).map((ind: string) => (
                        <Badge key={ind} variant="secondary" className="text-xs">
                          {ind}
                        </Badge>
                      ))}
                      {industries.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{industries.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      <div className="text-green-600">✓ {strengths.length} Stärken</div>
                      <div className="text-orange-600">⚠ {weaknesses.length} Schwächen</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {markets.slice(0, 2).map((market: string) => (
                        <Badge key={market} variant="outline" className="text-xs">
                          {market}
                        </Badge>
                      ))}
                      {markets.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{markets.length - 2}
                        </Badge>
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
                        onClick={() => void handleApprove(comp.id, comp.companyName)}
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
            <DialogTitle>Wettbewerber ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie Feedback für den Nutzer, damit er die Wettbewerberinformationen
              überarbeiten kann.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="z.B. 'Bitte ergänzen Sie konkrete Projekterfahrungen und typische Märkte.'"
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
