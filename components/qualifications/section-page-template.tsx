'use client';

import { SectionPageTemplate } from '@/components/section-page-template';
import { QualificationScanStatusBanner } from '@/components/qualifications/qualification-scan-status-banner';

export interface PreQualificationSectionPageTemplateProps {
  preQualificationId: string;
  sectionId: string;
  title: string;
  description?: string;
}

/**
 * Qualification Section Page Template
 *
 * Thin wrapper around the generic SectionPageTemplate that provides:
 * - API path: /api/qualifications/{preQualificationId}
 * - QualificationScanStatusBanner at the top
 * - No visualization generation (analyses are created automatically)
 */
export function PreQualificationSectionPageTemplate({
  preQualificationId,
  sectionId,
  title,
  description,
}: PreQualificationSectionPageTemplateProps) {
  return (
    <SectionPageTemplate
      apiBasePath={`/api/qualifications/${preQualificationId}`}
      sectionId={sectionId}
      title={title}
      description={description}
      banner={<QualificationScanStatusBanner compact showWhenComplete={false} />}
      noDataTitle="Analyse wird automatisch erstellt"
      noDataDescription="Die Analyse startet automatisch sobald Daten verfügbar sind."
    />
  );
}
