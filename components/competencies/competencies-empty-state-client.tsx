/**
 * Competencies Empty State Client Component
 *
 * Client-side empty state with suggested actions for capability discovery.
 * Used when no competencies are available.
 */

'use client';

import { Sparkles, Plus, Users, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { SuggestedActions } from '@/components/ui/suggested-actions';

export function CompetenciesEmptyStateClient() {
  const router = useRouter();

  const suggestions = [
    {
      id: 'create-competency',
      icon: <Plus className="h-5 w-5" />,
      label: 'Kompetenz erfassen',
      description: 'Neue Kompetenz mit Level und Zertifizierungen anlegen',
      onClick: () => {
        router.push('/competencies/new');
      },
      variant: 'default' as const,
    },
    {
      id: 'team-matching',
      icon: <Users className="h-5 w-5" />,
      label: 'Team-Matching',
      description: 'AI nutzt Kompetenzen für optimale Team-Zusammenstellung',
      onClick: () => {
        router.push('/docs/team-matching');
      },
      variant: 'outline' as const,
    },
    {
      id: 'view-docs',
      icon: <BookOpen className="h-5 w-5" />,
      label: 'Dokumentation',
      description: 'Mehr über Kompetenz-basiertes Matching erfahren',
      onClick: () => {
        router.push('/docs/competencies');
      },
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <EmptyState
        icon={<Sparkles className="h-12 w-12" />}
        title="Keine Kompetenzen erfasst"
        description="Kompetenzen ermöglichen intelligentes Team-Matching. Die AI schlägt basierend auf Projektanforderungen passende Teammitglieder vor."
        variant="info"
        actions={[
          {
            label: 'Kompetenz erfassen',
            onClick: () => router.push('/competencies/new'),
            variant: 'default',
            icon: <Plus className="h-4 w-4" />,
          },
        ]}
      />

      <SuggestedActions
        title="Warum Kompetenzen?"
        description="So unterstützt AI das Matching"
        actions={suggestions}
        columns={3}
      />
    </div>
  );
}
