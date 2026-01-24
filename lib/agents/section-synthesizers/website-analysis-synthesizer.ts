/**
 * Website Analysis Synthesizer (Sprint 1.3)
 *
 * Analyzes customer website performance, SEO, and accessibility.
 * Synthesizes website quality metrics from RAG data.
 *
 * Output includes:
 * - Performance metrics (Core Web Vitals)
 * - SEO analysis
 * - Accessibility score
 * - Content volume and structure
 * - Recommended improvements
 */

import { z } from 'zod';

import {
  SectionSynthesizerBase,
  type SectionSynthesizerInput,
  type SectionSynthesizerOutput,
  type SectionMetadata,
} from './base';

// ========================================
// Output Schema
// ========================================

const performanceMetricsSchema = z.object({
  lcp: z.number().optional(), // Largest Contentful Paint (ms)
  fid: z.number().optional(), // First Input Delay (ms)
  cls: z.number().optional(), // Cumulative Layout Shift (score)
  fcp: z.number().optional(), // First Contentful Paint (ms)
  ttfb: z.number().optional(), // Time to First Byte (ms)
  overallScore: z.number().min(0).max(100), // 0-100
  assessment: z.enum(['poor', 'needs-improvement', 'good', 'excellent']),
});

const seoAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  hasMetaTags: z.boolean(),
  hasStructuredData: z.boolean(),
  hasXMLSitemap: z.boolean(),
  hasRobotsTxt: z.boolean(),
  mobileOptimized: z.boolean(),
  issues: z.array(z.string()).min(0).max(10),
  opportunities: z.array(z.string()).min(0).max(10),
});

const accessibilityAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  wcagLevel: z.enum(['none', 'A', 'AA', 'AAA']).optional(),
  criticalIssues: z.number(), // Count of critical issues
  warningIssues: z.number(), // Count of warnings
  topIssues: z.array(z.string()).min(0).max(5), // Top 5 issues
});

const websiteAnalysisOutputSchema = z.object({
  summary: z.string().min(50), // 2-3 sentence website quality summary
  performance: performanceMetricsSchema,
  seo: seoAnalysisSchema,
  accessibility: accessibilityAnalysisSchema,
  contentVolume: z.object({
    estimatedPages: z.number().optional(), // Estimated page count
    estimatedContentTypes: z.number().optional(), // Number of content types
    complexity: z.enum(['low', 'medium', 'high', 'very-high']),
    details: z.string().optional(),
  }),
  technicalDebt: z.object({
    score: z.number().min(0).max(100), // 0 = no debt, 100 = critical debt
    factors: z.array(z.string()), // What contributes to technical debt?
    impactOnMigration: z.string(), // How does this affect migration?
  }),
  recommendedImprovements: z.array(
    z.object({
      category: z.enum(['performance', 'seo', 'accessibility', 'content', 'technical']),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      title: z.string(),
      description: z.string(),
      estimatedEffort: z.string().optional(), // e.g., "2-4 Wochen"
    })
  ),
  overallQualityScore: z.number().min(0).max(100), // Weighted average of all scores
});

export type WebsiteAnalysisOutput = z.infer<typeof websiteAnalysisOutputSchema>;

// ========================================
// Website Analysis Synthesizer
// ========================================

