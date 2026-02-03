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
      const toolResult = await registry.execute(
        'prequal.query',
        {
          preQualificationId: input.preQualificationId,
          query: question,
          language,
          topK: 8,
        },
        toolContext
      );

      const data = toolResult.data as { context?: string } | undefined;
      return {
        id: index + 1,
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

  const questions = payload.questions.map(item => ({
    id: item.id,
    question: item.question,
    answered: Boolean(item.answer),
    answer: item.answer ?? undefined,
    evidence: item.evidence,
    confidence: item.confidence,
  }));

  const answeredCount = questions.filter(q => q.answered).length;

  return {
    questions,
    answeredCount,
    totalCount: questions.length,
    projectType: 'qualification',
  };
}
