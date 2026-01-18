'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import type { QuickScan } from '@/lib/db/schema';

interface TenQuestionsTabProps {
  quickScan: QuickScan;
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
  seoAudit?: unknown | null;
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
export function TenQuestionsTab({ quickScan }: TenQuestionsTabProps) {
  // Parse JSON fields
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const performanceIndicators = parseJsonField<PerformanceData>(quickScan.performanceIndicators);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(quickScan.companyIntelligence);

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
  const getAnswerStatus = (hasAnswer: boolean, value?: string | number | boolean | null) => {
    if (!hasAnswer || value === null || value === undefined) {
      return { status: 'unknown', color: 'bg-gray-100 text-gray-700', icon: '❓' };
    }
    return { status: 'answered', color: 'bg-green-50 text-green-800', icon: '✓' };
  };

  // Map data to the 10 BIT questions
  const questions = [
    {
      id: 1,
      question: 'Wie ist die bisherige Geschäftsbeziehung zum Kunden?',
      answer: companyIntelligence?.basicInfo?.name
        ? `Unternehmen: ${companyIntelligence.basicInfo.name}${companyIntelligence.basicInfo.industry ? `, Branche: ${companyIntelligence.basicInfo.industry}` : ''}`
        : null,
      source: 'Company Intelligence',
      ...getAnswerStatus(!!companyIntelligence, companyIntelligence?.basicInfo?.name),
    },
    {
      id: 2,
      question: 'Wie hoch ist das Auftragsvolumen bzw. Budget?',
      answer: companyIntelligence?.financials?.revenueClass
        ? `Umsatzklasse: ${companyIntelligence.financials.revenueClass}${companyIntelligence.financials.publiclyTraded ? ' (börsennotiert)' : ''}`
        : contentVolume && 'estimatedPageCount' in contentVolume && contentVolume.estimatedPageCount
          ? `Geschätzte Projektgröße basierend auf ${contentVolume.estimatedPageCount} Seiten`
          : null,
      source: 'Company Intelligence / Content Volume',
      ...getAnswerStatus(!!companyIntelligence?.financials || !!(contentVolume && 'estimatedPageCount' in contentVolume)),
    },
    {
      id: 3,
      question: 'Ist der Zeitplan realistisch?',
      answer: contentVolume && 'complexity' in contentVolume && contentVolume.complexity
        ? `Projektkomplexität: ${contentVolume.complexity === 'high' ? 'Hoch' : contentVolume.complexity === 'medium' ? 'Mittel' : 'Gering'}${contentVolume.estimatedPageCount ? `, ${contentVolume.estimatedPageCount} Seiten zu migrieren` : ''}`
        : null,
      source: 'Content Volume',
      ...getAnswerStatus(!!(contentVolume && 'complexity' in contentVolume)),
    },
    {
      id: 4,
      question: 'Um welche Art von Vertrag handelt es sich?',
      answer: null, // Not determinable from Quick Scan
      source: 'Manuell zu ermitteln',
      ...getAnswerStatus(false),
    },
    {
      id: 5,
      question: 'Welche Leistungen werden benötigt?',
      answer: [
        techStack && 'cms' in techStack && techStack.cms ? `CMS Migration von ${techStack.cms}` : null,
        features && 'ecommerce' in features && features.ecommerce ? 'E-Commerce Integration' : null,
        features && 'multiLanguage' in features && features.multiLanguage ? 'Mehrsprachigkeit' : null,
        features && 'userAccounts' in features && features.userAccounts ? 'User Management' : null,
        accessibilityAudit && accessibilityAudit.score < 50 ? 'Accessibility Überarbeitung' : null,
      ].filter(Boolean).join(', ') || null,
      source: 'Tech Stack / Features / Accessibility',
      ...getAnswerStatus(!!(techStack || features)),
    },
    {
      id: 6,
      question: 'Haben wir passende Referenzen?',
      answer: techStack && 'cms' in techStack && techStack.cms
        ? `Prüfe Referenzen für ${techStack.cms} Migrationen`
        : null,
      source: 'Tech Stack → Referenz-Datenbank',
      ...getAnswerStatus(!!(techStack && 'cms' in techStack)),
    },
    {
      id: 7,
      question: 'Welche Zuschlagskriterien gelten?',
      answer: null, // Not determinable from Quick Scan
      source: 'Ausschreibungsunterlagen',
      ...getAnswerStatus(false),
    },
    {
      id: 8,
      question: 'Welche Team-Anforderungen bestehen?',
      answer: results.blRecommendation?.requiredSkills?.length
        ? `Empfohlene Skills: ${results.blRecommendation.requiredSkills.join(', ')}`
        : techStack && 'cms' in techStack && techStack.cms
          ? `${techStack.cms} Expertise benötigt`
          : null,
      source: 'BL Recommendation / Tech Stack',
      ...getAnswerStatus(!!(results.blRecommendation?.requiredSkills || (techStack && 'cms' in techStack))),
    },
    {
      id: 9,
      question: 'Welche besonderen Herausforderungen gibt es?',
      answer: [
        performanceIndicators?.estimatedLoadTime === 'slow' ? 'Performance-Optimierung nötig' : null,
        accessibilityAudit && accessibilityAudit.criticalIssues > 0 ? `${accessibilityAudit.criticalIssues} kritische A11y-Issues` : null,
        legalCompliance && legalCompliance.score < 50 ? 'DSGVO-Compliance verbessern' : null,
        contentVolume && 'complexity' in contentVolume && contentVolume.complexity === 'high' ? 'Hohe Inhaltskomplexität' : null,
        features && 'api' in features && features.api ? 'API-Integrationen' : null,
      ].filter(Boolean).join(', ') || 'Keine besonderen Herausforderungen erkannt',
      source: 'Performance / A11y / Legal / Content',
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
          {questions.map((q) => (
            <div
              key={q.id}
              className={`p-3 rounded-lg ${q.color} transition-colors`}
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-white/50 px-1.5 py-0.5 rounded">
                  {q.id}.
                </span>
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
