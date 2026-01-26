'use client';

import { Building2, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { QuickScan } from '@/lib/db/schema';
import { safeJsonParseOrNull } from '@/lib/utils/parse';

interface BUMatchingTabProps {
  bidId: string;
  quickScan: QuickScan | null;
  currentBusinessUnitId: string | null;
}

export function BUMatchingTab({
  bidId: _bidId,
  quickScan,
  currentBusinessUnitId: _currentBusinessUnitId,
}: BUMatchingTabProps) {
  const router = useRouter();
  const [isReassigning, setIsReassigning] = useState(false);

  // Parse quick scan data - techStack contains detected technologies
  const matchData = quickScan
    ? {
        recommendedBU: quickScan.recommendedBusinessUnit,
        confidence: quickScan.confidence,
        reasoning: quickScan.reasoning,
        // techStack is the JSON field for detected technologies
        detectedTechnologies: safeJsonParseOrNull<string[]>(quickScan.techStack) ?? [],
        cms: quickScan.cms,
        framework: quickScan.framework,
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

  if (!quickScan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business Unit Matching</CardTitle>
          <CardDescription>Der Quick Scan wurde noch nicht durchgeführt.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nach dem Quick Scan wird hier die BU-Zuweisung angezeigt.
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
            <CardDescription>Erkannte Systeme aus dem Quick Scan</CardDescription>
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
            <CardDescription>Technologien aus dem Quick Scan</CardDescription>
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
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
