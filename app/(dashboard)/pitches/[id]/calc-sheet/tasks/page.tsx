/**
 * Calc-Sheet Tasks Page
 *
 * Shows all project tasks from adesso Calculator structure.
 * Grouped by phase with role assignments and hours.
 */

import { CalcSheetTasksTable } from '@/components/pitches/calc-sheet-client';

interface CalcSheetTasksPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalcSheetTasksPage({ params }: CalcSheetTasksPageProps) {
  const { id } = await params;

  return <CalcSheetTasksTable leadId={id} />;
}
