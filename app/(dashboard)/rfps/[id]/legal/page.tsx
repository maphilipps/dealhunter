import { AlertCircle, CheckCircle2, FileText, Scale, Shield, XCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { auth } from '@/lib/auth';
import { getCachedRfpWithRelations } from '@/lib/rfps/cached-queries';

interface LegalCompliance {
  score: number;
  checks: {
    hasImprint?: boolean;
    hasPrivacyPolicy?: boolean;
    hasCookieBanner?: boolean;
    hasTermsOfService?: boolean;
    hasAccessibilityStatement?: boolean;
  };
  gdprIndicators?: {
    cookieConsentTool?: string;
    analyticsCompliant?: boolean;
    hasDataProcessingInfo?: boolean;
  };
  issues?: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
  }>;
}

interface ExtractedRequirements {
  legalRequirements?: string[];
  complianceRequirements?: string[];
  contractualClauses?: string[];
  insuranceRequirements?: string[];
  certifications?: string[];
}

export default async function LegalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP with relations (cached and parallelized)
  const { rfp, quickScan } = await getCachedRfpWithRelations(id);

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

  // Parse legal compliance
  const legalCompliance: LegalCompliance | null = quickScan?.legalCompliance
    ? (JSON.parse(quickScan.legalCompliance) as LegalCompliance)
    : null;

  // Parse extracted requirements
  const extractedReqs: ExtractedRequirements | null = rfp.extractedRequirements
    ? (JSON.parse(rfp.extractedRequirements) as ExtractedRequirements)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Legal & Compliance</h1>
        <p className="text-muted-foreground">Rechtliche Anforderungen und Compliance-Vorgaben</p>
      </div>

      {/* Legal Compliance Score */}
      {legalCompliance && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance-Score
              </CardTitle>
              <Badge
                variant={
                  legalCompliance.score >= 80
                    ? 'default'
                    : legalCompliance.score >= 60
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {legalCompliance.score}%
              </Badge>
            </div>
            <CardDescription>Automatische GDPR- und Rechtskonformitäts-Prüfung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={legalCompliance.score} className="h-2" />

            {/* Legal Checks */}
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(legalCompliance.checks).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                  {value ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    {key === 'hasImprint' && 'Impressum'}
                    {key === 'hasPrivacyPolicy' && 'Datenschutzerklärung'}
                    {key === 'hasCookieBanner' && 'Cookie-Banner'}
                    {key === 'hasTermsOfService' && 'AGB'}
                    {key === 'hasAccessibilityStatement' && 'Barrierefreiheitserklärung'}
                  </span>
                </div>
              ))}
            </div>

            {/* GDPR Indicators */}
            {legalCompliance.gdprIndicators && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">GDPR-Indikatoren</h4>
                <div className="grid gap-2">
                  {legalCompliance.gdprIndicators.cookieConsentTool && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Cookie-Consent Tool: {legalCompliance.gdprIndicators.cookieConsentTool}</span>
                    </div>
                  )}
                  {legalCompliance.gdprIndicators.analyticsCompliant && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Analytics GDPR-konform</span>
                    </div>
                  )}
                  {legalCompliance.gdprIndicators.hasDataProcessingInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Datenverarbeitungshinweise vorhanden</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Issues */}
            {legalCompliance.issues && legalCompliance.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Identifizierte Probleme</h4>
                {legalCompliance.issues.map((issue, idx) => (
                  <Alert
                    key={idx}
                    variant={issue.severity === 'critical' ? 'destructive' : 'default'}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="capitalize">{issue.severity}</AlertTitle>
                    <AlertDescription>{issue.description}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legal Requirements from RFP */}
      {extractedReqs?.legalRequirements && extractedReqs.legalRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Rechtliche Anforderungen
            </CardTitle>
            <CardDescription>Aus dem RFP-Dokument extrahierte rechtliche Vorgaben</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {extractedReqs.legalRequirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Compliance Requirements */}
      {extractedReqs?.complianceRequirements && extractedReqs.complianceRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance-Vorgaben
            </CardTitle>
            <CardDescription>Einzuhaltende Standards und Zertifizierungen</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {extractedReqs.complianceRequirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Contractual Clauses */}
      {extractedReqs?.contractualClauses && extractedReqs.contractualClauses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vertragsklauseln
            </CardTitle>
            <CardDescription>Besondere vertragliche Bedingungen</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {extractedReqs.contractualClauses.map((clause, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <span className="text-sm">{clause}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Insurance Requirements */}
      {extractedReqs?.insuranceRequirements && extractedReqs.insuranceRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Versicherungsanforderungen</CardTitle>
            <CardDescription>Geforderte Versicherungen und Deckungssummen</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {extractedReqs.insuranceRequirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      {extractedReqs?.certifications && extractedReqs.certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zertifizierungen</CardTitle>
            <CardDescription>Geforderte Zertifikate und Nachweise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {extractedReqs.certifications.map((cert, idx) => (
                <Badge key={idx} variant="outline">
                  {cert}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Available */}
      {!legalCompliance &&
        !extractedReqs?.legalRequirements &&
        !extractedReqs?.complianceRequirements &&
        !extractedReqs?.contractualClauses &&
        !extractedReqs?.insuranceRequirements &&
        !extractedReqs?.certifications && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Keine rechtlichen Informationen verfügbar</AlertTitle>
            <AlertDescription>
              Der Quick Scan muss zuerst durchgeführt werden, bevor rechtliche Informationen und
              Compliance-Analysen verfügbar sind.
            </AlertDescription>
          </Alert>
        )}
    </div>
  );
}
