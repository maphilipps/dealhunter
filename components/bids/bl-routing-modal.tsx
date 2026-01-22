'use client';

import { Building2, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getBusinessUnits } from '@/lib/admin/business-units-actions';
import { forwardToBusinessLeader } from '@/lib/bids/actions';

interface BLRecommendation {
  primaryBusinessLine: string;
  confidence: number;
  reasoning: string;
  alternativeBusinessLines?: string[];
}

interface BLRoutingModalProps {
  bidId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: BLRecommendation;
  isIbexa?: boolean;
}

interface BusinessUnit {
  id: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
}

export function BLRoutingModal({
  bidId,
  open,
  onOpenChange,
  recommendation,
  isIbexa = false,
}: BLRoutingModalProps) {
  const router = useRouter();
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBU, setSelectedBU] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isForwarding, setIsForwarding] = useState(false);

  // Load business units when modal opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      void getBusinessUnits().then(result => {
        if (result.success && result.businessUnits) {
          const units = result.businessUnits as BusinessUnit[];
          setBusinessUnits(units);

          // Auto-select recommended BU if available
          if (recommendation.primaryBusinessLine) {
            const recommended = units.find(bu => bu.name === recommendation.primaryBusinessLine);
            if (recommended) {
              setSelectedBU(recommended.id);
            }
          }

          // For Ibexa, auto-select PHP BU and disable selection
          if (isIbexa) {
            const phpBU = units.find(bu => bu.name.toLowerCase().includes('php'));
            if (phpBU) {
              setSelectedBU(phpBU.id);
            }
          }
        }
        setIsLoading(false);
      });
    }
  }, [open, recommendation.primaryBusinessLine, isIbexa]);

  const handleRoute = async () => {
    if (!selectedBU) {
      toast.error('Bitte wählen Sie eine Business Unit aus');
      return;
    }

    setIsForwarding(true);
    try {
      const result = await forwardToBusinessLeader(bidId, selectedBU);
      if (result.success) {
        toast.success(
          `Erfolgreich an ${result.leaderName} (${result.businessUnit}) weitergeleitet!`
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Weiterleitung fehlgeschlagen');
      }
    } catch (error) {
      console.error('Forward error:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Line Auswahl
          </DialogTitle>
          <DialogDescription>
            Wählen Sie die Business Unit für die Weiterleitung dieses Projekts
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Lade Business Units...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* AI Recommendation Card */}
            {recommendation.primaryBusinessLine && (
              <Card className="bg-violet-50 border-violet-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    <CardTitle className="text-base">AI-Empfehlung</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-violet-600">{recommendation.primaryBusinessLine}</Badge>
                    <div className="flex items-center gap-2">
                      <Progress value={recommendation.confidence} className="w-20 h-2" />
                      <span className="text-sm font-medium text-violet-900">
                        {recommendation.confidence}%
                      </span>
                    </div>
                  </div>
                  {recommendation.reasoning && (
                    <p className="text-sm text-violet-800">{recommendation.reasoning}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* BL Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Business Unit auswählen</label>
              <Select value={selectedBU} onValueChange={setSelectedBU} disabled={isIbexa}>
                <SelectTrigger>
                  <SelectValue placeholder="Business Unit auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {businessUnits.map(bu => (
                    <SelectItem key={bu.id} value={bu.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bu.name}</span>
                        {bu.name === recommendation.primaryBusinessLine && (
                          <Badge variant="secondary" className="text-xs">
                            Empfohlen
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">({bu.leaderName})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isIbexa && (
                <p className="text-xs text-muted-foreground">
                  Ibexa-Projekte werden automatisch an die PHP Business Unit weitergeleitet
                </p>
              )}
            </div>

            {/* Alternative BLs */}
            {recommendation.alternativeBusinessLines &&
              recommendation.alternativeBusinessLines.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Alternative Optionen</p>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.alternativeBusinessLines.map((bl, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {bl}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isForwarding}>
            Abbrechen
          </Button>
          <Button
            onClick={() => void handleRoute()}
            disabled={!selectedBU || isForwarding || isLoading}
          >
            {isForwarding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Weiterleiten...
              </>
            ) : (
              'Weiterleiten'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
