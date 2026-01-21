'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, CheckCircle2, Send, ArrowRight, Building2, Sparkles } from 'lucide-react';
import type { QuickScan } from '@/lib/db/schema';
import { getBusinessUnits } from '@/lib/admin/business-units-actions';
import { forwardToBusinessLeader } from '@/lib/bids/actions';
import {
  startCMSEvaluation,
  getCMSEvaluation,
  refreshCMSEvaluation,
  researchRequirement,
} from '@/lib/cms-matching/actions';
import { CMSEvaluationMatrix } from '@/components/bids/cms-evaluation-matrix';
import type { CMSMatchingResult } from '@/lib/cms-matching/schema';

interface BusinessUnit {
  id: string;
  name: string;
  leaderName: string;
}

interface DecisionMatrixTabProps {
  quickScan: QuickScan;
  bidId: string;
}

export function DecisionMatrixTab({ quickScan, bidId }: DecisionMatrixTabProps) {
  const router = useRouter();

  // CMS Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(true);
  const [cmsEvaluation, setCmsEvaluation] = useState<CMSMatchingResult | null>(null);
  const [selectedCMS, setSelectedCMS] = useState<string>('');

  // BL Forwarding State
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBU, setSelectedBU] = useState<string>('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwarded, setForwarded] = useState(false);
  const [forwardResult, setForwardResult] = useState<{
    businessUnit: string;
    leaderName: string;
  } | null>(null);

  // Load saved CMS Evaluation on mount
  useEffect(() => {
    const loadSavedEvaluation = async () => {
      if (!quickScan?.id) return;

      setIsLoadingEvaluation(true);
      try {
        const result = await getCMSEvaluation(quickScan.id);
        if (result.success && result.result) {
          setCmsEvaluation(result.result);
          // Pre-select the recommended CMS
          if (result.result.comparedTechnologies.length > 0) {
            setSelectedCMS(result.result.comparedTechnologies[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load CMS Evaluation:', error);
      } finally {
        setIsLoadingEvaluation(false);
      }
    };

    if (quickScan?.status === 'completed') {
      loadSavedEvaluation();
    }
  }, [quickScan?.id, quickScan?.status]);

  // Load business units on mount
  useEffect(() => {
    const loadBusinessUnits = async () => {
      const result = await getBusinessUnits();
      if (result.success && result.businessUnits) {
        setBusinessUnits(result.businessUnits as BusinessUnit[]);

        // Check if Ibexa - auto-select PHP Business Unit
        const isIbexa = quickScan?.cms?.toLowerCase().includes('ibexa');
        if (isIbexa) {
          const phpBU = result.businessUnits.find((bu: BusinessUnit) =>
            bu.name.toLowerCase().includes('php')
          );
          if (phpBU) {
            setSelectedBU(phpBU.id);
          }
        } else if (quickScan?.recommendedBusinessUnit) {
          // Pre-select recommended BU if available (non-Ibexa)
          const recommended = result.businessUnits.find(
            (bu: BusinessUnit) => bu.name === quickScan.recommendedBusinessUnit
          );
          if (recommended) {
            setSelectedBU(recommended.id);
          }
        }
      }
    };

    if (quickScan?.status === 'completed') {
      loadBusinessUnits();
    }
  }, [quickScan?.status, quickScan?.recommendedBusinessUnit, quickScan?.cms]);

  // Handle single requirement research
  const [researchingCell, setResearchingCell] = useState<string | null>(null);

  const handleResearchRequirement = async (cmsId: string, requirement: string) => {
    if (!quickScan?.id) return;

    const cellKey = `${cmsId}-${requirement}`;
    setResearchingCell(cellKey);

    try {
      const result = await researchRequirement(quickScan.id, cmsId, requirement);

      if (result.success && result.result) {
        setCmsEvaluation(result.result);
      } else {
        console.error('Research failed:', result.error);
      }
    } catch (error) {
      console.error('Research error:', error);
    } finally {
      setResearchingCell(null);
    }
  };

  // Handle CMS Evaluation (Start or Refresh)
  const handleStartEvaluation = async (forceRefresh = false) => {
    if (!quickScan?.id) return;

    setIsEvaluating(true);
    try {
      // Use refreshCMSEvaluation if forcing, otherwise startCMSEvaluation (which uses cache)
      const result = forceRefresh
        ? await refreshCMSEvaluation(quickScan.id, { useWebSearch: true })
        : await startCMSEvaluation(quickScan.id, { useWebSearch: true });

      if (result.success && result.result) {
        setCmsEvaluation(result.result);
        // Pre-select the recommended CMS
        if (result.result.comparedTechnologies.length > 0) {
          setSelectedCMS(result.result.comparedTechnologies[0].id);
        }
      } else {
        alert(result.error || 'CMS-Evaluation fehlgeschlagen');
      }
    } catch (error) {
      console.error('CMS Evaluation error:', error);
      alert('CMS-Evaluation fehlgeschlagen');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle forward to BL
  const handleForward = async () => {
    if (!selectedBU || !bidId) return;

    setIsForwarding(true);
    try {
      const result = await forwardToBusinessLeader(bidId, selectedBU);
      if (result.success) {
        setForwarded(true);
        setForwardResult({
          businessUnit: result.businessUnit!,
          leaderName: result.leaderName!,
        });
        // Redirect to BL review page after 2 seconds
        setTimeout(() => {
          router.push(`/bl-review/${bidId}`);
        }, 2000);
      } else {
        alert(result.error || 'Weiterleitung fehlgeschlagen');
      }
    } catch (error) {
      console.error('Forward error:', error);
      alert('Weiterleitung fehlgeschlagen');
    } finally {
      setIsForwarding(false);
    }
  };

  if (quickScan.status !== 'completed') {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400 mb-4" />
          <p className="text-muted-foreground">QuickScan wird ausgeführt...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Die Entscheidungsmatrix ist verfügbar, sobald der Scan abgeschlossen ist.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if CMS is Ibexa - special handling
  const isIbexa = quickScan.cms?.toLowerCase().includes('ibexa');

  return (
    <div className="space-y-6">
      {/* Special handling for Ibexa CMS - Direct routing to Francesco Rapos */}
      {isIbexa ? (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl text-blue-900">Ibexa CMS erkannt</CardTitle>
                <CardDescription className="text-blue-700">
                  Automatische Weiterleitung an PHP-Spezialist
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-white p-4 border border-blue-200">
              <p className="text-sm text-muted-foreground mb-2">Weiterleitung an</p>
              <p className="text-2xl font-bold text-blue-900">Francesco Rapos</p>
              <p className="text-sm text-blue-700 mt-1">Bereichsleiter PHP</p>
            </div>
            <div className="rounded-lg bg-blue-100 border border-blue-200 p-3">
              <p className="text-sm text-blue-800">
                <strong>Ibexa</strong> ist ein PHP-basiertes Enterprise CMS. Dieses Projekt wird
                automatisch an den PHP-Bereich weitergeleitet.
              </p>
            </div>
            {quickScan.reasoning && (
              <div className="rounded-lg bg-white p-4 border border-blue-200">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Quick Scan Analyse
                </p>
                <p className="text-sm text-foreground">{quickScan.reasoning}</p>
              </div>
            )}
            <Button
              onClick={handleForward}
              disabled={isForwarding}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isForwarding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Weiterleiten...
                </>
              ) : (
                <>
                  An Francesco Rapos weiterleiten
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header Card with BL Recommendation */}
          {quickScan.recommendedBusinessUnit && (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <CardTitle className="text-lg text-violet-900">AI-Empfehlung</CardTitle>
              </div>
              <Badge className="bg-violet-600">{quickScan.recommendedBusinessUnit}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-violet-700 mb-1">Empfohlene Business Unit</p>
                <p className="text-xl font-bold text-violet-900">
                  {quickScan.recommendedBusinessUnit}
                </p>
              </div>
              {quickScan.confidence && (
                <div className="w-32">
                  <p className="text-xs text-violet-600 mb-1">Confidence</p>
                  <div className="flex items-center gap-2">
                    <Progress value={quickScan.confidence} className="h-2" />
                    <span className="text-sm font-medium text-violet-900">
                      {quickScan.confidence}%
                    </span>
                  </div>
                </div>
              )}
            </div>
            {quickScan.reasoning && (
              <div className="mt-3 pt-3 border-t border-violet-200">
                <p className="text-xs text-violet-600 mb-1">Begründung</p>
                <p className="text-sm text-violet-800">{quickScan.reasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CMS Evaluation Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-600" />
          CMS-Evaluation
        </h3>

        {isLoadingEvaluation && (
          <Card className="border-slate-200">
            <CardContent className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-muted-foreground">Lade gespeicherte Evaluation...</p>
            </CardContent>
          </Card>
        )}

        {!cmsEvaluation && !isEvaluating && !isLoadingEvaluation && (
          <Card className="border-slate-200">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-semibold text-muted-foreground">n/a</span>
                  <span className="text-sm text-muted-foreground">
                    Noch keine Evaluation durchgeführt
                  </span>
                </div>
                <Button
                  onClick={() => {
                    handleStartEvaluation(false);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Evaluation starten
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isEvaluating && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-blue-700 font-medium">CMS-Evaluation läuft...</p>
              <p className="text-sm text-blue-600">
                Anforderungen werden gegen CMS-Systeme gematched (mit Web Search)
              </p>
            </CardContent>
          </Card>
        )}

        {cmsEvaluation && (
          <div className="space-y-3">
            {/* Metadata Info */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Zuletzt evaluiert:{' '}
                {new Date(cmsEvaluation.metadata.matchedAt).toLocaleString('de-DE')}
                {cmsEvaluation.metadata.webSearchUsed && ' (mit Web Search)'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleStartEvaluation(true);
                }}
                disabled={isEvaluating}
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Recherchiere...
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3 mr-1" />
                    Neu recherchieren
                  </>
                )}
              </Button>
            </div>

            <CMSEvaluationMatrix
              result={cmsEvaluation}
              onSelectCMS={setSelectedCMS}
              selectedCMS={selectedCMS}
              isLoading={isEvaluating}
              onResearchRequirement={handleResearchRequirement}
              researchingCell={researchingCell}
            />
          </div>
        )}
      </div>

      {/* Forward to Business Leader Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-600" />
          Weiterleitung an Bereichsleiter
        </h3>

        {forwarded ? (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-green-800 mb-2">Weiterleitung erfolgreich!</h3>
              <p className="text-green-700">
                Die Anfrage wurde an <strong>{forwardResult?.leaderName}</strong> (
                {forwardResult?.businessUnit}) weitergeleitet.
              </p>
              <p className="text-sm text-green-600 mt-2">
                Sie werden in Kürze zur BL-Übersicht weitergeleitet...
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-lg text-orange-900">
                  An Bereichsleiter weiterleiten
                </CardTitle>
              </div>
              <CardDescription className="text-orange-700">
                Wählen Sie die Business Unit aus und leiten Sie die Anfrage an den zuständigen
                Bereichsleiter weiter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Select value={selectedBU} onValueChange={setSelectedBU}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Business Unit auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {businessUnits.map(bu => (
                        <SelectItem key={bu.id} value={bu.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{bu.name}</span>
                            {bu.name === quickScan.recommendedBusinessUnit && (
                              <Badge variant="secondary" className="text-xs">
                                Empfohlen
                              </Badge>
                            )}
                            <span className="text-muted-foreground text-xs">({bu.leaderName})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleForward}
                  disabled={!selectedBU || isForwarding}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isForwarding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Weiterleiten...
                    </>
                  ) : (
                    <>
                      Weiterleiten
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {quickScan.recommendedBusinessUnit && selectedBU && (
                <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI empfiehlt: {quickScan.recommendedBusinessUnit}
                  {businessUnits.find(bu => bu.id === selectedBU)?.name ===
                  quickScan.recommendedBusinessUnit
                    ? ' (ausgewählt)'
                    : ''}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
        </>
      )}
    </div>
  );
}
