'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Users, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { suggestTeamForBid, assignTeam } from '@/lib/team/actions';
import type { TeamSuggestion, TeamMemberSuggestion, TeamAssignment } from '@/lib/team/schema';

interface TeamBuilderProps {
  bidId: string;
}

export function TeamBuilder({ bidId }: TeamBuilderProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<TeamSuggestion | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<TeamMemberSuggestion[]>([]);
  const [showGapWarning, setShowGapWarning] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Load AI suggestion on mount
  useEffect(() => {
    loadTeamSuggestion();
  }, [bidId]);

  const loadTeamSuggestion = async () => {
    setIsLoading(true);
    toast.info('Lade Team-Empfehlung...');

    try {
      const result = await suggestTeamForBid(bidId);

      if (result.success && result.suggestion) {
        setSuggestion(result.suggestion);
        setSelectedMembers(result.suggestion.members);
        toast.success('Team-Empfehlung geladen!');
      } else {
        toast.error(result.error || 'Fehler beim Laden der Empfehlung');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.employeeId !== memberId));
    toast.info('Team-Mitglied entfernt');
  };

  const handleAssignTeam = async () => {
    // Validate minimum requirements
    const hasProjectManager = selectedMembers.some((m) => m.role === 'project_manager');
    const developerCount = selectedMembers.filter((m) =>
      [
        'developer',
        'senior_developer',
        'frontend_developer',
        'backend_developer',
        'technical_lead',
      ].includes(m.role)
    ).length;

    if (!hasProjectManager) {
      toast.error('Team muss einen Project Manager enthalten');
      return;
    }

    if (developerCount < 2) {
      toast.error('Team muss mindestens 2 Entwickler enthalten');
      return;
    }

    // Check for skill gaps
    if (suggestion && suggestion.skillGaps.length > 0 && !showGapWarning) {
      setShowGapWarning(true);
      return;
    }

    setIsAssigning(true);
    toast.info('Weise Team zu...');

    try {
      const teamAssignment: TeamAssignment = {
        members: selectedMembers.map((m) => ({
          employeeId: m.employeeId,
          name: m.name,
          role: m.role,
        })),
        assignedBy: 'current-user-id', // TODO: Get from session
        assignedAt: new Date().toISOString(),
        acknowledgedGaps: suggestion?.skillGaps.map((g) => g.skill),
      };

      const result = await assignTeam(bidId, teamAssignment);

      if (result.success) {
        toast.success('Team erfolgreich zugewiesen!');
        router.refresh();
      } else {
        toast.error(result.error || 'Team-Zuweisung fehlgeschlagen');
        setIsAssigning(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      setIsAssigning(false);
    }
  };

  const roleLabels: Record<string, string> = {
    project_manager: 'Project Manager',
    technical_lead: 'Technical Lead',
    senior_developer: 'Senior Developer',
    developer: 'Developer',
    frontend_developer: 'Frontend Developer',
    backend_developer: 'Backend Developer',
    ux_designer: 'UX Designer',
    qa_engineer: 'QA Engineer',
    devops_engineer: 'DevOps Engineer',
    business_analyst: 'Business Analyst',
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              AI generiert Team-Empfehlung...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team-Empfehlung konnte nicht geladen werden</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={loadTeamSuggestion}>Erneut versuchen</Button>
        </CardContent>
      </Card>
    );
  }

  const isLowConfidence = suggestion.overallConfidence < 70;

  return (
    <div className="space-y-6">
      {/* AI Suggestion Header */}
      <Card className={isLowConfidence ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className={isLowConfidence ? 'h-6 w-6 text-amber-600' : 'h-6 w-6 text-blue-600'} />
              <div>
                <CardTitle className={isLowConfidence ? 'text-amber-900' : 'text-blue-900'}>
                  AI Team-Empfehlung
                </CardTitle>
                <CardDescription className={isLowConfidence ? 'text-amber-700' : 'text-blue-700'}>
                  Optimale Team-Zusammensetzung basierend auf Anforderungen
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={isLowConfidence ? 'destructive' : 'secondary'}
              className={isLowConfidence ? '' : 'bg-blue-100 text-blue-900'}
            >
              {suggestion.overallConfidence}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Begründung</p>
            <p className="text-sm text-foreground">{suggestion.reasoning}</p>
          </div>

          {/* Required Roles Check */}
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Erforderliche Rollen</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {suggestion.hasProjectManager ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span className="text-sm">Project Manager</span>
              </div>
              <div className="flex items-center gap-2">
                {suggestion.hasTechnicalLead ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span className="text-sm">Technical Lead</span>
              </div>
              <div className="flex items-center gap-2">
                {suggestion.hasMinimumDevelopers ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span className="text-sm">Mindestens 2 Entwickler</span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {suggestion.warnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {suggestion.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Vorgeschlagenes Team ({selectedMembers.length} Mitglieder)</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedMembers.map((member) => (
            <Card key={member.employeeId} className="border-muted">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <Badge>{roleLabels[member.role] || member.role}</Badge>
                      </div>
                    </div>

                    {/* Skill Match */}
                    <div className="grid gap-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Skill Match: {member.skillMatchScore}%
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {member.matchingSkills.map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              ✓ {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {member.missingSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-amber-700">Fehlende Skills:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {member.missingSkills.map((skill, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Availability */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Verfügbarkeit:</span>
                      <Badge
                        variant={
                          member.availabilityStatus === 'available'
                            ? 'default'
                            : member.availabilityStatus === 'on_project'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {member.availabilityStatus === 'available' && 'Verfügbar'}
                        {member.availabilityStatus === 'on_project' && 'Im Projekt'}
                        {member.availabilityStatus === 'unavailable' && 'Nicht verfügbar'}
                      </Badge>
                    </div>

                    {/* Reasoning */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Begründung:</p>
                      <p className="text-xs text-muted-foreground mt-1">{member.reasoning}</p>
                    </div>

                    {member.similarProjectExperience && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Ähnliche Projekte:
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {member.similarProjectExperience}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.employeeId)}
                  >
                    Entfernen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {selectedMembers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keine Team-Mitglieder ausgewählt</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Gaps */}
      {suggestion.skillGaps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Identifizierte Skill-Lücken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestion.skillGaps.map((gap, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Badge
                    variant={
                      gap.severity === 'critical'
                        ? 'destructive'
                        : gap.severity === 'important'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {gap.severity}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">{gap.skill}</p>
                    <p className="text-sm text-amber-800">{gap.recommendation}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleAssignTeam} disabled={isAssigning} className="flex-1">
          {isAssigning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird zugewiesen...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Team zuweisen
            </>
          )}
        </Button>
      </div>

      {/* Gap Warning Dialog */}
      <AlertDialog open={showGapWarning} onOpenChange={setShowGapWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Skill-Lücken bestätigen
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Das vorgeschlagene Team hat folgende Skill-Lücken:</p>
              <ul className="list-disc list-inside space-y-1">
                {suggestion?.skillGaps.map((gap, idx) => (
                  <li key={idx} className="text-sm">
                    <strong>{gap.skill}</strong> ({gap.severity})
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                Möchten Sie das Team trotz dieser Lücken zuweisen?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowGapWarning(false)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignTeam}>
              Trotzdem zuweisen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
