'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { assignBusinessUnit } from '@/lib/routing/actions';
import type { BLRecommendation } from '@/lib/quick-scan/schema';

interface BLRoutingCardProps {
  bidId: string;
  recommendation: BLRecommendation;
}

export function BLRoutingCard({ bidId, recommendation }: BLRoutingCardProps) {
  const router = useRouter();
  const [showOverride, setShowOverride] = useState(false);
  const [selectedBL, setSelectedBL] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const businessUnits = [
    'Banking & Insurance',
    'Automotive',
    'Energy & Utilities',
    'Retail & E-Commerce',
    'Healthcare',
    'Public Sector',
    'Manufacturing',
    'Technology & Innovation',
  ];

  const handleAcceptRecommendation = async () => {
    setIsSubmitting(true);
    toast.info('Routing zu Business Unit...');

    try {
      const result = await assignBusinessUnit({
        bidId,
        businessLineName: recommendation.primaryBusinessLine,
      });

      if (result.success) {
        toast.success(`Opportunity wurde zu "${recommendation.primaryBusinessLine}" geroutet!`);
        router.refresh();
      } else {
        toast.error(result.error || 'Routing fehlgeschlagen');
        setIsSubmitting(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      setIsSubmitting(false);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!selectedBL) {
      toast.error('Bitte Business Unit auswählen');
      return;
    }

    if (!overrideReason.trim()) {
      toast.error('Bitte Grund für Override angeben');
      return;
    }

    setIsSubmitting(true);
    toast.info('Routing mit Override...');

    try {
      const result = await assignBusinessUnit({
        bidId,
        businessLineName: selectedBL,
        overrideReason: overrideReason.trim(),
      });

      if (result.success) {
        toast.success(`Opportunity wurde zu "${selectedBL}" geroutet!`);
        router.refresh();
      } else {
        toast.error(result.error || 'Routing fehlgeschlagen');
        setIsSubmitting(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      setIsSubmitting(false);
    }
  };

  const isLowConfidence = recommendation.confidence < 70;

  return (
    <div className="space-y-6">
      {/* AI Recommendation Card */}
      <Card className={isLowConfidence ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className={isLowConfidence ? 'h-6 w-6 text-amber-600' : 'h-6 w-6 text-blue-600'} />
              <div>
                <CardTitle className={isLowConfidence ? 'text-amber-900' : 'text-blue-900'}>
                  AI Empfehlung: Business Unit Routing
                </CardTitle>
                <CardDescription className={isLowConfidence ? 'text-amber-700' : 'text-blue-700'}>
                  Basierend auf Quick Scan Analyse
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={isLowConfidence ? 'destructive' : 'secondary'}
              className={isLowConfidence ? '' : 'bg-blue-100 text-blue-900'}
            >
              {recommendation.confidence}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Recommendation */}
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Empfohlene Business Unit</p>
            <p className="text-2xl font-bold text-foreground">{recommendation.primaryBusinessLine}</p>
          </div>

          {/* Reasoning */}
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Begründung</p>
            <p className="text-sm text-foreground">{recommendation.reasoning}</p>
          </div>

          {/* Required Skills */}
          {recommendation.requiredSkills.length > 0 && (
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Erforderliche Skills</p>
              <div className="flex flex-wrap gap-2">
                {recommendation.requiredSkills.map((skill, idx) => (
                  <Badge key={idx} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Alternative BLs */}
          {recommendation.alternativeBusinessLines.length > 0 && (
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Alternative Business Units
              </p>
              <ul className="space-y-2">
                {recommendation.alternativeBusinessLines.map((alt, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span>{alt.name}</span>
                    <Badge variant="secondary">{alt.confidence}%</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Low Confidence Warning */}
          {isLowConfidence && (
            <div className="rounded-lg bg-amber-100 border border-amber-300 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Niedrige Konfidenz</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Die AI ist unsicher bei dieser Empfehlung. Bitte überprüfen Sie die Begründung
                    sorgfältig oder wählen Sie manuell eine Business Unit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAcceptRecommendation}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                'Wird geroutet...'
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Empfehlung akzeptieren
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowOverride(!showOverride)}
              disabled={isSubmitting}
            >
              Manuelle Auswahl
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Override Form */}
      {showOverride && (
        <Card>
          <CardHeader>
            <CardTitle>Manuelle Business Unit Auswahl</CardTitle>
            <CardDescription>
              Wählen Sie eine andere Business Unit und geben Sie den Grund an
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* BL Select */}
            <div className="space-y-2">
              <Label htmlFor="bl-select">Business Unit</Label>
              <Select value={selectedBL} onValueChange={setSelectedBL}>
                <SelectTrigger id="bl-select">
                  <SelectValue placeholder="Business Unit auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {businessUnits.map((bl) => (
                    <SelectItem key={bl} value={bl}>
                      {bl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Override Reason */}
            <div className="space-y-2">
              <Label htmlFor="override-reason">Grund für Abweichung von AI-Empfehlung</Label>
              <Textarea
                id="override-reason"
                placeholder="Bitte erklären Sie, warum Sie von der AI-Empfehlung abweichen..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={4}
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleOverrideSubmit}
              disabled={isSubmitting || !selectedBL || !overrideReason.trim()}
              className="w-full"
            >
              {isSubmitting ? (
                'Wird geroutet...'
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Zu "{selectedBL || '...'}" routen
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
