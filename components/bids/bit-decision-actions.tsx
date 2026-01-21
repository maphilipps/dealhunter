'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ThumbsUp, ThumbsDown, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { makeBitDecision } from '@/lib/bids/actions';
import { BLRoutingModal } from './bl-routing-modal';

interface BitDecisionActionsProps {
  bidId: string;
  answeredQuestionsCount: number;
  totalQuestionsCount: number;
  overallScore?: number;
  recommendation?: 'strong_bid' | 'conditional_bid' | 'no_bid' | 'needs_review';
  blRecommendation?: {
    primaryBusinessLine: string;
    confidence: number;
    reasoning: string;
    alternativeBusinessLines?: string[];
  };
  isIbexa?: boolean;
}

export function BitDecisionActions({
  bidId,
  answeredQuestionsCount,
  totalQuestionsCount,
  overallScore,
  recommendation,
  blRecommendation,
  isIbexa = false,
}: BitDecisionActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoBitDialog, setShowNoBitDialog] = useState(false);
  const [showBLRoutingModal, setShowBLRoutingModal] = useState(false);
  const [noBitReason, setNoBitReason] = useState('');

  const completionPercentage = Math.round((answeredQuestionsCount / totalQuestionsCount) * 100);
  const isLowCompletion = completionPercentage < 70;

  const handleBitDecision = async () => {
    setIsSubmitting(true);

    try {
      const result = await makeBitDecision(bidId, 'bid');

      if (result.success) {
        toast.success('BIT-Entscheidung gespeichert!');
        setIsSubmitting(false);
        // Open BL-Routing Modal instead of direct routing
        setShowBLRoutingModal(true);
      } else {
        toast.error(result.error || 'Fehler bei der BIT-Entscheidung');
        setIsSubmitting(false);
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
      setIsSubmitting(false);
    }
  };

  const handleNoBitDecision = async () => {
    if (!noBitReason.trim()) {
      toast.error('Bitte geben Sie eine Begründung an');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await makeBitDecision(bidId, 'no_bid', noBitReason);

      if (result.success) {
        toast.success('NO BIT-Entscheidung gespeichert. Opportunity archiviert.');
        setShowNoBitDialog(false);
        // Redirect to dashboard after NO-BID
        router.push('/dashboard');
      } else {
        toast.error(result.error || 'Fehler bei der NO BIT-Entscheidung');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRecommendationBadge = () => {
    switch (recommendation) {
      case 'strong_bid':
        return <Badge className="bg-green-100 text-green-800">Starke BIT-Empfehlung</Badge>;
      case 'conditional_bid':
        return <Badge className="bg-yellow-100 text-yellow-800">Bedingte BIT-Empfehlung</Badge>;
      case 'no_bid':
        return <Badge className="bg-red-100 text-red-800">NO BIT-Empfehlung</Badge>;
      case 'needs_review':
        return (
          <Badge className="bg-orange-100 text-orange-800">Manuelle Prüfung erforderlich</Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card
        data-decision-actions
        className="border-indigo-200 bg-indigo-50/50 transition-all duration-300"
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-indigo-900">BIT / NO BIT Entscheidung</CardTitle>
              <CardDescription className="text-indigo-700">
                Basierend auf den 10 Fragen und Quick Scan Ergebnissen
              </CardDescription>
            </div>
            {getRecommendationBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-indigo-700">Fragen beantwortet</span>
                <span className="text-sm font-medium text-indigo-900">
                  {answeredQuestionsCount}/{totalQuestionsCount}
                </span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
            {overallScore !== undefined && (
              <div className="text-center px-4 py-2 bg-white rounded-lg">
                <p className="text-2xl font-bold text-indigo-900">{overallScore}%</p>
                <p className="text-xs text-indigo-600">Score</p>
              </div>
            )}
          </div>

          {isLowCompletion && (
            <div className="flex items-center gap-2 p-3 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Weniger als 70% der Fragen konnten beantwortet werden. Eine manuelle Prüfung wird
                empfohlen.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 border-red-200 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800"
              onClick={() => setShowNoBitDialog(true)}
              disabled={isSubmitting}
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              NO BIT
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => void handleBitDecision()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ThumbsUp className="h-5 w-5 mr-2" />
              )}
              BIT
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNoBitDialog} onOpenChange={setShowNoBitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-600" />
              NO BIT Entscheidung
            </DialogTitle>
            <DialogDescription>
              Bitte geben Sie eine Begründung für die NO BIT Entscheidung an. Diese wird für
              zukünftige Referenz archiviert.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Begründung für NO BIT (z.B. fehlendes Budget, keine passenden Referenzen, zu hohe Risiken...)"
              value={noBitReason}
              onChange={e => setNoBitReason(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNoBitDialog(false)}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleNoBitDecision()}
              disabled={isSubmitting || !noBitReason.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              NO BIT bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BL-Routing Modal */}
      {blRecommendation && (
        <BLRoutingModal
          bidId={bidId}
          open={showBLRoutingModal}
          onOpenChange={setShowBLRoutingModal}
          recommendation={blRecommendation}
          isIbexa={isIbexa}
        />
      )}
    </>
  );
}
