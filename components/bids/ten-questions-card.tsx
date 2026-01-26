'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuestionWithStatus, ProjectType } from '@/lib/bids/ten-questions';

interface TenQuestionsCardProps {
  questions: QuestionWithStatus[];
  projectType: ProjectType;
  answeredCount: number;
  totalCount: number;
}

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  migration: 'Migration',
  greenfield: 'Greenfield',
  relaunch: 'Relaunch',
};

export function TenQuestionsCard({
  questions,
  projectType,
  answeredCount,
  totalCount,
}: TenQuestionsCardProps) {
  return (
    <Card data-ten-questions-card>
      <CardHeader>
        <CardTitle>10 Fragen Review - {PROJECT_TYPE_LABELS[projectType]}</CardTitle>
        <CardDescription>
          {answeredCount}/{totalCount} Fragen beantwortet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                {q.answered ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {q.id}. {q.question}
                  </p>
                  {q.answer ? (
                    <p className="text-sm text-muted-foreground mt-1">{q.answer}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mt-1">
                      Keine Daten verfügbar - manuelle Recherche erforderlich
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
