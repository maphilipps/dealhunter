'use client';

import { Building2, CheckCircle2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { LeadScan } from '@/lib/db/schema';
import { safeJsonParseOrNull } from '@/lib/utils/parse';

interface BUMatchingTabProps {
  bidId: string;
  qualificationScan: LeadScan | null;
  currentBusinessUnitId: string | null;
}

export function BUMatchingTab({
  bidId: _bidId,
  qualificationScan,
  currentBusinessUnitId: _currentBusinessUnitId,
}: BUMatchingTabProps) {
  const router = useRouter();
  const [isReassigning, setIsReassigning] = useState(false);

  // Parse qualification scan data - techStack contains detected technologies
  const matchData = qualificationScan
    ? {
        recommendedBU: qualificationScan.recommendedBusinessUnit,
        confidence: qualificationScan.confidence,
        reasoning: qualificationScan.reasoning,
        // techStack is the JSON field for detected technologies
        detectedTechnologies: safeJsonParseOrNull<string[]>(qualificationScan.techStack) ?? [],
        cms: qualificationScan.cms,
        framework: qualificationScan.framework,
      }
    : null;

  const handleReassign = () => {
    setIsReassigning(true);
    try {
      // TODO: Implement reassignment action
      toast.info('BU-Neuzuweisung wird implementiert...');
      router.refresh();
    } catch (_error) {
      toast.error('Fehler bei der Neuzuweisung');
    } finally {
      setIsReassigning(false);
    }
  };

  if (!qualificationScan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business Unit Matching</CardTitle>
          <CardDescription>Die Qualification wurde noch nicht durchgeführt.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nach der Qualification wird hier die BU-Zuweisung angezeigt.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Assignment */}
      <Card className="border-primary/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Aktuelle Zuweisung
              </CardTitle>
              <CardDescription>Der Bid wurde diesem Business Unit zugewiesen</CardDescription>
            </div>
            <Badge variant="default" className="text-lg px-4 py-1">
              {matchData?.recommendedBU || 'Nicht zugewiesen'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Confidence Score */}
          {matchData?.confidence && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Match-Konfidenz</span>
                <span className="font-medium">{matchData.confidence}%</span>
              </div>
              <Progress value={matchData.confidence} className="h-3" />
            </div>
          )}

          {/* Reasoning */}
          {matchData?.reasoning && (
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm">{matchData.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matching Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* CMS & Framework */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CMS & Framework</CardTitle>
            <CardDescription>Erkannte Systeme aus der Qualification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {matchData?.cms && (
              <div>
                <p className="text-xs text-muted-foreground">CMS</p>
                <Badge variant="secondary">{matchData.cms}</Badge>
              </div>
            )}
            {matchData?.framework && (
              <div>
                <p className="text-xs text-muted-foreground">Framework</p>
                <Badge variant="secondary">{matchData.framework}</Badge>
              </div>
            )}
            {!matchData?.cms && !matchData?.framework && (
              <p className="text-sm text-muted-foreground">Keine Systeme erkannt</p>
            )}
          </CardContent>
        </Card>

        {/* Detected Technologies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tech Stack</CardTitle>
            <CardDescription>Technologien aus der Qualification</CardDescription>
          </CardHeader>
          <CardContent>
            {matchData?.detectedTechnologies &&
            Array.isArray(matchData.detectedTechnologies) &&
            matchData.detectedTechnologies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {matchData.detectedTechnologies.map((tech: string, idx: number) => (
                  <Badge key={idx} variant="outline">
                    {tech}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Technologien erkannt</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktionen</CardTitle>
          <CardDescription>BU-Zuweisung ändern oder bestätigen</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={handleReassign} disabled={isReassigning}>
            {isReassigning ? (
              <Loader size="sm" className="mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Andere BU wählen
          </Button>
          <Button variant="default">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Zuweisung bestätigen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
