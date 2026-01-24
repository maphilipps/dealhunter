/**
 * CMS Advocates System
 *
 * Multi-CMS advocate agents that "pitch" their platforms.
 * Each CMS gets a specialized agent that argues for its selection.
 */

export { runCMSAdvocateOrchestrator, runCMSAdvocate } from './orchestrator';
export { loadCMSKnowledge, CMS_SPECIFIC_CONTEXT } from './base-advocate';
export * from './types';
