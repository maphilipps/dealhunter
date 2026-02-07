import type { LeadScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

export interface QuestionWithStatus {
  id: number;
  question: string;
  answered: boolean;
  answer?: string;
  evidence?: Array<{ snippet: string; source: string }>;
  confidence?: number;
}

export type ProjectType = 'qualification' | 'migration' | 'greenfield' | 'relaunch';

export const QUALIFICATION_QUESTIONS = [
  'Wie gut ist unsere Kundenbeziehung? Kennen wir die Entscheidungsstruktur und Ansprechpartner oder sind wir lediglich über das Ausschreibungsportal anonym in Kontakt?',
  'Welche Budgetvorstellung schätzt Du hinter der Ausschreibung? (Also: würde sich der Aufwand lohnen?)',
  'Wie lautet die Timeline der Ausschreibung? Gibt es ein Shortlistingprozess (Teilnahme-Antrag, danach bekannte kurze Liste der Bieterkandidaten? Oder ist es ein direktes Vergabeverfahren, mit potentiell sehr vielen Mit-Anbietern?)?',
  'Was besagt der Vertragstyp, soweit schon erkennbar? EVB-IT? Oder anderer angelehnter Vertrag? Mit Werk-Anteile, Dienstvertrag oder Servicevertrag mit SLA?',
  'Was sind die geforderten Leistungen?',
  'Welche und wie viele Referenzen sind gefordert? Wie spitz sind diese eingegrenzt? Welche adesso Referenzen fielen dir hierzu ein?',
  'Zuschlagskriterien im Detail? Sind diese an zu liefernde Konzepte gebunden? Gibt es unterschiedliche Kriterien für einen Teilnahmeantrag und ein etwaig später abzugebendes Angebot?',
  'Was muss ein Angebotsteam erarbeiten? In der Teilnahme-Antragphase? Was fiele in der Angebotsphase an?',
  'Welche Herausforderungen hätten wir?',
  'Deine Einschätzung zu Bid/No Bid?',
];

export interface TenQuestionsPayload {
  questions: QuestionWithStatus[];
  answeredCount: number;
  totalCount: number;
  projectType: ProjectType;
}

function parseTenQuestions(qualificationScan: LeadScan): TenQuestionsPayload | null {
  if (!qualificationScan.tenQuestions) return null;

  try {
    const parsed = JSON.parse(qualificationScan.tenQuestions) as TenQuestionsPayload;
    if (!parsed?.questions?.length) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function createEmptyTenQuestionsPayload(): TenQuestionsPayload {
  const questions = QUALIFICATION_QUESTIONS.map((question, index) => ({
    id: index + 1,
    question,
    answered: false,
  }));

  return {
    questions,
    answeredCount: 0,
    totalCount: questions.length,
    projectType: 'qualification',
  };
}

export function calculateAnsweredQuestionsCount(
  qualificationScan: LeadScan,
  _extractedData?: ExtractedRequirements | null
): { answered: number; total: number; projectType: ProjectType } {
  const stored = parseTenQuestions(qualificationScan);
  if (stored) {
    return {
      answered: stored.answeredCount ?? stored.questions.filter(q => q.answered).length,
      total: stored.totalCount ?? stored.questions.length,
      projectType: stored.projectType ?? 'qualification',
    };
  }

  const fallback = createEmptyTenQuestionsPayload();
  return {
    answered: fallback.answeredCount,
    total: fallback.totalCount,
    projectType: fallback.projectType,
  };
}

export function buildQuestionsWithStatus(
  qualificationScan: LeadScan,
  _extractedData?: ExtractedRequirements | null
): {
  questions: QuestionWithStatus[];
  projectType: ProjectType;
  summary: { answered: number; total: number };
} {
  const stored = parseTenQuestions(qualificationScan);
  if (stored) {
    return {
      questions: stored.questions,
      projectType: stored.projectType ?? 'qualification',
      summary: {
        answered: stored.answeredCount ?? stored.questions.filter(q => q.answered).length,
        total: stored.totalCount ?? stored.questions.length,
      },
    };
  }

  const fallback = createEmptyTenQuestionsPayload();
  return {
    questions: fallback.questions,
    projectType: fallback.projectType,
    summary: {
      answered: fallback.answeredCount,
      total: fallback.totalCount,
    },
  };
}
