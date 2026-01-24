'use client';

import { CheckCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeepScan, EXPERT_TO_SECTION_MAP } from '@/contexts/deep-scan-context';

interface DeepScanResultsPreviewProps {
  leadId: string;
}

/**
 * Shows preview cards for completed Deep Scan experts during and after the scan.
 * Results appear progressively as each expert completes.
 */
export function DeepScanResultsPreview({ leadId }: DeepScanResultsPreviewProps) {
  const deepScan = useDeepScan();

  // Get completed experts with their results
  const completedExperts = deepScan.completedExperts.map(expertName => {
    const state = deepScan.agentStates[expertName];
    const sectionId = EXPERT_TO_SECTION_MAP[expertName];
    return {
      name: expertName,
      sectionId,
      result: state?.result,
      confidence: state?.confidence,
    };
  });

  if (completedExperts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Analyse-Ergebnisse
        </CardTitle>
        <CardDescription>
          {deepScan.isStreaming
            ? `${completedExperts.length} Experten abgeschlossen`
            : 'Alle Experten abgeschlossen - Ergebnisse verfügbar'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {completedExperts.map(expert => (
            <ExpertResultCard
              key={expert.name}
              expertName={expert.name}
              sectionId={expert.sectionId}
              confidence={expert.confidence}
              result={expert.result}
              leadId={leadId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ExpertResultCardProps {
  expertName: string;
  sectionId?: string;
  confidence?: number;
  result?: unknown;
  leadId: string;
}

function ExpertResultCard({ expertName, sectionId, confidence, leadId }: ExpertResultCardProps) {
  const router = useRouter();

  // Extract a summary from the expert name
  const displayName = expertName.replace(' Expert', '');

  // Navigate to the audit section
  const handleNavigate = () => {
    if (sectionId) {
      // Navigate to the expert's section in the audit
      router.push(`/leads/${leadId}/audit/${sectionId}`);
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleNavigate}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-sm">{displayName}</h4>
            {confidence !== undefined && (
              <Badge
                variant={confidence >= 70 ? 'default' : confidence >= 40 ? 'secondary' : 'outline'}
                className="mt-1"
              >
                {confidence}% Confidence
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
