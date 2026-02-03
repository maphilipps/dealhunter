/**
 * References Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no references are available.
 */

'use client';

import { FolderKanban, Plus, FileSearch, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export function ReferencesEmptyStateClient() {
  const router = useRouter();

  const suggestions = [
    {
      id: 'create-reference',
      icon: <Plus className="h-5 w-5" />,
      label: 'Referenz anlegen',
      description: 'Projektdetails, Technologien und Erfolge dokumentieren',
      onClick: () => {
        router.push('/references/new');
      },
      variant: 'default' as const,
    },
    {
      id: 'pitch-generation',
      icon: <FileSearch className="h-5 w-5" />,
      label: 'Pitch-Generierung',
      description: 'AI nutzt Referenzen für passende Angebotstexte',
      onClick: () => {
        router.push('/docs/pitch-generation');
      },
      variant: 'outline' as const,
    },
    {
      id: 'view-docs',
      icon: <BookOpen className="h-5 w-5" />,
      label: 'Dokumentation',
      description: 'Best Practices für Referenz-Dokumentation',
      onClick: () => {
        router.push('/docs/references');
      },
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <EmptyState
        icon={<FolderKanban className="h-12 w-12" />}
        title="Keine Referenzen vorhanden"
        description="Referenzen stärken Ihre Angebote. Die AI verwendet dokumentierte Projekterfolge, um überzeugende Pitch-Texte mit passenden Beispielen zu generieren."
        variant="info"
        actions={[
          {
            label: 'Referenz anlegen',
            onClick: () => router.push('/references/new'),
            variant: 'default',
            icon: <Plus className="h-4 w-4" />,
          },
        ]}
      />

      <SuggestedActions
        title="Referenzen im Einsatz"
        description="So nutzt die AI Ihre Projekterfahrung"
        actions={suggestions}
        columns={3}
      />
    </div>
  );
}
