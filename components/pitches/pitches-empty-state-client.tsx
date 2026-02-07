/**
 * Pitches Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no pitches are available for the current user/BU.
 */

'use client';

import { FileText, Upload, BookOpen, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export interface QualificationsEmptyStateClientProps {
  userRole: string;
}

export function QualificationsEmptyStateClient({ userRole }: QualificationsEmptyStateClientProps) {
  const router = useRouter();

  // BL users see different suggestions than Admin users
  const suggestions =
    userRole === 'bl'
      ? [
          {
            id: 'wait-for-pitches',
            icon: <Zap className="h-5 w-5" />,
            label: 'Pitches erwarten',
            description: 'BD Team qualifiziert Leads und leitet passende Pitches weiter',
            onClick: () => {
              // Just informational - no action needed
            },
            variant: 'outline' as const,
            disabled: true,
          },
          {
            id: 'view-docs',
            icon: <BookOpen className="h-5 w-5" />,
            label: 'Dokumentation',
            description: 'Erfahren Sie mehr über den Pitch-Review-Prozess',
            onClick: () => {
              router.push('/docs/qualification-process');
            },
            variant: 'outline' as const,
          },
        ]
      : [
          {
            id: 'create-lead',
            icon: <Upload className="h-5 w-5" />,
            label: 'Lead hochladen',
            description: 'Laden Sie einen Lead hoch, um den Qualifizierungsprozess zu starten',
            onClick: () => {
              router.push('/qualifications/new');
            },
            variant: 'default' as const,
          },
          {
            id: 'view-leads',
            icon: <FileText className="h-5 w-5" />,
            label: 'Leads anzeigen',
            description: 'Alle Leads und deren Status anzeigen',
            onClick: () => {
              router.push('/qualifications');
            },
            variant: 'outline' as const,
          },
          {
            id: 'view-docs',
            icon: <BookOpen className="h-5 w-5" />,
            label: 'Dokumentation',
            description: 'Erfahren Sie mehr über den Lead-zu-Pitch-Workflow',
            onClick: () => {
              router.push('/docs/workflow');
            },
            variant: 'outline' as const,
          },
        ];

  return (
    <div className="space-y-6">
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="Keine Pitches vorhanden"
        description={
          userRole === 'bl'
            ? 'Für Ihre Business Unit wurden noch keine Pitches weitergeleitet. Sobald das BD Team einen passenden Lead qualifiziert, erscheint er hier.'
            : 'Es gibt aktuell keine Pitches im System. Laden Sie Leads hoch, um den Qualifizierungsprozess zu starten.'
        }
        variant="info"
      />

      <SuggestedActions
        title="Nächste Schritte"
        description="Was Sie jetzt tun können"
        actions={suggestions}
        columns={userRole === 'bl' ? 2 : 3}
      />
    </div>
  );
}
