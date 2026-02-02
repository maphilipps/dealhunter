import { tool } from 'ai';
import { z } from 'zod';

export interface UncertaintyFlag {
  area: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
}

/**
 * Creates the flagUncertainty tool that marks areas of low confidence.
 *
 * The orchestrator uses this to collect uncertainty flags which are later
 * included in the generated indication document. This follows the
 * "Best-Effort + Flags" principle.
 */
export function createUncertaintyTool(params: { flags: UncertaintyFlag[] }) {
  return tool({
    description:
      'Markiere einen Bereich mit niedriger Confidence. ' +
      'Verwende dieses Tool für alle unsicheren Analysen, damit sie im Ergebnis sichtbar sind. ' +
      'Folge dem Prinzip "Best-Effort + Flags".',
    inputSchema: z.object({
      area: z
        .string()
        .describe('Bereich der Unsicherheit (z.B. "CMS-Erkennung", "Performance-Score")'),
      message: z.string().describe('Erklärung warum die Confidence niedrig ist'),
      severity: z.enum(['info', 'warning', 'critical']).describe('Schweregrad'),
      confidence: z.number().min(0).max(100).describe('Confidence-Level (0-100)'),
    }),
    execute: async ({ area, message, severity, confidence }) => {
      const flag: UncertaintyFlag = { area, message, severity, confidence };
      params.flags.push(flag);

      return {
        flagged: true,
        totalFlags: params.flags.length,
        ...flag,
      };
    },
  });
}
