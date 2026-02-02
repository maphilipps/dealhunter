/**
 * Calc-Sheet Features Page
 *
 * Shows all project features from adesso Calculator structure.
 * Grouped by type (Content Type, Paragraph, View, Module).
 * Shows complexity badges and hours per feature.
 */

import { CalcSheetFeaturesTable } from '@/components/pitches/calc-sheet-client';

interface CalcSheetFeaturesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalcSheetFeaturesPage({ params }: CalcSheetFeaturesPageProps) {
  const { id } = await params;

  return <CalcSheetFeaturesTable leadId={id} />;
}
