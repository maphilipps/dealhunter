'use client';

import { Users, Mail, Phone, ExternalLink, Building } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import type { DecisionMakersResearch } from '@/lib/quick-scan/schema';

interface Contact {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  category?: 'decision_maker' | 'influencer' | 'coordinator' | 'unknown';
  confidence?: number;
  source: 'RFP' | 'QuickScan';
  linkedInUrl?: string;
}

interface EnhancedDecisionMakersCardProps {
  rfpContacts: ExtractedRequirements['contacts'];
  quickScanDecisionMakers: DecisionMakersResearch | null;
}

/**
 * Enhanced Decision Makers Card
 *
 * Kombiniert RFP contacts (aus Ausschreibung) mit QuickScan decisionMakers (Website-Research).
 * Dedupliziert nach Email-Adresse.
 */
export function EnhancedDecisionMakersCard({
  rfpContacts,
  quickScanDecisionMakers,
}: EnhancedDecisionMakersCardProps) {
  // Merge and deduplicate contacts
  const allContacts: Contact[] = [];

  // Add RFP contacts
  if (rfpContacts && rfpContacts.length > 0) {
    rfpContacts.forEach(contact => {
      allContacts.push({
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        category: contact.category,
        confidence: contact.confidence,
        source: 'RFP',
      });
    });
  }

  // Add QuickScan decisionMakers (only if not already in RFP contacts by email)
  if (quickScanDecisionMakers && quickScanDecisionMakers.decisionMakers.length > 0) {
    quickScanDecisionMakers.decisionMakers.forEach(dm => {
      // Check if already exists in RFP contacts by email
      const emailMatch = dm.email
        ? allContacts.find(c => c.email?.toLowerCase() === dm.email?.toLowerCase())
        : null;

      if (!emailMatch) {
        allContacts.push({
          name: dm.name,
          role: dm.role,
          email: dm.email,
          linkedInUrl: dm.linkedInUrl,
          source: 'QuickScan',
        });
      } else {
        // Merge LinkedIn URL if available
        if (dm.linkedInUrl && !emailMatch.linkedInUrl) {
          emailMatch.linkedInUrl = dm.linkedInUrl;
        }
      }
    });
  }

  if (allContacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Entscheider & Kontakte</CardTitle>
          </div>
          <CardDescription>Keine Kontakte gefunden</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Group by source
  const rfpContactsList = allContacts.filter(c => c.source === 'RFP');
  const quickScanContactsList = allContacts.filter(c => c.source === 'QuickScan');

  // Category Badge Helper
  const getCategoryBadge = (category?: string) => {
    if (!category || category === 'unknown') return null;

    const config: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
    > = {
      decision_maker: { label: 'Entscheider', variant: 'default' },
      influencer: { label: 'Influencer', variant: 'secondary' },
      coordinator: { label: 'Koordinator', variant: 'outline' },
    };

    const cfg = config[category];
    return cfg ? <Badge variant={cfg.variant}>{cfg.label}</Badge> : null;
  };

  // Render Contact Helper
  const renderContact = (contact: Contact, idx: number) => {
    return (
      <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">
          {contact.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Name & Role */}
          <div>
            <p className="font-medium text-sm truncate">{contact.name}</p>
            <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-1">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Mail className="h-3 w-3" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Phone className="h-3 w-3" />
                {contact.phone}
              </a>
            )}
            {contact.linkedInUrl && (
              <a
                href={contact.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                LinkedIn
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {contact.category && getCategoryBadge(contact.category)}
          {contact.confidence !== undefined && contact.confidence < 70 && (
            <Badge variant="outline" className="text-xs">
              {contact.confidence}%
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <CardTitle>Entscheider & Kontakte</CardTitle>
        </div>
        <CardDescription>
          {rfpContactsList.length} aus Ausschreibung, {quickScanContactsList.length} aus
          Website-Research
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* RFP Contacts Section */}
        {rfpContactsList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">RFP Kontakte</h3>
              <Badge variant="secondary" className="text-xs">
                {rfpContactsList.length}
              </Badge>
            </div>
            <div className="space-y-3">{rfpContactsList.map(renderContact)}</div>
          </div>
        )}

        {/* Separator */}
        {rfpContactsList.length > 0 && quickScanContactsList.length > 0 && <Separator />}

        {/* QuickScan Contacts Section */}
        {quickScanContactsList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Website-Research</h3>
              <Badge variant="secondary" className="text-xs">
                {quickScanContactsList.length}
              </Badge>
            </div>
            <div className="space-y-3">{quickScanContactsList.map(renderContact)}</div>
          </div>
        )}

        {/* Research Quality (if available from QuickScan) */}
        {quickScanDecisionMakers?.researchQuality && (
          <>
            <Separator />
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Research Confidence</span>
                <span className="text-xs font-bold">
                  {quickScanDecisionMakers.researchQuality.confidence}%
                </span>
              </div>
              <Progress
                value={quickScanDecisionMakers.researchQuality.confidence}
                className="h-1"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
