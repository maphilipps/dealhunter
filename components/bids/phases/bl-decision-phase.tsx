'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Gavel,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { QuickScan } from '@/lib/db/schema';

interface BLDecisionPhaseProps {
  quickScan: QuickScan;
  rfpId: string;
}

type Decision = 'bid' | 'no-bid' | null;

export function BLDecisionPhase({ quickScan, rfpId }: BLDecisionPhaseProps) {
  const [decision, setDecision] = useState<Decision>(null);
  const [reasoning, setReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!decision) return;

    setSubmitting(true);
    try {
      // TODO: Implement actual decision submission API
      const res = await fetch(`/api/rfps/${rfpId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reasoning }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card
        className={decision === 'bid' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}
      >
        <CardContent className="py-12 text-center">
          {decision === 'bid' ? (
            <>
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">BID-Entscheidung erfasst</h2>
              <p className="text-green-700">
                Das Team wird über die positive Entscheidung informiert.
              </p>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 mx-auto text-red-600 mb-4" />
              <h2 className="text-2xl font-bold text-red-800 mb-2">NO-BID-Entscheidung erfasst</h2>
              <p className="text-red-700">Die Anfrage wurde abgelehnt. Grund wurde dokumentiert.</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-violet-600" />
            <CardTitle>Bid/No-Bid Entscheidung</CardTitle>
          </div>
          <CardDescription>
            Als Bereichsleiter entscheiden Sie, ob diese Anfrage bearbeitet wird.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Context Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Empfohlene BU</p>
              <p className="font-medium">{quickScan.recommendedBusinessUnit || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <Badge
                variant={
                  (quickScan.confidence || 0) >= 70
                    ? 'default'
                    : (quickScan.confidence || 0) >= 50
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {quickScan.confidence || 0}%
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Website</p>
              <a
                href={quickScan.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                {new URL(quickScan.websiteUrl).hostname}
              </a>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CMS/Tech</p>
              <p className="font-medium">{quickScan.cms || quickScan.framework || '-'}</p>
            </div>
          </div>
          {quickScan.reasoning && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">AI-Begründung</p>
              <p className="text-sm">{quickScan.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ihre Entscheidung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Decision Radio */}
          <div>
            <Label className="text-base mb-4 block">Wie lautet Ihre Entscheidung?</Label>
            <RadioGroup
              value={decision || ''}
              onValueChange={v => setDecision(v as Decision)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="bid"
                className={`flex items-center gap-4 p-6 border-2 rounded-lg cursor-pointer transition-colors ${
                  decision === 'bid'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-green-300 hover:bg-green-50/50'
                }`}
              >
                <RadioGroupItem value="bid" id="bid" />
                <div className="flex items-center gap-3">
                  <ThumbsUp
                    className={`h-8 w-8 ${decision === 'bid' ? 'text-green-600' : 'text-slate-400'}`}
                  />
                  <div>
                    <p className="font-semibold text-lg">BID</p>
                    <p className="text-sm text-muted-foreground">Anfrage bearbeiten</p>
                  </div>
                </div>
              </Label>

              <Label
                htmlFor="no-bid"
                className={`flex items-center gap-4 p-6 border-2 rounded-lg cursor-pointer transition-colors ${
                  decision === 'no-bid'
                    ? 'border-red-500 bg-red-50'
                    : 'border-slate-200 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <RadioGroupItem value="no-bid" id="no-bid" />
                <div className="flex items-center gap-3">
                  <ThumbsDown
                    className={`h-8 w-8 ${decision === 'no-bid' ? 'text-red-600' : 'text-slate-400'}`}
                  />
                  <div>
                    <p className="font-semibold text-lg">NO-BID</p>
                    <p className="text-sm text-muted-foreground">Anfrage ablehnen</p>
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </div>

          <Separator />

          {/* Reasoning */}
          <div>
            <Label htmlFor="reasoning" className="text-base mb-2 block">
              <MessageSquare className="h-4 w-4 inline mr-2" />
              Begründung {decision === 'no-bid' && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="reasoning"
              placeholder={
                decision === 'bid'
                  ? 'Optional: Notizen für das Team...'
                  : 'Pflicht bei No-Bid: Warum wird diese Anfrage abgelehnt?'
              }
              value={reasoning}
              onChange={e => setReasoning(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {decision === 'no-bid' && !reasoning && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Bei No-Bid ist eine Begründung erforderlich
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!decision || (decision === 'no-bid' && !reasoning) || submitting}
            className={`w-full ${
              decision === 'bid'
                ? 'bg-green-600 hover:bg-green-700'
                : decision === 'no-bid'
                  ? 'bg-red-600 hover:bg-red-700'
                  : ''
            }`}
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Entscheidung abschließen
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Hinweis</p>
              <p className="text-sm text-yellow-700">
                Diese Entscheidung ist verbindlich. Bei BID wird das zuständige Team automatisch
                benachrichtigt und der Workflow zur Angebotserstellung gestartet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
