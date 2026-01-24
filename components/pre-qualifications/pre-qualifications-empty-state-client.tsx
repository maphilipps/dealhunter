/**
 * RFPs Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no RFPs are available.
 */

'use client';

import { Upload, BookOpen, Zap, FileSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export function PreQualificationsEmptyStateClient() {
  const router = useRouter();

  const suggestions = [
    {
      id: 'upload-rfp',
      icon: <Upload className="h-5 w-5" />,
      label: 'RFP hochladen',
      description: 'PDF oder Text hochladen und AI-Extraktion starten',
      onClick: () => {
        router.push('/pre-qualifications/new');
      },
      variant: 'default' as const,
    },
    {
      id: 'quick-scan',
      icon: <Zap className="h-5 w-5" />,
      label: 'Quick Scan',
      description: 'Website-Analyse mit Tech Stack Erkennung',
      onClick: () => {
        router.push('/docs/quick-scan');
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
      description: 'RFP-Workflow und BID/NO-BID Kriterien',
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
        title="Keine RFPs vorhanden"
        description="Laden Sie Ihr erstes RFP hoch, um den AI-gestützten Qualifizierungsprozess zu starten. Der Quick Scan analysiert automatisch die Website und gibt eine initiale BID/NO-BID Empfehlung."
        variant="info"
        actions={[
          {
            label: 'Neuer RFP',
            onClick: () => router.push('/pre-qualifications/new'),
            variant: 'default',
            icon: <Upload className="h-4 w-4" />,
          },
        ]}
      />

      <SuggestedActions
        title="Workflow Übersicht"
        description="So funktioniert der RFP-zu-Lead-Prozess"
        actions={suggestions}
        columns={2}
      />
    </div>
  );
}
