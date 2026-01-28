'use client';

import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Dashboard PDF Export Button
 *
 * Triggers browser print dialog with print-optimized styles.
 * The print CSS in globals.css handles the formatting.
 */
export function DashboardPDFExport({ disabled = false }: { disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} disabled={disabled}>
      <Download className="mr-2 h-4 w-4" />
      Als PDF exportieren
    </Button>
  );
}
