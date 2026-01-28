'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export interface DashboardPDFExportProps {
  preQualificationId: string;
  headline?: string;
  disabled?: boolean;
}

/**
 * Dashboard PDF Export Button
 *
 * Triggers browser print dialog with print-optimized styles.
 * The print CSS in globals.css handles the formatting.
 */
export function DashboardPDFExport({
  preQualificationId: _preQualificationId,
  headline: _headline,
  disabled = false,
}: DashboardPDFExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    // Short delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Trigger browser print dialog
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={disabled || isExporting}>
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exportiere...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Als PDF exportieren
        </>
      )}
    </Button>
  );
}
