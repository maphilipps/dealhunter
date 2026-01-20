/**
 * Timeline Agent Integration Helpers
 *
 * Functions to integrate Timeline Agent with Quick Scan workflow
 */

import { generateTimeline, type TimelineAgentInput } from './agent';
import type { ProjectTimeline } from './schema';

/**
 * Generate Timeline from Quick Scan Results
 *
 * Converts Quick Scan data into Timeline Agent input and generates timeline estimate
 */
export async function generateTimelineFromQuickScan(params: {
  projectName: string;
  projectDescription?: string;
  websiteUrl: string;
  extractedRequirements?: any;
  quickScanResult: {
    techStack?: {
      cms?: string;
      technologies?: Array<{ name: string; category: string }>;
    };
    contentVolume?: {
      estimatedPages?: number;
      estimatedContentTypes?: number;
    };
    features?: {
      detectedFeatures?: string[];
      integrations?: string[];
    };
  };
}): Promise<ProjectTimeline> {
  const {
    projectName,
    projectDescription,
    websiteUrl,
    extractedRequirements,
    quickScanResult,
  } = params;

  // Build Timeline Agent input
  const timelineInput: TimelineAgentInput = {
    projectName,
    projectDescription: projectDescription || extractedRequirements?.projectDescription || '',
    websiteUrl,
    targetDeadline: extractedRequirements?.targetDeadline,
    budget: extractedRequirements?.budget?.max || extractedRequirements?.budget,

    // From Quick Scan
    estimatedPageCount: quickScanResult.contentVolume?.estimatedPages,
    contentTypes: quickScanResult.contentVolume?.estimatedContentTypes,
    detectedFeatures: quickScanResult.features?.detectedFeatures,
    detectedIntegrations: quickScanResult.features?.integrations,
    techStack: quickScanResult.techStack?.technologies?.map(t => t.name),
    cms: quickScanResult.techStack?.cms,

    // From RFP
    rfpTimeline: extractedRequirements?.timeline,
    specialRequirements: extractedRequirements?.keyRequirements,
  };

  // Generate timeline
  const timeline = await generateTimeline(timelineInput);

  return timeline;
}

/**
 * Helper to parse timeline from database
 */
export function parseTimelineFromDb(timelineJson: string | null): ProjectTimeline | null {
  if (!timelineJson) return null;

  try {
    return JSON.parse(timelineJson) as ProjectTimeline;
  } catch {
    return null;
  }
}
