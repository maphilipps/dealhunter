import { Mail, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Employee } from '@/lib/db/schema';

interface TeamMemberWithDetails {
  id: string;
  pitchdeckId: string;
  employeeId: string;
  role: 'pm' | 'ux' | 'frontend' | 'backend' | 'devops' | 'qa';
  createdAt: Date | null;
  employee: Employee;
}

interface PitchdeckTeamProps {
  teamMembers: TeamMemberWithDetails[];
}

const roleLabels: Record<string, string> = {
  pm: 'Project Manager',
  ux: 'UX Designer',
  frontend: 'Frontend Developer',
  backend: 'Backend Developer',
  devops: 'DevOps Engineer',
  qa: 'QA Engineer',
};

export function PitchdeckTeam({ teamMembers }: PitchdeckTeamProps) {
  if (teamMembers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Kein Team zugewiesen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Das Team wird nach der Bestätigung hier angezeigt.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team ({teamMembers.length} Mitglieder)</CardTitle>
        <CardDescription>Zugewiesene Team-Mitglieder für dieses Pitchdeck</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map(member => (
            <Card key={member.id} className="border-muted">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-none">{member.employee.name}</p>
                    <Badge variant="secondary" className="mt-1">
                      {roleLabels[member.role] || member.role}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{member.employee.email}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
