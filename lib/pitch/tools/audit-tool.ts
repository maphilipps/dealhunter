import { tool } from 'ai';
import { z } from 'zod';

import { runFullAudit, type FullAuditResult } from '../audit';
import { markAgentComplete, markAgentFailed } from '../checkpoints';
import { AGENT_NAMES } from '../constants';

/**
 * Creates the runAudit tool that executes the full website audit pipeline.
 *
 * This delegates to the audit module (tech detection, performance,
 * accessibility, component analysis) and stores results in the DB.
 */
export function createAuditTool(params: { runId: string; pitchId: string; websiteUrl: string }) {
  return tool({
    description:
      'Führe ein vollständiges Website-Audit durch (Tech-Stack, Performance, Accessibility, Komponenten-Analyse). ' +
      'Rufe dieses Tool einmal am Anfang der Pipeline auf.',
    inputSchema: z.object({
      websiteUrl: z.string().optional().describe('Website-URL (Standard: die URL des Pitches)'),
    }),
    execute: async ({ websiteUrl }): Promise<FullAuditResult> => {
      const url = websiteUrl || params.websiteUrl;

      try {
        const result = await runFullAudit({
          runId: params.runId,
          pitchId: params.pitchId,
          websiteUrl: url,
        });

        await markAgentComplete(
          params.runId,
          AGENT_NAMES.AUDIT_WEBSITE,
          result.failedModules.length === 0 ? 90 : 60
        );

        return result;
      } catch (error) {
        await markAgentFailed(params.runId, AGENT_NAMES.AUDIT_WEBSITE);
        throw error;
      }
    },
  });
}
