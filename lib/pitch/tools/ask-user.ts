import { tool } from 'ai';
import { z } from 'zod';

import { saveCheckpoint } from '../checkpoints';
import type { OrchestratorCheckpoint } from '../types';

/**
 * Custom error class to signal the BullMQ job should stop gracefully
 * and wait for a user answer before resuming.
 */
export class AskUserInterrupt extends Error {
  constructor(
    public readonly runId: string,
    public readonly question: string,
    public readonly context: string,
    public readonly options?: string[]
  ) {
    super(`AskUserInterrupt: ${question}`);
    this.name = 'AskUserInterrupt';
  }
}

/**
 * Creates the askUser tool that pauses the pipeline to ask the user a question.
 *
 * When called, it saves a checkpoint with the pending question and throws
 * AskUserInterrupt to stop the BullMQ job gracefully. The job can be resumed
 * when the user provides an answer.
 */
export function createAskUserTool(params: {
  runId: string;
  getCheckpoint: () => OrchestratorCheckpoint;
}) {
  return tool({
    description:
      'Stelle dem User eine Frage, wenn du dir bei einer kritischen Entscheidung unsicher bist. ' +
      'Verwende dieses Tool NUR bei wirklich wichtigen Unsicherheiten. ' +
      'Die Pipeline wird pausiert bis der User antwortet.',
    inputSchema: z.object({
      question: z.string().describe('Die Frage an den User'),
      context: z.string().describe('Kontext warum diese Frage wichtig ist'),
      options: z.array(z.string()).optional().describe('Optionale Antwortvorschläge'),
      defaultAnswer: z
        .string()
        .optional()
        .describe('Standard-Antwort falls der User nicht reagiert'),
    }),
    execute: async ({ question, context, options, defaultAnswer }): Promise<{ paused: true }> => {
      const checkpoint = params.getCheckpoint();
      checkpoint.pendingQuestion = {
        question,
        context,
        options,
        defaultAnswer,
      };

      await saveCheckpoint(params.runId, checkpoint);

      throw new AskUserInterrupt(params.runId, question, context, options);
    },
  });
}
