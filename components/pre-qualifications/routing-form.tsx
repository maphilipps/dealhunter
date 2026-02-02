'use client';

import { Lightbulb, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { BusinessUnit } from '@/lib/db/schema';
import { assignBusinessUnit } from '@/lib/routing/actions';

interface BLRecommendation {
  primaryBusinessLine: string;
  confidence: number;
  reasoning: string;
}

interface RoutingFormProps {
  preQualificationId: string;
  blRecommendation: BLRecommendation | null;
  allBusinessUnits: BusinessUnit[];
}

export function RoutingForm({
  preQualificationId,
  blRecommendation,
  allBusinessUnits,
}: RoutingFormProps) {
  const router = useRouter();

  // Find the ID of the recommended business unit by matching the name
  const recommendedBuId =
    allBusinessUnits.find(bu => bu.name === blRecommendation?.primaryBusinessLine)?.id || '';

  const [selectedBL, setSelectedBL] = useState<string>(recommendedBuId);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedBL) {
      setError('Bitte wählen Sie eine Business Line aus');
      return;
    }

    setIsSubmitting(true);

    void (async () => {
      try {
        // Business Unit Name aus der Liste holen
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
          // Redirect zum Lead falls einer erstellt wurde, sonst zum Pre-Qualification
          if (result.leadId) {
            router.push(`/pitches/${result.leadId}`);
          } else {
            router.push(`/pre-qualifications/${preQualificationId}`);
          }
          router.refresh();
        } else {
          setError(result.error || 'Fehler beim Routen des Pre-Qualifications');
        }
      } catch (err) {
        setError('Unerwarteter Fehler beim Routen');
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const isOverride = selectedBL !== '' && selectedBL !== recommendedBuId;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Recommendation */}
      {blRecommendation && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">AI-Empfehlung:</span>
                <Badge variant="secondary">{blRecommendation.primaryBusinessLine}</Badge>
                <Badge variant="outline">Konfidenz: {blRecommendation.confidence}%</Badge>
              </div>
              {blRecommendation.reasoning && (
                <p className="text-sm text-muted-foreground">{blRecommendation.reasoning}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Low Confidence Warning */}
      {blRecommendation && blRecommendation.confidence < 30 && (
        <Alert variant="destructive">
          <AlertDescription>
            Die AI-Empfehlung hat eine niedrige Konfidenz ({blRecommendation.confidence}%). Manuelle
            Analyse wird empfohlen.
          </AlertDescription>
        </Alert>
      )}

      {/* BL Selection */}
      <div className="space-y-2">
        <Label htmlFor="business-line">Business Line auswählen *</Label>
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
            Sie weichen von der AI-Empfehlung ab. Bitte begründen Sie Ihre Entscheidung unten.
          </AlertDescription>
        </Alert>
      )}

      {/* Routing Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Routing-Begründung {isOverride && <span className="text-destructive">*</span>}
        </Label>
        <Textarea
          id="reason"
          placeholder="z.B. 'Kunde kennt uns bereits aus vorherigem Projekt' oder 'Spezifische Expertise in diesem Bereich'"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
        />
        <p className="text-sm text-muted-foreground">
          {isOverride
            ? 'Begründung ist erforderlich bei Abweichung von der Empfehlung'
            : 'Optional: Kontext für die BL'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Abbrechen
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || selectedBL === '' || (isOverride && reason.trim() === '')}
        >
          {isSubmitting ? (
            'Wird weitergeleitet...'
          ) : (
            <>
              An BL routen
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
