'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Server, Globe, Package, Lightbulb } from 'lucide-react';
import type { QuickScan } from '@/lib/db/schema';

interface QuickScanResultsProps {
  quickScan: QuickScan & {
    techStack?: any;
    contentVolume?: any;
    features?: any;
    activityLog?: any[];
  };
}

export function QuickScanResults({ quickScan }: QuickScanResultsProps) {
  // Running state
  if (quickScan.status === 'running') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Quick Scan läuft
          </CardTitle>
          <CardDescription>
            Analyse der Kunden-Website: {quickScan.websiteUrl}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fortschritt</span>
              <span className="font-medium">~3-5 Minuten</span>
            </div>
            <Progress value={66} className="h-2" />
          </div>

          {/* Activity Log Preview */}
          {quickScan.activityLog && Array.isArray(quickScan.activityLog) && quickScan.activityLog.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Aktuelle Aktivität:</p>
              {quickScan.activityLog.slice(-3).map((activity: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    {activity.details && (
                      <p className="text-muted-foreground text-xs">{activity.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Failed state
  if (quickScan.status === 'failed') {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Quick Scan fehlgeschlagen</CardTitle>
          <CardDescription>
            Website konnte nicht analysiert werden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bitte überprüfen Sie die Website-URL und versuchen Sie es erneut.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Completed state - Show results
  if (quickScan.status === 'completed') {
    const techStack = quickScan.techStack;
    const contentVolume = quickScan.contentVolume;
    const features = quickScan.features;

    return (
      <div className="space-y-6">
        {/* Business Line Recommendation - Most Important */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900">Empfohlene Business Line</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-900">
                {quickScan.confidence}% Confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {quickScan.recommendedBusinessLine}
              </p>
            </div>
            {quickScan.reasoning && (
              <p className="text-sm text-blue-800">{quickScan.reasoning}</p>
            )}
          </CardContent>
        </Card>

        {/* Tech Stack */}
        {techStack && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Tech Stack</CardTitle>
              </div>
              <CardDescription>Erkannte Technologien</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {techStack.cms && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">CMS</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-base">
                        {techStack.cms}
                      </Badge>
                      {techStack.cmsVersion && (
                        <span className="text-sm text-muted-foreground">v{techStack.cmsVersion}</span>
                      )}
                      {techStack.cmsConfidence && (
                        <span className="text-xs text-muted-foreground">
                          ({techStack.cmsConfidence}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {techStack.framework && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Framework</p>
                    <Badge variant="outline" className="text-base">{techStack.framework}</Badge>
                  </div>
                )}

                {techStack.hosting && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Hosting</p>
                    <Badge variant="outline" className="text-base">{techStack.hosting}</Badge>
                  </div>
                )}

                {techStack.backend && techStack.backend.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Backend</p>
                    <div className="flex flex-wrap gap-2">
                      {techStack.backend.map((tech: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{tech}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {techStack.libraries && techStack.libraries.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Libraries & Tools</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.libraries.slice(0, 10).map((lib: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{lib}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content & Features */}
        {(contentVolume || features) && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Content & Features</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Content Volume */}
                {contentVolume && (
                  <div className="space-y-3">
                    <p className="font-medium">Content Volume</p>
                    {contentVolume.estimatedPageCount && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Geschätzte Seiten</span>
                        <span className="font-medium">{contentVolume.estimatedPageCount}</span>
                      </div>
                    )}
                    {contentVolume.complexity && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Komplexität</span>
                        <Badge variant={
                          contentVolume.complexity === 'high' ? 'destructive' :
                          contentVolume.complexity === 'medium' ? 'default' : 'secondary'
                        }>
                          {contentVolume.complexity}
                        </Badge>
                      </div>
                    )}
                    {contentVolume.languages && contentVolume.languages.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-2">Sprachen</span>
                        <div className="flex flex-wrap gap-1">
                          {contentVolume.languages.map((lang: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">{lang}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Features */}
                {features && (
                  <div className="space-y-3">
                    <p className="font-medium">Erkannte Features</p>
                    <div className="grid gap-2">
                      {features.ecommerce && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">E-Commerce</span>
                        </div>
                      )}
                      {features.userAccounts && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">User Accounts</span>
                        </div>
                      )}
                      {features.search && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">Search</span>
                        </div>
                      )}
                      {features.multiLanguage && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">Multi-Language</span>
                        </div>
                      )}
                      {features.blog && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">Blog/News</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Website Link */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Analysierte Website</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <a
              href={quickScan.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {quickScan.websiteUrl}
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
