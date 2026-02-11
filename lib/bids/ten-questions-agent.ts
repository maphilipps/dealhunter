import { z } from 'zod';

import { registry } from '@/lib/agent-tools';
import type { ToolContext } from '@/lib/agent-tools';
import { generateStructuredOutput, AI_TIMEOUTS } from '@/lib/ai/config';
import { QUALIFICATION_QUESTIONS, type TenQuestionsPayload } from '@/lib/bids/ten-questions';

interface TenQuestionsAgentInput {
  preQualificationId: string;
  userId: string;
  language?: 'de' | 'en';
}

const RAG_QUERY_BY_QUESTION_ID: Record<number, string> = {
  1: 'Kundenbeziehung Entscheidungsstruktur Ansprechpartner Kontaktperson anonym Vergabeportal',
  2: 'Budget Kostenrahmen Auftragswert Schätzwert EUR € Vergütung Festpreis Time and Material',
  3: 'Zeitplan Fristen Termine Abgabefrist Angebotsfrist Teilnahmeantrag Shortlist Verhandlungsverfahren',
  4: 'Vertrag Vertragstyp EVB-IT AGB Haftung Gewährleistung SLA Vertragsstrafe Pönale',
  5: 'Leistungen Lieferumfang Scope Arbeitspakete Implementierung Migration Betrieb Support Schulung',
  6: 'Referenzen Eignungsnachweise Referenzanforderungen Anzahl Projekte Branche Vergleichbarkeit',
  7: 'Zuschlagskriterien Bewertungskriterien Gewichtung Punkte Wertung Konzept Preis Qualität',
  8: 'Angebotsunterlagen Teilnahmeantrag Angebotsphase Preisblatt Formblätter Konzepte Nachweise',
  9: 'Herausforderungen Risiken Abhängigkeiten Komplexität Migration Schnittstellen Sicherheit Barrierefreiheit',
  10: 'Bid No-Bid Empfehlung Entscheidung Bewertung',
};

const completionSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number().int(),
      question: z.string(),
      answer: z.string().nullable(),
      evidence: z.array(
        z.object({
          snippet: z.string(),
          source: z.string(),
        })
      ),
      confidence: z.number().min(0).max(100),
    })
  ),
});

export async function runTenQuestionsAgent(
  input: TenQuestionsAgentInput
): Promise<TenQuestionsPayload> {
  const toolContext: ToolContext = {
    userId: input.userId,
    userRole: 'admin',
    userEmail: 'system@dealhunter.local',
    userName: 'Qualification Agent',
  };

  // Deterministic orchestrator-worker pattern:
  // 1) Query documents per question via tool
  // 2) Synthesize answers from those document contexts only
  const language = input.language ?? 'de';
  const contexts = await Promise.all(
    QUALIFICATION_QUESTIONS.map(async (question, index) => {
      const id = index + 1;
      const retrievalQuery = RAG_QUERY_BY_QUESTION_ID[id] ?? question;
      const toolResult = await registry.execute(
        'prequal.query',
        {
          preQualificationId: input.preQualificationId,
          query: retrievalQuery,
          language,
          topK: 8,
        },
        toolContext
      );

      const data = toolResult.data as { context?: string } | undefined;
      return {
        id,
        question,
        context: toolResult.success ? (data?.context ?? '') : '',
      };
    })
  );

  const payload = await generateStructuredOutput({
    model: 'quality',
    schema: completionSchema,
    system: [
      'Du berätst mich in der Analyse der beigefügten Ausschreibung.',
      'Beziehe Dich bei den Antworten immer ausschließlich auf die bereitgestellten Dokumente.',
      'Wenn keine Evidenz vorhanden ist, setze answer=null und evidence=[].',
      'Evidence-Snippets müssen direkte Ausschnitte aus dem Kontext sein.',
    ].join('\n'),
    prompt: `Kontext je Frage (nur Dokumente):\n${JSON.stringify(contexts, null, 2)}`,
    timeout: AI_TIMEOUTS.AGENT_HEAVY,
  });

  const contextById = new Map<number, string>(contexts.map(c => [c.id, c.context ?? '']));

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const rawById = new Map(payload.questions.map(q => [q.id, q]));

  const questions = QUALIFICATION_QUESTIONS.map((question, index) => {
    const id = index + 1;
    const raw = rawById.get(id);

    let answer = raw?.answer ?? null;
    let confidence = raw?.confidence ?? 0;
    const evidenceIn = raw?.evidence ?? [];

    const ctxNorm = normalize(contextById.get(id) ?? '');
    const evidence = evidenceIn
      .filter(e => typeof e?.snippet === 'string' && e.snippet.trim().length > 0)
      .filter(e => {
        const snippetNorm = normalize(e.snippet);
        if (!snippetNorm) return false;
        return ctxNorm.includes(snippetNorm);
      });

    // Deterministic guardrails: no evidence => no answer.
    if (answer && evidence.length === 0) {
      answer = null;
      confidence = 0;
    }

    if (!answer) {
      answer = null;
      confidence = 0;
    }

    return {
      id,
      question,
      answered: Boolean(answer),
      answer: answer ?? undefined,
      evidence,
      confidence,
    };
  });

  const answeredCount = questions.filter(q => q.answered).length;

  return {
    questions,
    answeredCount,
    totalCount: questions.length,
    projectType: 'qualification',
  };
}
