import type { LucideIcon } from 'lucide-react';

/**
 * DEA-140: Lead Navigation Configuration
 *
 * Central configuration for all 13 Lead navigation sections.
 * Each section defines:
 * - UI metadata (label, icon, route)
 * - RAG query template for content retrieval
 * - Synthesizer agent name for on-demand processing
 * - Collapsed state for hierarchical navigation
 */

export interface LeadNavigationSection {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  route: string; // Relative to /pitches/[id]/
  ragQueryTemplate?: string; // Template for RAG queries
  synthesizerAgent?: string; // Agent name for content synthesis
  collapsed?: boolean; // If true, renders as collapsible group
  subsections?: LeadNavigationSubSection[];
}

export interface LeadNavigationSubSection {
  id: string;
  label: string;
  route: string; // Relative to /pitches/[id]/
  ragQueryTemplate?: string;
  synthesizerAgent?: string;
}

/**
 * All 13 Lead navigation sections (DEA-138 PRD)
 *
 * Navigation structure follows the Deep Scan architecture:
 * 1. Overview - Executive summary
 * 2. Current Technology - Tech stack analysis
 * 3. Website Analysis - Performance, SEO, accessibility
 * 4. Target Architecture - CMS-agnostic target architecture and content model
 * 5. CMS Comparison - CMS selection and comparison
 * 6. Hosting & Infrastructure - Infrastructure analysis
 * 7. Integrations - Third-party integrations
 * 8. Migration & Project - Migration complexity and project scope
 * 9. Staffing & Timeline - Resource planning
 * 10. References - Relevant reference projects
 * 11. Legal Check - Compliance and legal risks
 * 12. Costs & Budget - Cost estimation
 * 13. BID/NO-BID Decision - Final decision page
 */
