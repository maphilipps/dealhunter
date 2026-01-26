'use client';

import { Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuickScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface TenQuestionsTabProps {
  quickScan: QuickScan;
  extractedData?: ExtractedRequirements | null;
}

// Types for parsed fields
interface TechStackData {
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  framework?: string;
  hosting?: string;
  backend?: string[];
  libraries?: string[];
}

interface ContentVolumeData {
  estimatedPageCount?: number;
  complexity?: 'low' | 'medium' | 'high';
  languages?: string[];
}

interface FeaturesData {
  ecommerce?: boolean;
  userAccounts?: boolean;
  search?: boolean;
  multiLanguage?: boolean;
  blog?: boolean;
  forms?: boolean;
  api?: boolean;
}

interface AccessibilityAuditData {
  score: number;
  criticalIssues: number;
  seriousIssues: number;
  moderateIssues: number;
  minorIssues: number;
}

interface LegalComplianceData {
  score: number;
}

interface PerformanceData {
  estimatedLoadTime: 'fast' | 'medium' | 'slow';
}

interface CompanyIntelligenceData {
  basicInfo: {
    name: string;
    industry?: string;
  };
  financials?: {
    revenueClass?: string;
    publiclyTraded?: boolean;
  };
}

interface BlRecommendationData {
  primaryBusinessLine?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  alternativeBusinessLines?: Array<{ name: string; confidence: number }>;
  requiredSkills?: string[];
}

interface ResultsData {
  techStack: TechStackData | Record<string, never>;
  contentVolume: ContentVolumeData | Record<string, never>;
  features: FeaturesData | Record<string, never>;
  blRecommendation: BlRecommendationData;
  accessibilityAudit?: AccessibilityAuditData | null;
  seoAudit?: unknown;
  legalCompliance?: LegalComplianceData | null;
  performanceIndicators?: PerformanceData | null;
  companyIntelligence?: CompanyIntelligenceData | null;
}

// Helper to parse JSON fields safely
function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * 10 Fragen Tab
 * - Zeigt BIT-Entscheidungsfragen basierend auf Quick Scan Daten
 * - Extrahiert aus quick-scan-results.tsx BITDecisionOverview
 */
export function TenQuestionsTab({ quickScan, extractedData }: TenQuestionsTabProps) {
  // Parse JSON fields
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const performanceIndicators = parseJsonField<PerformanceData>(quickScan.performanceIndicators);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(
    quickScan.companyIntelligence
  );

  const results: ResultsData = {
    techStack: techStack || {},
    contentVolume: contentVolume || {},
    features: features || {},
    blRecommendation: {
      primaryBusinessLine: quickScan.recommendedBusinessUnit,
      confidence: quickScan.confidence,
      reasoning: quickScan.reasoning,
    },
    accessibilityAudit,
    legalCompliance,
    performanceIndicators,
    companyIntelligence,
  };

  // Helper to determine answer status
  // Only checks hasAnswer - simplified to avoid issues with undefined second parameter
  const getAnswerStatus = (hasAnswer: boolean) => {
    if (!hasAnswer) {
      return { status: 'unknown', color: 'bg-gray-100 text-gray-700', icon: '❓' };
    }
    return { status: 'answered', color: 'bg-green-50 text-green-800', icon: '✓' };
  };

  // Map data to the 10 BIT questions - combining Quick Scan and Pre-Qualification data
  const questions = [
    {
      id: 1,
      question: 'Wie ist die bisherige Geschäftsbeziehung zum Kunden?',
      answer: companyIntelligence?.basicInfo?.name
        ? `Unternehmen: ${companyIntelligence.basicInfo.name}${companyIntelligence.basicInfo.industry ? `, Branche: ${companyIntelligence.basicInfo.industry}` : ''}`
        : extractedData?.customerName
          ? `Unternehmen: ${extractedData.customerName}${extractedData.industry ? `, Branche: ${extractedData.industry}` : ''}`
          : null,
      source: companyIntelligence ? 'Company Intelligence' : 'Pre-Qualification-Extraktion',
      ...getAnswerStatus(!!companyIntelligence?.basicInfo?.name || !!extractedData?.customerName),
    },
    {
      id: 2,
      question: 'Wie hoch ist das Auftragsvolumen bzw. Budget?',
      answer: extractedData?.budgetRange
        ? `Budget: ${extractedData.budgetRange.min ? (extractedData.budgetRange.min / 1000).toFixed(0) + 'k' : '?'} - ${extractedData.budgetRange.max ? (extractedData.budgetRange.max / 1000).toFixed(0) + 'k' : '?'} ${extractedData.budgetRange.currency}`
        : companyIntelligence?.financials?.revenueClass
          ? `Umsatzklasse: ${companyIntelligence.financials.revenueClass}${companyIntelligence.financials.publiclyTraded ? ' (börsennotiert)' : ''}`
          : contentVolume &&
              'estimatedPageCount' in contentVolume &&
              contentVolume.estimatedPageCount
            ? `Geschätzte Projektgröße basierend auf ${contentVolume.estimatedPageCount} Seiten`
            : null,
      source: extractedData?.budgetRange ? 'Pre-Qualification-Dokument' : 'Company Intelligence / Content Volume',
      ...getAnswerStatus(
        !!extractedData?.budgetRange ||
          !!companyIntelligence?.financials ||
          !!(contentVolume && 'estimatedPageCount' in contentVolume)
      ),
    },
    {
      id: 3,
      question: 'Ist der Zeitplan realistisch?',
      answer: (() => {
        const parts: string[] = [];
        if (extractedData?.submissionDeadline) {
          const deadline = new Date(extractedData.submissionDeadline);
          parts.push(
            `Abgabefrist: ${deadline.toLocaleDateString('de-DE')}${extractedData.submissionTime ? ` ${extractedData.submissionTime} Uhr` : ''}`
          );
        }
        if (extractedData?.projectStartDate) {
          parts.push(
            `Projektstart: ${new Date(extractedData.projectStartDate).toLocaleDateString('de-DE')}`
          );
        }
        if (extractedData?.timeline) {
          parts.push(`Laufzeit: ${extractedData.timeline}`);
        }
        if (contentVolume && 'complexity' in contentVolume && contentVolume.complexity) {
          parts.push(
            `Komplexität: ${contentVolume.complexity === 'high' ? 'Hoch' : contentVolume.complexity === 'medium' ? 'Mittel' : 'Gering'}`
          );
        }
        return parts.length > 0 ? parts.join(' | ') : null;
      })(),
      source:
        extractedData?.submissionDeadline || extractedData?.timeline
          ? 'Pre-Qualification-Dokument / Content Volume'
          : 'Content Volume',
      ...getAnswerStatus(
        !!(
          extractedData?.submissionDeadline ||
          extractedData?.timeline ||
          (contentVolume && 'complexity' in contentVolume)
        )
      ),
    },
    {
      id: 4,
      question: 'Um welche Art von Vertrag handelt es sich?',
      answer: extractedData?.procurementType
        ? `Vergabeart: ${extractedData.procurementType === 'public' ? 'Öffentliche Ausschreibung' : extractedData.procurementType === 'private' ? 'Private Vergabe' : 'Semi-öffentlich'}`
        : null,
      source: extractedData?.procurementType ? 'Pre-Qualification-Dokument' : 'Manuell zu ermitteln',
      ...getAnswerStatus(!!extractedData?.procurementType),
    },
    {
      id: 5,
      question: 'Welche Leistungen werden benötigt?',
      answer: (() => {
        const services: string[] = [];
        // From Pre-Qualification extraction
        if (extractedData?.scope) services.push(extractedData.scope);
        // From Quick Scan
        if (techStack && 'cms' in techStack && techStack.cms)
          services.push(`CMS Migration von ${techStack.cms}`);
        if (features && 'ecommerce' in features && features.ecommerce)
          services.push('E-Commerce Integration');
        if (features && 'multiLanguage' in features && features.multiLanguage)
          services.push('Mehrsprachigkeit');
        if (features && 'userAccounts' in features && features.userAccounts)
          services.push('User Management');
        if (accessibilityAudit && accessibilityAudit.score < 50)
          services.push('Accessibility Überarbeitung');
        // From key requirements (first 3)
        if (extractedData?.keyRequirements?.length) {
          services.push(...extractedData.keyRequirements.slice(0, 3));
        }
        return services.length > 0 ? services.join(', ') : null;
      })(),
      source: 'Pre-Qualification-Dokument / Tech Stack / Features',
      ...getAnswerStatus(
        !!(extractedData?.scope || extractedData?.keyRequirements?.length || techStack || features)
      ),
    },
    {
      id: 6,
      question: 'Haben wir passende Referenzen?',
      answer: (() => {
        const refs: string[] = [];
        if (techStack && 'cms' in techStack && techStack.cms)
          refs.push(`${techStack.cms} Migrationen`);
        if (extractedData?.industry) refs.push(`${extractedData.industry}-Projekte`);
        if (extractedData?.technologies?.length)
          refs.push(`Technologien: ${extractedData.technologies.slice(0, 3).join(', ')}`);
        return refs.length > 0 ? `Prüfe Referenzen für: ${refs.join(', ')}` : null;
      })(),
      source: 'Tech Stack / Pre-Qualification → Referenz-Datenbank',
      ...getAnswerStatus(
        !!(techStack && 'cms' in techStack) ||
          !!extractedData?.industry ||
          !!extractedData?.technologies?.length
      ),
    },
    {
      id: 7,
      question: 'Welche Zuschlagskriterien gelten?',
      answer: (() => {
        // Try to extract criteria from key requirements or deliverables
        const criteria: string[] = [];
        if (extractedData?.requiredDeliverables?.length) {
          const mandatoryDeliverables = extractedData.requiredDeliverables
            .filter(d => d.mandatory)
            .map(d => d.name);
          if (mandatoryDeliverables.length > 0) {
            criteria.push(`Pflicht-Unterlagen: ${mandatoryDeliverables.join(', ')}`);
          }
        }
        if (extractedData?.constraints?.length) {
          criteria.push(...extractedData.constraints.slice(0, 2));
        }
        return criteria.length > 0 ? criteria.join(' | ') : null;
      })(),
      source: extractedData?.requiredDeliverables?.length
        ? 'Pre-Qualification-Dokument (Unterlagen)'
        : 'Ausschreibungsunterlagen',
      ...getAnswerStatus(
        !!extractedData?.requiredDeliverables?.length || !!extractedData?.constraints?.length
      ),
    },
    {
      id: 8,
      question: 'Welche Team-Anforderungen bestehen?',
      answer: (() => {
        const teamReqs: string[] = [];
        if (results.blRecommendation?.requiredSkills?.length) {
          teamReqs.push(`Skills: ${results.blRecommendation.requiredSkills.join(', ')}`);
        }
        if (extractedData?.teamSize) {
          teamReqs.push(`Teamgröße: ${extractedData.teamSize} Personen`);
        }
        if (extractedData?.technologies?.length) {
          teamReqs.push(`Tech-Expertise: ${extractedData.technologies.slice(0, 4).join(', ')}`);
        } else if (techStack && 'cms' in techStack && techStack.cms) {
          teamReqs.push(`${techStack.cms} Expertise benötigt`);
        }
        return teamReqs.length > 0 ? teamReqs.join(' | ') : null;
      })(),
      source: 'Pre-Qualification-Dokument / BL Recommendation / Tech Stack',
      ...getAnswerStatus(
        !!(
          results.blRecommendation?.requiredSkills ||
          extractedData?.teamSize ||
          extractedData?.technologies?.length ||
          (techStack && 'cms' in techStack)
        )
      ),
    },
    {
      id: 9,
      question: 'Welche besonderen Herausforderungen gibt es?',
      answer:
        [
          performanceIndicators?.estimatedLoadTime === 'slow'
            ? 'Performance-Optimierung nötig'
            : null,
          accessibilityAudit && accessibilityAudit.criticalIssues > 0
            ? `${accessibilityAudit.criticalIssues} kritische A11y-Issues`
            : null,
          legalCompliance && legalCompliance.score < 50 ? 'DSGVO-Compliance verbessern' : null,
          contentVolume && 'complexity' in contentVolume && contentVolume.complexity === 'high'
            ? 'Hohe Inhaltskomplexität'
            : null,
          features && 'api' in features && features.api ? 'API-Integrationen' : null,
          extractedData?.constraints?.length ? extractedData.constraints[0] : null,
        ]
          .filter(Boolean)
          .join(', ') || 'Keine besonderen Herausforderungen erkannt',
      source: 'Performance / A11y / Legal / Content / Pre-Qualification',
      ...getAnswerStatus(true),
    },
    {
      id: 10,
      question: 'Wie lautet die Bit / No Bit Einschätzung?',
      answer: results.blRecommendation?.primaryBusinessLine
        ? `Empfehlung: ${results.blRecommendation.primaryBusinessLine} (${results.blRecommendation.confidence}% Confidence)`
        : null,
      source: 'BL Recommendation',
      ...getAnswerStatus(!!results.blRecommendation?.primaryBusinessLine),
    },
  ];

  const answeredCount = questions.filter(q => q.status === 'answered').length;

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-purple-900">BIT-Entscheidungsfragen</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            {answeredCount}/10 beantwortet
          </Badge>
        </div>
        <CardDescription className="text-purple-700">
          Übersicht der 10 Schlüsselfragen für die BIT/No-BIT Entscheidung
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className={`p-3 rounded-lg ${q.color} transition-colors`}>
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-white/50 px-1.5 py-0.5 rounded">{q.id}.</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{q.question}</p>
                  {q.answer ? (
                    <p className="text-sm mt-1 opacity-90">{q.answer}</p>
                  ) : (
                    <p className="text-sm mt-1 opacity-60 italic">Keine Daten verfügbar</p>
                  )}
                  <p className="text-xs mt-1 opacity-50">Quelle: {q.source}</p>
                </div>
                <span className="text-lg">{q.icon}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
