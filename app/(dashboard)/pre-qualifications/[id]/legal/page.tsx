import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  HelpCircle,
  Lightbulb,
  Scale,
  Shield,
  ShieldAlert,
  XCircle,
  XOctagon,
} from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { getAgentResult, type LegalRfpAnalysis } from '@/lib/agents/expert-agents';
import { auth } from '@/lib/auth';
import { getCachedPreQualificationWithRelations } from '@/lib/pre-qualifications/cached-queries';
import { parseJsonField } from '@/lib/utils/json';

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

const categoryLabels: Record<string, string> = {
  contract_terms: 'Vertragsbedingungen',
  compliance: 'Compliance',
  insurance: 'Versicherung',
  certification: 'Zertifizierungen',
  nda_ip: 'NDA & Geistiges Eigentum',
  subcontracting: 'Unteraufträge',
  payment_terms: 'Zahlungsbedingungen',
  warranty: 'Gewährleistung & SLA',
  data_protection: 'Datenschutz',
  other: 'Sonstige',
};

function getRiskBadgeVariant(
  level: 'low' | 'medium' | 'high' | 'critical'
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (level) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'default';
  }
}

function getRiskBadgeClassName(level: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (level) {
    case 'critical':
      return 'bg-red-600 hover:bg-red-700';
    case 'high':
      return 'bg-orange-500 hover:bg-orange-600';
    case 'medium':
      return 'bg-yellow-500 hover:bg-yellow-600 text-black';
    case 'low':
      return 'bg-green-600 hover:bg-green-700';
  }
}

function getRiskLabel(level: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (level) {
    case 'critical':
      return 'Kritisch';
    case 'high':
      return 'Hoch';
    case 'medium':
      return 'Mittel';
    case 'low':
      return 'Niedrig';
  }
}