export const QUALIFICATION_NAVIGATION_SECTIONS: LeadNavigationSection[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    icon: 'LayoutDashboard',
    route: '',
    ragQueryTemplate:
      'Provide an executive summary of the lead including key facts, opportunities, and risks.',
    synthesizerAgent: 'overview-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'executive-summary',
        label: 'Executive Summary',
        route: '',
      },
      {
        id: 'detailed-summary',
        label: 'Detaillierte Zusammenfassung',
        route: 'zusammenfassung',
      },
    ],
  },
  {
    id: 'technology',
    label: 'Aktuelle Technologie',
    icon: 'Code2',
    route: 'technology',
    ragQueryTemplate:
      'What is the current technology stack of the customer website? Include CMS, framework, hosting, and all detected technologies.',
    synthesizerAgent: 'technology-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'tech-stack',
        label: 'Tech-Stack Überblick',
        route: 'technology',
      },
    ],
  },
  {
    id: 'website-analysis',
    label: 'Website-Analyse',
    icon: 'BarChart3',
    route: 'website-analysis',
    ragQueryTemplate:
      'Provide a comprehensive website analysis including performance metrics (Core Web Vitals), SEO analysis, accessibility audit, and security assessment.',
    synthesizerAgent: 'website-analysis-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'page-types',
        label: 'Seitentypen',
        route: 'website-analysis/page-types',
      },
      {
        id: 'components',
        label: 'Components',
        route: 'website-analysis/components',
      },
      {
        id: 'performance',
        label: 'Performance-Audit',
        route: 'website-analysis/performance',
      },
      {
        id: 'accessibility',
        label: 'Accessibility-Audit',
        route: 'website-analysis/accessibility',
      },
    ],
  },
  {
    id: 'target-architecture',
    label: 'Ziel-Architektur',
    icon: 'Layers',
    route: 'target-architecture',
    ragQueryTemplate:
      'Define the target architecture based on requirements. What architectural approach is recommended (headless, hybrid, traditional)? What is the content model? What components and dynamic content features are needed? Keep this CMS-agnostic.',
    synthesizerAgent: 'target-architecture-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'architecture-overview',
        label: 'Architektur-Übersicht',
        route: 'target-architecture/overview',
        ragQueryTemplate:
          'Recommend an architectural approach based on project requirements: Headless vs. Hybrid vs. Traditional CMS, API strategy, multi-site/multi-language setup, editorial workflow needs. Keep CMS-agnostic.',
      },
      {
        id: 'content-model',
        label: 'Content-Modell',
        route: 'target-architecture/content-model',
        ragQueryTemplate:
          'Define the content model: What content entities are needed (articles, events, persons, locations, products)? What are the relationships between entities? What taxonomies and classifications are required? Present as a conceptual model, not CMS-specific.',
      },
      {
        id: 'component-catalog',
        label: 'Komponenten-Katalog',
        route: 'target-architecture/components',
        ragQueryTemplate:
          'Define the required editor components/building blocks: Hero sections, teaser grids, accordions, tabs, forms, etc. Describe variants, nesting rules, and editor experience. Keep conceptual and CMS-agnostic.',
      },
      {
        id: 'dynamic-content',
        label: 'Dynamische Inhalte',
        route: 'target-architecture/dynamic-content',
        ragQueryTemplate:
          'Define required dynamic content features: News listings with filters, search functionality, event calendars, person directories. Describe sorting, pagination, and faceted filtering needs. Keep functional and CMS-agnostic.',
      },
    ],
  },
  {
    id: 'cms-comparison',
    label: 'CMS-Vergleich',
    icon: 'Scale',
    route: 'cms-comparison',
    ragQueryTemplate:
      'Compare available CMS options for this project. Which CMS systems are suitable? What are the pros and cons? Provide a recommendation.',
    synthesizerAgent: 'cms-comparison-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'comparison-overview',
        label: 'Vergleichsübersicht',
        route: 'cms-comparison',
      },
    ],
  },
  {
    id: 'hosting',
    label: 'Hosting & Infrastruktur',
    icon: 'Server',
    route: 'hosting',
    ragQueryTemplate:
      'Analyze the current and recommended hosting infrastructure. What are the requirements? What are the costs? What are the technical constraints?',
    synthesizerAgent: 'hosting-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'azure',
        label: 'Azure-Architektur',
        route: 'hosting/azure',
      },
      {
        id: 'high-scale',
        label: 'High-Scale',
        route: 'hosting/high-scale',
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrationen',
    icon: 'Puzzle',
    route: 'integrations',
    ragQueryTemplate:
      'What third-party integrations are currently in use or required? Include CRM, marketing automation, analytics, payment systems, etc.',
    synthesizerAgent: 'integrations-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'integrations-overview',
        label: 'Übersicht & Systemlandschaft',
        route: 'integrations',
      },
    ],
  },
  {
    id: 'migration',
    label: 'Migration & Projekt',
    icon: 'GitBranch',
    route: 'migration',
    ragQueryTemplate:
      'Analyze the migration complexity. What content needs to be migrated? What are the technical challenges? What is the estimated effort?',
    synthesizerAgent: 'migration-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'strategy',
        label: 'Migrations-Strategie',
        route: 'migration/strategy',
      },
      {
        id: 'timeline',
        label: 'Timeline & Meilensteine',
        route: 'migration/timeline',
      },
      {
        id: 'risks',
        label: 'Risiken & Mitigation',
        route: 'migration/risks',
      },
    ],
  },
  {
    id: 'project-org',
    label: 'Projekt-Organisation',
    icon: 'Users',
    route: 'project-org',
    ragQueryTemplate: 'Define the project organization, team structure, and KPIs.',
    synthesizerAgent: 'project-org-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'team',
        label: 'Team & Ressourcen',
        route: 'project-org/team',
      },
      {
        id: 'kpis',
        label: 'KPIs & Erfolgskriterien',
        route: 'project-org/kpis',
      },
    ],
  },
  {
    id: 'costs',
    label: 'Kosten & Budget',
    icon: 'DollarSign',
    route: 'costs',
    ragQueryTemplate:
      'Provide a detailed cost breakdown. What are the implementation costs? What are the ongoing costs? What is the budget fit?',
    synthesizerAgent: 'costs-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'features',
        label: 'Feature-Liste',
        route: 'costs/features',
      },
      {
        id: 'budget',
        label: 'Budget-Analyse',
        route: 'costs/budget',
      },
      {
        id: 'roi',
        label: 'ROI & TCO',
        route: 'costs/roi',
      },
    ],
  },
  {
    id: 'calc-sheet',
    label: 'adCalc',
    icon: 'Calculator',
    route: 'calc-sheet',
    ragQueryTemplate:
      'Project estimation including features breakdown, project tasks, team roles, risk assessment, hours calculation, and budget estimation for the adesso Calculator.',
    synthesizerAgent: 'calc-sheet-generator',
    collapsed: false,
    subsections: [
      {
        id: 'calc-overview',
        label: 'Übersicht',
        route: 'calc-sheet',
        ragQueryTemplate:
          'Project summary including client name, project type, CMS selection, total features, total hours, and estimated budget.',
      },
      {
        id: 'calc-features',
        label: 'Features',
        route: 'calc-sheet/features',
        ragQueryTemplate:
          'List all project features with ID, name, description, type (Content Type, Paragraph, View, Module), complexity (H/M/L), and estimated hours.',
      },
      {
        id: 'calc-tasks',
        label: 'Aufgaben',
        route: 'calc-sheet/tasks',
        ragQueryTemplate:
          'List all project tasks with ID, phase, description, assigned role, and estimated hours.',
      },
      {
        id: 'calc-roles',
        label: 'Rollen',
        route: 'calc-sheet/roles',
        ragQueryTemplate:
          'List all project roles with ID, title, level, responsibilities, and FTE allocation.',
      },
      {
        id: 'calc-risks',
        label: 'Risiken',
        route: 'calc-sheet/risks',
        ragQueryTemplate:
          'List all project risks with ID, name, description, likelihood, impact, and mitigation strategy.',
      },
    ],
  },
  {
    id: 'decision',
    label: 'BID/NO-BID Entscheidung',
    icon: 'Target',
    route: 'decision',
    ragQueryTemplate:
      'Aggregate all section insights into a final BID/NO-BID recommendation. Include pros, cons, confidence score, and reasoning.',
    synthesizerAgent: 'decision-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'final-recommendation',
        label: 'Finale Empfehlung',
        route: 'decision',
      },
    ],
  },
  {
    id: 'audit',
    label: 'Deep Scan Audit',
    icon: 'Radar',
    route: 'audit',
    ragQueryTemplate:
      'Run a comprehensive deep scan audit of the customer website including technology detection, performance analysis, and content structure mapping.',
    synthesizerAgent: 'audit-orchestrator',
    collapsed: false,
    subsections: [
      {
        id: 'audit-overview',
        label: 'Audit Übersicht',
        route: 'audit',
      },
      {
        id: 'audit-technology',
        label: 'Technologie-Erkennung',
        route: 'audit/technology',
      },
      {
        id: 'audit-content',
        label: 'Content-Struktur',
        route: 'audit/content',
      },
      {
        id: 'audit-performance',
        label: 'Performance',
        route: 'audit/performance',
      },
    ],
  },
  {
    id: 'interview',
    label: 'Pitch-Interview',
    icon: 'MessageSquare',
    route: 'interview',
    ragQueryTemplate: '',
    synthesizerAgent: undefined,
    collapsed: false,
  },
  {
    id: 'rag-data',
    label: 'RAG Data (Debug)',
    icon: 'Database',
    route: 'rag-data',
    ragQueryTemplate: '',
    synthesizerAgent: undefined,
    collapsed: false,
  },
];

