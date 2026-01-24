/**
 * Calc-Sheet Roles Page
 *
 * Shows all project roles from adesso Calculator structure.
 * Displays role cards with FTE allocation and responsibilities.
 */

import { CalcSheetRolesTable } from '@/components/leads/calc-sheet-client';

interface CalcSheetRolesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalcSheetRolesPage({ params }: CalcSheetRolesPageProps) {
  const { id } = await params;

  return <CalcSheetRolesTable leadId={id} />;
}
