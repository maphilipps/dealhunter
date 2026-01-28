/**
 * Quick-Scan Summary Grid
 *
 * Zeigt eine Grid-Übersicht aller Quick-Scan Ergebnisse mit Links zu den Detail-Seiten.
 */

import { Code2, Building2, FileText, ShieldCheck, ArrowRightLeft, Compass } from 'lucide-react';

import { SummaryLinkCard } from './summary-link-card';

import type { quickScans } from '@/lib/db/schema';

type QuickScan = typeof quickScans.$inferSelect;

export interface QuickScanSummaryGridProps {
  preQualificationId: string;
  quickScan: QuickScan | null;
}

interface ParsedData {
  techStack?: {
    cms?: string | null;
    framework?: string | null;
    hosting?: string | null;
    libraries?: string[];
  };
  contentVolume?: {
    estimatedPageCount?: number;
    contentTypes?: string[];
  };
  companyIntelligence?: {
    companyName?: string;
    industry?: string;
    employeeCount?: string;
  };
  accessibilityAudit?: {
    overallScore?: number;
    issues?: Array<{ severity: string }>;
  };
  seoAudit?: {
    overallScore?: number;
    issues?: Array<{ severity: string }>;
  };
  legalCompliance?: {
    gdprCompliant?: boolean;
    hasPrivacyPolicy?: boolean;
    hasCookieConsent?: boolean;
  };
  migrationComplexity?: {
    overallScore?: number;
    reasoning?: string;
  };
  decisionMakers?: {
    decisionMakers?: Array<{ name: string; role?: string }>;
  };
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getTechStackSummary(quickScan: QuickScan): { summary: string | null; details: string[] } {
  const techStack = safeJsonParse<ParsedData['techStack']>(quickScan.techStack);

  if (!techStack && !quickScan.cms && !quickScan.framework) {
    return { summary: null, details: [] };
  }

  const parts: string[] = [];
  if (quickScan.cms) parts.push(quickScan.cms);
  if (quickScan.framework) parts.push(quickScan.framework);
  if (quickScan.hosting) parts.push(quickScan.hosting);

  const details: string[] = [];
  if (techStack?.libraries) {
    details.push(...techStack.libraries.slice(0, 5));
  }

  return {
    summary: parts.length > 0 ? parts.join(' + ') : 'Tech-Stack analysiert',
    details,
  };
}

function getCompanySummary(quickScan: QuickScan): { summary: string | null; details: string[] } {
  const company = safeJsonParse<ParsedData['companyIntelligence']>(quickScan.companyIntelligence);
  const decisionMakers = safeJsonParse<ParsedData['decisionMakers']>(quickScan.decisionMakers);

  if (!company && !decisionMakers) {
    return { summary: null, details: [] };
  }

  const parts: string[] = [];
  if (company?.companyName) parts.push(company.companyName);
  if (company?.industry) parts.push(company.industry);

  const details: string[] = [];
  if (decisionMakers?.decisionMakers) {
    details.push(
      ...decisionMakers.decisionMakers.slice(0, 3).map(dm => dm.name || dm.role || 'Kontakt')
    );
  }

  return {
    summary: parts.length > 0 ? parts.join(' - ') : 'Unternehmensdaten verfügbar',
    details,
  };
}

function getContentSummary(quickScan: QuickScan): { summary: string | null; details: string[] } {
  const content = safeJsonParse<ParsedData['contentVolume']>(quickScan.contentVolume);

  if (!content) {
    return { summary: null, details: [] };
  }

  const parts: string[] = [];
  if (content.estimatedPageCount) {
    parts.push(`~${content.estimatedPageCount} Seiten`);
  }

  const details: string[] = [];
  if (content.contentTypes) {
    details.push(...content.contentTypes.slice(0, 4));
  }

  return {
    summary: parts.length > 0 ? parts.join(', ') : 'Content analysiert',
    details,
  };
}

function getAuditsSummary(quickScan: QuickScan): { summary: string | null; details: string[] } {
  const accessibility = safeJsonParse<ParsedData['accessibilityAudit']>(
    quickScan.accessibilityAudit
  );
  const seo = safeJsonParse<ParsedData['seoAudit']>(quickScan.seoAudit);
  const legal = safeJsonParse<ParsedData['legalCompliance']>(quickScan.legalCompliance);

  if (!accessibility && !seo && !legal) {
    return { summary: null, details: [] };
  }

  const parts: string[] = [];
  if (accessibility?.overallScore !== undefined) {
    parts.push(`A11y: ${accessibility.overallScore}/100`);
  }
  if (seo?.overallScore !== undefined) {
    parts.push(`SEO: ${seo.overallScore}/100`);
  }
  if (legal?.gdprCompliant !== undefined) {
    parts.push(legal.gdprCompliant ? 'DSGVO OK' : 'DSGVO prüfen');
  }

  const details: string[] = [];
  if (legal?.hasPrivacyPolicy) details.push('Datenschutz');
  if (legal?.hasCookieConsent) details.push('Cookie-Banner');

  return {
    summary: parts.length > 0 ? parts.join(' | ') : 'Audits durchgeführt',
    details,
  };
}

function getMigrationSummary(quickScan: QuickScan): { summary: string | null; details: string[] } {
  const migration = safeJsonParse<ParsedData['migrationComplexity']>(quickScan.migrationComplexity);

  if (!migration) {
    return { summary: null, details: [] };
  }

  const score = migration.overallScore;
  let complexity = 'Unbekannt';
  if (score !== undefined) {
    if (score <= 3) complexity = 'Gering';
    else if (score <= 6) complexity = 'Mittel';
    else complexity = 'Hoch';
  }

  return {
    summary: `Komplexität: ${complexity}${score !== undefined ? ` (${score}/10)` : ''}`,
    details: migration.reasoning ? [migration.reasoning.slice(0, 50) + '...'] : [],
  };
}

function getRoutingSummary(quickScan: QuickScan): { summary: string | null; details: string[] } {
  if (!quickScan.recommendedBusinessUnit) {
    return { summary: null, details: [] };
  }

  const confidence = quickScan.confidence;
  const confidenceLabel =
    confidence && confidence >= 0.8
      ? 'Hohe'
      : confidence && confidence >= 0.5
        ? 'Mittlere'
        : 'Niedrige';

  return {
    summary: `${quickScan.recommendedBusinessUnit} (${confidenceLabel} Konfidenz)`,
    details: quickScan.reasoning ? [quickScan.reasoning.slice(0, 60) + '...'] : [],
  };
}

export function QuickScanSummaryGrid({ preQualificationId, quickScan }: QuickScanSummaryGridProps) {
  if (!quickScan || quickScan.status !== 'completed') {
    return null;
  }

  const techStack = getTechStackSummary(quickScan);
  const company = getCompanySummary(quickScan);
  const content = getContentSummary(quickScan);
  const audits = getAuditsSummary(quickScan);
  const migration = getMigrationSummary(quickScan);
  const routing = getRoutingSummary(quickScan);

  const cards = [
    {
      title: 'Tech Stack',
      icon: Code2,
      href: `/pre-qualifications/${preQualificationId}/routing/cms-matrix`,
      ...techStack,
    },
    {
      title: 'Unternehmen',
      icon: Building2,
      href: `/pre-qualifications/${preQualificationId}/deliverables`,
      ...company,
    },
    {
      title: 'Content',
      icon: FileText,
      href: `/pre-qualifications/${preQualificationId}/deliverables`,
      ...content,
    },
    {
      title: 'Audits',
      icon: ShieldCheck,
      href: `/pre-qualifications/${preQualificationId}/contracts`,
      ...audits,
    },
    {
      title: 'Migration',
      icon: ArrowRightLeft,
      href: `/pre-qualifications/${preQualificationId}/timing`,
      ...migration,
    },
    {
      title: 'BL Routing',
      icon: Compass,
      href: `/pre-qualifications/${preQualificationId}/routing`,
      ...routing,
    },
  ];

  // Filter: Nur Cards mit Daten anzeigen
  const visibleCards = cards.filter(card => card.summary !== null);

  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quick-Scan Ergebnisse</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map(card => (
          <SummaryLinkCard
            key={card.title}
            title={card.title}
            icon={card.icon}
            href={card.href}
            summary={card.summary}
            details={card.details}
          />
        ))}
      </div>
    </div>
  );
}
