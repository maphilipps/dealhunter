'use client';

import { Loader2, CheckCircle2, Cpu, DollarSign, Target, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AgentStatus {
  name: string;
  label: string;
  icon: typeof Cpu;
  status: 'pending' | 'running' | 'completed';
}

interface EvaluationProgressProps {
  status: 'evaluating' | 'completed';
}

export function EvaluationProgress({ status }: EvaluationProgressProps) {
  // Simulate progressive agent completion for demo
  // In reality, all agents run in parallel and complete nearly simultaneously
  const agents: AgentStatus[] = [
    {
      name: 'capability',
      label: 'Capability Match',
      icon: Cpu,
      status: status === 'completed' ? 'completed' : 'running',
    },
    {
      name: 'deal-quality',
      label: 'Deal Quality',
      icon: DollarSign,
      status: status === 'completed' ? 'completed' : 'running',
    },
    {
      name: 'strategic-fit',
      label: 'Strategic Fit',
      icon: Target,
      status: status === 'completed' ? 'completed' : 'running',
    },
    {
      name: 'competition',
      label: 'Competition Check',
      icon: Users,
      status: status === 'completed' ? 'completed' : 'running',
    },
  ];

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'evaluating' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              BIT/NO BIT Evaluierung läuft
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Evaluierung abgeschlossen
            </>
          )}
        </CardTitle>
        <CardDescription>Multi-Agent Analyse der Opportunity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {agents.map(agent => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.name}
                className="flex items-center gap-3 rounded-lg border bg-white p-4"
              >
                <div className="flex-shrink-0">
                  {agent.status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : agent.status === 'running' ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium truncate">{agent.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agent.status === 'completed'
                      ? 'Abgeschlossen'
                      : agent.status === 'running'
                        ? 'Analysiert...'
                        : 'Wartet...'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {status === 'evaluating' && (
          <div className="mt-4 rounded-lg bg-white p-3 text-sm text-muted-foreground">
            <p>Die Agents analysieren parallel die Opportunity aus verschiedenen Perspektiven.</p>
            <p className="mt-1">Dauer: ca. 30-60 Sekunden</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
