'use client';

import { Users, Info } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Staffing Entry represents resource allocation for a specific role and phase
 */
export interface StaffingEntry {
  role: string;
  phase: string;
  startMonth: number;
  endMonth: number;
  pt: number; // Person-Days allocated
}

interface StaffingGanttChartProps {
  entries: StaffingEntry[];
  className?: string;
}

/**
 * Staffing Gantt Chart Component
 *
 * Displays team resource allocation across project phases in a Gantt-like timeline.
 * Shows roles (PM, UX, Frontend, Backend, DevOps, QA) and their allocation across phases
 * (Konzeption, Design, Development, Testing, Launch).
 *
 * Based on DEA-148 requirements and existing timeline patterns.
 */
export function StaffingGanttChart({ entries, className }: StaffingGanttChartProps) {
  if (entries.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ressourcenplanung
          </CardTitle>
          <CardDescription>Team-Allocation über Projektphasen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Staffing-Daten verfügbar. Starten Sie die Team-Zuweisung.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate timeline bounds
  const minMonth = Math.min(...entries.map((e) => e.startMonth));
  const maxMonth = Math.max(...entries.map((e) => e.endMonth));
  const totalMonths = maxMonth - minMonth + 1;

  // Group entries by role for display
  const roles = Array.from(new Set(entries.map((e) => e.role)));
  const roleOrder = ['PM', 'UX', 'Frontend', 'Backend', 'DevOps', 'QA'];
  const sortedRoles = roles.sort(
    (a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b) || a.localeCompare(b)
  );

  // Calculate total PT per role
  const rolePT = sortedRoles.map((role) => ({
    role,
    totalPT: entries.filter((e) => e.role === role).reduce((sum, e) => sum + e.pt, 0),
  }));

  // Role colors
  const roleColors: Record<string, string> = {
    PM: 'bg-purple-500',
    UX: 'bg-pink-500',
    Frontend: 'bg-blue-500',
    Backend: 'bg-green-500',
    DevOps: 'bg-orange-500',
    QA: 'bg-teal-500',
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ressourcenplanung
            </CardTitle>
            <CardDescription>Team-Allocation über Projektphasen</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Projekt-Dauer</div>
            <div className="text-2xl font-bold">{totalMonths} Monate</div>
            <div className="text-xs text-muted-foreground">
              Monat {minMonth} - {maxMonth}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Rollen</div>
            <div className="text-2xl font-bold">{sortedRoles.length}</div>
            <div className="text-xs text-muted-foreground">Verschiedene Rollen</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Gesamt-Aufwand</div>
            <div className="text-2xl font-bold">
              {entries.reduce((sum, e) => sum + e.pt, 0)} PT
            </div>
            <div className="text-xs text-muted-foreground">Person-Days</div>
          </div>
        </div>

        {/* Gantt Chart */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Ressourcen-Übersicht</div>

          {sortedRoles.map((role) => {
            const roleEntries = entries.filter((e) => e.role === role);
            const roleTotal = rolePT.find((r) => r.role === role)?.totalPT || 0;
            const color = roleColors[role] || 'bg-gray-500';

            return (
              <div key={role} className="space-y-1">
                {/* Role Name and Total PT */}
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <div className={`h-3 w-3 rounded ${color}`} />
                    {role}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {roleTotal} PT
                  </Badge>
                </div>

                {/* Timeline Bar Container */}
                <div className="relative h-10 bg-muted rounded-md overflow-hidden">
                  {/* Timeline Grid (months) */}
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: totalMonths }).map((_, idx) => (
                      <div
                        key={idx}
                        className="flex-1 border-r border-border/50 last:border-r-0"
                      />
                    ))}
                  </div>

                  {/* Role Allocation Bars */}
                  {roleEntries.map((entry, idx) => {
                    const startOffset = entry.startMonth - minMonth;
                    const duration = entry.endMonth - entry.startMonth + 1;
                    const leftPercent = (startOffset / totalMonths) * 100;
                    const widthPercent = (duration / totalMonths) * 100;

                    return (
                      <div
                        key={`${entry.phase}-${idx}`}
                        className={`absolute h-full ${color} transition-all flex items-center justify-center text-white text-xs font-medium group hover:opacity-90 cursor-pointer`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                        title={`${entry.phase}: ${entry.pt} PT (Monat ${entry.startMonth}-${entry.endMonth})`}
                      >
                        {/* Only show text if bar is wide enough */}
                        {widthPercent > 15 && (
                          <div className="truncate px-2">
                            <div className="font-semibold">{entry.phase}</div>
                            <div className="text-[10px] opacity-90">{entry.pt} PT</div>
                          </div>
                        )}
                        {widthPercent <= 15 && widthPercent > 8 && (
                          <div className="text-[10px] font-semibold">{entry.pt}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Phases for this role */}
                <div className="text-xs text-muted-foreground pl-2">
                  {roleEntries.map((e) => e.phase).join(' → ')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Axis */}
        <div className="border-t pt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            {Array.from({ length: Math.min(totalMonths, 12) }).map((_, idx) => {
              const monthNum = minMonth + Math.floor((idx / 12) * totalMonths);
              return (
                <div key={idx} className="flex-1 text-center">
                  M{monthNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm font-medium flex items-center gap-2 mb-2">
            <Info className="h-4 w-4" />
            Legende
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {sortedRoles.map((role) => (
              <div key={role} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded ${roleColors[role] || 'bg-gray-500'}`} />
                <span className="text-muted-foreground">{role}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            PT = Person-Days (Personentage) • Hover über Balken für Details
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
