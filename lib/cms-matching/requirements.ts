import type { RequirementMatch } from './schema';

/**
 * Extracts CMS requirements from Qualification Scan data
 */
export function extractRequirementsFromQualificationScan(
  qualificationScanData: Record<string, unknown>
): Array<{
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

  const features = qualificationScanData.features as Record<string, unknown> | undefined;
  const techStack = qualificationScanData.techStack as Record<string, unknown> | undefined;
  const contentVolume = qualificationScanData.contentVolume as Record<string, unknown> | undefined;
  const accessibility = qualificationScanData.accessibilityAudit as
    | Record<string, unknown>
    | undefined;
  const legalCompliance = qualificationScanData.legalCompliance as
    | Record<string, unknown>
    | undefined;
  const performance = qualificationScanData.performanceIndicators as
    | Record<string, unknown>
    | undefined;

  function mapCategory(raw: unknown): RequirementMatch['category'] {
    const normalized =
      raw == null
        ? ''
        : typeof raw === 'string'
          ? raw
          : typeof raw === 'number' || typeof raw === 'boolean'
            ? String(raw)
            : typeof raw === 'object'
              ? JSON.stringify(raw)
              : '';
    const c = normalized.toLowerCase();
    if (c.includes('compliance') || c.includes('legal') || c.includes('privacy'))
      return 'compliance';
    if (c.includes('performance')) return 'performance';
    if (c.includes('scal') || c.includes('enterprise')) return 'scalability';
    if (c.includes('tech')) return 'technical';
    if (c.includes('integration')) return 'technical';
    if (c.includes('security')) return 'technical';
    if (c.includes('content')) return 'functional';
    if (c.includes('marketing')) return 'functional';
    return 'functional';
  }

  function mapPriority(raw: unknown): RequirementMatch['priority'] {
    const p = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(p)) {
      if (p >= 75) return 'must-have';
      if (p >= 55) return 'should-have';
      return 'nice-to-have';
    }
    return 'should-have';
  }

  // Features -> Functional Requirements
  if (features) {
    const detected = features.detectedFeatures as
      | Array<{
          id?: string;
          slug?: string;
          name?: string;
          category?: string;
          priority?: number;
          confidence?: number;
        }>
      | undefined;

    // Preferred: DB-driven feature library matches
    if (detected && detected.length > 0) {
      for (const f of detected) {
        if (!f?.name) continue;
        requirements.push({
          name: f.name,
          category: mapCategory(f.category),
          priority: mapPriority(f.priority),
          source: 'detected',
        });
      }
    } else {
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
  }

  // Tech Stack -> Technical Requirements
  if (techStack) {
    if (typeof techStack.cms === 'string' && techStack.cms) {
      requirements.push({
        name: `CMS bevorzugt: ${techStack.cms}`,
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
    if (typeof techStack.hosting === 'string' && techStack.hosting) {
      requirements.push({
        name: `Hosting-Vorgabe: ${techStack.hosting}`,
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
