/**
 * Accounts Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no accounts are available.
 */

'use client';

import { Building2, Plus, Upload, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export function AccountsEmptyStateClient() {
  const router = useRouter();

  const suggestions = [
    {
      id: 'create-account',
      icon: <Plus className="h-5 w-5" />,
      label: 'Account erstellen',
      description: 'Manuell einen neuen Kunden-Account anlegen',
      onClick: () => {
        router.push('/accounts/new');
      },
      variant: 'default' as const,
    },
    {
      id: 'upload-lead',
      icon: <Upload className="h-5 w-5" />,
      label: 'Lead hochladen',
      description: 'AI extrahiert Account-Daten automatisch aus Leads',
      onClick: () => {
        router.push('/qualifications/new');
      },
      variant: 'outline' as const,
    },
    {
      id: 'view-docs',
      icon: <BookOpen className="h-5 w-5" />,
      label: 'Dokumentation',
      description: 'Erfahren Sie mehr über Account-Management',
      onClick: () => {
        router.push('/docs/accounts');
      },
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="Keine Accounts vorhanden"
        description="Accounts werden automatisch erstellt, wenn Sie Leads hochladen. Die AI extrahiert Kundendaten und ordnet diese dem passenden Account zu."
        variant="info"
        actions={[
          {
            label: 'Neuer Account',
            onClick: () => router.push('/accounts/new'),
            variant: 'default',
            icon: <Plus className="h-4 w-4" />,
          },
        ]}
      />

      <SuggestedActions
        title="So funktioniert's"
        description="Accounts im Workflow"
        actions={suggestions}
        columns={3}
      />
    </div>
  );
}
