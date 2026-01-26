'use client';

import {
  CheckCircle2,
  Circle,
  ArrowRight,
  FileSearch,
  Users,
  Gavel,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { BLDecisionPhase } from './phases/bl-decision-phase';
import { BUComparisonPhase } from './phases/bu-comparison-phase';
import { ScrapedFactsPhase } from './phases/scraped-facts-phase';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { QuickScan, PreQualification } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface WorkflowStepperProps {
  preQualification: PreQualification;
  quickScan: QuickScan | null;
  extractedData?: ExtractedRequirements | null;
}

type WorkflowPhase = 'facts' | 'comparison' | 'decision';

interface PhaseConfig {
  id: WorkflowPhase;
  label: string;
  description: string;
  icon: React.ElementType;
  route: string;
}

const phases: PhaseConfig[] = [
  {
    id: 'facts',
    label: 'Quick Scan',
    description: 'Automatische Datenerfassung',
    icon: FileSearch,
    route: '/workflow-1',
  },
  {
    id: 'comparison',
    label: 'BU-Vergleich',
    description: 'Matching & Zuordnung',
    icon: Users,
    route: '/workflow-2',
  },
  {
    id: 'decision',
    label: 'Bid-Entscheidung',
    description: 'Bereichsleiter entscheidet',
    icon: Gavel,
    route: '/workflow-3',
  },
];

function getPhaseStatus(
  phase: WorkflowPhase,
  quickScan: QuickScan | null
): 'completed' | 'current' | 'pending' {
  if (!quickScan || quickScan.status !== 'completed') {
    return phase === 'facts' ? 'current' : 'pending';
  }

  // Quick Scan completed
  if (phase === 'facts') return 'completed';

  // Check if BU comparison was done (has recommended BU)
  if (quickScan.recommendedBusinessUnit) {
    if (phase === 'comparison') return 'completed';
    return 'current'; // Decision phase is current
  }

  // BU comparison is current
  if (phase === 'comparison') return 'current';
  return 'pending';
}

export function WorkflowStepper({ preQualification, quickScan, extractedData }: WorkflowStepperProps) {
  const [activePhase, setActivePhase] = useState<WorkflowPhase>(() => {
    if (!quickScan || quickScan.status !== 'completed') return 'facts';
    if (!quickScan.recommendedBusinessUnit) return 'comparison';
    return 'decision';
  });

  const [triggeringWorkflow2, setTriggeringWorkflow2] = useState(false);

  // Handle manual trigger of workflow-2
  const handleTriggerWorkflow2 = async () => {
    setTriggeringWorkflow2(true);
    try {
      // TODO: Implement actual workflow trigger
      await new Promise(resolve => setTimeout(resolve, 1500));
      setActivePhase('comparison');
    } catch (error) {
      console.error('Error triggering workflow:', error);
    } finally {
      setTriggeringWorkflow2(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stepper Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {phases.map((phase, index) => {
              const status = getPhaseStatus(phase.id, quickScan);
              const Icon = phase.icon;
              const isActive = activePhase === phase.id;

              return (
                <div key={phase.id} className="flex items-center flex-1">
                  {/* Phase Indicator */}
                  <button
                    onClick={() => status !== 'pending' && setActivePhase(phase.id)}
                    disabled={status === 'pending'}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors w-full ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : status === 'completed'
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`rounded-full p-2 ${
                        isActive
                          ? 'bg-white/20'
                          : status === 'completed'
                            ? 'bg-green-200'
                            : 'bg-slate-200'
                      }`}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : status === 'current' ? (
                        <Icon className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{phase.label}</div>
                      <div className={`text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                        {phase.description}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-xs ${isActive ? 'bg-white/10 border-white/20' : ''}`}
                    >
                      {phase.route}
                    </Badge>
                  </button>

                  {/* Connector */}
                  {index < phases.length - 1 && (
                    <ChevronRight
                      className={`h-5 w-5 mx-2 flex-shrink-0 ${
                        status === 'completed' ? 'text-green-500' : 'text-slate-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Phase Content */}
      <div className="min-h-[500px]">
        {activePhase === 'facts' && (
          <div className="space-y-4">
            <ScrapedFactsPhase quickScan={quickScan} extractedData={extractedData} bidId={preQualification.id} />

            {/* Trigger Workflow 2 Button */}
            {quickScan?.status === 'completed' && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-orange-900">
                        Workflow 2: BU-Vergleich starten
                      </h3>
                      <p className="text-sm text-orange-700">
                        Der BU-Vergleich wird nicht automatisch gestartet. Klicke hier um
                        fortzufahren.
                      </p>
                    </div>
                    <Button
                      onClick={handleTriggerWorkflow2}
                      disabled={triggeringWorkflow2}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {triggeringWorkflow2 ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Starte...
                        </>
                      ) : (
                        <>
                          Weiter zu Phase 2
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activePhase === 'comparison' && quickScan && (
          <BUComparisonPhase quickScan={quickScan} preQualificationId={preQualification.id} />
        )}

        {activePhase === 'decision' && quickScan && (
          <BLDecisionPhase quickScan={quickScan} preQualificationId={preQualification.id} />
        )}
      </div>
    </div>
  );
}
