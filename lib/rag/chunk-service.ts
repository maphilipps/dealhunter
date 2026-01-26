/**
 * RAG Chunking Service (DEA-107)
 *
 * Chunks agent outputs into granular, semantically meaningful chunks
 * for embedding and retrieval.
 */

export interface ChunkInput {
  preQualificationId: string;
  agentName: string;
  output: Record<string, unknown>;
}

export interface Chunk {
  preQualificationId: string;
  agentName: string;
  chunkType: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Chunk agent output into granular chunks for embedding
 *
 * Strategy:
 * - Quick Scan: Split into tech_stack, performance, content_volume, etc.
 * - Extract: Split into customer, project, technologies, budget_timeline
 * - Deep Analysis Agents: Keep as single chunks (already focused)
 */
export async function chunkAgentOutput(input: ChunkInput): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  // Quick Scan Agent - Granular chunking
  if (input.agentName === 'quick_scan') {
    const qs = input.output as any;
    let index = 0;

    if (qs.techStack) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'tech_stack',
        chunkIndex: index++,
        content: `Tech Stack Analysis:\n${JSON.stringify(qs.techStack, null, 2)}`,
        metadata: {
          cms: qs.techStack.cms,
          framework: qs.techStack.frontend?.framework,
        },
      });
    }

    if (qs.performanceIndicators) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'performance',
        chunkIndex: index++,
        content: `Performance Indicators:\n${JSON.stringify(qs.performanceIndicators, null, 2)}`,
        metadata: {
          lcp: qs.performanceIndicators.lcp,
          fid: qs.performanceIndicators.fid,
          cls: qs.performanceIndicators.cls,
        },
      });
    }

    if (qs.contentVolume) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'content_volume',
        chunkIndex: index++,
        content: `Content Volume:\n${JSON.stringify(qs.contentVolume, null, 2)}`,
        metadata: {
          pageCount: qs.contentVolume.pageCount,
        },
      });
    }

    if (qs.accessibilityAudit) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'accessibility',
        chunkIndex: index++,
        content: `Accessibility Audit:\n${JSON.stringify(qs.accessibilityAudit, null, 2)}`,
        metadata: {
          score: qs.accessibilityAudit.overallScore,
        },
      });
    }

    if (qs.seoAudit) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'seo',
        chunkIndex: index++,
        content: `SEO Audit:\n${JSON.stringify(qs.seoAudit, null, 2)}`,
        metadata: {},
      });
    }

    if (qs.navigationStructure) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'navigation',
        chunkIndex: index++,
        content: `Navigation Structure:\n${JSON.stringify(qs.navigationStructure, null, 2)}`,
        metadata: {},
      });
    }

    if (qs.screenshots) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'quick_scan',
        chunkType: 'screenshots',
        chunkIndex: index++,
        content: `Screenshots:\n${JSON.stringify(qs.screenshots, null, 2)}`,
        metadata: {},
      });
    }
  }

  // Extract Agent - Granular chunking
  else if (input.agentName === 'extract') {
    const ext = input.output as any;
    let index = 0;

    if (ext.customerName || ext.industry) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'customer',
        chunkIndex: index++,
        content: `Customer: ${ext.customerName || 'Unknown'}\nIndustry: ${ext.industry || 'Unknown'}`,
        metadata: {
          customerName: ext.customerName,
          industry: ext.industry,
        },
      });
    }

    if (ext.projectName || ext.projectDescription) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'project',
        chunkIndex: index++,
        content: `Project: ${ext.projectName || 'Unknown'}\nDescription: ${ext.projectDescription || 'N/A'}`,
        metadata: {
          projectName: ext.projectName,
        },
      });
    }

    if (ext.technologies && Array.isArray(ext.technologies)) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'technologies',
        chunkIndex: index++,
        content: `Technologies: ${ext.technologies.join(', ')}`,
        metadata: {
          technologies: ext.technologies,
        },
      });
    }

    if (ext.budgetRange || ext.timeline) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'budget_timeline',
        chunkIndex: index++,
        content: `Budget: ${ext.budgetRange || 'N/A'}\nTimeline: ${JSON.stringify(ext.timeline || {})}`,
        metadata: {
          budgetRange: ext.budgetRange,
        },
      });
    }

    if (ext.budgetRange || ext.contractDuration) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'budget',
        chunkIndex: index++,
        content: `Budget: ${JSON.stringify(ext.budgetRange || {})}\nLaufzeit: ${ext.contractDuration || 'N/A'}`,
        metadata: {
          sectionId: 'budget',
        },
      });
    }

    if (
      ext.submissionDeadline ||
      ext.procedureType ||
      ext.shortlistingProcess ||
      ext.submissionPortal
    ) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'timing_procedure',
        chunkIndex: index++,
        content: `Abgabefrist: ${ext.submissionDeadline || 'N/A'}\nVerfahren: ${ext.procedureType || 'N/A'}\nShortlisting: ${JSON.stringify(ext.shortlistingProcess || {})}\nPortal: ${JSON.stringify(ext.submissionPortal || {})}`,
        metadata: {
          sectionId: 'timing',
        },
      });
    }

    if (ext.contractType || ext.contractModel || ext.contractDuration) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'contracts',
        chunkIndex: index++,
        content: `Vertragstyp: ${ext.contractType || 'N/A'}\nModell: ${ext.contractModel || 'N/A'}\nLaufzeit: ${ext.contractDuration || 'N/A'}`,
        metadata: {
          sectionId: 'contracts',
        },
      });
    }

    if (ext.requiredDeliverables || ext.proposalStructure || ext.requiredServices || ext.scope) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'deliverables',
        chunkIndex: index++,
        content: `Leistungsumfang: ${ext.scope || 'N/A'}\nServices: ${JSON.stringify(ext.requiredServices || [])}\nTeilnahmeantrag: ${JSON.stringify(ext.proposalStructure?.participationPhase || [])}\nAngebot: ${JSON.stringify(ext.proposalStructure?.offerPhase || [])}\nDeliverables: ${JSON.stringify(ext.requiredDeliverables || [])}`,
        metadata: {
          sectionId: 'deliverables',
        },
      });
    }

    if (ext.referenceRequirements || ext.keyRequirements) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'references',
        chunkIndex: index++,
        content: `Referenzen: ${JSON.stringify(ext.referenceRequirements || {})}\nKey Requirements: ${JSON.stringify(ext.keyRequirements || [])}`,
        metadata: {
          sectionId: 'references',
        },
      });
    }

    if (ext.awardCriteria) {
      chunks.push({
        preQualificationId: input.preQualificationId,
        agentName: 'extract',
        chunkType: 'award_criteria',
        chunkIndex: index++,
        content: `Zuschlagskriterien: ${JSON.stringify(ext.awardCriteria || {})}`,
        metadata: {
          sectionId: 'award-criteria',
        },
      });
    }
  }

  // Deep Analysis Agents - Keep as single chunks
  else if (
    [
      'tech_agent',
      'commercial_agent',
      'risk_agent',
      'legal_agent',
      'team_agent',
      'content_architecture',
      'migration_complexity',
      'accessibility_audit',
    ].includes(input.agentName)
  ) {
    chunks.push({
      preQualificationId: input.preQualificationId,
      agentName: input.agentName,
      chunkType: 'full_analysis',
      chunkIndex: 0,
      content: `${input.agentName} Analysis:\n${JSON.stringify(input.output, null, 2)}`,
      metadata: {},
    });
  }

  // Generic fallback for unknown agents
  else {
    chunks.push({
      preQualificationId: input.preQualificationId,
      agentName: input.agentName,
      chunkType: 'generic',
      chunkIndex: 0,
      content: JSON.stringify(input.output, null, 2),
      metadata: {},
    });
  }

  return chunks;
}