/**
 * Get a section or subsection by its route
 * @param route - Route path (relative to /pitches/[id]/)
 * @returns LeadNavigationSection or LeadNavigationSubSection or undefined
 */
export function getSectionByRoute(
  route: string
): LeadNavigationSection | LeadNavigationSubSection | undefined {
  // Normalize route: remove leading/trailing slashes
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

  // Search top-level sections
  const section = QUALIFICATION_NAVIGATION_SECTIONS.find(s => {
    const sectionRoute = s.route.replace(/^\/+|\/+$/g, '');
    return sectionRoute === normalizedRoute;
  });
  if (section) return section;

  // Search subsections
  for (const s of QUALIFICATION_NAVIGATION_SECTIONS) {
    if (s.subsections) {
      const subsection = s.subsections.find(sub => {
        const subRoute = sub.route.replace(/^\/+|\/+$/g, '');
        return subRoute === normalizedRoute;
      });
      if (subsection) return subsection;
    }
  }

  return undefined;
}

/**
 * Get a section or subsection by its ID
 * @param id - Section or Subsection ID
 * @returns LeadNavigationSection or LeadNavigationSubSection or undefined
 */
export function getSectionById(
  id: string
): LeadNavigationSection | LeadNavigationSubSection | undefined {
  // Search top-level sections
  const section = QUALIFICATION_NAVIGATION_SECTIONS.find(s => s.id === id);
  if (section) return section;

  // Search subsections
  for (const s of QUALIFICATION_NAVIGATION_SECTIONS) {
    if (s.subsections) {
      const subsection = s.subsections.find(sub => sub.id === id);
      if (subsection) return subsection;
    }
  }

  return undefined;
}

/**
 * Get all sections
 * @returns Array of all navigation sections
 */
export function getAllSections(): LeadNavigationSection[] {
  return QUALIFICATION_NAVIGATION_SECTIONS;
}

/**
 * Get all section IDs
 * @returns Array of section IDs
 */
export function getAllSectionIds(): string[] {
  return QUALIFICATION_NAVIGATION_SECTIONS.map(section => section.id);
}

/**
 * Check if a route is a valid lead section route
 * @param route - Route path (relative to /pitches/[id]/)
 * @returns boolean
 */
export function isValidSectionRoute(route: string): boolean {
  return getSectionByRoute(route) !== undefined;
}

export function getRAGQueryTemplate(sectionId: string): string | undefined {
  const section = getSectionById(sectionId);
  if (!section) return undefined;

  if (!section.ragQueryTemplate && 'route' in section) {
    const parent = QUALIFICATION_NAVIGATION_SECTIONS.find(s =>
      s.subsections?.some(sub => sub.id === section.id)
    );
    if (parent?.ragQueryTemplate) {
      return parent.ragQueryTemplate;
    }
  }

  return section.ragQueryTemplate;
}

/**
 * Get the synthesizer agent name for a section
 * @param sectionId - Section ID
 * @returns Synthesizer agent name or undefined
 */
export function getSynthesizerAgent(sectionId: string): string | undefined {
  const section = getSectionById(sectionId);
  return section?.synthesizerAgent;
}
