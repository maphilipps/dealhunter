/**
 * AI-Elements Constants
 *
 * Shared constants and utilities for agent-related components.
 * Uses CSS custom properties defined in globals.css for dark mode support.
 */

import type { QuickScanPhase } from '@/lib/streaming/event-types';

// ============================================================================
// Agent Categories
// ============================================================================

/**
 * Agent category determines the color scheme used for display.
 * Each category maps to CSS variables: --agent-{category}-bg/text/border
 */
export type AgentCategory =
  | 'crawler'
  | 'discovery'
  | 'analysis'
  | 'content'
  | 'feature'
  | 'coordinator'
  | 'research'
  | 'evaluation'
  | 'optimization'
  | 'audit'
  | 'intelligence'
  | 'business'
  | 'reasoning'
  | 'error'
  | 'default';

/**
 * Maps agent names to their display category for consistent coloring.
 */
export const AGENT_CATEGORIES: Record<string, AgentCategory> = {
  // Phase 1: Bootstrap
  'Website Crawler': 'crawler',
  Wappalyzer: 'crawler',
  'Sitemap Parser': 'crawler',

  // Phase 1.2: Multi-Page
  'Link Discovery': 'discovery',
  'Page Sampler': 'discovery',
  'Multi-Page Fetcher': 'discovery',
  'Multi-Page Tech Analyzer': 'discovery',
  'Component Extractor': 'discovery',

  // Phase 1.3: Analysis
  'Tech Stack Analyzer': 'analysis',
  'Enhanced Tech Stack': 'analysis',
  'httpx Tech Detection': 'analysis',

  // Content Analysis
  'Content Analyzer': 'content',
  'Content Classifier': 'content',

  // Feature Detection
  'Feature Detector': 'feature',
  'Migration Analyzer': 'feature',

  // Coordinator
  Coordinator: 'coordinator',
  'Quick Scan': 'coordinator',
  Qualification: 'coordinator',

  // Intelligent Agent Framework
  Researcher: 'research',
  'CMS Researcher': 'research',
  'Competition Researcher': 'research',
  'Decision Maker Research': 'research',

  Evaluator: 'evaluation',

  Optimizer: 'optimization',

  // Phase 4: Enhanced Audits
  Playwright: 'audit',
  'Accessibility Audit': 'audit',
  'Navigation Analyzer': 'audit',
  'Performance Analyzer': 'audit',
  'SEO Audit': 'audit',
  'Legal Compliance': 'audit',

  // Company Intelligence
  'Company Intelligence': 'intelligence',
  Capability: 'intelligence',

  // Business / Quality Analysis
  'Business Analyst': 'business',
  'Deal Quality': 'business',
  'Strategic Fit': 'business',
  Competition: 'business',

  // AI Reasoning / Synthesis
  'AI Reasoning': 'reasoning',

  // Error state
  Error: 'error',
};

/**
 * CSS class strings for each agent category.
 * Uses CSS custom properties for automatic dark mode support.
 */
