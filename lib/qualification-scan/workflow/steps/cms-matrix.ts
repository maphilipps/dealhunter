// ═══════════════════════════════════════════════════════════════════════════════
// CMS MATRIX STEP - QualificationScan 2.0 Workflow
// Evaluates CMS options against extracted requirements using parallel research
// ═══════════════════════════════════════════════════════════════════════════════

import { eq } from 'drizzle-orm';

import type { TechStack, ContentVolume, Features } from '../../schema';
import { wrapToolWithProgress } from '../tool-wrapper';

import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface CMSMatrixInput {
  techStack: TechStack;
  features: Features;
  contentVolume: ContentVolume;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPE (re-exported from orchestrator)
// ═══════════════════════════════════════════════════════════════════════════════

export type { RequirementMatrix } from '@/lib/cms-matching/parallel-matrix-orchestrator';

// ═══════════════════════════════════════════════════════════════════════════════
// CMS MATRIX STEP
// ═══════════════════════════════════════════════════════════════════════════════

function formatCMSMatrixForRAG(result: unknown): string {
  const matrix =
    result as import('@/lib/cms-matching/parallel-matrix-orchestrator').RequirementMatrix;
  const parts: string[] = [
    `CMS-Evaluierung: ${matrix.requirements.length} Requirements × ${matrix.technologies.length} CMS`,
    `Durchschnittlicher Score: ${matrix.metadata.averageScore}/100`,
  ];

  for (const tech of matrix.technologies) {
    const techCells = matrix.cells.filter(c => c.cmsId === tech.id && c.result);
    const avgScore =
      techCells.length > 0
        ? Math.round(
            techCells.reduce((sum, c) => sum + (c.result?.score ?? 0), 0) / techCells.length
          )
        : 0;
    parts.push(`${tech.name}: ${avgScore}/100`);
  }

  return parts.join('. ');
}

export const cmsMatrixStep = wrapToolWithProgress<
  CMSMatrixInput,
  import('@/lib/cms-matching/parallel-matrix-orchestrator').RequirementMatrix | null
>(
  {
    name: 'cmsMatrix',
    displayName: 'CMS Matrix',
    phase: 'synthesis',
    dependencies: ['techStack', 'features', 'contentVolume'],
    optional: true,
    timeout: 120000,
    ragStorage: {
      chunkType: 'cms_matrix',
      category: 'recommendation',
      formatContent: formatCMSMatrixForRAG,
      getConfidence: result => {
        const matrix = result as
          | import('@/lib/cms-matching/parallel-matrix-orchestrator').RequirementMatrix
          | null;
        return matrix ? Math.min(95, matrix.metadata.averageScore) : 0;
      },
    },
  },
  async (input, _ctx, onProgress) => {
    // 1. Load default CMS technologies from DB
    onProgress('Lade CMS-Technologien...');

    const defaultTechnologies = await db
      .select({
        id: technologies.id,
        name: technologies.name,
        pros: technologies.pros,
        cons: technologies.cons,
      })
      .from(technologies)
      .where(eq(technologies.isDefault, true));

    if (defaultTechnologies.length === 0) {
      onProgress('Keine Default-CMS-Technologien konfiguriert — überspringe');
      return null;
    }

    // Map to orchestrator format
    const cmsOptions = defaultTechnologies.map((tech, index) => ({
      id: tech.id,
      name: tech.name,
      isBaseline: index === 0,
      strengths: tech.pros ? (JSON.parse(tech.pros) as string[]) : undefined,
      weaknesses: tech.cons ? (JSON.parse(tech.cons) as string[]) : undefined,
    }));

    onProgress(
      `${cmsOptions.length} CMS-Technologien geladen: ${cmsOptions.map(c => c.name).join(', ')}`
    );

    // 2. Extract requirements from scan results
    onProgress('Extrahiere Anforderungen aus Scan-Ergebnissen...');

    const { extractRequirementsFromQualificationScan } =
      await import('@/lib/cms-matching/requirements');

    const scanData: Record<string, unknown> = {
      techStack: input.techStack,
      features: input.features,
      contentVolume: input.contentVolume,
    };

    const requirements = extractRequirementsFromQualificationScan(scanData);

    if (requirements.length === 0) {
      onProgress('Keine Anforderungen extrahiert — überspringe CMS-Evaluierung');
      return null;
    }

    onProgress(`${requirements.length} Anforderungen extrahiert`);

    // 3. Run parallel matrix research
    onProgress(
      `Starte parallele CMS-Evaluierung: ${requirements.length} Requirements × ${cmsOptions.length} CMS...`
    );

    const { runParallelMatrixResearch } =
      await import('@/lib/cms-matching/parallel-matrix-orchestrator');

    const matrix = await runParallelMatrixResearch(
      requirements,
      cmsOptions,
      event => {
        // Forward progress events
        if (
          'data' in event &&
          event.data &&
          typeof event.data === 'object' &&
          'message' in event.data
        ) {
          onProgress(String((event.data as { message: string }).message));
        }
      },
      {
        useCache: true,
        saveToDb: true,
      }
    );

    onProgress(
      `CMS-Evaluierung abgeschlossen — Durchschnittlicher Score: ${matrix.metadata.averageScore}/100`
    );

    return matrix;
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ALL CMS MATRIX STEPS
// ═══════════════════════════════════════════════════════════════════════════════

export const cmsMatrixSteps = [cmsMatrixStep];
