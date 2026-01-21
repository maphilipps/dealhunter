import type { QuickScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

// ========================================
// Helper Functions
// ========================================

/**
 * Format budget range object to display string
 */
function formatBudgetRange(budgetRange: ExtractedRequirements['budgetRange']): string | undefined {
  if (!budgetRange) return undefined;
  if (!budgetRange.min && !budgetRange.max) return undefined;

  const min = budgetRange.min ? new Intl.NumberFormat('de-DE').format(budgetRange.min) : '0';
  const max = budgetRange.max ? new Intl.NumberFormat('de-DE').format(budgetRange.max) : '∞';

  return `${min} - ${max} ${budgetRange.currency}`;
}

// ========================================
// 10 Fragen Texte nach Projekttyp
// ========================================

export const MIGRATION_QUESTIONS = [
  'Welches CMS/System wird aktuell verwendet?',
  'Wie viele Seiten/Inhalte müssen migriert werden?',
  'Ist ein Datenexport aus dem Altsystem möglich?',
  'Wie ist das Budget für das Projekt?',
  'Welcher Zeitrahmen ist geplant?',
  'Welche Features sind geschäftskritisch?',
  'Welche Integrationen müssen erhalten bleiben?',
  'Welche Technologie-Präferenzen gibt es?',
  'Gibt es bestehende SEO-Rankings zu erhalten?',
  'Welche Business Unit passt am besten?',
];

export const GREENFIELD_QUESTIONS = [
  'Welche Technologie-Präferenzen gibt es?',
  'Welche Features werden benötigt?',
  'Wie ist das Budget für das Projekt?',
  'Welcher Zeitrahmen ist geplant?',
  'Welche Integrationen sind erforderlich?',
  'Welche Branche/Domäne ist relevant?',
  'Gibt es regulatorische Anforderungen (DSGVO, etc.)?',
  'Welche Skalierungsanforderungen bestehen?',
  'Welches Hosting wird präferiert?',
  'Welche Business Unit passt am besten?',
];

export const RELAUNCH_QUESTIONS = [
  'Wie ist der aktuelle Accessibility-Stand?',
  'Wie ist der aktuelle SEO-Stand?',
  'Welche Features werden benötigt?',
  'Wie viele Seiten/Inhalte gibt es?',
  'Wie ist das Budget für das Projekt?',
  'Welcher Zeitrahmen ist geplant?',
  'Welches CMS/System wird aktuell verwendet?',
  'Was soll optimiert werden (Design, Performance, UX)?',
  'Gibt es bestehende Rankings zu erhalten?',
  'Welche Business Unit passt am besten?',
];

export interface QuestionWithStatus {
  id: number;
  question: string;
  answered: boolean;
  answer?: string;
}

export type ProjectType = 'migration' | 'greenfield' | 'relaunch';

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

interface SeoAuditData {
  score?: number;
  hasMetaTags?: boolean;
  hasSitemap?: boolean;
}

interface LegalComplianceData {
  score: number;
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

interface MigrationFeasibilityData {
  exportMethod?: string;
  dataQuality?: string;
  estimatedEffort?: string;
}

function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function detectProjectType(
  techStack: TechStackData | null,
  extractedData: ExtractedRequirements | null | undefined
): ProjectType {
  const scopeLower = extractedData?.scope?.toLowerCase() || '';
  const keyReqs = extractedData?.keyRequirements?.join(' ').toLowerCase() || '';
  const projectDesc = extractedData?.projectDescription?.toLowerCase() || '';
  const allText = `${scopeLower} ${keyReqs} ${projectDesc}`;

  const migrationKeywords = [
    'migration',
    'umzug',
    'wechsel',
    'ablösung',
    'ersetzen',
    'migrate',
    'cms-wechsel',
  ];
  const greenfieldKeywords = [
    'neuentwicklung',
    'neu entwickeln',
    'von grund auf',
    'greenfield',
    'neue website',
    'neue plattform',
  ];
  const relaunchKeywords = [
    'relaunch',
    'redesign',
    'neugestaltung',
    'überarbeitung',
    'modernisierung',
    'refresh',
  ];

  const hasMigrationSignal = migrationKeywords.some(kw => allText.includes(kw)) || !!techStack?.cms;
  const hasGreenfieldSignal = greenfieldKeywords.some(kw => allText.includes(kw));
  const hasRelaunchSignal = relaunchKeywords.some(kw => allText.includes(kw));

  if (hasGreenfieldSignal && !hasMigrationSignal) return 'greenfield';
  if (hasRelaunchSignal && !hasMigrationSignal) return 'relaunch';
  if (hasMigrationSignal) return 'migration';

  return techStack?.cms ? 'migration' : 'greenfield';
}

function countMigrationAnswers(
  quickScan: QuickScan,
  extractedData: ExtractedRequirements | null | undefined,
  techStack: TechStackData | null,
  contentVolume: ContentVolumeData | null,
  features: FeaturesData | null,
  companyIntelligence: CompanyIntelligenceData | null,
  migrationFeasibility: MigrationFeasibilityData | null
): number {
  const answers = [
    !!techStack?.cms,
    !!contentVolume?.estimatedPageCount,
    !!(migrationFeasibility || techStack?.cms),
    !!(extractedData?.budgetRange || companyIntelligence?.financials),
    !!(extractedData?.timeline || extractedData?.submissionDeadline || contentVolume?.complexity),
    !!Object.values(features || {}).some(Boolean),
    !!techStack?.cms,
    !!(techStack?.cms || quickScan.recommendedBusinessUnit || extractedData?.technologies?.length),
    true,
    !!quickScan.recommendedBusinessUnit,
  ];
  return answers.filter(Boolean).length;
}

function countGreenfieldAnswers(
  quickScan: QuickScan,
  extractedData: ExtractedRequirements | null | undefined,
  techStack: TechStackData | null,
  features: FeaturesData | null,
  companyIntelligence: CompanyIntelligenceData | null,
  legalCompliance: LegalComplianceData | null
): number {
  const answers = [
    !!(extractedData?.technologies?.length || techStack?.framework),
    !!(Object.values(features || {}).some(Boolean) || extractedData?.keyRequirements?.length),
    !!(extractedData?.budgetRange || companyIntelligence?.financials),
    !!(extractedData?.timeline || extractedData?.submissionDeadline),
    !!(features?.api || features?.ecommerce),
    !!(extractedData?.industry || extractedData?.technologies?.length),
    !!(legalCompliance || extractedData?.procurementType || extractedData?.constraints?.length),
    !!(quickScan.recommendedBusinessUnit || extractedData?.technologies?.length),
    true,
    !!quickScan.recommendedBusinessUnit,
  ];
  return answers.filter(Boolean).length;
}

function countRelaunchAnswers(
  quickScan: QuickScan,
  extractedData: ExtractedRequirements | null | undefined,
  techStack: TechStackData | null,
  contentVolume: ContentVolumeData | null,
  features: FeaturesData | null,
  accessibilityAudit: AccessibilityAuditData | null,
  seoAudit: SeoAuditData | null,
  companyIntelligence: CompanyIntelligenceData | null
): number {
  const answers = [
    !!accessibilityAudit,
    !!seoAudit,
    !!Object.values(features || {}).some(Boolean),
    !!contentVolume?.estimatedPageCount,
    !!(extractedData?.budgetRange || companyIntelligence?.financials),
    !!(extractedData?.timeline || extractedData?.submissionDeadline),
    !!(techStack?.cms || techStack?.framework),
    true,
    true,
    !!quickScan.recommendedBusinessUnit,
  ];
  return answers.filter(Boolean).length;
}

export function calculateAnsweredQuestionsCount(
  quickScan: QuickScan,
  extractedData?: ExtractedRequirements | null
): { answered: number; total: number; projectType: ProjectType } {
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(
    quickScan.companyIntelligence
  );
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const seoAudit = parseJsonField<SeoAuditData>(quickScan.seoAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const migrationFeasibility = parseJsonField<MigrationFeasibilityData>(
    (quickScan as { migrationFeasibility?: string }).migrationFeasibility
  );

  const projectType = detectProjectType(techStack, extractedData);

  let answered: number;
  switch (projectType) {
    case 'migration':
      answered = countMigrationAnswers(
        quickScan,
        extractedData,
        techStack,
        contentVolume,
        features,
        companyIntelligence,
        migrationFeasibility
      );
      break;
    case 'greenfield':
      answered = countGreenfieldAnswers(
        quickScan,
        extractedData,
        techStack,
        features,
        companyIntelligence,
        legalCompliance
      );
      break;
    case 'relaunch':
      answered = countRelaunchAnswers(
        quickScan,
        extractedData,
        techStack,
        contentVolume,
        features,
        accessibilityAudit,
        seoAudit,
        companyIntelligence
      );
      break;
  }

  return {
    answered,
    total: 10,
    projectType,
  };
}

/**
 * Builds the 10 questions with answered status and answer text
 */
export function buildQuestionsWithStatus(
  quickScan: QuickScan,
  extractedData?: ExtractedRequirements | null
): {
  questions: QuestionWithStatus[];
  projectType: ProjectType;
  summary: { answered: number; total: number };
} {
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(
    quickScan.companyIntelligence
  );
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const seoAudit = parseJsonField<SeoAuditData>(quickScan.seoAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const migrationFeasibility = parseJsonField<MigrationFeasibilityData>(
    (quickScan as { migrationFeasibility?: string }).migrationFeasibility
  );

  const projectType = detectProjectType(techStack, extractedData);

  let questionTexts: string[];
  let answersWithStatus: { answered: boolean; answer?: string }[];

  switch (projectType) {
    case 'migration':
      questionTexts = MIGRATION_QUESTIONS;
      answersWithStatus = [
        {
          answered: !!techStack?.cms,
          answer: techStack?.cms
            ? `${techStack.cms}${techStack.cmsVersion ? ` v${techStack.cmsVersion}` : ''}`
            : undefined,
        },
        {
          answered: !!contentVolume?.estimatedPageCount,
          answer: contentVolume?.estimatedPageCount
            ? `${contentVolume.estimatedPageCount} Seiten`
            : undefined,
        },
        {
          answered: !!(migrationFeasibility || techStack?.cms),
          answer:
            migrationFeasibility?.exportMethod || (techStack?.cms ? 'Ja, CMS erkannt' : undefined),
        },
        {
          answered: !!(extractedData?.budgetRange || companyIntelligence?.financials),
          answer:
            formatBudgetRange(extractedData?.budgetRange) ||
            companyIntelligence?.financials?.revenueClass,
        },
        {
          answered: !!(
            extractedData?.timeline ||
            extractedData?.submissionDeadline ||
            contentVolume?.complexity
          ),
          answer:
            extractedData?.timeline ||
            extractedData?.submissionDeadline ||
            (contentVolume?.complexity ? `Komplexität: ${contentVolume.complexity}` : undefined),
        },
        {
          answered: !!Object.values(features || {}).some(Boolean),
          answer: features ? buildFeatureString(features) : undefined,
        },
        {
          answered: !!techStack?.cms,
          answer: techStack?.cms ? `CMS: ${techStack.cms}` : undefined,
        },
        {
          answered: !!(
            techStack?.cms ||
            quickScan.recommendedBusinessUnit ||
            extractedData?.technologies?.length
          ),
          answer: extractedData?.technologies?.join(', ') || techStack?.framework,
        },
        { answered: true, answer: 'SEO-Analyse verfügbar' },
        {
          answered: !!quickScan.recommendedBusinessUnit,
          answer: quickScan.recommendedBusinessUnit
            ? `${quickScan.recommendedBusinessUnit} (${quickScan.confidence}%)`
            : undefined,
        },
      ];
      break;
    case 'greenfield':
      questionTexts = GREENFIELD_QUESTIONS;
      answersWithStatus = [
        {
          answered: !!(extractedData?.technologies?.length || techStack?.framework),
          answer: extractedData?.technologies?.join(', ') || techStack?.framework,
        },
        {
          answered: !!(
            Object.values(features || {}).some(Boolean) || extractedData?.keyRequirements?.length
          ),
          answer: features
            ? buildFeatureString(features)
            : extractedData?.keyRequirements?.slice(0, 3).join(', '),
        },
        {
          answered: !!(extractedData?.budgetRange || companyIntelligence?.financials),
          answer:
            formatBudgetRange(extractedData?.budgetRange) ||
            companyIntelligence?.financials?.revenueClass,
        },
        {
          answered: !!(extractedData?.timeline || extractedData?.submissionDeadline),
          answer: extractedData?.timeline || extractedData?.submissionDeadline,
        },
        {
          answered: !!(features?.api || features?.ecommerce),
          answer: features?.api
            ? 'API Integration'
            : features?.ecommerce
              ? 'E-Commerce'
              : undefined,
        },
        {
          answered: !!(extractedData?.industry || extractedData?.technologies?.length),
          answer: extractedData?.industry,
        },
        {
          answered: !!(
            legalCompliance ||
            extractedData?.procurementType ||
            extractedData?.constraints?.length
          ),
          answer: legalCompliance
            ? `DSGVO Score: ${legalCompliance.score}%`
            : extractedData?.constraints?.join(', '),
        },
        {
          answered: !!(quickScan.recommendedBusinessUnit || extractedData?.technologies?.length),
          answer: extractedData?.technologies?.join(', '),
        },
        { answered: true, answer: 'Hosting-Optionen analysiert' },
        {
          answered: !!quickScan.recommendedBusinessUnit,
          answer: quickScan.recommendedBusinessUnit
            ? `${quickScan.recommendedBusinessUnit} (${quickScan.confidence}%)`
            : undefined,
        },
      ];
      break;
    case 'relaunch':
      questionTexts = RELAUNCH_QUESTIONS;
      answersWithStatus = [
        {
          answered: !!accessibilityAudit,
          answer: accessibilityAudit ? `Score: ${accessibilityAudit.score}%` : undefined,
        },
        {
          answered: !!seoAudit,
          answer: seoAudit?.score !== undefined ? `Score: ${seoAudit.score}%` : undefined,
        },
        {
          answered: !!Object.values(features || {}).some(Boolean),
          answer: features ? buildFeatureString(features) : undefined,
        },
        {
          answered: !!contentVolume?.estimatedPageCount,
          answer: contentVolume?.estimatedPageCount
            ? `${contentVolume.estimatedPageCount} Seiten`
            : undefined,
        },
        {
          answered: !!(extractedData?.budgetRange || companyIntelligence?.financials),
          answer:
            formatBudgetRange(extractedData?.budgetRange) ||
            companyIntelligence?.financials?.revenueClass,
        },
        {
          answered: !!(extractedData?.timeline || extractedData?.submissionDeadline),
          answer: extractedData?.timeline || extractedData?.submissionDeadline,
        },
        {
          answered: !!(techStack?.cms || techStack?.framework),
          answer: techStack?.cms || techStack?.framework,
        },
        { answered: true, answer: 'Design & Performance Analyse verfügbar' },
        { answered: true, answer: 'SEO-Rankings dokumentiert' },
        {
          answered: !!quickScan.recommendedBusinessUnit,
          answer: quickScan.recommendedBusinessUnit
            ? `${quickScan.recommendedBusinessUnit} (${quickScan.confidence}%)`
            : undefined,
        },
      ];
      break;
  }

  const questions: QuestionWithStatus[] = questionTexts.map((q, idx) => ({
    id: idx + 1,
    question: q,
    answered: answersWithStatus[idx].answered,
    answer: answersWithStatus[idx].answer,
  }));

  const answeredCount = questions.filter(q => q.answered).length;

  return {
    questions,
    projectType,
    summary: { answered: answeredCount, total: 10 },
  };
}

function buildFeatureString(features: FeaturesData): string | undefined {
  const active: string[] = [];
  if (features.ecommerce) active.push('E-Commerce');
  if (features.userAccounts) active.push('User Accounts');
  if (features.search) active.push('Suche');
  if (features.multiLanguage) active.push('Mehrsprachig');
  if (features.blog) active.push('Blog');
  if (features.forms) active.push('Formulare');
  if (features.api) active.push('API');
  return active.length > 0 ? active.slice(0, 3).join(', ') : undefined;
}
