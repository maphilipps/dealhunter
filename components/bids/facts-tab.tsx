'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, Globe, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { QuickScan } from '@/lib/db/schema';
import { retriggerQuickScan } from '@/lib/quick-scan/actions';
import { QuickScanRenderer, type RenderTree } from '@/components/json-render/quick-scan-registry';

interface FactsTabProps {
  quickScan: QuickScan;
  bidId: string;
}

/**
 * Facts Tab Component - AI-Generated json-render Visualization
 *
 * Lädt die AI-generierte Visualisierung vom API Endpoint und rendert sie
 * mit dem QuickScanRenderer.
 */
export function FactsTab({ quickScan, bidId }: FactsTabProps) {
  const [isRetriggering, setIsRetriggering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tree, setTree] = useState<RenderTree | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load AI visualization on mount
  useEffect(() => {
    async function loadVisualization() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/rfps/${bidId}/facts-visualization`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Visualisierung konnte nicht geladen werden');
        }

        if (data.tree) {
          setTree(data.tree);
        } else {
          setError('Keine Visualisierungs-Daten verfügbar');
        }
      } catch (err) {
        console.error('Failed to load visualization:', err);
        setError(err instanceof Error ? err.message : 'Visualisierung fehlgeschlagen');
      } finally {
        setIsLoading(false);
      }
    }

    loadVisualization();
  }, [bidId]);

  const handleRetrigger = async () => {
    setIsRetriggering(true);
    toast.info('Starte Quick Scan erneut...');
    try {
      const result = await retriggerQuickScan(bidId);
      if (result.success) {
        toast.success('Quick Scan gestartet - bitte warten...');
        window.location.reload();
      } else {
        toast.error(result.error || 'Quick Scan Re-Trigger fehlgeschlagen');
        setIsRetriggering(false);
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
      setIsRetriggering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <CardTitle>Website-Analyse</CardTitle>
              <Badge variant="outline" className="ml-2">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Visualisierung
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetrigger}
                disabled={isRetriggering}
              >
                {isRetriggering ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Erneut scannen
              </Button>
              <Badge variant={quickScan.status === 'completed' ? 'default' : 'destructive'}>
                {quickScan.status === 'completed' ? 'Abgeschlossen' : 'Fehlgeschlagen'}
              </Badge>
            </div>
          </div>
          <CardDescription>Analyse von {quickScan.websiteUrl}</CardDescription>
        </CardHeader>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <div className="text-center">
                <p className="font-medium text-blue-900">Generiere AI-Visualisierung...</p>
                <p className="text-sm text-blue-700 mt-1">
                  Die Analyse-Daten werden in eine kreative Darstellung umgewandelt
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Visualisierung fehlgeschlagen</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.location.reload()}
                >
                  Erneut versuchen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI-Generated Visualization */}
      {tree && !isLoading && <QuickScanRenderer tree={tree} />}
    </div>
  );
}
