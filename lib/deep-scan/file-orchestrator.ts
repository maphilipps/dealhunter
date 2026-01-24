import fs from 'fs/promises';
import path from 'path';

import { eq } from 'drizzle-orm';

import { runArchitectureExpert } from './experts/architecture-expert';
import { runCostsExpert } from './experts/costs-expert';
import { runDecisionExpert } from './experts/decision-expert';
import { runHostingExpert } from './experts/hosting-expert';
import { runIntegrationsExpert } from './experts/integrations-expert';
import { runMigrationExpert } from './experts/migration-expert';
import { runPerformanceExpert } from './experts/performance-expert';
import { runProjectExpert } from './experts/project-expert';
import { runTechExpert } from './experts/tech-expert';
import type { AuditAgentInput, AuditAgentOutput } from './experts/types';
import { runWebsiteExpert } from './experts/website-expert';
import { AgentFile, NavigationSubpage, AuditScanResult } from './types';

import { db } from '@/lib/db';
import { qualifications } from '@/lib/db/schema';
import type { EventEmitter } from '@/lib/streaming/event-emitter';

// Expert agent type with emit parameter (optional for file-based usage)
type ExpertAgentFn = (input: AuditAgentInput, emit?: EventEmitter) => Promise<AuditAgentOutput>;

// Registry of expert agents
const EXPERT_AGENTS: Record<string, ExpertAgentFn> = {
  website: runWebsiteExpert,
  tech: runTechExpert,
  performance: runPerformanceExpert,
  migration: runMigrationExpert,
  architecture: runArchitectureExpert,
  hosting: runHostingExpert,
  integrations: runIntegrationsExpert,
  project: runProjectExpert,
  costs: runCostsExpert,
  decision: runDecisionExpert,
};

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '');
  } catch {
    return 'unknown-domain';
  }
}

/**
 * Run File-Based Deep Scan
 *
 * Orchestrates expert agents, writes files to disk, and prepares navigation/visualization.
 */
export async function runFileBasedDeepScan(leadId: string): Promise<AuditScanResult> {
  // 1. Get Lead Data
  const lead = await db.query.qualifications.findFirst({
    where: eq(qualifications.id, leadId),
  });

  if (!lead || !lead.websiteUrl) {
    throw new Error(`Lead ${leadId} not found or missing website URL`);
  }

  const domain = extractDomain(lead.websiteUrl);
  const auditPath = path.join(process.cwd(), 'audits', `audit_${domain}`);

  // 2. Create Directory Structure
  await ensureDir(path.join(auditPath, 'audit_data'));
  await ensureDir(path.join(auditPath, 'screenshots'));
  await ensureDir(path.join(auditPath, 'docs'));

  // 3. Run Agents in Parallel
  const agentInput: AuditAgentInput = {
    leadId,
    websiteUrl: lead.websiteUrl,
  };

  const agentPromises = Object.entries(EXPERT_AGENTS).map(async ([name, agent]) => {
    try {
      const result = await agent(agentInput);
      return { name, status: 'fulfilled' as const, value: result };
    } catch (error) {
      console.error(`[DeepScan] Expert ${name} failed:`, error);
      return { name, status: 'rejected' as const, reason: error };
    }
  });

  const results = await Promise.all(agentPromises);

  // 4. Aggregate Results (adapted for AuditAgentOutput)
  const allFiles: AgentFile[] = [];
  const allSubpages: NavigationSubpage[] = [];
  const visualizationElements: Record<string, unknown> = {};
  const visualizationRootChildren: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const output = result.value;

      // Convert sections to files (AuditAgentOutput uses sections instead of files)
      if (output.sections) {
        for (const section of output.sections) {
          const filename = `${output.category}-${section.slug}.json`;
          const filePath = path.join(auditPath, 'audit_data', filename);
          const content = JSON.stringify(section.content, null, 2);

          await fs.writeFile(filePath, content, 'utf-8');
          allFiles.push({
            filename,
            content: section.content as object,
            format: 'json',
          });
        }
      }

      // Convert navigation items to subpages (AuditAgentOutput uses navigation.items)
      if (output.navigation?.items) {
        for (const item of output.navigation.items) {
          allSubpages.push({
            id: item.slug,
            label: item.title,
            route: `/${output.category}/${item.slug}`,
          });
        }
      }

      // Generate visualization from sections (AuditAgentOutput doesn't have visualization)
      // Create a simple card visualization for each agent's output
      const rootKey = `${result.name}-card`;
      visualizationElements[rootKey] = {
        key: rootKey,
        type: 'Card',
        props: {
          title: output.navigation?.title ?? output.category,
          subtitle: `Confidence: ${output.confidence}%`,
        },
        children: output.sections.map((_, i) => `${rootKey}-section-${i}`),
      };

      // Add section elements
      output.sections.forEach((section, i) => {
        visualizationElements[`${rootKey}-section-${i}`] = {
          key: `${rootKey}-section-${i}`,
          type: 'Text',
          props: { children: section.title },
        };
      });

      visualizationRootChildren.push(rootKey);
    }
  }

  // 5. Generate Main Visualization Tree
  const visualizationTree = {
    root: 'main-dashboard',
    elements: {
      'main-dashboard': {
        key: 'main-dashboard',
        type: 'Grid',
        props: { columns: 2, gap: 'md' },
        children: visualizationRootChildren,
      },
      ...visualizationElements,
    },
  };

  // 6. Generate VitePress Config (Placeholder for now)
  // We would generate docs/.vitepress/config.js here based on allSubpages

  return {
    auditPath,
    files: allFiles,
    subpages: allSubpages,
    visualizationTree,
  };
}
