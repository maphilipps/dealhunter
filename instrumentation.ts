import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Warm the AI model config cache from DB at server start
    const { warmModelConfigCache } = await import('@/lib/ai/model-config');
    await warmModelConfigCache();

    // Register cleanup for qualification event publisher Redis connection
    const { closeQualificationPublisher } = await import('@/lib/streaming/qualification-publisher');
    process.on('SIGTERM', () => void closeQualificationPublisher());
    process.on('SIGINT', () => void closeQualificationPublisher());
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
