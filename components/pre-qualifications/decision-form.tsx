'use client';

import { Archive, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { BusinessUnit } from '@/lib/db/schema';
import { assignBusinessUnit, archiveAsNoBid } from '@/lib/routing/actions';

interface BLRecommendation {
  primaryBusinessLine: string;
  confidence: number;
  reasoning: string;
}

interface DecisionFormProps {
  preQualificationId: string;
  blRecommendation: BLRecommendation | null;
  aiDecisionRecommendation?: 'bid' | 'no_bid' | null;
  aiDecisionConfidence?: number;
  allBusinessUnits: BusinessUnit[];
}

export function DecisionForm({
  preQualificationId,
  blRecommendation,
  aiDecisionRecommendation,
  aiDecisionConfidence,
  allBusinessUnits,
}: DecisionFormProps) {
  const router = useRouter();

  // Find the ID of the recommended business unit by matching the name
  const recommendedBuId =
    allBusinessUnits.find(bu => bu.name === blRecommendation?.primaryBusinessLine)?.id || '';

  const [decision, setDecision] = useState<'bid' | 'no_bid' | null>(null);
  const [selectedBL, setSelectedBL] = useState<string>(recommendedBuId);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!decision) {
      setError('Bitte wählen Sie BID oder NO-BID');
      return;
    }

    if (decision === 'bid' && !selectedBL) {
      setError('Bitte wählen Sie eine Business Line aus');
      return;
    }

    if (decision === 'no_bid' && !reason.trim()) {
      setError('Bitte geben Sie eine Begründung für NO-BID an');
      return;
    }

    setIsSubmitting(true);

    try {
      if (decision === 'bid') {
        // BID: Route to Business Line
        const selectedBU = allBusinessUnits.find(bu => bu.id === selectedBL);
        if (!selectedBU) {
          setError('Business Unit nicht gefunden');
          setIsSubmitting(false);
          return;
        }

        const isOverriding = selectedBL !== recommendedBuId;
        const result = await assignBusinessUnit({
          bidId: preQualificationId,
          businessLineName: selectedBU.name,
          overrideReason: isOverriding ? reason.trim() : undefined,
        });

        if (result.success) {
          if (result.leadId) {
            router.push(`/qualifications/${result.leadId}`);
          } else {
            router.push(`/pre-qualifications/${preQualificationId}`);
          }
          router.refresh();
        } else {
          setError(result.error || 'Fehler beim Routen');
        }
      } else {
        // NO-BID: Archive
        const result = await archiveAsNoBid({
          preQualificationId,
          reason: reason.trim(),
        });

        if (result.success) {
          router.push('/pre-qualifications');
          router.refresh();
        } else {
          setError(result.error || 'Fehler beim Archivieren');
        }
      }
    } catch (err) {
      setError('Unerwarteter Fehler');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverride = decision === 'bid' && selectedBL !== '' && selectedBL !== recommendedBuId;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Recommendation Banner */}
      {aiDecisionRecommendation && (
        <Alert
          className={
            aiDecisionRecommendation === 'bid'
              ? 'border-green-500 bg-green-50'
              : 'border-red-500 bg-red-50'
          }
        >
          <AlertDescription>
            <div className="flex items-center gap-3">
              {aiDecisionRecommendation === 'bid' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <span className="font-semibold">
                  AI-Empfehlung: {aiDecisionRecommendation === 'bid' ? 'BID' : 'NO-BID'}
                </span>
                {aiDecisionConfidence !== undefined && (
                  <Badge variant="outline" className="ml-2">
                    {aiDecisionConfidence}% Konfidenz
                  </Badge>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Decision Selection */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Entscheidung *</Label>
        <RadioGroup
          value={decision || ''}
          onValueChange={v => setDecision(v as 'bid' | 'no_bid')}
          className="grid grid-cols-2 gap-4"
        >
          <Card
            className={`cursor-pointer transition-all ${
              decision === 'bid' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
            }`}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <RadioGroupItem value="bid" id="bid" />
              <Label htmlFor="bid" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-semibold">BID</p>
                    <p className="text-sm text-muted-foreground">
                      Opportunity verfolgen & an BL routen
                    </p>
                  </div>
                </div>
              </Label>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              decision === 'no_bid' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-gray-50'
            }`}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <RadioGroupItem value="no_bid" id="no_bid" />
              <Label htmlFor="no_bid" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-semibold">NO-BID</p>
                    <p className="text-sm text-muted-foreground">Opportunity ablehnen & archivieren</p>
                  </div>
                </div>
              </Label>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {/* BID: Business Line Selection */}
      {decision === 'bid' && (
        <div className="space-y-4 rounded-lg border border-green-200 bg-green-50/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="business-line">Business Line auswählen *</Label>
            {blRecommendation && (
              <p className="text-sm text-muted-foreground">
                Empfehlung: <strong>{blRecommendation.primaryBusinessLine}</strong>
                {blRecommendation.confidence !== undefined && (
                  <span className="ml-1">({blRecommendation.confidence}% Konfidenz)</span>
                )}
              </p>
            )}
            <Select value={selectedBL} onValueChange={setSelectedBL}>
              <SelectTrigger id="business-line">
                <SelectValue placeholder="Business Line wählen..." />
              </SelectTrigger>
              <SelectContent>
                {allBusinessUnits.map(bu => (
                  <SelectItem key={bu.id} value={bu.id}>
                    {bu.name}
                    {bu.id === recommendedBuId && (
                      <span className="ml-2 text-xs text-muted-foreground">(Empfohlen)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Override Warning */}
          {isOverride && (
            <Alert>
              <AlertDescription>
                Sie weichen von der AI-Empfehlung ab. Bitte begründen Sie Ihre Entscheidung.
              </AlertDescription>
            </Alert>
          )}

          {/* Routing Reason (optional unless override) */}
          <div className="space-y-2">
            <Label htmlFor="bid-reason">
              Begründung {isOverride && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="bid-reason"
              placeholder="z.B. 'Kunde kennt uns bereits aus vorherigem Projekt'"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      )}

      {/* NO-BID: Reason (required) */}
      {decision === 'no_bid' && (
        <div className="space-y-4 rounded-lg border border-red-200 bg-red-50/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="no-bid-reason">
              Begründung für NO-BID <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="no-bid-reason"
              placeholder="z.B. 'Budget zu gering', 'Technologie nicht in unserem Portfolio', 'Timeline unrealistisch'"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Die Begründung wird für zukünftige Analysen gespeichert.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Buttons */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !decision ||
            (decision === 'bid' && !selectedBL) ||
            (decision === 'bid' && isOverride && !reason.trim()) ||
            (decision === 'no_bid' && !reason.trim())
          }
          variant={decision === 'no_bid' ? 'destructive' : 'default'}
        >
          {isSubmitting ? (
            'Wird verarbeitet...'
          ) : decision === 'bid' ? (
            <>
              An BL routen
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : decision === 'no_bid' ? (
            <>
              Archivieren
              <Archive className="ml-2 h-4 w-4" />
            </>
          ) : (
            'Entscheidung treffen'
          )}
        </Button>
      </div>
    </form>
  );
}
