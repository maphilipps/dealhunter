import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { ScanHubClient } from './client';

import { db } from '@/lib/db';
import { pitches, preQualifications, auditScanRuns } from '@/lib/db/schema';
import type { PitchScanSectionId } from '@/lib/pitch-scan/section-ids';
import { PITCH_SCAN_SECTION_LABELS } from '@/lib/pitch-scan/section-ids';
import type { PhaseStatus } from '@/hooks/use-pitch-scan-progress';

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [lead] = await db
    .select({
      id: pitches.id,
      customerName: pitches.customerName,
      websiteUrl: pitches.websiteUrl,
      preQualificationId: pitches.preQualificationId,
    })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Get suggested URLs from Qualification
  let suggestedUrls: { url: string; description?: string }[] = [];
  if (lead.preQualificationId) {
    const [preQualification] = await db
      .select({ extractedRequirements: preQualifications.extractedRequirements })
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (preQualification?.extractedRequirements) {
      try {
        const extracted = JSON.parse(preQualification.extractedRequirements) as Record<
          string,
          unknown
        >;
        if (extracted.websiteUrls && Array.isArray(extracted.websiteUrls)) {
          suggestedUrls = (
            extracted.websiteUrls as Array<{ url: string; description?: string }>
          ).map(u => ({
            url: u.url,
            description: u.description,
          }));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Fetch latest audit_scan_runs record
  const [latestRun] = await db
    .select({
      id: auditScanRuns.id,
      status: auditScanRuns.status,
      progress: auditScanRuns.progress,
      currentPhase: auditScanRuns.currentPhase,
      completedAgents: auditScanRuns.completedAgents,
      agentConfidences: auditScanRuns.agentConfidences,
      startedAt: auditScanRuns.startedAt,
      completedAt: auditScanRuns.completedAt,
    })
    .from(auditScanRuns)
    .where(eq(auditScanRuns.pitchId, id))
    .orderBy(desc(auditScanRuns.createdAt))
    .limit(1);

  // Build completed sections from deal_embeddings (grouped by agentName)
  const validSectionIds = new Set(Object.keys(PITCH_SCAN_SECTION_LABELS));
  const completedSections: Array<{
    sectionId: PitchScanSectionId;
    status: PhaseStatus;
    confidence?: number;
  }> = [];

  if (latestRun) {
    // Parse agent confidences
    let agentConfidences: Record<string, number> = {};
    if (latestRun.agentConfidences) {
      try {
        agentConfidences = JSON.parse(latestRun.agentConfidences) as Record<string, number>;
      } catch {
        // ignore
      }
    }

    // Parse completed agents
    let completedAgents: string[] = [];
    if (latestRun.completedAgents) {
      try {
        completedAgents = JSON.parse(latestRun.completedAgents) as string[];
      } catch {
        // ignore
      }
    }

    for (const agentName of completedAgents) {
      if (validSectionIds.has(agentName)) {
        completedSections.push({
          sectionId: agentName,
          status: 'completed',
          confidence: agentConfidences[agentName],
        });
      }
    }
  }

  const isRunning = latestRun && ['pending', 'running'].includes(latestRun.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pitch Scan</h1>
        <p className="text-muted-foreground">
          {lead.customerName || 'Lead'} – {lead.websiteUrl || 'Keine URL'}
        </p>
      </div>

      <ScanHubClient
        pitchId={id}
        websiteUrl={lead.websiteUrl || ''}
        suggestedUrls={suggestedUrls}
        completedSections={completedSections}
        hasExistingRun={!!latestRun}
        isRunning={!!isRunning}
        runStatus={latestRun?.status ?? null}
      />
    </div>
  );
}
