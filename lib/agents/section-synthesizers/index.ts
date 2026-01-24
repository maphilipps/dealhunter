/**
 * Section Synthesizers - Central Export
 *
 * All section synthesizers for lead detail pages.
 * Each synthesizer generates structured content for a specific section.
 */

// Base class and types
import { SectionSynthesizerBase } from './base';
export { SectionSynthesizerBase };
export type {
  SectionSynthesizerInput,
  SectionSynthesizerOutput,
  SectionMetadata,
  RAGQueryOptions,
} from './base';

// Sprint 1.3: Initial Synthesizers
import { overviewSynthesizer, OverviewSynthesizer } from './overview-synthesizer';
export { overviewSynthesizer, OverviewSynthesizer };
export type { OverviewOutput } from './overview-synthesizer';

import { technologySynthesizer, TechnologySynthesizer } from './technology-synthesizer';
export { technologySynthesizer, TechnologySynthesizer };
export type { TechnologyOutput } from './technology-synthesizer';

import {
  websiteAnalysisSynthesizer,
  WebsiteAnalysisSynthesizer,
} from './website-analysis-synthesizer';
export { websiteAnalysisSynthesizer, WebsiteAnalysisSynthesizer };
export type { WebsiteAnalysisOutput } from './website-analysis-synthesizer';

// Sprint 2.2: Additional Synthesizers
import {
  cmsArchitectureSynthesizer,
  CMSArchitectureSynthesizer,
} from './cms-architecture-synthesizer';
export { cmsArchitectureSynthesizer, CMSArchitectureSynthesizer };

import { cmsComparisonSynthesizer, CMSComparisonSynthesizer } from './cms-comparison-synthesizer';
export { cmsComparisonSynthesizer, CMSComparisonSynthesizer };

import { hostingSynthesizer, HostingSynthesizer } from './hosting-synthesizer';
export { hostingSynthesizer, HostingSynthesizer };

import { integrationsSynthesizer, IntegrationsSynthesizer } from './integrations-synthesizer';
export { integrationsSynthesizer, IntegrationsSynthesizer };

import { migrationSynthesizer, MigrationSynthesizer } from './migration-synthesizer';
export { migrationSynthesizer, MigrationSynthesizer };

import { costsSynthesizer, CostsSynthesizer } from './costs-synthesizer';
export { costsSynthesizer, CostsSynthesizer };

import { decisionSynthesizer, DecisionSynthesizer } from './decision-synthesizer';
export { decisionSynthesizer, DecisionSynthesizer };

// Registry for easy lookup
export const SYNTHESIZER_REGISTRY = {
  overview: overviewSynthesizer,
  technology: technologySynthesizer,
  'website-analysis': websiteAnalysisSynthesizer,
  'cms-architecture': cmsArchitectureSynthesizer,
  'cms-comparison': cmsComparisonSynthesizer,
  hosting: hostingSynthesizer,
  integrations: integrationsSynthesizer,
  migration: migrationSynthesizer,
  costs: costsSynthesizer,
  decision: decisionSynthesizer,
};

/**
 * Get a synthesizer by section ID
 * @param sectionId - Section ID (e.g., 'overview', 'technology')
 * @returns Section synthesizer instance or undefined
 */
export function getSynthesizer(sectionId: string): SectionSynthesizerBase | undefined {
  return SYNTHESIZER_REGISTRY[sectionId as keyof typeof SYNTHESIZER_REGISTRY];
}

/**
 * Get all registered section IDs
 * @returns Array of section IDs
 */
export function getRegisteredSectionIds(): string[] {
  return Object.keys(SYNTHESIZER_REGISTRY);
}
