import { AlertCircle, CheckCircle2, Clock, FileText, Package } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

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
import { auth } from '@/lib/auth';
import { getCachedRfp } from '@/lib/rfps/cached-queries';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP (cached - shares query with layout)
  const rfp = await getCachedRfp(id);

  if (!rfp) {
    notFound();
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    notFound();
  }

  // Parse extracted requirements
  const extractedReqs: ExtractedRequirements | null = rfp.extractedRequirements
    ? (JSON.parse(rfp.extractedRequirements) as ExtractedRequirements)
    : null;

  const deliverables = extractedReqs?.requiredDeliverables || [];
  const mandatoryDeliverables = deliverables.filter(d => d.mandatory);
  const optionalDeliverables = deliverables.filter(d => !d.mandatory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deliverables & Unterlagen</h1>
        <p className="text-muted-foreground">
          Einzureichende Unterlagen und Projekt-Lieferumfang
        </p>
      </div>

      {/* No Deliverables Alert */}
      {deliverables.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Deliverables gefunden</AlertTitle>
          <AlertDescription>
            Die Anforderungsextraktion hat keine spezifischen Deliverables identifiziert. Dies
            könnte bedeuten, dass das Dokument keine expliziten Unterlagen-Anforderungen enthält.
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