export default async function LegalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get Pre-Qualification with relations (cached and parallelized)
  const [{ preQualification, quickScan }, legalAgentRow] = await Promise.all([
    getCachedPreQualificationWithRelations(id),
    getAgentResult(id, 'legal_rfp_expert'),
  ]);

  // Parse the legal agent result from metadata
  const legalAgentResult = legalAgentRow?.metadata as LegalRfpAnalysis | null;

  if (!preQualification) {
    notFound();
  }

  // Check ownership
  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Parse legal compliance
  const legalCompliance = parseJsonField<LegalCompliance | null>(quickScan?.legalCompliance, null);

  // Parse extracted requirements
  const extractedReqs = parseJsonField<ExtractedRequirements | null>(
    preQualification.extractedRequirements,
    null
  );

  // Group requirements by category
  type LegalRequirement = LegalRfpAnalysis['requirements'][number];
  const requirementsByCategory = legalAgentResult?.requirements?.reduce(
    (acc: Record<string, LegalRequirement[]>, req: LegalRequirement) => {
      if (!acc[req.category]) {
        acc[req.category] = [];
      }
      acc[req.category].push(req);
      return acc;
    },
    {} as Record<string, LegalRequirement[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Legal & Compliance</h1>
        <p className="text-muted-foreground">Rechtliche Anforderungen und Compliance-Vorgaben</p>
      </div>

      {/* Expert Agent Analysis */}
      {legalAgentResult && (
        <>
          {/* Risk Overview Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Risiko-Übersicht
                </CardTitle>
                <Badge className={getRiskBadgeClassName(legalAgentResult.overallRiskLevel)}>
                  {getRiskLabel(legalAgentResult.overallRiskLevel)}
                </Badge>
              </div>
              <CardDescription>
                Bewertung der rechtlichen Risiken aus dem Pre-Qualification-Dokument (Konfidenz:{' '}
                {legalAgentResult.confidence}%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <XOctagon className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {legalAgentResult.dealBreakers?.length ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Deal Breaker</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {legalAgentResult.riskFactors?.length ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Risikofaktoren</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Scale className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {legalAgentResult.requirements?.length ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Anforderungen</p>
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              {(legalAgentResult.riskFactors?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Risikofaktoren</h4>
                  <ul className="space-y-1">
                    {legalAgentResult.riskFactors.map((factor, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deal Breakers Card - Red themed */}
          {(legalAgentResult.dealBreakers?.length ?? 0) > 0 && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <XOctagon className="h-5 w-5" />
                  Deal Breaker
                </CardTitle>
                <CardDescription className="text-red-600 dark:text-red-400">
                  Kritische Punkte, die das Angebot gefährden könnten
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {legalAgentResult.dealBreakers.map((breaker, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-red-200 bg-white p-3 dark:border-red-800 dark:bg-red-950/50"
                    >
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                      <span className="text-sm font-medium">{breaker}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Contract Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Vertragsdetails
              </CardTitle>
              <CardDescription>Wichtige vertragliche Rahmenbedingungen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {legalAgentResult.contractDetails.contractType && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Vertragsart</p>
                    <p className="text-sm">{legalAgentResult.contractDetails.contractType}</p>
                  </div>
                )}
                {legalAgentResult.contractDetails.duration && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Laufzeit</p>
                    <p className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      {legalAgentResult.contractDetails.duration}
                    </p>
                  </div>
                )}
                {legalAgentResult.contractDetails.terminationNotice && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Kündigungsfrist</p>
                    <p className="text-sm">{legalAgentResult.contractDetails.terminationNotice}</p>
                  </div>
                )}
                {legalAgentResult.contractDetails.liabilityLimit && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Haftungslimit</p>
                    <p className="text-sm">{legalAgentResult.contractDetails.liabilityLimit}</p>
                  </div>
                )}
              </div>

              {/* Penalty Clauses */}
              {legalAgentResult.contractDetails?.penaltyClauses &&
                (legalAgentResult.contractDetails.penaltyClauses?.length ?? 0) > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Vertragsstrafen</p>
                      <ul className="space-y-2">
                        {legalAgentResult.contractDetails.penaltyClauses.map((penalty, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-lg bg-orange-50 p-2 text-sm dark:bg-orange-950/30"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                            <span>{penalty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>

          {/* Requirements Cards - Certifications & Insurance */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Required Certifications */}
            {(legalAgentResult.requiredCertifications?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Geforderte Zertifizierungen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {legalAgentResult.requiredCertifications.map((cert, idx) => (
                      <Badge key={idx} variant="outline" className="text-sm">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Required Insurance */}
            {(legalAgentResult.requiredInsurance?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Versicherungsanforderungen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {legalAgentResult.requiredInsurance.map((insurance, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">{insurance.type}</p>
                          {insurance.minAmount && (
                            <p className="text-xs text-muted-foreground">
                              Mindestdeckung: {insurance.minAmount}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Legal Requirements Accordion by Category */}
          {requirementsByCategory && Object.keys(requirementsByCategory).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Rechtliche Anforderungen nach Kategorie
                </CardTitle>
                <CardDescription>
                  Detaillierte Aufschlüsselung aller identifizierten rechtlichen Anforderungen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {Object.entries(requirementsByCategory).map(([category, reqs]) => (
                    <AccordionItem key={category} value={category}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span>{categoryLabels[category] || category}</span>
                          <Badge variant="secondary" className="text-xs">
                            {reqs.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-3">
                          {reqs.map((req, idx) => (
                            <li key={idx} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium">{req.requirement}</p>
                                <div className="flex shrink-0 gap-2">
                                  {req.mandatory && (
                                    <Badge variant="destructive" className="text-xs">
                                      Pflicht
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={getRiskBadgeVariant(req.riskLevel)}
                                    className={`text-xs ${getRiskBadgeClassName(req.riskLevel)}`}
                                  >
                                    {getRiskLabel(req.riskLevel)}
                                  </Badge>
                                </div>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {req.implication}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground italic">
                                &ldquo;{req.rawText}&rdquo;
                              </p>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Questions for Legal Card */}
          {(legalAgentResult.questionsForLegal?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Fragen für die Rechtsabteilung
                </CardTitle>
                <CardDescription>
                  Offene Punkte, die vor der Abgabe geklärt werden sollten
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {legalAgentResult.questionsForLegal.map((question, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {idx + 1}
                      </span>
                      <span className="text-sm">{question}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Recommendations Card */}
          {(legalAgentResult.recommendations?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Empfehlungen
                </CardTitle>
                <CardDescription>Handlungsempfehlungen für die Angebotsabgabe</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {legalAgentResult.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Separator />
          <h2 className="text-xl font-semibold">Website-Compliance (Quick Scan)</h2>
        </>
      )}

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
                      <span>
                        Cookie-Consent Tool: {legalCompliance.gdprIndicators.cookieConsentTool}
                      </span>
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

      {/* Legal Requirements from Pre-Qualification */}
      {extractedReqs?.legalRequirements && extractedReqs.legalRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Rechtliche Anforderungen
            </CardTitle>
            <CardDescription>Aus dem Pre-Qualification-Dokument extrahierte rechtliche Vorgaben</CardDescription>
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
      {!legalAgentResult &&
        !legalCompliance &&
        !extractedReqs?.legalRequirements &&
        !extractedReqs?.complianceRequirements &&
        !extractedReqs?.contractualClauses &&
        !extractedReqs?.insuranceRequirements &&
        !extractedReqs?.certifications && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Keine rechtlichen Informationen verfügbar</AlertTitle>
            <AlertDescription>
              Der Quick Scan oder die Expertenanalyse muss zuerst durchgeführt werden, bevor
              rechtliche Informationen und Compliance-Analysen verfügbar sind.
            </AlertDescription>
          </Alert>
        )}
    </div>
  );
}
