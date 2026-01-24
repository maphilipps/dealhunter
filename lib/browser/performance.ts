/**
 * Performance Metrics via agent-browser evaluate
 * Measures Core Web Vitals and page load performance
 */

import type { BrowserSession, PerformanceResult, CoreWebVitals } from './types';
import { evaluate, getNetworkRequests } from './agent-browser';

// ========================================
// Web Vitals Thresholds (Google's recommendations)
// ========================================

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 }, // milliseconds
  cls: { good: 0.1, poor: 0.25 }, // dimensionless
  fcp: { good: 1800, poor: 3000 }, // milliseconds
  ttfb: { good: 800, poor: 1800 }, // milliseconds
  inp: { good: 200, poor: 500 }, // milliseconds
  fid: { good: 100, poor: 300 }, // milliseconds (deprecated)
};

/**
 * Rate a metric value against thresholds
 */
function rateMetric(
  metric: keyof typeof THRESHOLDS,
  value: number | undefined
): 'good' | 'needs-improvement' | 'poor' | null {
  if (value === undefined || value === null) return null;

  const threshold = THRESHOLDS[metric];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// ========================================
// Performance Measurement
// ========================================

/**
 * Get Core Web Vitals from browser Performance API
 */
export async function getCoreWebVitals(options: BrowserSession = {}): Promise<CoreWebVitals> {
  const result = await evaluate<CoreWebVitals>(
    `
    const navEntries = performance.getEntriesByType('navigation');
    const navEntry = navEntries[0];
    const paintEntries = performance.getEntriesByType('paint');

    // First Contentful Paint
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
    const fcp = fcpEntry ? fcpEntry.startTime : undefined;

    // Largest Contentful Paint
    let lcp = undefined;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }

    // Cumulative Layout Shift
    let cls = 0;
    const layoutShiftEntries = performance.getEntriesByType('layout-shift');
    for (const entry of layoutShiftEntries) {
      if (!entry.hadRecentInput) {
        cls += entry.value || 0;
      }
    }

    // Time to First Byte
    const ttfb = navEntry ? navEntry.responseStart - navEntry.requestStart : undefined;

    // Interaction to Next Paint (simplified - INP requires event tracking)
    let inp = undefined;
    const eventEntries = performance.getEntriesByType('event');
    if (eventEntries.length > 0) {
      const durations = eventEntries.map(e => e.duration || 0);
      inp = Math.max(...durations);
    }

    return {
      lcp,
      fcp,
      cls: cls > 0 ? cls : undefined,
      ttfb,
      inp: inp || undefined
    };
  `,
    options
  );

  return result || {};
}

/**
 * Get page load timing metrics
 */
export async function getLoadTiming(options: BrowserSession = {}): Promise<{
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
}> {
  const result = await evaluate<{
    loadTime: number;
    domContentLoaded: number;
    firstPaint?: number;
  }>(
    `
    const navEntries = performance.getEntriesByType('navigation');
    const navEntry = navEntries[0];
    const paintEntries = performance.getEntriesByType('paint');

    const firstPaintEntry = paintEntries.find(e => e.name === 'first-paint');

    return {
      loadTime: navEntry ? navEntry.loadEventEnd - navEntry.startTime : 0,
      domContentLoaded: navEntry ? navEntry.domContentLoadedEventEnd - navEntry.startTime : 0,
      firstPaint: firstPaintEntry ? firstPaintEntry.startTime : undefined
    };
  `,
    options
  );

  return result || { loadTime: 0, domContentLoaded: 0 };
}

/**
 * Count resources by type from network requests
 */
export async function getResourceCounts(options: BrowserSession = {}): Promise<{
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
  total: number;
  totalSize: number;
}> {
  const network = await getNetworkRequests(options);

  const counts = {
    scripts: 0,
    stylesheets: 0,
    images: 0,
    fonts: 0,
    total: 0,
    totalSize: 0,
  };

  for (const request of network.requests) {
    counts.total++;
    counts.totalSize += request.size || 0;

    const contentType = (request.contentType || '').toLowerCase();
    const resourceType = (request.resourceType || '').toLowerCase();

    if (contentType.includes('javascript') || resourceType === 'script') {
      counts.scripts++;
    } else if (contentType.includes('css') || resourceType === 'stylesheet') {
      counts.stylesheets++;
    } else if (contentType.includes('image') || resourceType === 'image') {
      counts.images++;
    } else if (contentType.includes('font') || resourceType === 'font') {
      counts.fonts++;
    }
  }

  return counts;
}

/**
 * Get comprehensive performance metrics
 */
export async function getPerformanceMetrics(
  options: BrowserSession = {}
): Promise<PerformanceResult> {
  // Get all metrics in parallel
  const [vitals, timing, resources] = await Promise.all([
    getCoreWebVitals(options),
    getLoadTiming(options),
    getResourceCounts(options),
  ]);

  return {
    loadTime: timing.loadTime,
    domContentLoaded: timing.domContentLoaded,
    firstPaint: timing.firstPaint,
    vitals,
    ratings: {
      lcp: rateMetric('lcp', vitals.lcp),
      cls: rateMetric('cls', vitals.cls),
      fcp: rateMetric('fcp', vitals.fcp),
      ttfb: rateMetric('ttfb', vitals.ttfb),
      inp: rateMetric('inp', vitals.inp),
    },
    resourceCount: {
      scripts: resources.scripts,
      stylesheets: resources.stylesheets,
      images: resources.images,
      fonts: resources.fonts,
      total: resources.total,
    },
    totalSize: resources.totalSize,
  };
}

/**
 * Quick performance check with pass/fail
 */
export async function quickPerformanceCheck(options: BrowserSession = {}): Promise<{
  overall: 'good' | 'needs-improvement' | 'poor';
  details: string[];
}> {
  const metrics = await getPerformanceMetrics(options);
  const details: string[] = [];

  // Check each vital
  if (metrics.ratings.lcp === 'poor') {
    details.push(`LCP: ${metrics.vitals.lcp?.toFixed(0)}ms (poor, should be <2500ms)`);
  } else if (metrics.ratings.lcp === 'needs-improvement') {
    details.push(`LCP: ${metrics.vitals.lcp?.toFixed(0)}ms (needs improvement)`);
  }

  if (metrics.ratings.cls === 'poor') {
    details.push(`CLS: ${metrics.vitals.cls?.toFixed(3)} (poor, should be <0.1)`);
  } else if (metrics.ratings.cls === 'needs-improvement') {
    details.push(`CLS: ${metrics.vitals.cls?.toFixed(3)} (needs improvement)`);
  }

  if (metrics.ratings.fcp === 'poor') {
    details.push(`FCP: ${metrics.vitals.fcp?.toFixed(0)}ms (poor, should be <1800ms)`);
  } else if (metrics.ratings.fcp === 'needs-improvement') {
    details.push(`FCP: ${metrics.vitals.fcp?.toFixed(0)}ms (needs improvement)`);
  }

  if (metrics.ratings.ttfb === 'poor') {
    details.push(`TTFB: ${metrics.vitals.ttfb?.toFixed(0)}ms (poor, should be <800ms)`);
  } else if (metrics.ratings.ttfb === 'needs-improvement') {
    details.push(`TTFB: ${metrics.vitals.ttfb?.toFixed(0)}ms (needs improvement)`);
  }

  // Determine overall rating
  const poorCount = Object.values(metrics.ratings).filter(r => r === 'poor').length;
  const needsImprovementCount = Object.values(metrics.ratings).filter(
    r => r === 'needs-improvement'
  ).length;

  let overall: 'good' | 'needs-improvement' | 'poor' = 'good';
  if (poorCount > 0) {
    overall = 'poor';
  } else if (needsImprovementCount > 1) {
    overall = 'needs-improvement';
  }

  if (details.length === 0) {
    details.push('All Core Web Vitals are good');
  }

  return { overall, details };
}
