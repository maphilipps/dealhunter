/**
 * Leads Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no leads are available for the current user/BU.
 */

'use client';

import { FileText, Upload, BookOpen, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export interface LeadsEmptyStateClientProps {
  userRole: string;
}

export function LeadsEmptyStateClient({ userRole }: LeadsEmptyStateClientProps) {
  const router = useRouter();

  // BL users see different suggestions than Admin users
  const suggestions =
    userRole === 'bl'
      ? [
          {
            id: 'wait-for-leads',
            icon: <Zap className="h-5 w-5" />,
            label: 'Leads erwarten',
            description: 'BD Team qualifiziert RFPs und leitet passende Leads weiter',
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
            description: 'Erfahren Sie mehr über den Lead-Review-Prozess',
            onClick: () => {
              router.push('/docs/lead-process');
            },
            variant: 'outline' as const,
          },
        ]
      : [
          {
            id: 'create-rfp',
            icon: <Upload className="h-5 w-5" />,
            label: 'RFP hochladen',
            description: 'Laden Sie ein RFP hoch, um den Qualifizierungsprozess zu starten',
            onClick: () => {
              router.push('/pre-qualifications/new');
            },
            variant: 'default' as const,
          },
          {
            id: 'view-rfps',
            icon: <FileText className="h-5 w-5" />,
            label: 'Pre-Qualifications anzeigen',
            description: 'Alle Pre-Qualifications und deren Status anzeigen',
            onClick: () => {
              router.push('/pre-qualifications');
            },
            variant: 'outline' as const,
          },
          {
            id: 'view-docs',
            icon: <BookOpen className="h-5 w-5" />,
            label: 'Dokumentation',
            description: 'Erfahren Sie mehr über den RFP-zu-Lead-Workflow',
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
        title="Keine Leads vorhanden"
        description={
          userRole === 'bl'
            ? 'Für Ihre Business Unit wurden noch keine Leads weitergeleitet. Sobald das BD Team ein passendes RFP qualifiziert, erscheint es hier.'
            : 'Es gibt aktuell keine Leads im System. Laden Sie RFPs hoch, um den Qualifizierungsprozess zu starten.'
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
