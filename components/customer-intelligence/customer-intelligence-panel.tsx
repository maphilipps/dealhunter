import { ExternalLink, Linkedin, Mail, Phone, Server, Users } from 'lucide-react';

import { CopyButton } from './copy-button';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  CompanyIntelligence,
  DecisionMakersResearch,
  TechStack,
} from '@/lib/qualification-scan/schema';

function fmtDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function CustomerIntelligencePanel({
  customerName,
  websiteUrl,
  companyIntelligence,
  decisionMakers,
  techStack,
}: {
  customerName?: string | null;
  websiteUrl?: string | null;
  companyIntelligence?: CompanyIntelligence | null;
  decisionMakers?: DecisionMakersResearch | null;
  techStack?: TechStack | null;
}) {
  const company = companyIntelligence?.basicInfo;
  const financials = companyIntelligence?.financials;

  const decisionMakerList = decisionMakers?.decisionMakers ?? [];
  const generic = decisionMakers?.genericContacts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kundenprofil</h1>
        <p className="text-muted-foreground">
          Entscheider, Business Signals und Tech Stack fuer Qualification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unternehmen</CardTitle>
            <CardDescription>Business Snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Name</div>
              <div className="text-base font-medium">
                {company?.name || customerName || 'Unbekannt'}
              </div>
            </div>

            {(company?.industry || company?.headquarters || company?.employeeCount) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {company?.industry && (
                  <div>
                    <div className="text-xs text-muted-foreground">Branche</div>
                    <div className="text-sm">{company.industry}</div>
                  </div>
                )}
                {company?.headquarters && (
                  <div>
                    <div className="text-xs text-muted-foreground">Hauptsitz</div>
                    <div className="text-sm">{company.headquarters}</div>
                  </div>
                )}
                {company?.employeeCount && (
                  <div>
                    <div className="text-xs text-muted-foreground">Mitarbeiter</div>
                    <div className="text-sm">{company.employeeCount}</div>
                  </div>
                )}
                {financials?.revenueClass && (
                  <div>
                    <div className="text-xs text-muted-foreground">Umsatzklasse</div>
                    <div className="text-sm">{financials.revenueClass}</div>
                  </div>
                )}
              </div>
            )}

            {financials?.revenueEstimate && (
              <div>
                <div className="text-xs text-muted-foreground">Umsatz (Estimate)</div>
                <div className="text-sm">{financials.revenueEstimate}</div>
              </div>
            )}

            <div className="h-px w-full bg-border" />

            <div className="flex flex-wrap items-center gap-2">
              {(websiteUrl || company?.website) && (
                <a
                  className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                  href={(websiteUrl || company?.website) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Website
                </a>
              )}
              {companyIntelligence?.digitalPresence?.linkedInCompanyUrl && (
                <a
                  className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                  href={companyIntelligence.digitalPresence.linkedInCompanyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn Company
                </a>
              )}
              {companyIntelligence?.dataQuality?.confidence != null && (
                <Badge variant="secondary">
                  Confidence {companyIntelligence.dataQuality.confidence}%
                </Badge>
              )}
            </div>

            {companyIntelligence?.dataQuality?.lastUpdated && (
              <div className="text-xs text-muted-foreground">
                Stand: {fmtDate(companyIntelligence.dataQuality.lastUpdated) || 'Unbekannt'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Entscheider
            </CardTitle>
            <CardDescription>Kontakte und LinkedIn-Profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisionMakerList.length === 0 && !generic && (
              <p className="text-sm text-muted-foreground">Keine Kontakte gefunden.</p>
            )}

            {decisionMakerList.length > 0 && (
              <div className="space-y-3">
                {decisionMakerList.slice(0, 8).map((dm, idx) => (
                  <div key={`${dm.name}-${idx}`} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{dm.name}</div>
                        <div className="text-xs text-muted-foreground">{dm.role}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {dm.source}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {dm.linkedInUrl && (
                        <a
                          className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                          href={dm.linkedInUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Linkedin className="h-4 w-4" />
                          LinkedIn
                        </a>
                      )}
                      {dm.email && (
                        <div className="inline-flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{dm.email}</span>
                          <CopyButton value={dm.email} label="E-Mail kopieren" />
                          {dm.emailConfidence && (
                            <Badge variant="secondary">{dm.emailConfidence}</Badge>
                          )}
                        </div>
                      )}
                      {dm.phone && (
                        <div className="inline-flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{dm.phone}</span>
                          <CopyButton value={dm.phone} label="Telefon kopieren" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {decisionMakerList.length > 8 && (
                  <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm">
                      +{decisionMakerList.length - 8} weitere anzeigen
                    </summary>
                    <div className="mt-3 space-y-2">
                      {decisionMakerList.slice(8).map((dm, idx) => (
                        <div key={`${dm.name}-more-${idx}`} className="text-sm">
                          {dm.name} ({dm.role})
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {generic && (
              <>
                <div className="h-px w-full bg-border" />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Allgemeine Kontakte</div>
                  {generic.mainEmail && (
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{generic.mainEmail}</span>
                      <CopyButton value={generic.mainEmail} label="E-Mail kopieren" />
                    </div>
                  )}
                  {generic.phone && (
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{generic.phone}</span>
                      <CopyButton value={generic.phone} label="Telefon kopieren" />
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            Tech Stack
          </CardTitle>
          <CardDescription>CMS, Framework, Hosting, Integrationen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!techStack && (
            <p className="text-sm text-muted-foreground">Keine Tech-Daten gefunden.</p>
          )}

          {techStack && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">CMS</div>
                <div className="text-sm font-medium">{techStack.cms || '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Framework</div>
                <div className="text-sm font-medium">{techStack.framework || '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Hosting</div>
                <div className="text-sm font-medium">{techStack.hosting || '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">CDN</div>
                <div className="text-sm font-medium">
                  {techStack.cdn || techStack.cdnProviders?.slice(0, 3).join(', ') || '-'}
                </div>
              </div>
              {(techStack.analytics?.length || 0) > 0 && (
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs text-muted-foreground">Analytics</div>
                  <div className="flex flex-wrap gap-1">
                    {techStack.analytics?.slice(0, 10).map(a => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(techStack.marketing?.length || 0) > 0 && (
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs text-muted-foreground">Marketing</div>
                  <div className="flex flex-wrap gap-1">
                    {techStack.marketing?.slice(0, 10).map(m => (
                      <Badge key={m} variant="outline">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