export class WebsiteAnalysisSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'website-analysis';
  readonly sectionTitle = 'Website-Analyse';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, forceRegenerate } = input;

    try {
      // Check if we should use cached data
      if (!forceRegenerate) {
        const existing = await this.loadExistingSectionData(leadId);
        if (existing) {
          return {
            success: true,
            sectionId: this.sectionId,
            content: existing.content,
            confidence: existing.metadata.confidence,
            metadata: existing.metadata,
          };
        }
      }

      // Query RAG for website analysis data
      // Focus on crawling, performance, SEO, accessibility agents
      const ragResults = await this.queryRAG(leadId, undefined, {
        maxResults: 15,
        agentNameFilter: [
          'website_crawler',
          'accessibility_audit',
          'seo_audit',
          'performance_audit',
          'content_analyzer',
        ],
        minConfidence: 30,
      });

      if (ragResults.length === 0) {
        return {
          success: false,
          sectionId: this.sectionId,
          error: 'Keine Website-Analyse-Daten verfügbar',
        };
      }

      // Format RAG data for AI
      const ragContent = this.formatRAGResultsForPrompt(ragResults, 15);

      // Generate website analysis via AI
      const userPrompt = `Analysiere die Website-Qualität des Kunden basierend auf den folgenden Informationen.

**RAG-Ergebnisse:**
${ragContent}

**Anweisungen:**
Erstelle eine umfassende Website-Qualitäts-Analyse mit:
1. **Summary**: 2-3 Sätze über den Zustand der Website
2. **Performance Metrics**: Core Web Vitals (LCP, FID, CLS, FCP, TTFB)
   - Alle Werte in Millisekunden bzw. CLS als Score
   - Overall Score (0-100)
   - Assessment: poor/needs-improvement/good/excellent
3. **SEO Analysis**:
   - Overall Score (0-100)
   - Checks: Meta Tags, Structured Data, XML Sitemap, robots.txt, Mobile Optimized
   - Issues (max 10): Was ist schlecht?
   - Opportunities (max 10): Was könnte verbessert werden?
4. **Accessibility Analysis**:
   - Overall Score (0-100)
   - WCAG Level: none/A/AA/AAA
   - Critical Issues Count, Warning Issues Count
   - Top 5 Issues
5. **Content Volume**:
   - Estimated Pages, Content Types, Complexity (low/medium/high/very-high), Details
6. **Technical Debt**:
   - Score (0-100): 0 = kein Debt, 100 = kritischer Debt
   - Factors: Was trägt zu Tech Debt bei?
   - Impact on Migration: Wie beeinflusst das die Migration?
7. **Recommended Improvements**: Liste von Verbesserungen mit:
   - Category: performance/seo/accessibility/content/technical
   - Priority: low/medium/high/critical
   - Title, Description, Estimated Effort (optional)
8. **Overall Quality Score**: Gewichteter Durchschnitt aller Scores

**Scoring Guidelines:**
- Performance: LCP <2.5s = good, <4s = needs-improvement, >4s = poor
- SEO: All checks passed = 90+, 3-4 checks = 70+, 1-2 checks = 50+, 0 checks = <50
- Accessibility: WCAG AAA = 90+, AA = 70+, A = 50+, none = <50
- Overall Quality: weighted average (Performance 30%, SEO 30%, Accessibility 20%, Content 10%, Tech Debt 10%)

**Output Format (JSON):**
{
  "summary": "...",
  "performance": {
    "lcp": 2300,
    "fid": 80,
    "cls": 0.05,
    "fcp": 1200,
    "ttfb": 400,
    "overallScore": 85,
    "assessment": "good"
  },
  "seo": {
    "overallScore": 75,
    "hasMetaTags": true,
    "hasStructuredData": false,
    "hasXMLSitemap": true,
    "hasRobotsTxt": true,
    "mobileOptimized": true,
    "issues": ["Fehlende Structured Data", "..."],
    "opportunities": ["Implementiere Schema.org Markup", "..."]
  },
  "accessibility": {
    "overallScore": 68,
    "wcagLevel": "AA",
    "criticalIssues": 3,
    "warningIssues": 15,
    "topIssues": ["Fehlende Alt-Texte", "..."]
  },
  "contentVolume": {
    "estimatedPages": 250,
    "estimatedContentTypes": 12,
    "complexity": "medium",
    "details": "..."
  },
  "technicalDebt": {
    "score": 45,
    "factors": ["Legacy Code", "..."],
    "impactOnMigration": "..."
  },
  "recommendedImprovements": [
    {
      "category": "performance",
      "priority": "high",
      "title": "Optimize Images",
      "description": "...",
      "estimatedEffort": "2-3 Wochen"
    }
  ],
  "overallQualityScore": 72
}`;

      const systemPrompt = `Du bist ein Senior Web Performance & SEO Specialist bei adesso SE.
Du analysierst Websites und gibst fundierte Empfehlungen für Verbesserungen.

WICHTIG:
- Sei objektiv bei Scores - verwende die Scoring Guidelines
- Performance: Core Web Vitals sind kritisch für UX und SEO
- SEO: Google Rankings sind abhängig von technischem SEO
- Accessibility: WCAG AA ist Pflicht für öffentliche Websites in Deutschland/Schweiz
- Technical Debt beeinflusst Migrations-Komplexität und -Kosten
- Recommended Improvements sollten priorisiert sein nach Business Impact

Wenn keine Metriken vorhanden: Schätze basierend auf indirekten Signalen (z.B. alte Tech = langsam, fehlende Meta Tags = schlechtes SEO).

Antworte mit validem JSON ohne Markdown-Code-Blöcke.`;

      const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

      // Parse and validate response
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const rawResult = JSON.parse(cleanedResponse) as Record<string, unknown>;
      const validatedContent = websiteAnalysisOutputSchema.parse(rawResult);

      // Calculate confidence and metadata
      const confidence = this.calculateConfidence(ragResults);
      const sources = this.extractSources(ragResults);

      const metadata: SectionMetadata = {
        generatedAt: new Date(),
        agentName: 'website-analysis-synthesizer',
        sources,
        confidence,
      };

      // Save to database
      await this.saveSectionData(leadId, validatedContent, metadata);

      return {
        success: true,
        sectionId: this.sectionId,
        content: validatedContent,
        confidence,
        metadata,
      };
    } catch (error) {
      console.error('[WebsiteAnalysisSynthesizer] Error:', error);
      return {
        success: false,
        sectionId: this.sectionId,
        error: error instanceof Error ? error.message : 'Website analysis synthesis failed',
      };
    }
  }
}

// Export singleton instance
export const websiteAnalysisSynthesizer = new WebsiteAnalysisSynthesizer();
