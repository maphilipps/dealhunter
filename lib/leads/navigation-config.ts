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
  route: string; // Relative to /leads/[id]/
  ragQueryTemplate?: string; // Template for RAG queries
  synthesizerAgent?: string; // Agent name for content synthesis
  collapsed?: boolean; // If true, renders as collapsible group
  subsections?: LeadNavigationSubSection[];
}

export interface LeadNavigationSubSection {
  id: string;
  label: string;
  route: string; // Relative to /leads/[id]/
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
 * 4. CMS Architecture - Current CMS structure
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
export const LEAD_NAVIGATION_SECTIONS: LeadNavigationSection[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    icon: 'LayoutDashboard',
    route: '',
    ragQueryTemplate:
      'Provide an executive summary of the lead including key facts, opportunities, and risks.',
    synthesizerAgent: 'overview-synthesizer',
    collapsed: false,
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
  },
  {
    id: 'cms-architecture',
    label: 'CMS-Architektur',
    icon: 'Layers',
    route: 'cms-architecture',
    ragQueryTemplate:
      'Analyze the current CMS architecture. What is the content model? How is the CMS configured? What are the content types and relationships?',
    synthesizerAgent: 'cms-architecture-synthesizer',
    collapsed: false,
  },
  {
    id: 'cms-comparison',
    label: 'CMS-Vergleich & Auswahl',
    icon: 'Scale',
    route: 'cms-comparison',
    ragQueryTemplate:
      'Compare available CMS options for this project. Which CMS systems are suitable? What are the pros and cons? Provide a recommendation.',
    synthesizerAgent: 'cms-comparison-synthesizer',
    collapsed: false,
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
  },
  {
    id: 'staffing',
    label: 'Staffing & Timeline',
    icon: 'Calendar',
    route: 'staffing',
    ragQueryTemplate:
      'What resources are needed for this project? Provide role-based staffing requirements and a project timeline with phases.',
    synthesizerAgent: 'staffing-synthesizer',
    collapsed: false,
  },
  {
    id: 'references',
    label: 'Referenzen',
    icon: 'Bookmark',
    route: 'references',
    ragQueryTemplate:
      'Which reference projects are relevant for this lead? Include projects with similar technology, industry, or scope.',
    synthesizerAgent: 'references-synthesizer',
    collapsed: false,
  },
  {
    id: 'legal',
    label: 'Legal-Prüfung',
    icon: 'Scale',
    route: 'legal',
    ragQueryTemplate:
      'Analyze legal and compliance aspects. GDPR compliance, licensing risks, industry-specific regulations, contract terms.',
    synthesizerAgent: 'legal-check-synthesizer',
    collapsed: false,
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
  },
];

/**
 * Get a section by its route
 * @param route - Route path (relative to /leads/[id]/)
 * @returns LeadNavigationSection or undefined if not found
 */
export function getSectionByRoute(route: string): LeadNavigationSection | undefined {
  // Normalize route: remove leading/trailing slashes
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

  return LEAD_NAVIGATION_SECTIONS.find(section => {
    const sectionRoute = section.route.replace(/^\/+|\/+$/g, '');
    return sectionRoute === normalizedRoute;
  });
}

/**
 * Get a section by its ID
 * @param id - Section ID
 * @returns LeadNavigationSection or undefined if not found
 */
export function getSectionById(id: string): LeadNavigationSection | undefined {
  return LEAD_NAVIGATION_SECTIONS.find(section => section.id === id);
}

/**
 * Get all sections
 * @returns Array of all navigation sections
 */
export function getAllSections(): LeadNavigationSection[] {
  return LEAD_NAVIGATION_SECTIONS;
}

/**
 * Get all section IDs
 * @returns Array of section IDs
 */
export function getAllSectionIds(): string[] {
  return LEAD_NAVIGATION_SECTIONS.map(section => section.id);
}

/**
 * Check if a route is a valid lead section route
 * @param route - Route path (relative to /leads/[id]/)
 * @returns boolean
 */
export function isValidSectionRoute(route: string): boolean {
  return getSectionByRoute(route) !== undefined;
}

/**
 * Get the RAG query template for a section
 * @param sectionId - Section ID
 * @returns RAG query template or undefined
 */
export function getRAGQueryTemplate(sectionId: string): string | undefined {
  const section = getSectionById(sectionId);
  return section?.ragQueryTemplate;
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
