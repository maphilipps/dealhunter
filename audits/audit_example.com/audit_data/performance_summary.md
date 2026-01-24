# Performance Audit: www.example.com

**Date:** 1/22/2026
**Score:** 85/100 (Grade: B+)

## Executive Summary
The website demonstrates good baseline performance but has significant optimization potential in media handling.

## Core Web Vitals
- **LCP:** 364ms (Target: < 2500ms) ✅
- **CLS:** 0 (Target: < 0.1) ✅
- **TTFB:** 53ms ✅

## Top Bottlenecks
- **Large video file (6MB)** (HIGH)
- **Missing WebP images** (MEDIUM)
- **Render-blocking fonts** (MEDIUM)

## Recommendations
1. Implement Lazy Loading for videos
2. Convert images to WebP
3. Use font-display: swap
