/**
 * TypeScript interfaces for agent-browser wrapper
 */

// ========================================
// Core Types
// ========================================

export interface BrowserSession {
  session?: string;
  headed?: boolean;
}

export interface SnapshotOptions extends BrowserSession {
  interactive?: boolean;
  compact?: boolean;
}

export interface ScreenshotOptions extends BrowserSession {
  fullPage?: boolean;
  filePath?: string;
}

export interface ViewportOptions extends BrowserSession {
  width: number;
  height: number;
}

// ========================================
// Snapshot Types (Accessibility Tree)
// ========================================

export interface SnapshotElement {
  ref: string; // e.g., "@e1", "@e5"
  role: string;
  name?: string;
  description?: string;
  value?: string;
  children?: SnapshotElement[];
}

export interface SnapshotResult {
  url: string;
  title: string;
  elements: SnapshotElement[];
  interactiveElements?: SnapshotElement[];
}

// ========================================
// Network Types
// ========================================

export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  contentType?: string;
  resourceType?: string;
  size?: number;
}

export interface NetworkResult {
  requests: NetworkRequest[];
}

// ========================================
// Page Content Types
// ========================================

export interface PageContent {
  url: string;
  title: string;
  html: string;
}

// ========================================
// Cookie Banner Types
// ========================================

export interface CookieBannerResult {
  dismissed: boolean;
  method?: string; // Which button/ref was used
}

// ========================================
// Accessibility Types (Lighthouse)
// ========================================

export interface AccessibilityViolation {
  id: string;
  title: string;
  description: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  score?: number;
  helpUrl?: string;
}

export interface AccessibilityResult {
  score: number; // 0-100
  level: 'A' | 'AA' | 'AAA' | 'fail';
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
}

// ========================================
// Performance Types (Core Web Vitals)
// ========================================

export interface CoreWebVitals {
  lcp?: number; // Largest Contentful Paint (ms)
  fcp?: number; // First Contentful Paint (ms)
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte (ms)
  inp?: number; // Interaction to Next Paint (ms)
  fid?: number; // First Input Delay (ms, deprecated)
}

export interface WebVitalRating {
  metric: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface PerformanceResult {
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  vitals: CoreWebVitals;
  ratings: {
    lcp: 'good' | 'needs-improvement' | 'poor' | null;
    cls: 'good' | 'needs-improvement' | 'poor' | null;
    fcp: 'good' | 'needs-improvement' | 'poor' | null;
    ttfb: 'good' | 'needs-improvement' | 'poor' | null;
    inp: 'good' | 'needs-improvement' | 'poor' | null;
  };
  resourceCount: {
    scripts: number;
    stylesheets: number;
    images: number;
    fonts: number;
    total: number;
  };
  totalSize: number;
}

// ========================================
// Navigation Types
// ========================================

export interface NavItem {
  label: string;
  url?: string;
  children?: NavItem[];
}

export interface NavigationStructure {
  mainNav: NavItem[];
  footerNav: NavItem[];
  hasSearch: boolean;
  hasBreadcrumbs: boolean;
  hasMegaMenu: boolean;
  stickyHeader: boolean;
  mobileMenu: boolean;
}

// ========================================
// Combined Audit Types
// ========================================

export interface BrowserAuditResult {
  screenshots: {
    desktop?: string;
    mobile?: string;
    keyPages: Array<{ url: string; title: string; screenshot: string }>;
  };
  accessibility: AccessibilityResult;
  performance: PerformanceResult;
  navigation: NavigationStructure;
}
