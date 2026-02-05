import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { pitches, pitchSectionData } from '@/lib/db/schema';

/**
 * Decision Tools — Primitives for BID/NO-BID decision support.
 *
 * These are data-retrieval and stateless-calculation tools.
 * Insight extraction and interpretation is the agent's job (via LLM).
 */

// ============================================================================
// Critical sections used for decision completeness checks
// ============================================================================

const CRITICAL_SECTIONS = [
  'overview',
  'technology',
  'costs',
  'timeline',
  'project-org',
  'audit',
] as const;

// ============================================================================
// decision.list_sections — raw section data for a lead
// ============================================================================

const listSectionsInputSchema = z.object({
  leadId: z.string(),
});

registry.register({
  name: 'decision.list_sections',
  description:
    'List all pitch sections for a lead. Returns raw section data (id, confidence, content, timestamps).',
  category: 'decision',
  inputSchema: listSectionsInputSchema,
  async execute(input, _context: ToolContext) {
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.leadId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    const sections = await db
      .select()
      .from(pitchSectionData)
      .where(eq(pitchSectionData.pitchId, input.leadId));

    const parsedSections = sections.map(s => ({
      sectionId: s.sectionId,
      confidence: s.confidence,
      content: typeof s.content === 'string' ? JSON.parse(s.content) : s.content,
      createdAt: s.createdAt,
    }));

    return {
      success: true,
      data: {
        leadId: input.leadId,
        leadStatus: lead.status,
        blVote: lead.blVote,
        sections: parsedSections,
      },
    };
  },
});

// ============================================================================
// decision.section_stats — completeness and confidence metrics
// ============================================================================

const sectionStatsInputSchema = z.object({
  leadId: z.string(),
});

registry.register({
  name: 'decision.section_stats',
  description:
    'Calculate section completeness and confidence stats for a lead. Returns counts, average confidence, and missing critical sections.',
  category: 'decision',
  inputSchema: sectionStatsInputSchema,
  async execute(input, _context: ToolContext) {
    const sections = await db
      .select({
        sectionId: pitchSectionData.sectionId,
        confidence: pitchSectionData.confidence,
      })
      .from(pitchSectionData)
      .where(eq(pitchSectionData.pitchId, input.leadId));

    const completedSectionIds = new Set(sections.map(s => s.sectionId));
    const missingCriticalSections = CRITICAL_SECTIONS.filter(cs => !completedSectionIds.has(cs));

    const avgConfidence =
      sections.length > 0
        ? Math.round(
            (sections.reduce((sum, s) => sum + (s.confidence || 0), 0) / sections.length) * 100
          ) / 100
        : 0;

    return {
      success: true,
      data: {
        totalCriticalSections: CRITICAL_SECTIONS.length,
        completedSections: sections.length,
        missingCriticalSections,
        avgConfidence,
      },
    };
  },
});

// ============================================================================
// decision.aggregate — DEPRECATED, use decision.list_sections + decision.section_stats
// ============================================================================

const aggregateInputSchema = z.object({
  leadId: z.string(),
});

registry.register({
  name: 'decision.aggregate',
  description:
    '[DEPRECATED: use decision.list_sections + decision.section_stats] Aggregate all section insights for a lead.',
  category: 'decision',
  inputSchema: aggregateInputSchema,
  async execute(input, _context: ToolContext) {
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.leadId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    const sections = await db
      .select()
      .from(pitchSectionData)
      .where(eq(pitchSectionData.pitchId, input.leadId));

    const parsedSections = sections.map(s => ({
      sectionId: s.sectionId,
      confidence: s.confidence,
      content: typeof s.content === 'string' ? JSON.parse(s.content) : s.content,
      createdAt: s.createdAt,
    }));

    const completedSectionIds = new Set(sections.map(s => s.sectionId));
    const missingCriticalSections = CRITICAL_SECTIONS.filter(cs => !completedSectionIds.has(cs));
    const avgConfidence =
      sections.length > 0
        ? Math.round(
            (sections.reduce((sum, s) => sum + (s.confidence || 0), 0) / sections.length) * 100
          ) / 100
        : 0;

    return {
      success: true,
      data: {
        leadId: input.leadId,
        leadStatus: lead.status,
        blVote: lead.blVote,
        sections: parsedSections,
        summary: {
          totalSections: CRITICAL_SECTIONS.length,
          completedSections: sections.length,
          avgConfidence,
          missingCriticalSections,
          keyInsights: {},
        },
      },
    };
  },
});
