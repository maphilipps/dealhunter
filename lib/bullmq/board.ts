import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import express from 'express';

import { getDeepScanQueue, getPreQualProcessingQueue, getQuickScanQueue } from './queues';

/**
 * Bull Board Dashboard - Standalone Server
 *
 * Run separately from Next.js:
 *   npx tsx lib/bullmq/board.ts
 *
 * Or use npm script:
 *   npm run bull-board
 *
 * Dashboard available at: http://localhost:3002
 */

const PORT = process.env.BULL_BOARD_PORT || 3002;

function startBullBoard() {
  const app = express();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/');

  createBullBoard({
    queues: [
      new BullMQAdapter(getDeepScanQueue()),
      new BullMQAdapter(getPreQualProcessingQueue()),
      new BullMQAdapter(getQuickScanQueue()),
    ],
    serverAdapter,
  });

  app.use('/', serverAdapter.getRouter());

  app.listen(PORT, () => {
    console.log(`[Bull Board] Dashboard running at http://localhost:${PORT}`);
    console.log('[Bull Board] Queues: deep-scan, prequal-processing, quick-scan');
  });
}

// Run if executed directly
startBullBoard();
