'use client';

import { Users, Calendar } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Staffing Entry represents a role's involvement in a project phase
 */
export interface StaffingEntry {
  role: string;
  phase: string;
  startMonth: number;
  endMonth: number;
  pt: number;
}

interface StaffingGanttChartProps {
  entries: StaffingEntry[];
  className?: string;
}

/**
 * Staffing Gantt Chart Component
 *
 * Displays a Gantt-like timeline for staffing and resource planning.
 * Shows roles, phases, and person-time (PT) allocation over project duration.
 *
 * Uses Recharts BarChart with horizontal bars for a Gantt-like effect.
 */
export function StaffingGanttChart({ entries, className }: StaffingGanttChartProps) {
  if (!entries || entries.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staffing Timeline
          </CardTitle>
          <CardDescription>No staffing data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Calculate project duration
  const maxMonth = Math.max(...entries.map(e => e.endMonth));
  const minMonth = Math.min(...entries.map(e => e.startMonth));
  const totalMonths = maxMonth - minMonth;

  // Group entries by role for the Gantt display
  const roleGroups = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.role]) {
        acc[entry.role] = [];
      }
      acc[entry.role].push(entry);
      return acc;
    },
    {} as Record<string, StaffingEntry[]>
  );

  // Calculate total PT per role
  const roleTotals = Object.entries(roleGroups).map(([role, roleEntries]) => ({
    role,
    totalPT: roleEntries.reduce((sum, entry) => sum + entry.pt, 0),
    entries: roleEntries,
  }));

  // Calculate total project PT
  const totalProjectPT = entries.reduce((sum, entry) => sum + entry.pt, 0);

  // Available phases (unique)
  const phases = [...new Set(entries.map(e => e.phase))];

  // Phase colors
  const phaseColors: Record<string, string> = {
    Konzeption: 'hsl(var(--chart-1))',
    Design: 'hsl(var(--chart-2))',
    Development: 'hsl(var(--chart-3))',
    Testing: 'hsl(var(--chart-4))',
    Launch: 'hsl(var(--chart-5))',
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staffing & Ressourcen-Timeline
            </CardTitle>
            <CardDescription>Rollen-basierte Planung über Projekt-Phasen</CardDescription>
          </div>
          <Badge variant="outline" className="ml-4">
            {totalProjectPT} PT gesamt
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Projekt-Dauer
            </div>
            <div className="text-2xl font-bold">{totalMonths}</div>
            <div className="text-xs text-muted-foreground">Monate</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Rollen
            </div>
            <div className="text-2xl font-bold">{roleTotals.length}</div>
            <div className="text-xs text-muted-foreground">verschiedene Rollen</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Phasen</div>
            <div className="text-2xl font-bold">{phases.length}</div>
            <div className="text-xs text-muted-foreground">Projekt-Phasen</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Gesamt PT</div>
            <div className="text-2xl font-bold">{totalProjectPT}</div>
            <div className="text-xs text-muted-foreground">Personen-Tage</div>
          </div>
        </div>

        {/* Gantt-like Timeline per Role */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Rollen-Timeline (Gantt-Ansicht)</div>

          <div className="space-y-4">
            {roleTotals.map(({ role, totalPT, entries: roleEntries }) => (
              <div key={role} className="space-y-1">
                {/* Role Name and Total PT */}
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{role}</div>
                  <div className="text-muted-foreground">{totalPT} PT</div>
                </div>

                {/* Timeline Bar Container */}
                <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                  {/* Render each phase entry for this role */}
                  {roleEntries.map((entry, idx) => {
                    const startPercent = ((entry.startMonth - minMonth) / totalMonths) * 100;
                    const durationPercent =
                      ((entry.endMonth - entry.startMonth) / totalMonths) * 100;
                    const color = phaseColors[entry.phase] || 'hsl(var(--primary))';

                    return (
                      <div
                        key={`${role}-${entry.phase}-${idx}`}
                        className="absolute h-full transition-all flex items-center px-2 text-white text-xs font-medium group cursor-pointer"
                        style={{
                          left: `${startPercent}%`,
                          width: `${durationPercent}%`,
                          background: color,
                        }}
                        title={`${entry.phase}: ${entry.pt} PT (Monat ${entry.startMonth} - ${entry.endMonth})`}
                      >
                        {durationPercent > 15 && (
                          <span className="truncate">
                            {entry.phase} ({entry.pt} PT)
                          </span>
                        )}

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                          <div className="bg-popover text-popover-foreground text-xs px-3 py-2 rounded-md shadow-md border whitespace-nowrap">
                            <div className="font-medium">{entry.phase}</div>
                            <div className="text-muted-foreground">
                              {entry.pt} PT • Monat {entry.startMonth}-{entry.endMonth}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Phase breakdown for this role */}
                <div className="text-xs text-muted-foreground pl-2 flex gap-2 flex-wrap">
                  {roleEntries.map((entry, idx) => (
                    <span key={idx}>
                      {entry.phase} ({entry.pt} PT)
                      {idx < roleEntries.length - 1 && ' •'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase Legend */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm font-medium mb-2">Phasen-Legende</div>
          <div className="flex flex-wrap gap-3">
            {phases.map(phase => (
              <div key={phase} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: phaseColors[phase] || 'hsl(var(--primary))' }}
                />
                <span className="text-sm">{phase}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Role Breakdown Table */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="text-sm font-medium">Ressourcen-Übersicht</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {roleTotals.map(({ role, totalPT }) => (
              <div key={role} className="flex justify-between">
                <span className="text-muted-foreground">{role}:</span>
                <span className="font-medium">{totalPT} PT</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact Staffing Display
 * For use in lists or sidebars
 */
export function StaffingCompact({ entries }: StaffingGanttChartProps) {
  if (!entries || entries.length === 0) {
    return <div className="text-sm text-muted-foreground">No staffing data</div>;
  }

  const totalPT = entries.reduce((sum, entry) => sum + entry.pt, 0);
  const roles = [...new Set(entries.map(e => e.role))].length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{roles} Rollen</span>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-xs">
          {totalPT} PT
        </Badge>
      </div>
    </div>
  );
}
