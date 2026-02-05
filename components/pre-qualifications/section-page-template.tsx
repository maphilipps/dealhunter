'use client';

import { SectionPageTemplate } from '@/components/section-page-template';
import { QuickScanStatusBanner } from '@/components/pre-qualifications/quick-scan-status-banner';

export interface PreQualificationSectionPageTemplateProps {
  preQualificationId: string;
  sectionId: string;
  title: string;
  description?: string;
}

/**
 * Pre-Qualification Section Page Template
 *
 * Thin wrapper around the generic SectionPageTemplate that provides:
 * - API path: /api/pre-qualifications/{preQualificationId}
 * - QuickScanStatusBanner at the top
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
      apiBasePath={`/api/pre-qualifications/${preQualificationId}`}
      sectionId={sectionId}
      title={title}
      description={description}
      banner={<QuickScanStatusBanner compact showWhenComplete={false} />}
      noDataTitle="Analyse wird automatisch erstellt"
      noDataDescription="Die Analyse startet automatisch sobald Daten verfügbar sind."
    />
  );
}
