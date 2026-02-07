/**
 * Qualifications Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no Qualifications are available.
 */

'use client';

import { Upload, BookOpen, Zap, FileSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export function QualificationsEmptyStateClient() {
  const router = useRouter();

  const suggestions = [
    {
      id: 'upload-preQualification',
      icon: <Upload className="h-5 w-5" />,
      label: 'Lead hochladen',
      description: 'PDF oder Text hochladen und AI-Extraktion starten',
      onClick: () => {
        router.push('/qualifications/new');
      },
      variant: 'default' as const,
    },
    {
      id: 'qualification',
      icon: <Zap className="h-5 w-5" />,
      label: 'Qualification',
      description: 'Automatische Extraktion, Analyse und Detailseiten',
      onClick: () => {
        router.push('/docs/qualification');
      },
      variant: 'outline' as const,
    },
    {
      id: 'deep-analysis',
      icon: <FileSearch className="h-5 w-5" />,
      label: 'Deep Analysis',
      description: 'Umfassende Migration & CMS-Analyse',
      onClick: () => {
        router.push('/docs/deep-analysis');
      },
      variant: 'outline' as const,
    },
    {
      id: 'view-docs',
      icon: <BookOpen className="h-5 w-5" />,
      label: 'Dokumentation',
      description: 'Lead-Workflow und BID/NO-BID Kriterien',
      onClick: () => {
        router.push('/docs/workflow');
      },
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <EmptyState
        icon={<Upload className="h-12 w-12" />}
        title="Keine Leads vorhanden"
        description="Laden Sie Ihren ersten Lead hoch, um den AI-gestützten Qualifizierungsprozess zu starten. Die Qualification analysiert automatisch die Website und liefert eine initiale BID/NO-BID Einschätzung."
        variant="info"
        actions={[
          {
            label: 'Neuer Lead',
            onClick: () => router.push('/qualifications/new'),
            variant: 'default',
            icon: <Upload className="h-4 w-4" />,
          },
        ]}
      />

      <SuggestedActions
        title="Workflow Übersicht"
        description="So funktioniert der Lead-Prozess"
        actions={suggestions}
        columns={2}
      />
    </div>
  );
}
