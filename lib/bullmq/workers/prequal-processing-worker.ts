/**
 * PreQual Processing Worker (BullMQ)
 *
 * Thin entrypoint that delegates to the implementation module.
 * Keeping this file small makes the worker easier to navigate and review.
 */

export { processPreQualJob } from './prequal-processing-worker.impl';
