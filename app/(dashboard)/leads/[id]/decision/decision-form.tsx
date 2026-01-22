'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { Lead } from '@/lib/db/schema';
import { submitBLDecision } from '@/lib/leads/actions';

interface DecisionFormProps {
  lead: Lead;
}

export default function DecisionForm({ lead }: DecisionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedVote, setSelectedVote] = useState<'BID' | 'NO-BID' | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(50);
  const [reasoning, setReasoning] = useState<string>('');

  // If decision already made, show read-only view
  if (lead.blVote) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
          <p className="text-muted-foreground">
            Entscheidung für {lead.customerName} - Bereits entschieden
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entscheidung getroffen</CardTitle>
            <CardDescription>
              Diese Entscheidung wurde am{' '}
              {lead.blVotedAt ? new Date(lead.blVotedAt).toLocaleDateString('de-DE') : 'Unbekannt'}{' '}
              getroffen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vote</p>
              <Badge variant={lead.blVote === 'BID' ? 'default' : 'destructive'} className="mt-1">
                {lead.blVote}
              </Badge>
            </div>

            {lead.blConfidenceScore !== null && lead.blConfidenceScore !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Confidence Score</p>
                <p className="font-medium">{lead.blConfidenceScore}%</p>
              </div>
            )}

            {lead.blReasoning && (
              <div>
                <p className="text-sm text-muted-foreground">Begründung</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{lead.blReasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/leads/${lead.id}`)}>
            Zurück zur Lead-Übersicht
          </Button>
        </div>
      </div>
    );
  }

  // If not in bl_reviewing status, show error
  if (lead.status !== 'bl_reviewing') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
          <p className="text-muted-foreground">Entscheidung für {lead.customerName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entscheidung nicht möglich</CardTitle>
            <CardDescription>
              Dieser Lead befindet sich nicht im Status &quot;bl_reviewing&quot;
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aktueller Status: <Badge>{lead.status}</Badge>
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/leads/${lead.id}`)}>
            Zurück zur Lead-Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedVote) {
      setError('Bitte wählen Sie BID oder NO-BID');
      return;
    }

    if (reasoning.trim().length < 10) {
      setError('Begründung muss mindestens 10 Zeichen lang sein');
      return;
    }

    startTransition(async () => {
      const result = await submitBLDecision({
        leadId: lead.id,
        vote: selectedVote,
        confidenceScore,
        reasoning: reasoning.trim(),
      });

      if (result.success) {
        router.push(`/leads/${lead.id}`);
        router.refresh();
      } else {
        setError(result.error || 'Ein Fehler ist aufgetreten');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BID/NO-BID Entscheidung</h1>
        <p className="text-muted-foreground">Entscheidung für {lead.customerName}</p>
      </div>

      {/* Lead Context */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Informationen</CardTitle>
          <CardDescription>Übersicht über den Lead</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lead.websiteUrl && (
            <div>
              <p className="text-sm text-muted-foreground">Website</p>
              <p className="text-sm">{lead.websiteUrl}</p>
            </div>
          )}
          {lead.industry && (
            <div>
              <p className="text-sm text-muted-foreground">Branche</p>
              <p className="text-sm">{lead.industry}</p>
            </div>
          )}
          {lead.projectDescription && (
            <div>
              <p className="text-sm text-muted-foreground">Projektbeschreibung</p>
              <p className="text-sm">{lead.projectDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Ihre Entscheidung</CardTitle>
            <CardDescription>
              Bitte treffen Sie eine BID/NO-BID Entscheidung für diesen Lead
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Vote Selection */}
            <div className="space-y-2">
              <Label>Vote</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedVote === 'BID' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setSelectedVote('BID')}
                >
                  BID
                </Button>
                <Button
                  type="button"
                  variant={selectedVote === 'NO-BID' ? 'destructive' : 'outline'}
                  className="flex-1"
                  onClick={() => setSelectedVote('NO-BID')}
                >
                  NO-BID
                </Button>
              </div>
            </div>

            {/* Confidence Score Slider */}
            <div className="space-y-2">
              <Label>Confidence Score: {confidenceScore}%</Label>
              <Slider
                value={[confidenceScore]}
                onValueChange={values => setConfidenceScore(values[0] ?? 50)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Wie sicher sind Sie mit Ihrer Entscheidung? (0% = sehr unsicher, 100% = sehr sicher)
              </p>
            </div>

            {/* Reasoning Textarea */}
            <div className="space-y-2">
              <Label htmlFor="reasoning">Begründung</Label>
              <Textarea
                id="reasoning"
                value={reasoning}
                onChange={e => setReasoning(e.target.value)}
                placeholder="Bitte begründen Sie Ihre Entscheidung (mindestens 10 Zeichen)..."
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                Warum haben Sie sich für BID oder NO-BID entschieden?
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending || !selectedVote}>
                {isPending ? 'Wird gespeichert...' : 'Entscheidung speichern'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/leads/${lead.id}`)}
                disabled={isPending}
              >
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
