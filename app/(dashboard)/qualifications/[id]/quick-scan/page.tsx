import { eq } from 'drizzle-orm';
import { ExternalLink, Building2, Globe, FileText, Users, Target, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  qualifications,
  websiteAudits,
  businessUnits,
  preQualifications,
  quickScans,
} from '@/lib/db/schema';

interface ContentType {
  type?: string;
  count?: number;
}

interface NavigationItem {
  label?: string;
  name?: string;
}

interface NavigationStructure {
  levels?: number;
  mainMenuItems?: number;
}

interface DecisionMaker {
  name?: string;
  role?: string;
  department?: string;
  email?: string;
  phone?: string;
}

interface DecisionMakersPayload {
  decisionMakers?: DecisionMaker[];
}

export default async function QuickScanResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead with related data
  const [lead] = await db.select().from(qualifications).where(eq(qualifications.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Get related Pre-Qualification for decision makers
  const [preQualification] = lead.preQualificationId
    ? await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, lead.preQualificationId))
        .limit(1)
    : [null];

  const quickScanId = lead.quickScanId || preQualification?.quickScanId;
  const [quickScan] = quickScanId
    ? await db.select().from(quickScans).where(eq(quickScans.id, quickScanId)).limit(1)
    : [null];

  // Get website audit data
  const [audit] = lead.websiteUrl
    ? await db
        .select()
        .from(websiteAudits)
        .where(eq(websiteAudits.qualificationId, lead.id))
        .limit(1)
    : [null];

  // Get business unit
  const [businessUnit] = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.id, lead.businessUnitId))
    .limit(1);

  // Parse JSON fields
  const requirements = lead.requirements ? tryParseJSON(lead.requirements) : null;
  const contentTypes = audit?.contentTypes
    ? (tryParseJSON(audit.contentTypes) as ContentType[] | string[] | null)
    : null;
  const navigationStructure = audit?.navigationStructure
    ? (tryParseJSON(audit.navigationStructure) as
        | NavigationItem[]
        | NavigationStructure
        | string[]
        | null)
    : null;
  const decisionMakersRaw = quickScan?.decisionMakers
    ? (tryParseJSON(quickScan.decisionMakers) as
        | DecisionMakersPayload
        | DecisionMaker[]
        | null)
    : null;
  const decisionMakers = Array.isArray(decisionMakersRaw)
    ? decisionMakersRaw
    : decisionMakersRaw?.decisionMakers ?? null;

  // Check if CMS is Ibexa
  const isIbexa = audit?.cms?.toLowerCase().includes('ibexa');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Link
            href={`/qualifications/${id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {lead.customerName}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-3xl font-bold tracking-tight">Qualification Ergebnis</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Alle relevanten Informationen für die Routing-Entscheidung
        </p>
      </div>

      {/* 1. Kunde & Projekt */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Kunde & Projekt</CardTitle>
          </div>
          <CardDescription>Grundlegende Projekt- und Kundeninformationen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Kundenname</p>
              <p className="font-medium text-lg">{lead.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branche</p>
              <p className="font-medium">{lead.industry || 'Nicht bekannt'}</p>
            </div>
          </div>

          {lead.websiteUrl && (
            <div>
              <p className="text-sm text-muted-foreground">Website</p>
              <div className="flex items-center gap-2 mt-1">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={lead.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {lead.websiteUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {lead.projectDescription && (
            <div>
              <p className="text-sm text-muted-foreground">Projektbeschreibung</p>
              <p className="mt-1 text-sm leading-relaxed">{lead.projectDescription}</p>
            </div>
          )}

          {lead.budget && (
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-medium">{lead.budget}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Technische Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Technische Details</CardTitle>
          </div>
          <CardDescription>Erkannter Tech Stack und Website-Struktur</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {audit?.cms && (
              <div>
                <p className="text-sm text-muted-foreground">CMS</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{audit.cms}</Badge>
                  {audit.cmsVersion && (
                    <span className="text-sm text-muted-foreground">v{audit.cmsVersion}</span>
                  )}
                </div>
              </div>
            )}

            {audit?.framework && (
              <div>
                <p className="text-sm text-muted-foreground">Framework</p>
                <Badge variant="secondary" className="mt-1">
                  {audit.framework}
                </Badge>
              </div>
            )}

            {audit?.hosting && (
              <div>
                <p className="text-sm text-muted-foreground">Hosting</p>
                <Badge variant="outline" className="mt-1">
                  {audit.hosting}
                </Badge>
              </div>
            )}

            {audit?.server && (
              <div>
                <p className="text-sm text-muted-foreground">Server</p>
                <Badge variant="outline" className="mt-1">
                  {audit.server}
                </Badge>
              </div>
            )}
          </div>

          {audit?.pageCount && (
            <div>
              <p className="text-sm text-muted-foreground">Anzahl Seiten</p>
              <p className="font-medium text-lg">{audit.pageCount.toLocaleString('de-DE')}</p>
            </div>
          )}

          {contentTypes && Array.isArray(contentTypes) && contentTypes.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Content Types</p>
              <div className="flex flex-wrap gap-2">
                {contentTypes.map((type, idx: number) => {
                  const isString = typeof type === 'string';
                  const typeObj = isString ? null : type;
                  return (
                    <Badge key={idx} variant="outline">
                      {isString ? type : (typeObj?.type ?? 'Unknown')}
                      {!isString && typeObj?.count && (
                        <span className="ml-1 text-xs">({typeObj.count})</span>
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ) : null}

          {navigationStructure ? (
            <div>
              <p className="text-sm text-muted-foreground">Navigation Struktur</p>
              <div className="text-sm mt-1">
                {Array.isArray(navigationStructure) ? (
                  <ul className="list-disc list-inside space-y-1">
                    {navigationStructure.slice(0, 10).map((item, idx: number) => {
                      const isString = typeof item === 'string';
                      const navObj = isString ? null : item;
                      return (
                        <li key={idx}>
                          {isString
                            ? item
                            : (navObj?.label ?? navObj?.name ?? JSON.stringify(item))}
                        </li>
                      );
                    })}
                    {navigationStructure.length > 10 && (
                      <li className="text-muted-foreground">
                        ... und {navigationStructure.length - 10} weitere
                      </li>
                    )}
                  </ul>
                ) : typeof navigationStructure === 'object' &&
                  navigationStructure !== null &&
                  navigationStructure.levels !== undefined ? (
                  <p>
                    Ebenen: {navigationStructure.levels}, Hauptnavigation:{' '}
                    {navigationStructure.mainMenuItems ?? 'N/A'}
                  </p>
                ) : (
                  <p>
                    {navigationStructure !== null ? JSON.stringify(navigationStructure) : 'N/A'}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Anforderungen */}
      {(requirements || lead.budget) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Anforderungen</CardTitle>
            </div>
            <CardDescription>Spezielle Anforderungen und Budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requirements ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Spezielle Anforderungen</p>
                {Array.isArray(requirements) ? (
                  <ul className="list-disc list-inside space-y-1">
                    {(requirements as unknown[]).map((req, idx: number) => {
                      const reqText = typeof req === 'string' ? req : JSON.stringify(req);
                      return (
                        <li key={idx} className="text-sm">
                          {reqText}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                    {JSON.stringify(requirements, null, 2)}
                  </pre>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* 4. Ansprechpartner */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Ansprechpartner</CardTitle>
          </div>
          <CardDescription>Identifizierte Kontakte und Entscheider</CardDescription>
        </CardHeader>
        <CardContent>
          {decisionMakers && Array.isArray(decisionMakers) && decisionMakers.length > 0 ? (
            <div className="space-y-4">
              {decisionMakers.map((dm, idx: number) => (
                <div key={idx} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{dm.name || 'N/A'}</p>
                      {dm.role && <p className="text-sm text-muted-foreground">{dm.role}</p>}
                    </div>
                    {dm.department && <Badge variant="secondary">{dm.department}</Badge>}
                  </div>

                  <div className="flex flex-col gap-1">
                    {dm.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${dm.email}`} className="text-primary hover:underline">
                          {dm.email}
                        </a>
                      </div>
                    )}
                    {dm.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <a href={`tel:${dm.phone}`} className="text-primary hover:underline">
                          {dm.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Ansprechpartner-Informationen verfügbar. Diese werden während der Pre-Qualification-Extraktion
              ermittelt.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 5. BL Routing Empfehlung */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle>BL Routing Empfehlung</CardTitle>
          </div>
          <CardDescription>
            {isIbexa
              ? 'Ibexa-Projekt: Weiterleitung an Bereichsleiter PHP'
              : 'Empfohlene Business Unit für das Projekt'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isIbexa ? (
            // Special handling for Ibexa: Only show routing to Francesco Rapos
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">
                Ibexa CMS erkannt - Routing an PHP Bereich
              </p>
              <p className="text-sm text-blue-700 mt-2">
                Dieses Projekt wird direkt an <strong>Francesco Rapos</strong> (Bereichsleiter PHP)
                weitergeleitet.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href={`/qualifications/${id}`}>Lead bearbeiten</Link>
                </Button>
              </div>
            </div>
          ) : (
            // Standard routing recommendation
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Empfohlene Business Unit</p>
                  <p className="font-medium text-lg">{businessUnit?.name || 'Nicht zugewiesen'}</p>
                  {businessUnit && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Leiter: {businessUnit.leaderName}
                    </p>
                  )}
                </div>

                {lead.blConfidenceScore !== null && lead.blConfidenceScore !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${lead.blConfidenceScore}%` }}
                        />
                      </div>
                      <span className="font-medium text-sm">{lead.blConfidenceScore}%</span>
                    </div>
                  </div>
                )}
              </div>

              {lead.blReasoning && (
                <div>
                  <p className="text-sm text-muted-foreground">Begründung</p>
                  <p className="mt-1 text-sm leading-relaxed">{lead.blReasoning}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href={`/qualifications/${id}`}>Zurück zur Übersicht</Link>
        </Button>
        <Button asChild>
          <Link href={`/qualifications/${id}/website-audit`}>Website Audit ansehen</Link>
        </Button>
      </div>
    </div>
  );
}

function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str) as unknown;
  } catch {
    return null;
  }
}
