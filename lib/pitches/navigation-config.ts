/**
 * DEA-140: Lead Navigation Configuration
 *
 * Central configuration for Lead navigation sections.
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
 * Lead navigation sections
 *
 * Navigation structure:
 * 1. Overview - Executive summary
 * 2. Qualification Scan - Quick scan results and routing
 * 3. Pitch Scan - Comprehensive website analysis (13 subsections)
 * 4. adCalc - Project estimation calculator
 * 5. BID/NO-BID Decision - Final decision page
 * 6. Pitch-Interview - Interview chat
 * 7. RAG Data (Debug) - Debug view for RAG embeddings
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
    id: 'customer',
    label: 'Kundenprofil',
    icon: 'Building',
    route: 'customer',
    ragQueryTemplate:
      'Provide a concise customer profile including key decision makers (with LinkedIn), business signals (size/revenue where available), and the current tech stack.',
    synthesizerAgent: 'customer-synthesizer',
    collapsed: false,
  },
  {
    id: 'qualification-scan',
    label: 'Qualification Scan',
    icon: 'ScanSearch',
    route: 'qualification-scan',
    ragQueryTemplate:
      'Provide the qualifications scan results including customer information, technology stack, requirements, decision makers, and routing recommendation.',
    synthesizerAgent: 'qualification-scan-synthesizer',
    collapsed: false,
    subsections: [
      {
        id: 'qualification-scan-results',
        label: 'Qualification Scan Ergebnis',
        route: 'qualification-scan',
      },
    ],
  },
  {
    id: 'pitch-scan',
    label: 'Pitch Scan',
    icon: 'Radar',
    route: 'pitch-scan',
    ragQueryTemplate:
      'Run a comprehensive audit scan of the customer website including technology detection, performance analysis, content architecture, and migration assessment.',
    synthesizerAgent: 'pitch-scan-orchestrator',
    collapsed: false,
    subsections: [
      {
        id: 'ps-overview',
        label: 'Pitch Scan Übersicht',
        route: 'pitch-scan',
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
  if (!section) {
    // Dynamic pitch-scan sections are not part of the static navigation config.
    // Use the parent pitch-scan template as a sensible default.
    if (sectionId.startsWith('ps-')) {
      return QUALIFICATION_NAVIGATION_SECTIONS.find(s => s.id === 'pitch-scan')?.ragQueryTemplate;
    }
    return undefined;
  }

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
