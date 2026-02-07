'use client';

import {
  Award,
  Calculator,
  Eye,
  FileCheck,
  FileText,
  Gauge,
  GitBranch,
  Layers,
  Puzzle,
  Scale,
  Search,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { PhaseStatus, PitchScanPhase } from '@/hooks/use-pitch-scan-progress';
import type { PitchScanSectionId } from '@/lib/pitch-scan/section-ids';
import { PITCH_SCAN_SECTION_LABELS } from '@/lib/pitch-scan/section-ids';
import { cn } from '@/lib/utils';

// ====== Icon mapping per section ======

const SECTION_ICONS: Record<PitchScanSectionId, LucideIcon> = {
  'ps-discovery': Search,
  'ps-content-architecture': FileText,
  'ps-features': Zap,
  'ps-performance': Gauge,
  'ps-accessibility': Eye,
  'ps-legal': Shield,
  'ps-integrations': Puzzle,
  'ps-migration': GitBranch,
  'ps-cms-comparison': Scale,
  'ps-cms-recommendation': Award,
  'ps-drupal-architecture': Layers,
  'ps-estimation': Calculator,
  'ps-documentation': FileCheck,
};

// ====== Status helpers ======

function statusBadge(status: PhaseStatus) {
  switch (status) {
    case 'completed':
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          Fertig
        </Badge>
      );
    case 'active':
      return (
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          <Loader size="xs" className="mr-1 text-primary" />
          Läuft
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">Fehler</Badge>;
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Ausstehend
        </Badge>
      );
  }
}

function confidenceBadge(confidence: number | undefined) {
  if (confidence == null) return null;
  const rounded = Math.round(confidence);
  return (
    <Badge
      variant="outline"
      className={cn(
        'tabular-nums text-[10px]',
        rounded >= 80 &&
          'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400',
        rounded >= 60 &&
          rounded < 80 &&
          'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400',
        rounded < 60 && 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
      )}
    >
      {rounded}%
    </Badge>
  );
}

// ====== Props ======

export interface SectionData {
  sectionId: PitchScanSectionId;
  status: PhaseStatus;
  confidence?: number;
}

interface ScanSectionGridProps {
  pitchId: string;
  /** Static section data from the DB (completed sections from previous runs) */
  completedSections?: SectionData[];
  /** Live phase data from SSE progress hook — overrides completedSections when present */
  livePhases?: PitchScanPhase[];
}

export function ScanSectionGrid({
  pitchId,
  completedSections = [],
  livePhases,
}: ScanSectionGridProps) {
  const sectionIds = Object.keys(PITCH_SCAN_SECTION_LABELS) as PitchScanSectionId[];

  // Build a lookup: sectionId → status/confidence
  const sectionMap = new Map<PitchScanSectionId, { status: PhaseStatus; confidence?: number }>();

  // First, populate from DB data
  for (const s of completedSections) {
    sectionMap.set(s.sectionId, { status: s.status, confidence: s.confidence });
  }

  // Override with live SSE data when available
  if (livePhases && livePhases.length > 0) {
    for (const phase of livePhases) {
      const id = phase.id;
      const agentConfidence = phase.agents[0]?.confidence;
      sectionMap.set(id, { status: phase.status, confidence: agentConfidence });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sectionIds.map(sectionId => {
        const Icon = SECTION_ICONS[sectionId];
        const label = PITCH_SCAN_SECTION_LABELS[sectionId];
        const data = sectionMap.get(sectionId);
        const status: PhaseStatus = data?.status ?? 'pending';
        const isClickable = status === 'completed';

        const cardContent = (
          <Card
            className={cn(
              'transition-all duration-200',
              isClickable && 'hover:border-primary/50 hover:shadow-md cursor-pointer',
              status === 'active' && 'border-primary/30 shadow-sm',
              status === 'failed' && 'border-destructive/30',
              !isClickable && status !== 'active' && status !== 'failed' && 'opacity-60'
            )}
          >
            <CardHeader className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                      status === 'completed' &&
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      status === 'active' && 'bg-primary/10 text-primary',
                      status === 'failed' && 'bg-destructive/10 text-destructive',
                      status === 'pending' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-medium leading-tight">{label}</CardTitle>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {statusBadge(status)}
                {confidenceBadge(data?.confidence)}
              </div>
            </CardHeader>
          </Card>
        );

        if (isClickable) {
          return (
            <Link key={sectionId} href={`/pitches/${pitchId}/scan/${sectionId}`}>
              {cardContent}
            </Link>
          );
        }

        return <div key={sectionId}>{cardContent}</div>;
      })}
    </div>
  );
}
