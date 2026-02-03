import { tool } from 'ai';
import { z } from 'zod';

import { runFullAudit, type FullAuditResult } from '../audit';
import { fetchHtml, type FetchedPage } from '../audit/fetch-html';
import { detectTechStack, type TechStackResult, techStackSchema } from '../audit/tech-detector';
import {
  auditPerformance,
  type PerformanceResult,
  performanceSchema,
} from '../audit/performance-auditor';
import {
  auditAccessibility,
  type AccessibilityResult,
  accessibilitySchema,
} from '../audit/a11y-auditor';
import { analyzeComponents, componentAnalysisSchema } from '../audit/component-analyzer';
import { markAgentComplete, markAgentFailed } from '../checkpoints';
import { AGENT_NAMES } from '../constants';
import type { ComponentAnalysis } from '../types';

// Re-export types for consumers
export type { FullAuditResult } from '../audit';
export type { FetchedPage } from '../audit/fetch-html';
export type { TechStackResult } from '../audit/tech-detector';
export type { PerformanceResult } from '../audit/performance-auditor';
export type { AccessibilityResult } from '../audit/a11y-auditor';
export type { ComponentAnalysis } from '../types';

// ============================================================================
// Primitive Tools - Stateless, composable capabilities
// ============================================================================

/**
 * Primitive: Fetch HTML from a URL.
 *
 * Returns raw HTML, headers, and status code.
 * The agent decides what to do with the result.
 */
export function createFetchHtmlTool() {
  return tool({
    description:
      'Lädt den HTML-Inhalt einer Website herunter. ' +
      'Gibt HTML, HTTP-Header und Statuscode zurück. ' +
      'Nutze dies als ersten Schritt vor anderen Audit-Tools.',
    inputSchema: z.object({
      url: z.string().url().describe('Die URL der Website'),
    }),
    execute: async ({ url }): Promise<FetchedPage> => {
      return fetchHtml(url);
    },
  });
}

/**
 * Primitive: Detect tech stack from HTML and headers.
 *
 * Requires pre-fetched HTML. Returns tech stack analysis.
 */
export function createDetectTechStackTool() {
  return tool({
    description:
      'Erkennt den Tech-Stack einer Website (CMS, Framework, Libraries, Analytics, CDN, Hosting). ' +
      'Benötigt das Ergebnis von fetchHtml.',
    inputSchema: z.object({
      url: z.string().url().describe('Die URL der Website'),
      html: z.string().describe('Der HTML-Inhalt der Seite'),
      headers: z.record(z.string(), z.string()).describe('Die HTTP-Response-Header'),
    }),
    execute: async ({ url, html, headers }): Promise<TechStackResult> => {
      return detectTechStack(url, { html, headers });
    },
  });
}

/**
 * Primitive: Audit performance metrics.
 *
 * Analyzes HTML and optionally fetches PageSpeed data.
 * Returns Core Web Vitals estimates and performance findings.
 */
export function createAuditPerformanceTool() {
  return tool({
    description:
      'Analysiert die Performance einer Website (Core Web Vitals, Ressourcen-Optimierung). ' +
      'Nutzt PageSpeed Insights API und HTML-Analyse. Benötigt das Ergebnis von fetchHtml.',
    inputSchema: z.object({
      url: z.string().url().describe('Die URL der Website'),
      html: z.string().describe('Der HTML-Inhalt der Seite'),
    }),
    execute: async ({ url, html }): Promise<PerformanceResult> => {
      return auditPerformance(url, { html });
    },
  });
}

/**
 * Primitive: Audit accessibility (WCAG compliance).
 *
 * Performs static a11y checks on HTML.
 * Returns WCAG level estimate and violations.
 */
export function createAuditAccessibilityTool() {
  return tool({
    description:
      'Prüft die Barrierefreiheit einer Website nach WCAG 2.1 Richtlinien. ' +
      'Statische Analyse von Alt-Texten, Labels, Heading-Hierarchie, ARIA, etc. ' +
      'Benötigt das Ergebnis von fetchHtml.',
    inputSchema: z.object({
      url: z.string().url().describe('Die URL der Website'),
      html: z.string().describe('Der HTML-Inhalt der Seite'),
    }),
    execute: async ({ url, html }): Promise<AccessibilityResult> => {
      return auditAccessibility(url, { html });
    },
  });
}

/**
 * Primitive: Analyze UI components and content structure.
 *
 * Identifies components, content types, forms, and interactions.
 * Useful for migration complexity estimation.
 */
export function createAnalyzeComponentsTool() {
  return tool({
    description:
      'Analysiert UI-Komponenten, Content-Typen, Formulare und interaktive Elemente. ' +
      'Bewertet die Komplexität für eine CMS-Migration. ' +
      'Benötigt das Ergebnis von fetchHtml.',
    inputSchema: z.object({
      url: z.string().url().describe('Die URL der Website'),
      html: z.string().describe('Der HTML-Inhalt der Seite'),
    }),
    execute: async ({ url, html }): Promise<ComponentAnalysis> => {
      return analyzeComponents(url, { html });
    },
  });
}

// ============================================================================
// Convenience Wrapper - Runs all primitives and persists to DB
// ============================================================================

/**
 * Convenience: Run full audit pipeline.
 *
 * This wraps all primitives and persists results to the database.
 * Use this when you want the complete audit in one call.
 * Use the primitives when you need more control over the flow.
 */
export function createRunAuditTool(params: { runId: string; pitchId: string; websiteUrl: string }) {
  return tool({
    description:
      'Führe ein vollständiges Website-Audit durch (Tech-Stack, Performance, Accessibility, Komponenten-Analyse). ' +
      'Speichert Ergebnisse in der Datenbank. ' +
      'Nutze die einzelnen Audit-Tools (fetchHtml, detectTechStack, etc.) für mehr Kontrolle.',
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
        console.error(`[Audit Tool] Failed for run ${params.runId}:`, error);
        await markAgentFailed(params.runId, AGENT_NAMES.AUDIT_WEBSITE);
        return {
          auditId: 'failed',
          techStack: null,
          performance: null,
          accessibility: null,
          componentLibrary: null,
          performanceScore: 0,
          accessibilityScore: 0,
          complexityScore: 0,
          migrationComplexity: 'medium' as const,
          failedModules: ['full-audit'],
        };
      }
    },
  });
}

// ============================================================================
// Tool Collection - All audit tools for easy registration
// ============================================================================

/**
 * Returns all audit primitive tools.
 * Use this to register all primitives with the orchestrator.
 */
export function createAuditPrimitiveTools() {
  return {
    fetchHtml: createFetchHtmlTool(),
    detectTechStack: createDetectTechStackTool(),
    auditPerformance: createAuditPerformanceTool(),
    auditAccessibility: createAuditAccessibilityTool(),
    analyzeComponents: createAnalyzeComponentsTool(),
  };
}

/**
 * Returns all audit tools including the convenience wrapper.
 * The wrapper requires run context for DB persistence.
 */
export function createAuditTools(params: { runId: string; pitchId: string; websiteUrl: string }) {
  return {
    ...createAuditPrimitiveTools(),
    runAudit: createRunAuditTool(params),
  };
}

// Legacy export for backward compatibility
export const createAuditTool = createRunAuditTool;
