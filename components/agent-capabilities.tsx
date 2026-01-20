'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Wrench, Shield, AlertCircle } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface Tool {
  name: string;
  description: string;
}

interface CategoryWithTools {
  id: string;
  label: string;
  tools: Tool[];
}

interface Capabilities {
  canCreateRfps: boolean;
  canViewRfps: boolean;
  canManageAccounts: boolean;
  canManageReferences: boolean;
  canManageCompetencies: boolean;
  canManageEmployees: boolean;
  canManageTechnologies: boolean;
  canManageBusinessUnits: boolean;
  canManageUsers: boolean;
  canAccessAdminPanel: boolean;
  canReviewBids: boolean;
}

interface CapabilitiesData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  agents: Agent[];
  tools: {
    total: number;
    byCategory: CategoryWithTools[];
  };
  capabilities: Capabilities;
}

export function AgentCapabilities() {
  const [data, setData] = useState<CapabilitiesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCapabilities() {
      try {
        const response = await fetch('/api/agent/capabilities');
        if (!response.ok) {
          throw new Error('Failed to fetch capabilities');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCapabilities();
  }, []);

  if (isLoading) {
    return <AgentCapabilitiesSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-muted-foreground">
            {error || 'Keine Daten verfügbar'}
          </span>
        </CardContent>
      </Card>
    );
  }

  const capabilityLabels: Record<keyof Capabilities, string> = {
    canCreateRfps: 'RFPs erstellen',
    canViewRfps: 'RFPs ansehen',
    canManageAccounts: 'Accounts verwalten',
    canManageReferences: 'Referenzen verwalten',
    canManageCompetencies: 'Kompetenzen verwalten',
    canManageEmployees: 'Mitarbeiter verwalten',
    canManageTechnologies: 'Technologien verwalten',
    canManageBusinessUnits: 'Business Units verwalten',
    canManageUsers: 'Benutzer verwalten',
    canAccessAdminPanel: 'Admin-Panel',
    canReviewBids: 'Bids reviewen',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Agents
          </CardTitle>
          <CardDescription>
            {data.agents.length} aktive Agents für automatisierte Workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {data.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                    {agent.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {agent.description}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Verfügbare Tools
          </CardTitle>
          <CardDescription>
            {data.tools.total} Tools in {data.tools.byCategory.length} Kategorien
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {data.tools.byCategory.map((category) => (
              <AccordionItem key={category.id} value={category.id}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    {category.label}
                    <Badge variant="outline">{category.tools.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {category.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex flex-col rounded-md bg-muted/50 px-3 py-2"
                      >
                        <code className="text-sm font-medium">{tool.name}</code>
                        <span className="text-xs text-muted-foreground">
                          {tool.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Berechtigungen
          </CardTitle>
          <CardDescription>
            Ihre Berechtigungen als {data.user.role.toUpperCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.capabilities).map(([key, enabled]) => (
              <Badge
                key={key}
                variant={enabled ? 'default' : 'outline'}
                className={!enabled ? 'opacity-50' : ''}
              >
                {capabilityLabels[key as keyof Capabilities]}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentCapabilitiesSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border p-4">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
