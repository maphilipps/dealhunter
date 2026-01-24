/**
 * Calc-Sheet Risks Page
 *
 * Shows all project risks from adesso Calculator structure.
 * Displays risk cards sorted by risk score with mitigation strategies.
 */

import { CalcSheetRisksTable } from '@/components/qualifications/calc-sheet-client';

interface CalcSheetRisksPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalcSheetRisksPage({ params }: CalcSheetRisksPageProps) {
  const { id } = await params;

  return <CalcSheetRisksTable leadId={id} />;
}
