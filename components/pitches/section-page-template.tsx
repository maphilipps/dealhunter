'use client';

import { SectionPageTemplate as GenericSectionPageTemplate } from '@/components/section-page-template';

export interface SectionPageTemplateProps {
  leadId: string;
  sectionId: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Pitches Section Page Template
 *
 * Thin wrapper around the generic SectionPageTemplate that provides:
 * - API path: /api/pitches/{leadId}
 * - Visualization generation enabled
 * - Pitch-specific no-data messaging
 */
export function SectionPageTemplate({
  leadId,
  sectionId,
  title,
  description,
  children,
}: SectionPageTemplateProps) {
  return (
    <GenericSectionPageTemplate
      apiBasePath={`/api/pitches/${leadId}`}
      sectionId={sectionId}
      title={title}
      description={description}
      enableVisualizationGeneration
      noDataTitle="Keine Daten verfügbar"
      noDataDescription="Für diese Sektion sind noch keine Analyse-Ergebnisse vorhanden. Starte einen Qualification Scan oder Pitch Scan, um Daten zu generieren."
    >
      {children}
    </GenericSectionPageTemplate>
  );
}
