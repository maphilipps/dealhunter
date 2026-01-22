'use client';

import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DecisionConfidenceBannerProps {
  answeredCount: number;
  totalCount: number;
}

export function DecisionConfidenceBanner({
  answeredCount,
  totalCount,
}: DecisionConfidenceBannerProps) {
  const completionPercentage = Math.round((answeredCount / totalCount) * 100);

  if (completionPercentage >= 70) {
    return null;
  }

  return (
    <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Unvollständige Datengrundlage</AlertTitle>
      <AlertDescription className="text-amber-800">
        Nur {answeredCount}/{totalCount} Fragen beantwortet ({completionPercentage}%). Manuelle
        Recherche wird empfohlen, um eine fundierte Entscheidung zu treffen.
      </AlertDescription>
    </Alert>
  );
}
