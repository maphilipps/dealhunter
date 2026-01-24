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
  RAGQueryOptions,
  SectionMetadata,
  SectionSynthesizerInput,
  SectionSynthesizerOutput,
} from './base';

// Sprint 1.3: Initial Synthesizers
import { OverviewSynthesizer, overviewSynthesizer } from './overview-synthesizer';
export { OverviewSynthesizer, overviewSynthesizer };
export type { OverviewOutput } from './overview-synthesizer';

import { TechnologySynthesizer, technologySynthesizer } from './technology-synthesizer';
export { TechnologySynthesizer, technologySynthesizer };
export type { TechnologyOutput } from './technology-synthesizer';

import { WebsiteAnalysisSynthesizer, websiteAnalysisSynthesizer } from './website-analysis-synthesizer';
export { WebsiteAnalysisSynthesizer, websiteAnalysisSynthesizer };
export type { WebsiteAnalysisOutput } from './website-analysis-synthesizer';

// Sprint 2.2: Additional Synthesizers
import {
  CMSArchitectureSynthesizer,
  cmsArchitectureSynthesizer,
} from './cms-architecture-synthesizer';
export { CMSArchitectureSynthesizer, cmsArchitectureSynthesizer };

import { CMSComparisonSynthesizer, cmsComparisonSynthesizer } from './cms-comparison-synthesizer';
export { CMSComparisonSynthesizer, cmsComparisonSynthesizer };

import { CostsSynthesizer, costsSynthesizer } from './costs-synthesizer';
export { CostsSynthesizer, costsSynthesizer };

import { DecisionSynthesizer, decisionSynthesizer } from './decision-synthesizer';
export { DecisionSynthesizer, decisionSynthesizer };

import { HostingSynthesizer, hostingSynthesizer } from './hosting-synthesizer';
export { HostingSynthesizer, hostingSynthesizer };

import { IntegrationsSynthesizer, integrationsSynthesizer } from './integrations-synthesizer';
export { IntegrationsSynthesizer, integrationsSynthesizer };

import { MigrationSynthesizer, migrationSynthesizer } from './migration-synthesizer';
export { MigrationSynthesizer, migrationSynthesizer };

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