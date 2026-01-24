/**
 * Help Panel Component
 *
 * Collapsible help panel with FAQs, keyboard shortcuts, and quick links.
 * Used for capability discovery and user guidance.
 */

'use client';

import { HelpCircle, Keyboard, Link as LinkIcon, X } from 'lucide-react';
import { useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface HelpItem {
  question: string;
  answer: string;
}

export interface Shortcut {
  keys: string[];
  description: string;
}

export interface QuickLink {
  label: string;
  href: string;
  description?: string;
}

export interface HelpPanelProps {
  faqs?: HelpItem[];
  shortcuts?: Shortcut[];
  quickLinks?: QuickLink[];
}

const defaultFAQs: HelpItem[] = [
  {
    question: 'Wie lade ich ein RFP hoch?',
    answer:
      'Gehe zu "RFPs" → "New RFP" und lade eine PDF-Datei hoch oder füge den Text direkt ein. Der AI Agent extrahiert automatisch alle relevanten Informationen.',
  },
  {
    question: 'Was ist ein Quick Scan?',
    answer:
      'Der Quick Scan analysiert automatisch die Website des Kunden, identifiziert den Tech Stack und gibt eine initiale BID/NO-BID Empfehlung basierend auf der Business Line.',
  },
  {
    question: 'Wie funktioniert die BID/NO-BID Entscheidung?',
    answer:
      'Die Entscheidung basiert auf 6 Faktoren: Capability Match (25%), Deal Quality (20%), Strategic Fit (15%), Win Probability (15%), Legal Constraints (15%), und References (10%). Ein Score ≥ 55 bedeutet BID.',
  },
  {
    question: 'Wann wird ein Deep Scan ausgeführt?',
    answer:
      'Ein Deep Scan wird manuell gestartet und führt eine umfassende Analyse durch: Migration Complexity, CMS Comparison, Hosting Requirements, Integration Landscape, Timeline & Cost Estimation.',
  },
];

const defaultShortcuts: Shortcut[] = [
  { keys: ['Cmd', 'K'], description: 'Command Palette öffnen' },
  { keys: ['Cmd', 'B'], description: 'Sidebar ein-/ausblenden' },
  { keys: ['G', 'L'], description: 'Zu Qualifications navigieren' },
  { keys: ['G', 'R'], description: 'Zu Pre-Qualifications navigieren' },
  { keys: ['N'], description: 'Neue Pre-Qualification erstellen' },
];

const defaultQuickLinks: QuickLink[] = [
  {
    label: 'Pre-Qualifications verwalten',
    href: '/pre-qualifications',
    description: 'Alle Pre-Qualifications anzeigen und verwalten',
  },
  {
    label: 'Qualifications Dashboard',
    href: '/qualifications',
    description: 'Aktuelle Qualifications und Status',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    description: 'Conversion Rates und Performance Metriken',
  },
  {
    label: 'Admin Settings',
    href: '/admin',
    description: 'Business Units, Employees, Configuration',
  },
];

export function HelpPanel({
  faqs = defaultFAQs,
  shortcuts = defaultShortcuts,
  quickLinks = defaultQuickLinks,
}: HelpPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Help & Guidance</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* FAQs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Häufig gestellte Fragen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, idx) => (
                  <AccordionItem key={idx} value={`faq-${idx}`}>
                    <AccordionTrigger className="text-left text-sm">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shortcuts.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <Badge key={keyIdx} variant="secondary" className="font-mono">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="font-medium text-sm">{link.label}</div>
                    {link.description && (
                      <div className="text-xs text-muted-foreground mt-1">{link.description}</div>
                    )}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