export const AGENT_COLOR_CLASSES: Record<AgentCategory, string> = {
  crawler:
    'bg-[var(--agent-crawler-bg)] text-[var(--agent-crawler-text)] border-[var(--agent-crawler-border)]',
  discovery:
    'bg-[var(--agent-discovery-bg)] text-[var(--agent-discovery-text)] border-[var(--agent-discovery-border)]',
  analysis:
    'bg-[var(--agent-analysis-bg)] text-[var(--agent-analysis-text)] border-[var(--agent-analysis-border)]',
  content:
    'bg-[var(--agent-content-bg)] text-[var(--agent-content-text)] border-[var(--agent-content-border)]',
  feature:
    'bg-[var(--agent-feature-bg)] text-[var(--agent-feature-text)] border-[var(--agent-feature-border)]',
  coordinator:
    'bg-[var(--agent-coordinator-bg)] text-[var(--agent-coordinator-text)] border-[var(--agent-coordinator-border)]',
  research:
    'bg-[var(--agent-research-bg)] text-[var(--agent-research-text)] border-[var(--agent-research-border)]',
  evaluation:
    'bg-[var(--agent-evaluation-bg)] text-[var(--agent-evaluation-text)] border-[var(--agent-evaluation-border)]',
  optimization:
    'bg-[var(--agent-optimization-bg)] text-[var(--agent-optimization-text)] border-[var(--agent-optimization-border)]',
  audit:
    'bg-[var(--agent-audit-bg)] text-[var(--agent-audit-text)] border-[var(--agent-audit-border)]',
  intelligence:
    'bg-[var(--agent-intelligence-bg)] text-[var(--agent-intelligence-text)] border-[var(--agent-intelligence-border)]',
  business:
    'bg-[var(--agent-business-bg)] text-[var(--agent-business-text)] border-[var(--agent-business-border)]',
  reasoning:
    'bg-[var(--agent-reasoning-bg)] text-[var(--agent-reasoning-text)] border-[var(--agent-reasoning-border)]',
  error:
    'bg-[var(--agent-error-bg)] text-[var(--agent-error-text)] border-[var(--agent-error-border)]',
  default:
    'bg-[var(--agent-default-bg)] text-[var(--agent-default-text)] border-[var(--agent-default-border)]',
};

/**
 * Gets the CSS classes for an agent's display color scheme.
 * Falls back to 'default' category for unknown agents.
 */
export function getAgentColorClasses(agentName: string): string {
  const category = AGENT_CATEGORIES[agentName] || 'default';
  return AGENT_COLOR_CLASSES[category];
}

// ============================================================================
// Phase Colors
// ============================================================================

/**
 * CSS class strings for workflow phases.
 * Uses CSS custom properties for automatic dark mode support.
 */
export const PHASE_COLOR_CLASSES: Record<QuickScanPhase | 'complete', string> = {
  bootstrap:
    'bg-[var(--phase-bootstrap-bg)] text-[var(--phase-bootstrap-text)] border-[var(--phase-bootstrap-border)]',
  multi_page:
    'bg-[var(--phase-multipage-bg)] text-[var(--phase-multipage-text)] border-[var(--phase-multipage-border)]',
  analysis:
    'bg-[var(--phase-analysis-bg)] text-[var(--phase-analysis-text)] border-[var(--phase-analysis-border)]',
  synthesis:
    'bg-[var(--phase-synthesis-bg)] text-[var(--phase-synthesis-text)] border-[var(--phase-synthesis-border)]',
  complete:
    'bg-[var(--phase-complete-bg)] text-[var(--phase-complete-text)] border-[var(--phase-complete-border)]',
};

/**
 * Gets the CSS classes for a workflow phase.
 * @param phase - The phase identifier
 * @param isActive - Whether this is the currently active phase (adds complete styling when not active)
 */
export function getPhaseColorClasses(phase: QuickScanPhase, isActive: boolean): string {
  if (!isActive) {
    return PHASE_COLOR_CLASSES.complete;
  }
  return PHASE_COLOR_CLASSES[phase] || PHASE_COLOR_CLASSES.complete;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Formats a timestamp for agent activity display.
 * Uses German locale for consistency with the rest of the application.
 */
export function formatAgentTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// Confidence Thresholds
// ============================================================================

/** Confidence >= 80% is considered high confidence */
export const CONFIDENCE_HIGH_THRESHOLD = 80;

/** Confidence >= 60% is considered medium confidence */
export const CONFIDENCE_MEDIUM_THRESHOLD = 60;

// ============================================================================
// Timing Constants
// ============================================================================

/** Milliseconds in one second */
export const MS_PER_SECOND = 1000;

/** Delay before auto-closing reasoning panels after streaming completes */
export const AUTO_CLOSE_DELAY_MS = 1500;

/** Minimum number of expected agents for progress calculation */
export const MIN_EXPECTED_AGENTS = 5;

/** Default height for scroll areas in activity views (in pixels) */
export const SCROLL_AREA_HEIGHT_PX = 500;
