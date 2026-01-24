import { Globe, FileText, Camera, ExternalLink } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { ScreenshotGallery } from './screenshot-gallery';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { getCachedRfpWithRelations } from '@/lib/rfps/cached-queries';

interface ContentVolumeData {
  totalPages?: number;
  totalWords?: number;
  totalImages?: number;
  totalLinks?: number;
  avgWordsPerPage?: number;
  contentTypes?: {
    [key: string]: number;
  };
}

// Helper to parse JSON fields safely
function parseJsonField<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object') {
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export default async function FactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP with relations (cached and parallelized)
  const { rfp, quickScan } = await getCachedRfpWithRelations(id);

  if (!rfp) {
    notFound();
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    notFound();
  }

  // Parse content volume and screenshots
  const contentVolume = quickScan
    ? parseJsonField<ContentVolumeData>(quickScan.contentVolume)
    : null;
  const screenshots = quickScan ? parseJsonField<string[]>(quickScan.screenshots) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Facts</h1>
        <p className="text-muted-foreground">Analysierte Informationen über die Ziel-Website</p>
      </div>

      {/* Website URL Card */}
      {quickScan?.websiteUrl && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <CardTitle>Website URL</CardTitle>
            </div>
            <CardDescription>Ziel-Website für die Migration/Analyse</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <a
                href={quickScan.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
              >
                {quickScan.websiteUrl}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Volume Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            <CardTitle>Content Volume</CardTitle>
          </div>
          <CardDescription>Statistiken über den Website-Inhalt</CardDescription>
        </CardHeader>
        <CardContent>
          {contentVolume ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {contentVolume.totalPages !== undefined && (
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-3xl font-bold text-slate-900">
                    {contentVolume.totalPages.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Seiten</p>
                </div>
              )}
              {contentVolume.totalWords !== undefined && (
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-900">
                    {contentVolume.totalWords.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Wörter</p>
                </div>
              )}
              {contentVolume.totalImages !== undefined && (
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-900">
                    {contentVolume.totalImages.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Bilder</p>
                </div>
              )}
              {contentVolume.totalLinks !== undefined && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-900">
                    {contentVolume.totalLinks.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Links</p>
                </div>
              )}
              {contentVolume.avgWordsPerPage !== undefined && (
                <div className="text-center p-4 bg-orange-50 rounded-lg col-span-2">
                  <p className="text-3xl font-bold text-orange-900">
                    {Math.round(contentVolume.avgWordsPerPage).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Ø Wörter pro Seite</p>
                </div>
              )}
              {contentVolume.contentTypes && Object.keys(contentVolume.contentTypes).length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">Content-Typen</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(contentVolume.contentTypes).map(([type, count]) => (
                      <Badge key={type} variant="outline">
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Content Volume-Daten verfügbar. Bitte führen Sie einen Quick Scan durch.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Screenshots Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            <CardTitle>Screenshots</CardTitle>
          </div>
          <CardDescription>Website-Screenshots aus dem Scan</CardDescription>
        </CardHeader>
        <CardContent>
          {screenshots && screenshots.length > 0 ? (
            <ScreenshotGallery screenshots={screenshots} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Screenshots verfügbar. Bitte führen Sie einen Quick Scan durch.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
