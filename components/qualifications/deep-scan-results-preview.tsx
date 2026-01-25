'use client';

import { CheckCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeepScan } from '@/contexts/deep-scan-context';
import { EXPERT_TO_SECTIONS, getQualityBadge } from '@/lib/deep-scan/section-expert-mapping';

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
    const sections = EXPERT_TO_SECTIONS[expertName] || [];
    const confidence = deepScan.sectionConfidences[expertName];
    return {
      name: expertName,
      sections,
      confidence,
    };
  });

  if (completedExperts.length === 0) {
    return null;
  }

  const isRunning = deepScan.status === 'running' || deepScan.status === 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Analyse-Ergebnisse
        </CardTitle>
        <CardDescription>
          {isRunning
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
              sections={expert.sections}
              confidence={expert.confidence}
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
  sections: string[];
  confidence?: number;
  leadId: string;
}

function ExpertResultCard({ expertName, sections, confidence, leadId }: ExpertResultCardProps) {
  const router = useRouter();

  // Extract a summary from the expert name
  const displayName = expertName.charAt(0).toUpperCase() + expertName.slice(1);

  // Navigate to the first section of this expert
  const handleNavigate = () => {
    if (sections.length > 0) {
      router.push(`/qualifications/${leadId}/audit/${sections[0]}`);
    }
  };

  const qualityBadge = confidence !== undefined ? getQualityBadge(confidence) : null;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleNavigate}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-sm">{displayName}</h4>
            {qualityBadge && (
              <Badge
                variant={
                  qualityBadge.variant === 'success'
                    ? 'default'
                    : qualityBadge.variant === 'destructive'
                      ? 'destructive'
                      : 'secondary'
                }
                className="mt-1"
              >
                {confidence}% - {qualityBadge.label}
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
