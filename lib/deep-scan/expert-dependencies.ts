/**
 * Expert Dependencies Configuration
 *
 * Defines the execution order of experts as a Directed Acyclic Graph (DAG).
 * Each expert can only run after all its dependencies have completed.
 *
 * This enables:
 * 1. Parallel execution of independent experts
 * 2. Sequential execution of dependent experts
 * 3. Selective re-scan without re-running the entire pipeline
 */

/**
 * Expert dependency graph
 *
 * Format: expertName -> list of experts that must complete first
 */
export const EXPERT_DEPENDENCIES: Record<string, string[]> = {
  // Phase 1: Scraping (no dependencies)
  scraper: [],

  // Phase 2: Base experts (depend on scraper)
  tech: ['scraper'],
  website: ['scraper'],
  performance: ['scraper'],
  integrations: ['scraper'],

  // Phase 2b: Experts that depend on tech analysis
  architecture: ['scraper', 'tech'],
  hosting: ['scraper', 'tech'],

  // Phase 2c: Migration depends on architecture
  migration: ['scraper', 'architecture'],

  // Phase 3: Synthesis experts (depend on all base experts)
  project: ['tech', 'website', 'architecture', 'hosting', 'integrations', 'migration'],
  costs: ['tech', 'website', 'architecture', 'hosting', 'integrations', 'migration'],

  // Phase 4: Decision (depends on project and costs)
  decision: ['project', 'costs'],
};

/**
 * All expert names in the system
 */
export const ALL_EXPERTS = Object.keys(EXPERT_DEPENDENCIES);

/**
 * Base experts that can run in parallel after scraping
 */
export const BASE_EXPERTS = ['tech', 'website', 'performance', 'integrations'];

/**
 * Synthesis experts that aggregate results from base experts
 */
export const SYNTHESIS_EXPERTS = ['project', 'costs', 'decision'];

/**
 * Get all experts that depend on a given expert (direct or transitive)
 *
 * @param expertName - The expert to find dependents for
 * @returns Array of expert names that depend on this expert
 */
export function getDependentExperts(expertName: string): string[] {
  const dependents: string[] = [];

  for (const [expert, dependencies] of Object.entries(EXPERT_DEPENDENCIES)) {
    if (dependencies.includes(expertName)) {
      dependents.push(expert);
      // Recursively find transitive dependents
      dependents.push(...getDependentExperts(expert));
    }
  }

  // Return unique values
  return [...new Set(dependents)];
}

/**
 * Get all dependencies for a given expert (direct and transitive)
 *
 * @param expertName - The expert to find dependencies for
 * @returns Array of expert names this expert depends on
 */
export function getAllDependencies(expertName: string): string[] {
  const dependencies = EXPERT_DEPENDENCIES[expertName] || [];
  const allDeps: string[] = [...dependencies];

  for (const dep of dependencies) {
    allDeps.push(...getAllDependencies(dep));
  }

  // Return unique values
  return [...new Set(allDeps)];
}

/**
 * Check if an expert can run given a set of completed experts
 *
 * @param expertName - The expert to check
 * @param completedExperts - Set of experts that have completed
 * @returns True if all dependencies are satisfied
 */
export function canExpertRun(expertName: string, completedExperts: Set<string>): boolean {
  const dependencies = EXPERT_DEPENDENCIES[expertName] || [];
  return dependencies.every(dep => completedExperts.has(dep));
}

/**
 * Get the next experts that can run given a set of completed experts
 *
 * @param completedExperts - Set of experts that have completed
 * @param excludeExperts - Set of experts to exclude (already running or failed)
 * @returns Array of expert names that can run next
 */
export function getNextRunnableExperts(
  completedExperts: Set<string>,
  excludeExperts: Set<string> = new Set()
): string[] {
  return ALL_EXPERTS.filter(expert => {
    // Skip if already completed or excluded
    if (completedExperts.has(expert) || excludeExperts.has(expert)) {
      return false;
    }
    // Check if all dependencies are satisfied
    return canExpertRun(expert, completedExperts);
  });
}

/**
 * Calculate total expert count for progress tracking
 */
export const TOTAL_EXPERTS = ALL_EXPERTS.length;
