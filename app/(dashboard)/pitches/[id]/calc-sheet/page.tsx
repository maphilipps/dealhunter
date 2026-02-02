/**
 * Calc-Sheet Overview Page
 *
 * Main page showing project summary from adesso Calculator 2.01 structure.
 * Displays: Project info, total features, hours, FTE, estimated budget.
 */

import { CalcSheetOverview } from '@/components/pitches/calc-sheet-client';

interface CalcSheetPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalcSheetPage({ params }: CalcSheetPageProps) {
  const { id } = await params;

  return <CalcSheetOverview leadId={id} />;
}
