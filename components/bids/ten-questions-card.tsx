'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
        <Accordion type="single" collapsible className="w-full">
          {questions.map(q => (
            <AccordionItem key={q.id} value={`question-${q.id}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  {q.answered ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  )}
                  <span className="text-sm">{q.question}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-7 pt-2">
                  {q.answer ? (
                    <p className="text-sm text-muted-foreground">{q.answer}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Keine Daten verfügbar - manuelle Recherche erforderlich
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
