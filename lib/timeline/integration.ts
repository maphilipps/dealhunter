/**
 * Timeline Agent Integration Helpers
 *
 * Functions to integrate Timeline Agent with Qualification Scan workflow
 */

import { generateTimeline, type TimelineAgentInput } from './agent';
import type { ProjectTimeline } from './schema';

/**
 * Generate Timeline from Qualification Scan Results
 *
 * Converts Qualification Scan data into Timeline Agent input and generates timeline estimate
 */
export async function generateTimelineFromQualificationScan(params: {
  projectName: string;
  projectDescription?: string;
  websiteUrl: string;
  extractedRequirements?: any;
  qualificationScanResult: {
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
    qualificationScanResult,
  } = params;

  // Build Timeline Agent input
  const timelineInput: TimelineAgentInput = {
    projectName,
    projectDescription: projectDescription || extractedRequirements?.projectDescription || '',
    websiteUrl,
    targetDeadline: extractedRequirements?.targetDeadline,
    budget: extractedRequirements?.budget?.max || extractedRequirements?.budget,

    // From Qualification Scan
    estimatedPageCount: qualificationScanResult.contentVolume?.estimatedPages,
    contentTypes: qualificationScanResult.contentVolume?.estimatedContentTypes,
    detectedFeatures: qualificationScanResult.features?.detectedFeatures,
    detectedIntegrations: qualificationScanResult.features?.integrations,
    techStack: qualificationScanResult.techStack?.technologies?.map(t => t.name),
    cms: qualificationScanResult.techStack?.cms,

    // From Qualification
    rfpTimeline: extractedRequirements?.timeline,
    specialRequirements: extractedRequirements?.keyRequirements,
  };

  // Generate timeline
  const timeline = await generateTimeline(timelineInput);

  return timeline;
}

/** @deprecated Use generateTimelineFromQualificationScan */
export const generateTimelineFromLeadScan = generateTimelineFromQualificationScan;

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
