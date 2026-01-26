import { z } from 'zod';

import { registry } from './registry';

import { storeAuditAgentOutput } from '@/lib/deep-scan/experts/base';
import { runArchitectureExpert } from '@/lib/deep-scan/experts/architecture-expert';
import { runCostsExpert } from '@/lib/deep-scan/experts/costs-expert';
import { runDecisionExpert } from '@/lib/deep-scan/experts/decision-expert';
import { runHostingExpert } from '@/lib/deep-scan/experts/hosting-expert';
import { runIntegrationsExpert } from '@/lib/deep-scan/experts/integrations-expert';
import { runMigrationExpert } from '@/lib/deep-scan/experts/migration-expert';
import { runPerformanceExpert } from '@/lib/deep-scan/experts/performance-expert';
import { runProjectExpert } from '@/lib/deep-scan/experts/project-expert';
import { runTechExpert } from '@/lib/deep-scan/experts/tech-expert';
import { runWebsiteExpert } from '@/lib/deep-scan/experts/website-expert';
import { createExpertRagTools } from '@/lib/deep-scan/rag-tools';

const deepScanToolInput = z.object({
  leadId: z.string(),
  websiteUrl: z.string().url(),
});


const expertRegistry = {
  tech: runTechExpert,
  website: runWebsiteExpert,
  performance: runPerformanceExpert,
  architecture: runArchitectureExpert,
  hosting: runHostingExpert,
  integrations: runIntegrationsExpert,
  migration: runMigrationExpert,
  project: runProjectExpert,
  costs: runCostsExpert,
  decision: runDecisionExpert,
};

for (const [expertName, runner] of Object.entries(expertRegistry)) {
  registry.register({
    name: `scan.runExpert.${expertName}`,
    description: `Run the DeepScan ${expertName} expert and persist its audit output`,
    category: 'scan',
    inputSchema: deepScanToolInput,
    async execute(input) {
      try {
        const ragTools = createExpertRagTools(input.leadId, expertName);
        const output = await runner({ leadId: input.leadId, websiteUrl: input.websiteUrl, ragTools });

        try {
          await storeAuditAgentOutput(input.leadId, `audit_${expertName}_expert`, output);
        } catch (storeError) {
          console.error(`[${expertName} Expert] Store failed but expert succeeded:`, storeError);
          // Continue even if store fails - expert ran successfully
        }

        return {
          success: output.success,
          error: output.success ? undefined : output.error || 'Expert failed',
          data: {
            confidence: output.confidence,
            category: output.category,
            sections: output.sections.length,
          },
        };
      } catch (error) {
        console.error(`[${expertName} Expert] Execution failed:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Expert execution failed',
          data: {
            confidence: 0,
            category: '',
            sections: 0,
          },
        };
      }
    },
  });
}
