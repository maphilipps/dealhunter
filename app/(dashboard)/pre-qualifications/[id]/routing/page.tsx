import { AlertCircle, AlertTriangle } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { TenQuestionsCard } from '@/components/bids/ten-questions-card';
import { DecisionForm } from '@/components/pre-qualifications/decision-form';
import { FindingsSummary } from '@/components/pre-qualifications/findings-summary';
import { ReloadTimelineButton } from '@/components/pre-qualifications/reload-timeline-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import {
  buildQuestionsWithStatus,
  type QuestionWithStatus,
  type ProjectType,
} from '@/lib/bids/ten-questions';
import { db } from '@/lib/db';
import { businessUnits } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { getCachedPreQualificationWithRelations } from '@/lib/pre-qualifications/cached-queries';

export default async function RoutingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get Pre-Qualification with relations (cached and parallelized)
  const { preQualification, quickScan } = await getCachedPreQualificationWithRelations(id);

  if (!preQualification) {
    notFound();
  }

  // Check ownership
  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Get all business units for dropdown
  const allBusinessUnits = await db.select().from(businessUnits);

  // Get extracted requirements
  let extractedReqs: ExtractedRequirements | null = null;
  if (preQualification.extractedRequirements) {
    try {
      extractedReqs = JSON.parse(preQualification.extractedRequirements) as ExtractedRequirements;
    } catch {
      extractedReqs = null;
    }
  }

  // Build BL Recommendation
  const blRecommendation = quickScan?.recommendedBusinessUnit
    ? {
        primaryBusinessLine: quickScan.recommendedBusinessUnit,
        confidence: quickScan.confidence || 0,
        reasoning: quickScan.reasoning || '',
      }
    : null;

  // Build 10 Questions if available
  let questionsResult = null;
  if (quickScan) {
    questionsResult = buildQuestionsWithStatus(quickScan, extractedReqs);
  }

  // Check for missing data
  const hasMissingData = quickScan && (!blRecommendation);
  const missingData = {
    blRecommendation: !blRecommendation,
    tenQuestions: !questionsResult,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BID / NO-BID Entscheidung</h1>
        <p className="text-muted-foreground">
          Prüfen Sie die Findings und treffen Sie eine Entscheidung
        </p>
      </div>

      {/* Findings Summary - The North Star */}
      <FindingsSummary
        extractedRequirements={extractedReqs}
        quickScan={quickScan ? {
          recommendedBusinessUnit: quickScan.recommendedBusinessUnit,
          confidence: quickScan.confidence,
          reasoning: quickScan.reasoning,
          techStack: quickScan.techStack,
          contentVolume: quickScan.contentVolume,
        } : null}
      />

      {/* 10 Questions Card */}
      {questionsResult && (
        <TenQuestionsCard
          questions={questionsResult.questions}
          projectType={questionsResult.projectType}
          answeredCount={questionsResult.summary.answered}
          totalCount={questionsResult.summary.total}
        />
      )}

      {/* Missing Data Alert */}
      {quickScan && hasMissingData && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">Einige Analysedaten fehlen</AlertTitle>
          <AlertDescription className="text-amber-800">
            <p className="mb-3">
              Die Qualification wurde durchgeführt, aber nicht alle Daten konnten extrahiert werden.
              Sie können trotzdem eine Entscheidung treffen.
            </p>
            <div className="flex flex-wrap gap-2">
              {missingData.blRecommendation && (
                <Badge variant="outline" className="bg-white">
                  BL-Empfehlung fehlt
                </Badge>
              )}
              {missingData.tenQuestions && (
                <Badge variant="outline" className="bg-white">
                  10-Fragen fehlen
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* No Qualification Alert */}
      {!quickScan && !extractedReqs && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Daten verfügbar</AlertTitle>
          <AlertDescription>
            Die Verarbeitung ist noch nicht abgeschlossen oder es konnten keine Daten extrahiert werden.
            Bitte warten Sie oder starten Sie die Verarbeitung erneut.
          </AlertDescription>
        </Alert>
      )}

      {/* Decision Form */}
      <Card>
        <CardHeader>
          <CardTitle>Entscheidung treffen</CardTitle>
          <CardDescription>
            Entscheiden Sie, ob diese Opportunity verfolgt werden soll
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DecisionForm
            preQualificationId={preQualification.id}
            blRecommendation={blRecommendation}
            aiDecisionRecommendation={
              quickScan?.confidence && quickScan.confidence >= 50 ? 'bid' : null
            }
            aiDecisionConfidence={quickScan?.confidence || undefined}
            allBusinessUnits={allBusinessUnits}
          />
        </CardContent>
      </Card>
    </div>
  );
}
