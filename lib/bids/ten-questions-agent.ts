import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import { registry } from '@/lib/agent-tools';
import type { ToolContext } from '@/lib/agent-tools';
import { modelNames } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';
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

  let hasQueriedDocument = false;

  const runTool = tool({
    description: 'Query the pre-qualification documents using RAG.',
    inputSchema: z.object({
      name: z.literal('prequal.query'),
      input: z.object({
        preQualificationId: z.string(),
        query: z.string(),
        language: z.enum(['de', 'en']).default('de'),
        topK: z.number().min(1).max(20).default(5),
      }),
    }),
    execute: async ({ name, input: toolInput }) => {
      if (name === 'prequal.query') {
        hasQueriedDocument = true;
      }
      return registry.execute(name, toolInput, toolContext);
    },
  });

  const completeTenQuestions = tool({
    description: 'Finalize the qualification questions with answers and evidence.',
    inputSchema: completionSchema,
    execute: async payload => ({ success: true, payload }),
  });

  const agent = new ToolLoopAgent({
    model: getProviderForSlot('quality')(modelNames.quality),
    instructions: [
      'You answer the Qualification questions using ONLY the provided documents.',
      'You MUST use prequal.query to find evidence before answering each question.',
      'If the documents do not contain the information, set answer=null and evidence=[].',
      'Never invent data. Evidence snippets must be direct excerpts from the document context.',
      'Return all 10 questions with answers, evidence, and confidence (0-100).',
    ].join('\n'),
    tools: { runTool, completeTenQuestions },
    stopWhen: [stepCountIs(30), hasToolCall('completeTenQuestions')],
  });

  const questionsList = QUALIFICATION_QUESTIONS.map((q, index) => `${index + 1}. ${q}`).join('\n');

  const prompt = [
    `Pre-Qualification ID: ${input.preQualificationId}`,
    `Language: ${input.language ?? 'de'}`,
    '',
    'Answer the following 10 questions. Use prequal.query for each question to gather evidence.',
    'If no evidence is found, answer null.',
    '',
    questionsList,
  ].join('\n');

  const result = await agent.generate({ prompt });

  const completionCall = result.steps
    .flatMap(step => step.toolCalls)
    .find(call => call.toolName === 'completeTenQuestions');

  if (!completionCall || !('input' in completionCall)) {
    throw new Error('TenQuestions agent did not call completeTenQuestions');
  }

  const payload = completionCall.input as z.infer<typeof completionSchema>;

  if (!hasQueriedDocument) {
    throw new Error('TenQuestions agent did not query documents');
  }

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
