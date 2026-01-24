import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  Monitor,
  Package,
  Truck,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAgentResult } from '@/lib/agents/expert-agents';
import {
  DeliverablesAnalysisSchema,
  type Deliverable,
  type DeliverablesAnalysis,
} from '@/lib/agents/expert-agents/deliverables-schema';
import { auth } from '@/lib/auth';
import { extractedRequirementsSchema } from '@/lib/extraction/schema';
import { getCachedRfp } from '@/lib/pre-qualifications/cached-queries';

const categoryLabels: Record<string, string> = {
  proposal_document: 'Proposal Dokumente',
  commercial: 'Kommerzielle Unterlagen',
  legal: 'Rechtliche Dokumente',
  technical: 'Technische Dokumente',
  reference: 'Referenzen',
  administrative: 'Administrative Unterlagen',
  presentation: 'Präsentation',
};

const submissionMethodLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  email: { label: 'E-Mail', icon: <Mail className="h-4 w-4" /> },
  portal: { label: 'Online-Portal', icon: <Monitor className="h-4 w-4" /> },
  physical: { label: 'Postalisch', icon: <Truck className="h-4 w-4" /> },
  unknown: { label: 'Nicht angegeben', icon: <AlertCircle className="h-4 w-4" /> },
};

function groupDeliverablesByCategory(deliverables: Deliverable[]): Record<string, Deliverable[]> {
  return deliverables.reduce(
    (acc, d) => {
      const cat = d.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(d);
      return acc;
    },
    {} as Record<string, Deliverable[]>
  );
}

