'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { TechnologyList } from '@/components/admin/technology-list';
import { Button } from '@/components/ui/button';
import { getTechnologies } from '@/lib/admin/technologies-actions';

type Technology = {
  id: string;
  name: string;
  baselineHours: number | null;
  baselineName: string | null;
  baselineEntityCounts: string | null;
  isDefault: boolean;
  createdAt: Date | null;
  businessUnitId: string;
  businessLineName: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  category: string | null;
  license: string | null;
  latestVersion: string | null;
  githubUrl: string | null;
  githubStars: number | null;
  communitySize: string | null;
  researchStatus: string | null;
  lastResearchedAt: Date | null;
};

export default function TechnologiesPage() {
  const router = useRouter();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const result = await getTechnologies();
      if (result.success) {
        setTechnologies(result.technologies || []);
      }
      setIsLoading(false);
    }
    void loadData();
  }, []);

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Technologien</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Technologie-Stacks und Baseline-Konfigurationen
            </p>
          </div>
          <Button onClick={() => router.push('/admin/technologies/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Technologie
          </Button>
        </div>

        <TechnologyList technologies={technologies} />
      </div>
    </div>
  );
}
