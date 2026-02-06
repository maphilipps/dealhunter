// ═══════════════════════════════════════════════════════════════════════════════
// DAG RESOLVER - QualificationScan 2.0 Refactoring
// Resolves step dependencies and creates an execution plan
// Uses Kahn's algorithm for topological sorting
// ═══════════════════════════════════════════════════════════════════════════════

import type { StepRegistry, ExecutionPlan, DAGNode } from './types';

/**
 * Resolves dependencies between steps and creates an execution plan
 * Steps in the same wave can run in parallel
 * Steps in different waves run sequentially
 *
 * @example
 * ```ts
 * const plan = resolveExecutionPlan(steps);
 * // plan.waves = [
 * //   ['fetchWebsite', 'loadBusinessUnits'],  // Wave 0: No dependencies
 * //   ['crawlNavigation', 'techStack'],        // Wave 1: Depends on wave 0
 * //   ['recommendBL'],                         // Wave 2: Depends on waves 0 & 1
 * // ]
 * ```
 */
export function resolveExecutionPlan(steps: StepRegistry): ExecutionPlan {
  // Build the dependency graph
  const graph = buildGraph(steps);

  // Validate graph (check for cycles, missing dependencies)
  validateGraph(graph, steps);

  // Calculate execution waves using topological sort
  const waves = calculateWaves(graph);

  return {
    waves,
    totalSteps: steps.size,
    graph,
  };
}

/**
 * Build a dependency graph from the step registry
 */
function buildGraph(steps: StepRegistry): Map<string, DAGNode> {
  const graph = new Map<string, DAGNode>();

  // Create nodes for all steps
  for (const [stepId, step] of steps) {
    graph.set(stepId, {
      stepId,
      config: step.config,
      dependencies: new Set(step.config.dependencies ?? []),
      dependents: new Set(),
    });
  }

  // Calculate reverse dependencies (dependents)
  for (const [stepId, node] of graph) {
    for (const depId of node.dependencies) {
      const depNode = graph.get(depId);
      if (depNode) {
        depNode.dependents.add(stepId);
      }
    }
  }

  return graph;
}

/**
 * Validate the dependency graph
 * - Check for missing dependencies
 * - Check for cycles
 */
function validateGraph(graph: Map<string, DAGNode>, steps: StepRegistry): void {
  // Check for missing dependencies
  for (const [stepId, node] of graph) {
    for (const depId of node.dependencies) {
      if (!steps.has(depId)) {
        throw new Error(
          `Step "${stepId}" depends on "${depId}" which does not exist in the registry`
        );
      }
    }
  }

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const [stepId] of graph) {
    if (hasCycle(stepId, graph, visited, recursionStack)) {
      throw new Error(`Dependency cycle detected involving step "${stepId}"`);
    }
  }
}

/**
 * DFS-based cycle detection
 */
function hasCycle(
  stepId: string,
  graph: Map<string, DAGNode>,
  visited: Set<string>,
  recursionStack: Set<string>
): boolean {
  if (recursionStack.has(stepId)) {
    return true; // Cycle found
  }

  if (visited.has(stepId)) {
    return false; // Already processed, no cycle here
  }

  visited.add(stepId);
  recursionStack.add(stepId);

  const node = graph.get(stepId);
  if (node) {
    for (const depId of node.dependencies) {
      if (hasCycle(depId, graph, visited, recursionStack)) {
        return true;
      }
    }
  }

  recursionStack.delete(stepId);
  return false;
}

/**
 * Calculate execution waves using Kahn's algorithm (topological sort)
 * Each wave contains steps that can run in parallel
 */
function calculateWaves(graph: Map<string, DAGNode>): string[][] {
  const waves: string[][] = [];
  const inDegree = new Map<string, number>();
  const remaining = new Set<string>();

  // Initialize in-degree for each node
  for (const [stepId, node] of graph) {
    inDegree.set(stepId, node.dependencies.size);
    remaining.add(stepId);
  }

  while (remaining.size > 0) {
    // Find all nodes with no remaining dependencies (in-degree = 0)
    const currentWave: string[] = [];

    for (const stepId of remaining) {
      if ((inDegree.get(stepId) ?? 0) === 0) {
        currentWave.push(stepId);
      }
    }

    if (currentWave.length === 0) {
      // Should not happen if graph validation passed
      throw new Error('Dependency resolution failed: no steps available to execute');
    }

    // Remove current wave from remaining
    for (const stepId of currentWave) {
      remaining.delete(stepId);

      // Decrease in-degree of all dependents
      const node = graph.get(stepId);
      if (node) {
        for (const dependentId of node.dependents) {
          const currentDegree = inDegree.get(dependentId) ?? 0;
          inDegree.set(dependentId, currentDegree - 1);
        }
      }
    }

    waves.push(currentWave);
  }

  return waves;
}

/**
 * Get steps that are ready to execute based on completed steps
 */
export function getReadySteps(
  graph: Map<string, DAGNode>,
  completedSteps: Set<string>,
  runningSteps: Set<string>
): string[] {
  const ready: string[] = [];

  for (const [stepId, node] of graph) {
    // Skip if already completed or running
    if (completedSteps.has(stepId) || runningSteps.has(stepId)) {
      continue;
    }

    // Check if all dependencies are completed
    const allDepsCompleted = Array.from(node.dependencies).every(dep => completedSteps.has(dep));

    if (allDepsCompleted) {
      ready.push(stepId);
    }
  }

  return ready;
}

/**
 * Print the execution plan for debugging
 */
export function printExecutionPlan(plan: ExecutionPlan): string {
  const lines: string[] = ['Execution Plan:', ''];

  for (let i = 0; i < plan.waves.length; i++) {
    const wave = plan.waves[i];
    lines.push(`Wave ${i + 1} (parallel):`);

    for (const stepId of wave) {
      const node = plan.graph.get(stepId);
      const deps = node?.dependencies.size
        ? ` [deps: ${Array.from(node.dependencies).join(', ')}]`
        : '';
      lines.push(`  - ${stepId}${deps}`);
    }

    lines.push('');
  }

  lines.push(`Total steps: ${plan.totalSteps}`);
  return lines.join('\n');
}
