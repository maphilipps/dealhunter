/**
 * Browser Automation Module
 * Wrapper around agent-browser CLI for AI-optimized browser automation
 */

// Core browser functions
export {
  openPage,
  closeBrowser,
  goBack,
  reload,
  getHtml,
  getPageContent,
  screenshot,
  getSnapshot,
  click,
  type,
  fill,
  scroll,
  evaluate,
  evaluateFunction,
  setViewport,
  getNetworkRequests,
  createSession,
  wait,
  fetchPage,
  fetchCleanPage,
} from './agent-browser';

// Cookie banner handling
export { dismissCookieBanner, hasCookieBanner } from './cookie-banner';

// Accessibility auditing
export { runAccessibilityAudit, quickAccessibilityCheck } from './accessibility';

// Performance metrics
export {
  getCoreWebVitals,
  getLoadTiming,
  getResourceCounts,
  getPerformanceMetrics,
  quickPerformanceCheck,
} from './performance';

// Types
export type {
  BrowserSession,
  SnapshotOptions,
  ScreenshotOptions,
  ViewportOptions,
  SnapshotElement,
  SnapshotResult,
  NetworkRequest,
  NetworkResult,
  PageContent,
  CookieBannerResult,
  AccessibilityViolation,
  AccessibilityResult,
  CoreWebVitals,
  WebVitalRating,
  PerformanceResult,
  NavItem,
  NavigationStructure,
  BrowserAuditResult,
} from './types';
