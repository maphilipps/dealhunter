import { AlertCircle, Award, Building2, Calendar, CheckCircle2, Briefcase } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { getCachedRfp } from '@/lib/rfps/cached-queries';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

export default async function ReferencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP (cached - shares query with layout)
  const rfp = await getCachedRfp(id);

  if (!rfp) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">RFP nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte RFP konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Keine Berechtigung</h1>
        <p className="text-muted-foreground">
          Sie haben keine Berechtigung, diesen RFP anzuzeigen.
        </p>
      </div>
    );
  }

  // Parse extracted requirements
  const extractedReqs: ExtractedRequirements | null = rfp.extractedRequirements
    ? (JSON.parse(rfp.extractedRequirements) as ExtractedRequirements)
    : null;

  // Extract reference-related information from key requirements
  const keyRequirements = extractedReqs?.keyRequirements || [];
  const referenceRequirements = keyRequirements.filter(
    req =>
      req.toLowerCase().includes('referenz') ||
      req.toLowerCase().includes('reference') ||
      req.toLowerCase().includes('projekt') && req.toLowerCase().includes('erfahrung')
  );

  // Try to extract structured reference information
  const hasReferenceRequirements = referenceRequirements.length > 0;

  // Extract industry and technology info for reference criteria
  const industry = extractedReqs?.industry;
  const technologies = extractedReqs?.technologies || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referenzen</h1>
        <p className="text-muted-foreground">Geforderte Referenzen und Kriterien</p>
      </div>

      {/* No Reference Requirements Alert */}
      {!hasReferenceRequirements && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Referenz-Anforderungen identifiziert</AlertTitle>
          <AlertDescription>
            Die Anforderungsextraktion hat keine spezifischen Referenz-Anforderungen erkannt. Dies
            könnte bedeuten, dass das Dokument keine expliziten Referenzprojekt-Anforderungen
            enthält.
          </AlertDescription>
        </Alert>
      )}

      {/* Reference Requirements Card */}
      {hasReferenceRequirements && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Referenz-Anforderungen
            </CardTitle>
            <CardDescription>Erforderliche Referenzprojekte und Kriterien</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Requirements List */}
            <div>
              <h4 className="font-semibold mb-2 text-sm">Identifizierte Anforderungen</h4>
              <ul className="space-y-2">
                {referenceRequirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Anforderungen</p>
                  <p className="text-2xl font-bold">{referenceRequirements.length}</p>
                </div>
              </div>
              {industry && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Branche</p>
                    <p className="font-medium">{industry}</p>
                  </div>
                </div>
              )}
              {technologies.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Technologien</p>
                    <p className="font-medium">{technologies.length}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expected Criteria Card */}
      {(industry || technologies.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Erwartete Referenz-Kriterien
            </CardTitle>
            <CardDescription>
              Basierend auf den extrahierten Anforderungen abgeleitete Kriterien
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Industry Match */}
            {industry && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">Branchen-Erfahrung</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Referenzen sollten Projekte in der Branche <Badge variant="outline">{industry}</Badge> enthalten
                </p>
              </div>
            )}

            {/* Technology Match */}
            {technologies.length > 0 && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">Technologie-Erfahrung</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Referenzen sollten Erfahrung mit folgenden Technologien nachweisen:
                </p>
                <div className="flex flex-wrap gap-2">
                  {technologies.slice(0, 10).map((tech, idx) => (
                    <Badge key={idx} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                  {technologies.length > 10 && (
                    <Badge variant="outline">+{technologies.length - 10} weitere</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            {extractedReqs?.timeline && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">Zeitraum-Anforderungen</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Projektzeitraum: <span className="font-medium">{extractedReqs.timeline}</span>
                </p>
              </div>
            )}

            {/* Project Scope */}
            {extractedReqs?.scope && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">Projekt-Umfang</h4>
                </div>
                <p className="text-sm text-muted-foreground">{extractedReqs.scope}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Requirements for Context */}
      {keyRequirements.length > referenceRequirements.length && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Weitere Anforderungen
            </CardTitle>
            <CardDescription>
              Weitere Anforderungen, die bei der Referenz-Auswahl berücksichtigt werden sollten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {keyRequirements
                .filter(req => !referenceRequirements.includes(req))
                .map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