function ExpertAgentDisplay({ analysis }: { analysis: DeliverablesAnalysis }) {
  const grouped = groupDeliverablesByCategory(analysis.deliverables);
  const submission =
    submissionMethodLabels[analysis.primarySubmissionMethod] || submissionMethodLabels.unknown;

  return (
    <div className="space-y-6">
      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Übersicht Einreichungsunterlagen
          </CardTitle>
          <CardDescription>Analyse durch Deliverables Expert Agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{analysis.totalCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Verpflichtend</p>
                <p className="text-2xl font-bold">{analysis.mandatoryCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Optional</p>
                <p className="text-2xl font-bold">{analysis.optionalCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {submission.icon}
              <div>
                <p className="text-sm text-muted-foreground">Einreichung</p>
                <p className="text-lg font-semibold">{submission.label}</p>
              </div>
            </div>
          </div>

          {/* Submission details */}
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis.submissionEmail && (
              <Badge variant="outline" className="gap-1">
                <Mail className="h-3 w-3" />
                {analysis.submissionEmail}
              </Badge>
            )}
            {analysis.portalUrl && (
              <Badge variant="outline" className="gap-1">
                <Monitor className="h-3 w-3" />
                {analysis.portalUrl}
              </Badge>
            )}
            {analysis.estimatedEffortHours && (
              <Badge variant="secondary">
                Geschätzter Aufwand: {analysis.estimatedEffortHours}h
              </Badge>
            )}
            <Badge variant="secondary">Konfidenz: {analysis.confidence}%</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Deliverables by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Deliverables nach Kategorie</CardTitle>
          <CardDescription>Alle geforderten Unterlagen gruppiert nach Typ</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={Object.keys(grouped)} className="w-full">
            {Object.entries(grouped).map(([category, deliverables]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{categoryLabels[category] || category}</span>
                    <Badge variant="secondary" className="ml-2">
                      {deliverables.length}
                    </Badge>
                    {deliverables.some(d => d.mandatory) && (
                      <Badge variant="destructive" className="text-xs">
                        {deliverables.filter(d => d.mandatory).length} verpflichtend
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {deliverables.map(d => (
                      <div
                        key={d.id}
                        className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{d.name}</p>
                              {d.mandatory ? (
                                <Badge variant="destructive" className="text-xs">
                                  Pflicht
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Optional
                                </Badge>
                              )}
                            </div>
                            {d.description && (
                              <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {d.format && (
                                <Badge variant="outline" className="text-xs">
                                  {d.format}
                                </Badge>
                              )}
                              {d.pageLimit && (
                                <Badge variant="outline" className="text-xs">
                                  max. {d.pageLimit} Seiten
                                </Badge>
                              )}
                              {d.copies && d.copies > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  {d.copies}x
                                </Badge>
                              )}
                              {d.deadline && (
                                <Badge variant="outline" className="text-xs">
                                  Deadline: {d.deadline}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {d.confidence}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const rfp = await getCachedRfp(id);

  if (!rfp) {
    notFound();
  }

  if (rfp.userId !== session.user.id) {
    notFound();
  }

  // Try to get expert agent result first
  const agentResult = await getAgentResult(id, 'deliverables_expert');
  let expertAnalysis: DeliverablesAnalysis | null = null;

  if (agentResult?.metadata) {
    const parseResult = DeliverablesAnalysisSchema.safeParse(agentResult.metadata);
    if (parseResult.success) {
      expertAnalysis = parseResult.data;
    }
  }

  // Fallback: Parse extracted requirements
  const parseResult = rfp.extractedRequirements
    ? extractedRequirementsSchema.safeParse(JSON.parse(rfp.extractedRequirements))
    : null;

  if (parseResult && !parseResult.success) {
    console.error('Invalid extracted requirements:', parseResult.error);
  }

  const extractedReqs = parseResult?.success ? parseResult.data : null;
  const deliverables = extractedReqs?.requiredDeliverables || [];
  const mandatoryDeliverables = deliverables.filter(d => d.mandatory);
  const optionalDeliverables = deliverables.filter(d => !d.mandatory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deliverables & Unterlagen</h1>
        <p className="text-muted-foreground">Einzureichende Unterlagen und Projekt-Lieferumfang</p>
      </div>

      {/* Expert Agent Display (if available) */}
      {expertAnalysis ? (
        <ExpertAgentDisplay analysis={expertAnalysis} />
      ) : (
        <>
          {/* No Deliverables Alert */}
          {deliverables.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Keine Deliverables gefunden</AlertTitle>
              <AlertDescription>
                Die automatische Extraktion hat keine spezifischen Deliverables mit ausreichender
                Konfidenz identifiziert. <strong>Bitte manuell prüfen:</strong> Kontrollieren Sie
                die Originaldokumente auf Anforderungen zu einzureichenden Unterlagen.
              </AlertDescription>
            </Alert>
          )}

          {/* Statistics Card */}
          {deliverables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Übersicht Einreichungsunterlagen
                </CardTitle>
                <CardDescription>Zusammenfassung der geforderten Deliverables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Gesamt</p>
                      <p className="text-2xl font-bold">{deliverables.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Verpflichtend</p>
                      <p className="text-2xl font-bold">{mandatoryDeliverables.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Optional</p>
                      <p className="text-2xl font-bold">{optionalDeliverables.length}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mandatory Deliverables Table */}
          {mandatoryDeliverables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Verpflichtende Unterlagen
                </CardTitle>
                <CardDescription>Diese Unterlagen MÜSSEN eingereicht werden</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Anzahl</TableHead>
                      <TableHead className="text-right">Konfidenz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mandatoryDeliverables.map((deliverable, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{deliverable.name}</p>
                            {deliverable.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {deliverable.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {deliverable.format ? (
                            <Badge variant="outline">{deliverable.format}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nicht angegeben</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deliverable.deadline ? (
                            <div>
                              <p className="text-sm">
                                {new Date(deliverable.deadline).toLocaleDateString('de-DE', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              {deliverable.deadlineTime && (
                                <p className="text-xs text-muted-foreground">
                                  {deliverable.deadlineTime}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nicht angegeben</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deliverable.copies ? (
                            <span className="text-sm">{deliverable.copies}x</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">1x</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{deliverable.confidence}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Optional Deliverables Table */}
          {optionalDeliverables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Optionale Unterlagen
                </CardTitle>
                <CardDescription>
                  Diese Unterlagen sind optional oder empfohlen, aber nicht verpflichtend
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Anzahl</TableHead>
                      <TableHead className="text-right">Konfidenz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optionalDeliverables.map((deliverable, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{deliverable.name}</p>
                            {deliverable.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {deliverable.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {deliverable.format ? (
                            <Badge variant="outline">{deliverable.format}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nicht angegeben</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deliverable.deadline ? (
                            <div>
                              <p className="text-sm">
                                {new Date(deliverable.deadline).toLocaleDateString('de-DE', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              {deliverable.deadlineTime && (
                                <p className="text-xs text-muted-foreground">
                                  {deliverable.deadlineTime}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nicht angegeben</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deliverable.copies ? (
                            <span className="text-sm">{deliverable.copies}x</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">1x</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{deliverable.confidence}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Project Scope / Lieferumfang Section */}
      {extractedReqs?.scope && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Projekt-Lieferumfang
            </CardTitle>
            <CardDescription>Erwartete Leistungen und Ergebnisse des Projekts</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{extractedReqs.scope}</p>

            {extractedReqs.keyRequirements && extractedReqs.keyRequirements.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2 text-sm">Schlüsselanforderungen</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {extractedReqs.keyRequirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {extractedReqs.constraints && extractedReqs.constraints.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2 text-sm">Einschränkungen & Constraints</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {extractedReqs.constraints.map((constraint, idx) => (
                    <li key={idx}>{constraint}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
