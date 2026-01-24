import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { leads, leadSectionData } from '@/lib/db/schema';

/**
 * Sprint 4.1: Decision Aggregation Tools
 *
 * Aggregates insights from all section synthesizers to support BID/NO-BID decision making.
 * Provides consolidated view of technology, costs, risks, timeline, team requirements.
 */

// ============================================================================
// decision.aggregate
// ============================================================================

const aggregateInputSchema = z.object({
  leadId: z.string(),
});

interface AggregatedDecisionData {
  leadId: string;
  leadStatus: string;
  blVote: string | null;
  sections: {
    sectionId: string;
    confidence: number | null;
    content: Record<string, unknown>;
    createdAt: Date | null;
  }[];
  summary: {
    totalSections: number;
    completedSections: number;
    avgConfidence: number;
    missingCriticalSections: string[];
    keyInsights: {
      technology?: string[];
      risks?: string[];
      estimatedCosts?: string;
      timeline?: string;
      teamRequirements?: string[];
    };
  };
}

registry.register({
  name: 'decision.aggregate',
  description:
    'Aggregate all section insights for a lead. Returns consolidated data to support BID/NO-BID decision.',
  category: 'decision',
  inputSchema: aggregateInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Get all section data for this lead
    const sections = await db
      .select()
      .from(leadSectionData)
      .where(eq(leadSectionData.leadId, input.leadId));

    // Parse section content and extract key insights
    const parsedSections = sections.map(s => ({
      sectionId: s.sectionId,
      confidence: s.confidence,
      content: typeof s.content === 'string' ? JSON.parse(s.content) : s.content,
      createdAt: s.createdAt,
    }));

    // Calculate summary metrics
    const completedSections = sections.length;
    const avgConfidence =
      sections.length > 0
        ? sections.reduce((sum, s) => sum + (s.confidence || 0), 0) / sections.length
        : 0;

    // Define critical sections for decision making
    const criticalSections = [
      'overview',
      'technology',
      'costs',
      'timeline',
      'project-org',
      'audit',
    ];
    const completedSectionIds = new Set(sections.map(s => s.sectionId));
    const missingCriticalSections = criticalSections.filter(cs => !completedSectionIds.has(cs));

    // Extract key insights from section content
    const keyInsights: AggregatedDecisionData['summary']['keyInsights'] = {};

    for (const section of parsedSections) {
      switch (section.sectionId) {
        case 'technology': {
          const content = section.content as {
            detectedTechnologies?: Array<{ name: string }>;
            techStack?: { stack?: string[] };
          };
          keyInsights.technology =
            content.detectedTechnologies?.map(t => t.name) || content.techStack?.stack || [];
          break;
        }

        case 'costs': {
          const content = section.content as {
            totalEstimatedCosts?: { total?: string; range?: string };
          };
          keyInsights.estimatedCosts =
            content.totalEstimatedCosts?.total || content.totalEstimatedCosts?.range;
          break;
        }

        case 'timeline': {
          const content = section.content as {
            projectDuration?: string;
            estimatedDuration?: string;
          };
          keyInsights.timeline = content.projectDuration || content.estimatedDuration;
          break;
        }

        case 'project-org': {
          const content = section.content as {
            teamStructure?: Record<string, { count?: number; totalPT?: number }>;
            organizationRecommendation?: { teamSize?: number };
          };
          const teamSize =
            content.organizationRecommendation?.teamSize ||
            Object.values(content.teamStructure || {}).reduce(
              (sum, role) => sum + (role.count || 0),
              0
            );
          keyInsights.teamRequirements = teamSize ? [`${teamSize} team members required`] : [];
          break;
        }

        case 'audit': {
          const content = section.content as {
            risks?: Array<{ risk: string; impact: string }>;
          };
          keyInsights.risks =
            content.risks
              ?.filter(r => r.impact === 'high' || r.impact === 'critical')
              .map(r => r.risk) || [];
          break;
        }
      }
    }

    const aggregatedData: AggregatedDecisionData = {
      leadId: input.leadId,
      leadStatus: lead.status,
      blVote: lead.blVote,
      sections: parsedSections,
      summary: {
        totalSections: criticalSections.length,
        completedSections,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        missingCriticalSections,
        keyInsights,
      },
    };

    return {
      success: true,
      data: aggregatedData,
    };
  },
});
