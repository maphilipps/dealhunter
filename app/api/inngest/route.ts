import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { deepAnalysisFunction } from '@/lib/inngest/functions/deep-analysis';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [deepAnalysisFunction],
});
