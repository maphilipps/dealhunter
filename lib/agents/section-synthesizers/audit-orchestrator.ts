/**
 * Audit Orchestrator
 *
 * Orchestrates comprehensive website audit analysis.
 * Synthesizes findings from multiple audit dimensions:
 * - Navigation & Information Architecture
 * - Accessibility (WCAG)
 * - Performance & Core Web Vitals
 * - Content Quality & SEO
 * - Technical Infrastructure
 */

import { z } from 'zod';

import { SectionSynthesizerBase, type SectionResult } from '../section-synthesizer-base';

/**
 * Audit Orchestrator Output Schema
 */
const auditOutputSchema = z.object({
  overallHealthScore: z.number().min(0).max(100),
  navigationAudit: z.object({
    score: z.number().min(0).max(100),
    findings: z.array(
      z.object({
        issue: z.string(),
        severity: z.enum(['critical', 'major', 'minor']),
        recommendation: z.string(),
        effort: z.enum(['low', 'medium', 'high']),
      })
    ),
    strengths: z.array(z.string()),
    structureAssessment: z.string(),
  }),
  accessibilityAudit: z.object({
    score: z.number().min(0).max(100),
    wcagLevel: z.enum(['A', 'AA', 'AAA', 'non-compliant']),
    findings: z.array(
      z.object({
        issue: z.string(),
        wcagCriterion: z.string(),
        severity: z.enum(['critical', 'major', 'minor']),
        recommendation: z.string(),
        effort: z.enum(['low', 'medium', 'high']),
      })
    ),
    complianceGaps: z.array(z.string()),
  }),
  performanceAudit: z.object({
    score: z.number().min(0).max(100),
    coreWebVitals: z.object({
      lcp: z.string().optional(),
      fid: z.string().optional(),
      cls: z.string().optional(),
      assessment: z.string(),
    }),
    findings: z.array(
      z.object({
        issue: z.string(),
        severity: z.enum(['critical', 'major', 'minor']),
        recommendation: z.string(),
        effort: z.enum(['low', 'medium', 'high']),
      })
    ),
    optimizationPriorities: z.array(z.string()),
  }),
  contentQualityAudit: z.object({
    score: z.number().min(0).max(100),
    findings: z.array(
      z.object({
        area: z.string(),
        issue: z.string(),
        severity: z.enum(['critical', 'major', 'minor']),
        recommendation: z.string(),
      })
    ),
    seoAssessment: z.string(),
    contentGovernanceRecommendations: z.array(z.string()),
  }),
  technicalInfrastructureAudit: z.object({
    score: z.number().min(0).max(100),
    findings: z.array(
      z.object({
        category: z.string(),
        issue: z.string(),
        severity: z.enum(['critical', 'major', 'minor']),
        recommendation: z.string(),
      })
    ),
    securityAssessment: z.string(),
    scalabilityAssessment: z.string(),
  }),
  migrationImpact: z.object({
    preservableElements: z.array(z.string()),
    deprecatedFeatures: z.array(z.string()),
    requiredImprovements: z.array(z.string()),
    opportunitiesForModernization: z.array(z.string()),
  }),
  priorityRoadmap: z.array(
    z.object({
      phase: z.string(),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']),
      items: z.array(z.string()),
      estimatedEffort: z.string(),
      rationale: z.string(),
    })
  ),
});

type AuditOutput = z.infer<typeof auditOutputSchema>;

/**
 * Audit Orchestrator
 */
export class AuditOrchestrator extends SectionSynthesizerBase {
  sectionId = 'audit';

  async synthesize(leadId: string): Promise<SectionResult> {
    // Query RAG for audit-related context
    const ragResults = await this.queryRAG(
      leadId,
      'website audit navigation accessibility wcag performance core web vitals content quality seo technical infrastructure security scalability lighthouse'
    );

    // Build context
    const ragContext = ragResults.map(r => r.content).join('\n\n');

    // Build prompts
    const systemPrompt = `You are a comprehensive website audit expert specializing in multi-dimensional analysis.

Analyze websites across 5 dimensions:
1. Navigation & IA
2. Accessibility (WCAG)
3. Performance & CWV
4. Content Quality & SEO
5. Technical Infrastructure

Output must be valid JSON matching the exact schema.`;

    const userPrompt = `Analyze the following audit data and create a comprehensive audit report:

${ragContext}

Create a JSON output with:
1. Overall health score (0-100)
2. Navigation audit - score, findings (issue, severity, recommendation, effort), strengths, structure assessment
3. Accessibility audit - score, WCAG level, findings (issue, WCAG criterion, severity, recommendation, effort), compliance gaps
4. Performance audit - score, Core Web Vitals (LCP, FID, CLS, assessment), findings, optimization priorities
5. Content quality audit - score, findings (area, issue, severity, recommendation), SEO assessment, governance recommendations
6. Technical infrastructure audit - score, findings (category, issue, severity, recommendation), security assessment, scalability assessment
7. Migration impact - preservable elements, deprecated features, required improvements, modernization opportunities
8. Priority roadmap - phase, priority (P0-P3), items, estimated effort, rationale

Scoring guidelines:
- 90-100: Excellent, minor improvements only
- 70-89: Good, some improvements needed
- 50-69: Fair, significant improvements required
- 0-49: Poor, major overhaul needed

Prioritize findings by:
- P0 (Critical): Blockers, security issues, compliance violations
- P1 (High): Major UX issues, performance bottlenecks
- P2 (Medium): Enhancements, optimizations
- P3 (Low): Nice-to-haves, future considerations`;

    // Generate content
    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    // Parse and validate
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);
    const output: AuditOutput = auditOutputSchema.parse(rawResult);

    // Calculate confidence
    const confidence = this.calculateConfidence(ragResults);

    // Extract sources
    const sources = this.extractSources(ragResults);

    return {
      sectionId: this.sectionId,
      content: output,
      metadata: {
        generatedAt: new Date(),
        agentName: 'audit-orchestrator',
        sources,
        confidence,
      },
    };
  }
}
