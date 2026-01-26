import { Users, Mail, Phone, Linkedin, ExternalLink } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import type { DecisionMaker, DecisionMakersResearch } from '@/lib/quick-scan/schema';
import { getCachedPreQualificationWithRelations } from '@/lib/pre-qualifications/cached-queries';
import { cn } from '@/lib/utils';
import { parseJsonValue } from '@/lib/utils/json';

export default async function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get Pre-Qualification with relations (cached and parallelized)
  const { preQualification, quickScan } = await getCachedPreQualificationWithRelations(id);

  if (!preQualification) {
    notFound();
  }

  // Check ownership
  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Parse decision makers research
  const decisionMakersData = quickScan
    ? parseJsonValue<DecisionMakersResearch>(quickScan.decisionMakers)
    : null;

  const decisionMakers = decisionMakersData?.decisionMakers || [];
  const researchQuality = decisionMakersData?.researchQuality;

  // Email confidence colors
  const confidenceColors = {
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    likely: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    derived: 'bg-orange-100 text-orange-800 border-orange-200',
    unknown: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kontakte</h1>
        <p className="text-muted-foreground">Entscheider und Ansprechpartner</p>
      </div>

      {/* Enhanced Decision Makers Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <CardTitle>Entscheider & Stakeholder</CardTitle>
          </div>
          <CardDescription>
            Identifizierte Entscheidungsträger mit Web Search Integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decisionMakers.length > 0 ? (
            <div className="space-y-4">
              {/* Research Quality Stats */}
              {researchQuality && (
                <div className="flex gap-4 text-xs text-muted-foreground pb-3 border-b">
                  {researchQuality.linkedInFound !== undefined &&
                    researchQuality.linkedInFound > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Linkedin className="h-3.5 w-3.5 text-blue-600" />
                        <span>{researchQuality.linkedInFound} LinkedIn Profile</span>
                      </div>
                    )}
                  {researchQuality.emailsConfirmed !== undefined &&
                    researchQuality.emailsConfirmed > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-green-600" />
                        <span>{researchQuality.emailsConfirmed} bestätigte Emails</span>
                      </div>
                    )}
                  {researchQuality.emailsDerived !== undefined &&
                    researchQuality.emailsDerived > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-orange-600" />
                        <span>{researchQuality.emailsDerived} abgeleitete Emails</span>
                      </div>
                    )}
                  {researchQuality.confidence !== undefined && (
                    <div className="ml-auto">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          researchQuality.confidence >= 70
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : researchQuality.confidence >= 40
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                        )}
                      >
                        Confidence: {researchQuality.confidence}%
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Decision Makers List */}
              <div className="grid gap-3">
                {decisionMakers.map((dm: DecisionMaker, idx: number) => (
                  <div key={idx} className="p-4 rounded-lg border bg-card space-y-3">
                    {/* Name & Role + Social Links */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-base">{dm.name}</p>
                        <p className="text-sm text-muted-foreground">{dm.role}</p>
                      </div>
                      <div className="flex gap-2">
                        {dm.linkedInUrl && (
                          <a
                            href={dm.linkedInUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-md hover:bg-muted transition-colors"
                            title="LinkedIn Profil"
                          >
                            <Linkedin className="h-4 w-4 text-blue-600" />
                          </a>
                        )}
                        {dm.xingUrl && (
                          <a
                            href={dm.xingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-md hover:bg-muted transition-colors"
                            title="Xing Profil"
                          >
                            <ExternalLink className="h-4 w-4 text-green-600" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {dm.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${dm.email}`} className="text-blue-600 hover:underline">
                            {dm.email}
                          </a>
                          {dm.emailConfidence && dm.emailConfidence !== 'unknown' && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 ml-1',
                                confidenceColors[dm.emailConfidence]
                              )}
                            >
                              {dm.emailConfidence}
                            </Badge>
                          )}
                        </div>
                      )}
                      {dm.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${dm.phone}`} className="text-blue-600 hover:underline">
                            {dm.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Source Info */}
                    {dm.source && (
                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        Quelle:{' '}
                        {dm.source === 'linkedin'
                          ? 'LinkedIn'
                          : dm.source === 'xing'
                            ? 'Xing'
                            : dm.source === 'impressum'
                              ? 'Impressum'
                              : dm.source === 'web_search'
                                ? 'Web Search'
                                : dm.source === 'team_page'
                                  ? 'Team-Seite'
                                  : dm.source}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Research Sources */}
              {researchQuality?.sources && researchQuality.sources.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Recherche-Quellen:</p>
                  <div className="flex flex-wrap gap-2">
                    {researchQuality.sources.map((source, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {source === 'linkedin'
                          ? 'LinkedIn'
                          : source === 'xing'
                            ? 'Xing'
                            : source === 'impressum'
                              ? 'Impressum'
                              : source === 'web_search'
                                ? 'Web Search'
                                : source === 'team_page'
                                  ? 'Team-Seite'
                                  : source}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-muted/50 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Keine Entscheidungsträger gefunden.
                {!quickScan && ' Bitte führen Sie einen Quick Scan durch.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
