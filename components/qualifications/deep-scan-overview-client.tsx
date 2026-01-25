/**
 * Deep Scan Overview Client Component
 *
 * Combines the status banner and selective re-scan dialog for the qualification overview page.
 * Uses the DeepScan context for state management.
 */

'use client';

import { useState } from 'react';

import { DeepScanStatusBanner } from './deep-scan-status-banner';
import { SelectiveRescanDialog } from './selective-rescan-dialog';

export function DeepScanOverviewClient() {
  const [showRescanDialog, setShowRescanDialog] = useState(false);

  return (
    <>
      {/* Status Banner */}
      <DeepScanStatusBanner
        showWhenComplete={true}
        dismissible={true}
        onSelectiveRescan={() => setShowRescanDialog(true)}
      />

      {/* Selective Re-Scan Dialog */}
      <SelectiveRescanDialog open={showRescanDialog} onOpenChange={setShowRescanDialog} />
    </>
  );
}

export default DeepScanOverviewClient;
