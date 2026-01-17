'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBusinessLines } from '@/lib/admin/business-lines-actions';
import { BusinessLineList } from '@/components/admin/business-line-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function BusinessLinesPage() {
  const router = useRouter();
  const [businessLines, setBusinessLines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const result = await getBusinessLines();
      if (result.success) {
        setBusinessLines(result.businessLines || []);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Business Lines</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre Business Lines und deren Zuordnungen
            </p>
          </div>
          <Button onClick={() => router.push('/admin/business-lines/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Business Line
          </Button>
        </div>

        <BusinessLineList businessLines={businessLines} />
      </div>
    </div>
  );
}
