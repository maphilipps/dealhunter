import {
  Building2,
  Calendar,
  CircleDollarSign,
  Clock,
  Code2,
  FileText,
  Globe,
  Target,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface FindingsSummaryProps {
  extractedRequirements: ExtractedRequirements | null;
  qualificationScan: {
    recommendedBusinessUnit?: string | null;
    confidence?: number | null;
    reasoning?: string | null;
    techStack?: string | null;
    contentVolume?: string | null;
  } | null;
}

export function FindingsSummary({
  extractedRequirements,
  qualificationScan,
}: FindingsSummaryProps) {
  const req = extractedRequirements;

  // Parse tech stack if available
  let techStack: { cms?: string; framework?: string; technologies?: string[] } | null = null;
  if (qualificationScan?.techStack) {
    try {
      techStack = JSON.parse(qualificationScan.techStack);
    } catch {
      techStack = null;
    }
  }

  // Format budget
  const formatBudget = () => {
    if (!req?.budgetRange) return null;
    const { min, max, currency } = req.budgetRange;
    if (!min && !max) return null;
    const fmt = (n: number) =>
      n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : `${(n / 1000).toFixed(0)}k`;
    if (min && max) return `${fmt(min)} - ${fmt(max)} ${currency}`;
    if (min) return `ab ${fmt(min)} ${currency}`;
    if (max) return `bis ${fmt(max)} ${currency}`;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Findings Übersicht
        </CardTitle>
        <CardDescription>
          Zusammenfassung aller extrahierten Informationen aus der Qualification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Project Goal - The North Star */}
        {req?.projectGoal && (
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-primary">Projektziel</h3>
              {req.projectGoal.confidence && (
                <Badge variant="outline" className="ml-auto">
                  {req.projectGoal.confidence}% Konfidenz
                </Badge>
              )}
            </div>
            <p className="text-foreground">{req.projectGoal.objective}</p>
            {req.projectGoal.businessDrivers && req.projectGoal.businessDrivers.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Business Drivers:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {req.projectGoal.businessDrivers.map((driver, i) => (
                    <Badge key={i} variant="secondary">
                      {driver}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {req.projectGoal.successCriteria && req.projectGoal.successCriteria.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Erfolgskriterien:</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {req.projectGoal.successCriteria.map((criterion, i) => (
                    <li key={i}>{criterion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Key Facts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Customer */}
          {req?.customerName && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Kunde</p>
                <p className="font-medium">{req.customerName}</p>
                {req.industry && <p className="text-sm text-muted-foreground">{req.industry}</p>}
              </div>
            </div>
          )}

          {/* Budget */}
          {formatBudget() && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="font-medium">{formatBudget()}</p>
                {req?.budgetRange?.confidence && (
                  <p className="text-xs text-muted-foreground">
                    {req.budgetRange.confidence}% Konfidenz
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Deadline */}
          {req?.submissionDeadline && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Abgabefrist</p>
                <p className="font-medium">
                  {new Date(req.submissionDeadline).toLocaleDateString('de-DE')}
                </p>
                {req.submissionTime && (
                  <p className="text-sm text-muted-foreground">{req.submissionTime} Uhr</p>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          {req?.timeline && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Projekt-Timeline</p>
                <p className="font-medium">{req.timeline}</p>
              </div>
            </div>
          )}

          {/* Website */}
          {(req?.websiteUrl || req?.websiteUrls?.[0]) && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <a
                  href={req.websiteUrl || req.websiteUrls?.[0]?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {new URL(req.websiteUrl || req.websiteUrls?.[0]?.url || '').hostname}
                </a>
              </div>
            </div>
          )}

          {/* Contacts */}
          {req?.contacts && req.contacts.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Kontakte</p>
                <p className="font-medium">{req.contacts.length} Ansprechpartner</p>
                <p className="text-sm text-muted-foreground">
                  {req.contacts.filter(c => c.category === 'decision_maker').length > 0 &&
                    `${req.contacts.filter(c => c.category === 'decision_maker').length} Decision Maker`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Technologies */}
        {(req?.technologies?.length || techStack) && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Technologien</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {techStack?.cms && <Badge variant="default">{techStack.cms}</Badge>}
              {req?.technologies?.map((tech, i) => (
                <Badge key={i} variant="secondary">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* CMS Constraints */}
        {req?.cmsConstraints && (
          <div className="rounded-lg bg-muted/50 p-3">
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">CMS-Vorgaben</h4>
            <div className="space-y-1 text-sm">
              {req.cmsConstraints.required?.length ? (
                <p>
                  <span className="text-green-600">Erforderlich:</span>{' '}
                  {req.cmsConstraints.required.join(', ')}
                </p>
              ) : null}
              {req.cmsConstraints.preferred?.length ? (
                <p>
                  <span className="text-blue-600">Bevorzugt:</span>{' '}
                  {req.cmsConstraints.preferred.join(', ')}
                </p>
              ) : null}
              {req.cmsConstraints.excluded?.length ? (
                <p>
                  <span className="text-red-600">Ausgeschlossen:</span>{' '}
                  {req.cmsConstraints.excluded.join(', ')}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                Flexibilität: {req.cmsConstraints.flexibility}
              </p>
            </div>
          </div>
        )}

        {/* Key Requirements */}
        {req?.keyRequirements && req.keyRequirements.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              Wichtige Anforderungen
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {req.keyRequirements.slice(0, 5).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
              {req.keyRequirements.length > 5 && (
                <li className="text-muted-foreground">+{req.keyRequirements.length - 5} weitere</li>
              )}
            </ul>
          </div>
        )}

        {/* BL Recommendation */}
        {qualificationScan?.recommendedBusinessUnit && (
          <div className="rounded-lg border bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Empfohlene Business Line</p>
                <p className="text-lg font-bold text-blue-900">
                  {qualificationScan.recommendedBusinessUnit}
                </p>
              </div>
              {qualificationScan.confidence !== null &&
                qualificationScan.confidence !== undefined && (
                  <Badge variant={qualificationScan.confidence >= 70 ? 'default' : 'secondary'}>
                    {qualificationScan.confidence}% Konfidenz
                  </Badge>
                )}
            </div>
            {qualificationScan.reasoning && (
              <p className="mt-2 text-sm text-blue-700">{qualificationScan.reasoning}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
