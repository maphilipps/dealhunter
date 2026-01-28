import type { RequirementMatch } from './schema';

/**
 * Extracts CMS requirements from Quick Scan data
 */
export function extractRequirementsFromQuickScan(quickScanData: Record<string, unknown>): Array<{
  name: string;
  category: RequirementMatch['category'];
  priority: RequirementMatch['priority'];
  source: RequirementMatch['source'];
}> {
  const requirements: Array<{
    name: string;
    category: RequirementMatch['category'];
    priority: RequirementMatch['priority'];
    source: RequirementMatch['source'];
  }> = [];

  const features = quickScanData.features as Record<string, unknown> | undefined;
  const techStack = quickScanData.techStack as Record<string, unknown> | undefined;
  const contentVolume = quickScanData.contentVolume as Record<string, unknown> | undefined;
  const accessibility = quickScanData.accessibilityAudit as Record<string, unknown> | undefined;
  const legalCompliance = quickScanData.legalCompliance as Record<string, unknown> | undefined;
  const performance = quickScanData.performanceIndicators as Record<string, unknown> | undefined;

  // Features -> Functional Requirements
  if (features) {
    if (features.ecommerce) {
      requirements.push({
        name: 'E-Commerce Funktionalität',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (features.multiLanguage) {
      requirements.push({
        name: 'Mehrsprachigkeit',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (features.search) {
      requirements.push({
        name: 'Suchfunktion',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.blog) {
      requirements.push({
        name: 'Blog/News Bereich',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.forms) {
      requirements.push({
        name: 'Formulare',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.userAccounts) {
      requirements.push({
        name: 'Benutzerkonten/Login',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (features.api) {
      requirements.push({
        name: 'API-Schnittstelle',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.mobileApp) {
      requirements.push({
        name: 'Mobile App Integration',
        category: 'functional',
        priority: 'nice-to-have',
        source: 'detected',
      });
    }
    const custom = features.customFeatures as string[] | undefined;
    if (custom && custom.length > 0) {
      for (const feature of custom.slice(0, 6)) {
        requirements.push({
          name: feature,
          category: 'functional',
          priority: 'nice-to-have',
          source: 'detected',
        });
      }
    }
  }

  // Tech Stack -> Technical Requirements
  if (techStack) {
    if (techStack.cms) {
      requirements.push({
        name: `CMS bevorzugt: ${String(techStack.cms)}`,
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (techStack.serverSideRendering) {
      requirements.push({
        name: 'Server-Side Rendering (SSR)',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if ((techStack.apiEndpoints as Record<string, unknown>)?.graphql) {
      requirements.push({
        name: 'GraphQL API',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (techStack.hosting) {
      requirements.push({
        name: `Hosting-Vorgabe: ${String(techStack.hosting)}`,
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if ((techStack.headlessCms as string[] | undefined)?.length) {
      requirements.push({
        name: 'Headless CMS Support',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
  }

  // Content Volume -> Scalability
  if (contentVolume) {
    const pageCount = contentVolume.estimatedPageCount as number | undefined;
    if (pageCount && pageCount > 500) {
      requirements.push({
        name: 'Enterprise-Skalierbarkeit (>500 Seiten)',
        category: 'scalability',
        priority: 'must-have',
        source: 'inferred',
      });
    }
    if (contentVolume.complexity === 'high') {
      requirements.push({
        name: 'Komplexe Content-Strukturen',
        category: 'functional',
        priority: 'must-have',
        source: 'inferred',
      });
    }
    if (contentVolume.languages && Array.isArray(contentVolume.languages)) {
      if (contentVolume.languages.length > 1) {
        requirements.push({
          name: 'Mehrsprachigkeit (Internationalisierung/i18n)',
          category: 'functional',
          priority: 'must-have',
          source: 'detected',
        });
      }
    }
  }

  if (accessibility) {
    requirements.push({
      name: 'Barrierefreiheit (WCAG)',
      category: 'compliance',
      priority: 'must-have',
      source: 'detected',
    });
  }

  if (legalCompliance) {
    requirements.push({
      name: 'DSGVO-Konformität',
      category: 'compliance',
      priority: 'must-have',
      source: 'detected',
    });
  }

  if (performance) {
    requirements.push({
      name: 'Performance-Optimierung (Ladezeit & Core Web Vitals)',
      category: 'performance',
      priority: 'should-have',
      source: 'inferred',
    });
  }

  // Always include common requirements
  requirements.push({
    name: 'DSGVO-Konformität',
    category: 'compliance',
    priority: 'must-have',
    source: 'inferred',
  });

  requirements.push({
    name: 'Barrierefreiheit (WCAG)',
    category: 'compliance',
    priority: 'should-have',
    source: 'inferred',
  });

  const seen = new Set<string>();
  return requirements.filter(req => {
    const key = req.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
