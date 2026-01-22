'use client';

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Cpu,
  DollarSign,
  Clock,
  Scale,
  Award,
  Users,
  TrendingUp,
  Briefcase,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';
import type { QuickScan } from '@/lib/db/schema';

interface TenQuestionsTabProps {
  decisionData: BitEvaluationResult | null;
  extractedData: Record<string, unknown> | null;
  quickScan: QuickScan | null;
}

interface Question {
  id: number;
  question: string;
  icon: React.ElementType;
  answer: string;
  confidence: number;
  status: 'positive' | 'negative' | 'neutral' | 'warning';
  details?: string;
}

export function TenQuestionsTab({ decisionData, extractedData, quickScan }: TenQuestionsTabProps) {
  // Extract answers from the various data sources
  const questions = extractTenQuestions(decisionData, extractedData, quickScan);

  if (!decisionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>10 Fragen Bewertung</CardTitle>
          <CardDescription>
            Die BIT/NO BIT Evaluierung wurde noch nicht durchgeführt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
            <p>Keine Evaluierungsdaten verfügbar.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by status for summary
  const positiveCount = questions.filter(q => q.status === 'positive').length;
  const negativeCount = questions.filter(q => q.status === 'negative').length;
  const warningCount = questions.filter(q => q.status === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            10 Fragen Bewertung
            <Badge
              variant={
                positiveCount >= 7 ? 'default' : positiveCount >= 5 ? 'secondary' : 'destructive'
              }
            >
              {positiveCount}/10 positiv
            </Badge>
          </CardTitle>
          <CardDescription>
            Kompakte Zusammenfassung der Multi-Agent BIT/NO BIT Bewertung
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">{positiveCount} Positiv</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm">{warningCount} Warnung</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">{negativeCount} Negativ</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {questions.map(q => (
          <QuestionCard key={q.id} question={q} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ question }: { question: Question }) {
  const Icon = question.icon;
  const statusColors = {
    positive: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
    negative: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
    neutral: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/20',
  };

  const statusIcons = {
    positive: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    negative: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    neutral: <HelpCircle className="h-5 w-5 text-gray-500" />,
  };

  return (
    <Card className={statusColors[question.status]}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-base font-medium">Frage {question.id}</CardTitle>
          </div>
          {statusIcons[question.status]}
        </div>
        <CardDescription className="text-foreground font-medium">
          {question.question}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{question.answer}</p>
        {question.details && <p className="text-xs text-muted-foreground">{question.details}</p>}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Konfidenz:</span>
          <Progress value={question.confidence} className="h-2 flex-1" />
          <span className="text-xs font-medium">{question.confidence}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function extractTenQuestions(
  bitData: BitEvaluationResult | null,
  extracted: Record<string, unknown> | null,
  quickScan: QuickScan | null
): Question[] {
  // Default questions if no data
  if (!bitData) {
    return getDefaultQuestions();
  }

  const {
    capabilityMatch,
    dealQuality,
    strategicFit,
    competitionCheck,
    legalAssessment,
    referenceMatch,
    decision,
  } = bitData;

  return [
    // 1. Tech Stack Match
    {
      id: 1,
      question: 'Passt der Tech Stack zu unseren Kompetenzen?',
      icon: Cpu,
      answer: capabilityMatch.hasRequiredTechnologies
        ? `Ja, ${capabilityMatch.technologyMatchScore}% Technologie-Match`
        : `Eingeschränkt: ${capabilityMatch.missingCapabilities.slice(0, 3).join(', ')}`,
      confidence: capabilityMatch.confidence,
      status:
        capabilityMatch.technologyMatchScore >= 70
          ? 'positive'
          : capabilityMatch.technologyMatchScore >= 50
            ? 'warning'
            : 'negative',
      details: capabilityMatch.reasoning,
    },
    // 2. Budget Realistisch
    {
      id: 2,
      question: 'Ist das Budget realistisch?',
      icon: DollarSign,
      answer:
        dealQuality.budgetAdequacy === 'adequate'
          ? `Ja, Budget ist angemessen (${dealQuality.estimatedBudget || 'k.A.'})`
          : dealQuality.budgetAdequacy === 'tight'
            ? `Knapp: ${dealQuality.budgetRisks.slice(0, 2).join(', ')}`
            : `Nein: ${dealQuality.budgetRisks[0] || 'Unzureichendes Budget'}`,
      confidence: dealQuality.confidence,
      status:
        dealQuality.budgetAdequacy === 'adequate'
          ? 'positive'
          : dealQuality.budgetAdequacy === 'tight'
            ? 'warning'
            : 'negative',
      details: `Geschätzte Marge: ${dealQuality.estimatedMargin}%`,
    },
    // 3. Timeline Machbar
    {
      id: 3,
      question: 'Ist die Timeline machbar?',
      icon: Clock,
      answer:
        dealQuality.timelineRealism === 'realistic'
          ? 'Ja, Timeline ist realistisch'
          : dealQuality.timelineRealism === 'tight'
            ? `Eng: ${dealQuality.timelineRisks.slice(0, 2).join(', ')}`
            : `Unrealistisch: ${dealQuality.timelineRisks[0] || 'Zeitplan nicht haltbar'}`,
      confidence: dealQuality.confidence,
      status:
        dealQuality.timelineRealism === 'realistic'
          ? 'positive'
          : dealQuality.timelineRealism === 'tight'
            ? 'warning'
            : 'negative',
      details: dealQuality.projectStart ? `Projektstart: ${dealQuality.projectStart}` : undefined,
    },
    // 4. Rechtliche Red Flags
    {
      id: 4,
      question: 'Gibt es rechtliche Red Flags?',
      icon: Scale,
      answer:
        legalAssessment.criticalBlockers.length === 0
          ? 'Keine kritischen rechtlichen Probleme'
          : `Warnung: ${legalAssessment.criticalBlockers.slice(0, 2).join(', ')}`,
      confidence: legalAssessment.confidence,
      status: legalAssessment.criticalBlockers.length === 0 ? 'positive' : 'negative',
      details: `Legal Score: ${legalAssessment.overallLegalScore}/100`,
    },
    // 5. Passende Referenzen
    {
      id: 5,
      question: 'Haben wir passende Referenzen?',
      icon: Award,
      answer: referenceMatch.similarProjectsAnalysis.hasRelevantReferences
        ? `Ja, ${referenceMatch.similarProjectsAnalysis.similarProjects.length} relevante Projekte`
        : 'Begrenzte Referenzen verfügbar',
      confidence: referenceMatch.confidence,
      status:
        referenceMatch.overallReferenceScore >= 70
          ? 'positive'
          : referenceMatch.overallReferenceScore >= 50
            ? 'warning'
            : 'negative',
      details: referenceMatch.reasoning,
    },
    // 6. Wettbewerber
    {
      id: 6,
      question: 'Wer sind die Wettbewerber?',
      icon: Users,
      answer:
        competitionCheck.competitiveAnalysis.knownCompetitors.length > 0
          ? `${competitionCheck.competitiveAnalysis.competitionLevel} Wettbewerb: ${competitionCheck.competitiveAnalysis.knownCompetitors.slice(0, 3).join(', ')}`
          : 'Keine bekannten Wettbewerber identifiziert',
      confidence: competitionCheck.confidence,
      status:
        competitionCheck.competitiveAnalysis.competitionLevel === 'low' ||
        competitionCheck.competitiveAnalysis.competitionLevel === 'none'
          ? 'positive'
          : competitionCheck.competitiveAnalysis.competitionLevel === 'medium'
            ? 'warning'
            : 'negative',
      details: `Differenziatoren: ${competitionCheck.competitiveAnalysis.ourDifferentiators.slice(0, 2).join(', ')}`,
    },
    // 7. Win-Wahrscheinlichkeit
    {
      id: 7,
      question: 'Wie hoch ist die Win-Wahrscheinlichkeit?',
      icon: TrendingUp,
      answer: `${competitionCheck.estimatedWinProbability}% geschätzte Gewinnchance`,
      confidence: competitionCheck.confidence,
      status:
        competitionCheck.estimatedWinProbability >= 60
          ? 'positive'
          : competitionCheck.estimatedWinProbability >= 40
            ? 'warning'
            : 'negative',
      details: competitionCheck.reasoning,
    },
    // 8. Benötigte Skills
    {
      id: 8,
      question: 'Welche Skills werden benötigt?',
      icon: Briefcase,
      answer: capabilityMatch.hasRequiredScale
        ? `Kapazität vorhanden (${capabilityMatch.scaleMatchScore}% Match)`
        : `Gaps: ${capabilityMatch.scaleGaps.slice(0, 2).join(', ')}`,
      confidence: capabilityMatch.confidence,
      status:
        capabilityMatch.scaleMatchScore >= 70
          ? 'positive'
          : capabilityMatch.scaleMatchScore >= 50
            ? 'warning'
            : 'negative',
    },
    // 9. Skill-Gaps
    {
      id: 9,
      question: 'Gibt es Skill-Gaps?',
      icon: AlertCircle,
      answer:
        capabilityMatch.criticalBlockers.length === 0 &&
        capabilityMatch.missingCapabilities.length === 0
          ? 'Keine kritischen Skill-Gaps'
          : capabilityMatch.missingCapabilities.length > 0
            ? `Gaps: ${capabilityMatch.missingCapabilities.slice(0, 3).join(', ')}`
            : 'Einige Lücken identifiziert',
      confidence: capabilityMatch.confidence,
      status:
        capabilityMatch.criticalBlockers.length === 0
          ? capabilityMatch.missingCapabilities.length === 0
            ? 'positive'
            : 'warning'
          : 'negative',
      details:
        capabilityMatch.criticalBlockers.length > 0
          ? `Blocker: ${capabilityMatch.criticalBlockers[0]}`
          : undefined,
    },
    // 10. Finale Empfehlung
    {
      id: 10,
      question: 'Was ist die finale Empfehlung?',
      icon: ThumbsUp,
      answer:
        decision.decision === 'bit'
          ? `BIT empfohlen (${decision.scores.overall}/100 Punkte)`
          : `NO BIT empfohlen (${decision.scores.overall}/100 Punkte)`,
      confidence: decision.overallConfidence,
      status: decision.decision === 'bit' ? 'positive' : 'negative',
      details: decision.reasoning,
    },
  ];
}

function getDefaultQuestions(): Question[] {
  const defaultIcon = HelpCircle;
  return [
    {
      id: 1,
      question: 'Passt der Tech Stack zu unseren Kompetenzen?',
      icon: Cpu,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 2,
      question: 'Ist das Budget realistisch?',
      icon: DollarSign,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 3,
      question: 'Ist die Timeline machbar?',
      icon: Clock,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 4,
      question: 'Gibt es rechtliche Red Flags?',
      icon: Scale,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 5,
      question: 'Haben wir passende Referenzen?',
      icon: Award,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 6,
      question: 'Wer sind die Wettbewerber?',
      icon: Users,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 7,
      question: 'Wie hoch ist die Win-Wahrscheinlichkeit?',
      icon: TrendingUp,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 8,
      question: 'Welche Skills werden benötigt?',
      icon: Briefcase,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 9,
      question: 'Gibt es Skill-Gaps?',
      icon: AlertCircle,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
    {
      id: 10,
      question: 'Was ist die finale Empfehlung?',
      icon: ThumbsUp,
      answer: 'Keine Daten',
      confidence: 0,
      status: 'neutral',
    },
  ];
}
