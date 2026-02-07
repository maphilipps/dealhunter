// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN BUILDER - Qualification Scan Export
// Builds structured Markdown from scan results for PDF/Word export
// ═══════════════════════════════════════════════════════════════════════════════

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  preQualifications,
  qualificationScans,
  dealEmbeddings,
  sectionNotes,
} from '@/lib/db/schema';

interface ExportSection {
  title: string;
  content: string;
  notes?: string[];
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Build a complete Markdown document from Qualification Scan results.
 * Pulls data from qualificationScans + deal_embeddings + sectionNotes.
 */
export async function buildQualificationScanMarkdown(qualificationId: string): Promise<string> {
  // 1. Load qualification + scan
  const [bid] = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, qualificationId))
    .limit(1);

  if (!bid) throw new Error('Qualification nicht gefunden');

  let scan = null;
  if (bid.qualificationScanId) {
    const [result] = await db
      .select()
      .from(qualificationScans)
      .where(eq(qualificationScans.id, bid.qualificationScanId))
      .limit(1);
    scan = result ?? null;
  }

  const extractedRequirements = safeJsonParse<{ customerName?: string }>(bid.extractedRequirements);
  const companyIntelligence = safeJsonParse<{ basicInfo?: { name?: string } }>(
    scan?.companyIntelligence
  );
  const customerName =
    extractedRequirements?.customerName?.trim() ||
    companyIntelligence?.basicInfo?.name?.trim() ||
    bid.rawInput?.substring(0, 80) ||
    'Unbekannt';

  // 2. Load deal_embeddings for this qualification
  const embeddings = await db
    .select({
      agentName: dealEmbeddings.agentName,
      chunkType: dealEmbeddings.chunkType,
      content: dealEmbeddings.content,
      chunkCategory: dealEmbeddings.chunkCategory,
      confidence: dealEmbeddings.confidence,
    })
    .from(dealEmbeddings)
    .where(eq(dealEmbeddings.preQualificationId, qualificationId));

  // 3. Load notes
  const notes = await db
    .select()
    .from(sectionNotes)
    .where(eq(sectionNotes.qualificationId, qualificationId));

  const notesBySection = new Map<string, string[]>();
  for (const note of notes) {
    const existing = notesBySection.get(note.sectionId) ?? [];
    existing.push(note.content);
    notesBySection.set(note.sectionId, existing);
  }

  // 4. Build sections
  const sections: ExportSection[] = [];

  // Bid/No-Bid Decision (optional fields on preQualifications)
  const decision = bid.decision ?? 'pending';
  const decisionData = safeJsonParse<unknown>(bid.decisionData);
  const decisionEvaluation = safeJsonParse<unknown>(bid.decisionEvaluation);
  if (decision !== 'pending' || decisionData || decisionEvaluation) {
    const lines: string[] = [];
    lines.push(`- **Decision:** ${decision}`);
    if (decisionData) {
      lines.push('');
      lines.push('**Decision Data:**');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(decisionData, null, 2));
      lines.push('```');
    }
    if (decisionEvaluation) {
      lines.push('');
      lines.push('**Decision Evaluation:**');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(decisionEvaluation, null, 2));
      lines.push('```');
    }
    sections.push({
      title: 'Bid/No-Bid Decision',
      content: lines.join('\n'),
      notes: notesBySection.get('decision'),
    });
  }

  // Executive Summary
  const summaryEmbeddings = embeddings.filter(
    e => e.chunkType === 'executive_summary' || e.agentName === 'executive_summary'
  );
  if (summaryEmbeddings.length > 0) {
    sections.push({
      title: 'Executive Summary',
      content: summaryEmbeddings.map(e => e.content).join('\n\n'),
      notes: notesBySection.get('executive-summary'),
    });
  }

  // Tech Stack
  if (scan?.techStack) {
    const tech = JSON.parse(scan.techStack);
    const lines: string[] = [];
    if (tech.cms)
      lines.push(`- **CMS:** ${tech.cms}${tech.cmsVersion ? ` (${tech.cmsVersion})` : ''}`);
    if (tech.framework) lines.push(`- **Framework:** ${tech.framework}`);
    if (tech.hosting) lines.push(`- **Hosting:** ${tech.hosting}`);
    if (tech.cdn) lines.push(`- **CDN:** ${tech.cdn}`);
    if (tech.backend?.length) lines.push(`- **Backend:** ${tech.backend.join(', ')}`);
    if (tech.libraries?.length) lines.push(`- **Libraries:** ${tech.libraries.join(', ')}`);
    sections.push({
      title: 'Technologie-Stack',
      content: lines.join('\n') || 'Keine Daten verfügbar.',
      notes: notesBySection.get('tech-stack'),
    });
  }

  // Content Volume
  if (scan?.contentVolume) {
    const cv = JSON.parse(scan.contentVolume);
    const lines: string[] = [];
    if (cv.estimatedPageCount)
      lines.push(`- **Geschätzte Seitenanzahl:** ${cv.estimatedPageCount}`);
    if (cv.complexity) lines.push(`- **Komplexität:** ${cv.complexity}`);
    if (cv.languages?.length) lines.push(`- **Sprachen:** ${cv.languages.join(', ')}`);
    if (cv.contentTypes?.length) lines.push(`- **Content-Typen:** ${cv.contentTypes.join(', ')}`);
    sections.push({
      title: 'Content-Analyse',
      content: lines.join('\n') || 'Keine Daten verfügbar.',
      notes: notesBySection.get('content-analysis'),
    });
  }

  // Company Intelligence
  if (scan?.companyIntelligence) {
    const ci = JSON.parse(scan.companyIntelligence);
    const lines: string[] = [];
    if (ci.basicInfo?.name) lines.push(`- **Unternehmen:** ${ci.basicInfo.name}`);
    if (ci.basicInfo?.industry) lines.push(`- **Branche:** ${ci.basicInfo.industry}`);
    if (ci.basicInfo?.employeeCount) lines.push(`- **Mitarbeiter:** ${ci.basicInfo.employeeCount}`);
    if (ci.basicInfo?.headquarters) lines.push(`- **Hauptsitz:** ${ci.basicInfo.headquarters}`);
    sections.push({
      title: 'Unternehmensdaten',
      content: lines.join('\n') || 'Keine Daten verfügbar.',
      notes: notesBySection.get('company-intelligence'),
    });
  }

  // Migration Complexity
  if (scan?.migrationComplexity) {
    const mc = JSON.parse(scan.migrationComplexity);
    const lines: string[] = [];
    lines.push(`- **Score:** ${mc.score}/100`);
    lines.push(`- **Empfehlung:** ${mc.recommendation}`);
    if (mc.estimatedEffort) {
      lines.push(
        `- **Geschätzter Aufwand:** ${mc.estimatedEffort.minPT}–${mc.estimatedEffort.maxPT} PT`
      );
    }
    if (mc.warnings?.length) {
      lines.push('\n**Warnungen:**');
      mc.warnings.forEach((w: string) => lines.push(`- ${w}`));
    }
    sections.push({
      title: 'Migrations-Analyse',
      content: lines.join('\n'),
      notes: notesBySection.get('migration'),
    });
  }

  // Audits (SEO, Accessibility, Legal)
  const auditLines: string[] = [];
  if (scan?.accessibilityAudit) {
    const a11y = JSON.parse(scan.accessibilityAudit);
    auditLines.push(
      `### Barrierefreiheit\n- **Score:** ${a11y.score}/100\n- **Kritische Issues:** ${a11y.criticalIssues}`
    );
  }
  if (scan?.seoAudit) {
    const seo = JSON.parse(scan.seoAudit);
    auditLines.push(`### SEO\n- **Score:** ${seo.score ?? 'N/A'}/100`);
  }
  if (scan?.legalCompliance) {
    const legal = JSON.parse(scan.legalCompliance);
    auditLines.push(`### Recht & Compliance\n- **Score:** ${legal.score}/100`);
  }
  if (auditLines.length > 0) {
    sections.push({
      title: 'Audits',
      content: auditLines.join('\n\n'),
      notes: notesBySection.get('audits'),
    });
  }

  // BL Recommendation
  if (scan?.recommendedBusinessUnit) {
    const lines = [
      `- **Empfohlene Business Line:** ${scan.recommendedBusinessUnit}`,
      `- **Konfidenz:** ${scan.confidence ?? 'N/A'}%`,
    ];
    if (scan.reasoning) lines.push(`- **Begründung:** ${scan.reasoning}`);
    sections.push({
      title: 'BL-Empfehlung',
      content: lines.join('\n'),
      notes: notesBySection.get('bl-recommendation'),
    });
  }

  // CMS Matrix
  if (scan?.cmsEvaluation) {
    const cms = safeJsonParse<any>(scan.cmsEvaluation);
    const lines: string[] = [];

    const cmsMatchingResult = cms?.cmsMatchingResult;
    const cmsMatchingMatrix = cms?.cmsMatchingMatrix;

    if (cmsMatchingResult?.recommendation?.primaryCms) {
      lines.push(`- **Empfohlenes CMS:** ${cmsMatchingResult.recommendation.primaryCms}`);
      lines.push(`- **Konfidenz:** ${cmsMatchingResult.recommendation.confidence ?? 'N/A'}%`);
      if (cmsMatchingResult.recommendation.reasoning) {
        lines.push(`- **Begründung:** ${cmsMatchingResult.recommendation.reasoning}`);
      }
      if (cmsMatchingResult.recommendation.alternativeCms) {
        lines.push(`- **Alternative:** ${cmsMatchingResult.recommendation.alternativeCms}`);
        if (cmsMatchingResult.recommendation.alternativeReasoning) {
          lines.push(
            `- **Alternative Begründung:** ${cmsMatchingResult.recommendation.alternativeReasoning}`
          );
        }
      }

      if (Array.isArray(cmsMatchingResult.comparedTechnologies)) {
        lines.push('');
        lines.push('| CMS | Overall Score | Baseline |');
        lines.push('|-----|--------------:|----------|');
        for (const t of cmsMatchingResult.comparedTechnologies) {
          lines.push(
            `| ${t.name ?? '?'} | ${t.overallScore ?? '?'} | ${t.isBaseline ? 'Ja' : 'Nein'} |`
          );
        }
      }

      const compared = Array.isArray(cmsMatchingResult.comparedTechnologies)
        ? [...cmsMatchingResult.comparedTechnologies].sort(
            (a: any, b: any) => (b.overallScore ?? 0) - (a.overallScore ?? 0)
          )
        : [];
      const topTechs = compared.slice(0, 3);

      if (Array.isArray(cmsMatchingResult.requirements) && topTechs.length > 0) {
        lines.push('');
        lines.push(`### Feature-Bewertungen (Top ${topTechs.length})`);
        lines.push('');
        lines.push(
          `| Requirement | Priority | Category | ${topTechs.map(t => t.name).join(' | ')} |`
        );
        lines.push(
          `|------------|----------|----------|${topTechs.map(() => '------:').join('|')}|`
        );

        for (const r of cmsMatchingResult.requirements) {
          const scores = topTechs.map(t => {
            const s = r.cmsScores?.[t.id];
            return typeof s?.score === 'number' ? String(s.score) : '—';
          });
          lines.push(
            `| ${r.requirement ?? '?'} | ${r.priority ?? '—'} | ${r.category ?? '—'} | ${scores.join(
              ' | '
            )} |`
          );
        }
      }

      if (cmsMatchingMatrix?.metadata) {
        lines.push('');
        lines.push(
          `- **Matrix Cells:** ${cmsMatchingMatrix.metadata.completedCells ?? '?'} / ${cmsMatchingMatrix.metadata.totalCells ?? '?'}`
        );
        lines.push(`- **Average Score:** ${cmsMatchingMatrix.metadata.averageScore ?? 'N/A'}`);
      }
    } else {
      // Legacy CMS evaluation format
      if (cms?.winner) lines.push(`- **Empfohlenes CMS:** ${cms.winner}`);
      if (cms?.results?.length) {
        lines.push('\n| CMS | Score | Kategorie |');
        lines.push('|-----|-------|-----------|');
        for (const r of cms.results) {
          lines.push(
            `| ${r.cms ?? r.name ?? '?'} | ${r.totalScore ?? r.score ?? '?'} | ${r.category ?? '—'} |`
          );
        }
      }
    }
    sections.push({
      title: 'CMS-Matrix',
      content: lines.join('\n') || 'Keine CMS-Bewertung verfügbar.',
      notes: notesBySection.get('cms-matrix'),
    });
  }

  // Features (from scan)
  if (scan?.features) {
    const features = safeJsonParse<any>(scan.features);
    const lines: string[] = [];

    const boolFeatures: Array<[string, unknown]> = [
      ['E-Commerce', features?.ecommerce],
      ['User Accounts', features?.userAccounts],
      ['Suche', features?.search],
      ['Mehrsprachigkeit', features?.multiLanguage],
      ['Blog/News', features?.blog],
      ['Formulare', features?.forms],
      ['API', features?.api],
      ['Mobile App', features?.mobileApp],
    ];

    for (const [label, value] of boolFeatures) {
      if (typeof value === 'boolean') {
        lines.push(`- ${value ? '✅' : '❌'} ${label}`);
      }
    }

    if (Array.isArray(features?.customFeatures) && features.customFeatures.length > 0) {
      lines.push('');
      lines.push('**Custom Features:**');
      for (const f of features.customFeatures) lines.push(`- ${f}`);
    }

    sections.push({
      title: 'Erkannte Features',
      content: lines.join('\n') || 'Keine Feature-Daten verfügbar.',
      notes: notesBySection.get('features'),
    });
  }

  // Screenshots (from scan)
  if (scan?.screenshots) {
    const screenshots = safeJsonParse<any>(scan.screenshots);
    const lines: string[] = [];
    if (screenshots?.homepage?.desktop) {
      lines.push(`- **Homepage Desktop:** ${screenshots.homepage.desktop}`);
    }
    if (screenshots?.homepage?.mobile) {
      lines.push(`- **Homepage Mobile:** ${screenshots.homepage.mobile}`);
    }
    if (Array.isArray(screenshots?.keyPages) && screenshots.keyPages.length > 0) {
      lines.push('');
      lines.push('| Page | Path | URL | Screenshot |');
      lines.push('|------|------|-----|------------|');
      for (const p of screenshots.keyPages) {
        lines.push(
          `| ${p.name ?? p.title ?? '—'} | ${p.path ?? '—'} | ${p.url ?? '—'} | ${p.screenshot ?? '—'} |`
        );
      }
    }
    sections.push({
      title: 'Screenshots',
      content: lines.join('\n') || 'Keine Screenshots verfügbar.',
      notes: notesBySection.get('screenshots'),
    });
  }

  // 10 Questions (from scan)
  if (scan?.tenQuestions) {
    const ten = safeJsonParse<any>(scan.tenQuestions);
    const lines: string[] = [];
    if (ten?.answeredCount != null && ten?.totalCount != null) {
      lines.push(`- **Beantwortet:** ${ten.answeredCount}/${ten.totalCount}`);
    }
    if (Array.isArray(ten?.questions)) {
      lines.push('');
      for (const q of ten.questions) {
        lines.push(`### ${q.id}. ${q.question}`);
        lines.push('');
        lines.push(
          q.answered ? (q.answer ? q.answer : 'Beantwortet (ohne Text).') : 'Nicht beantwortet.'
        );
        if (q.confidence != null) {
          lines.push('');
          lines.push(`- **Confidence:** ${q.confidence}%`);
        }
        lines.push('');
      }
    }
    sections.push({
      title: '10 Fragen (aus Decision)',
      content: lines.join('\n') || 'Keine 10-Fragen-Daten verfügbar.',
      notes: notesBySection.get('ten-questions'),
    });
  }

  // BD Sections (from deal_embeddings written by prequal section agent)
  const BD_SECTION_IDS = [
    'budget',
    'timing',
    'contracts',
    'deliverables',
    'references',
    'award-criteria',
    'offer-structure',
    'risks',
  ] as const;
  const bdSectionTitles: Record<(typeof BD_SECTION_IDS)[number], string> = {
    budget: 'Budget',
    timing: 'Timing',
    contracts: 'Contracts',
    deliverables: 'Deliverables',
    references: 'References',
    'award-criteria': 'Award Criteria',
    'offer-structure': 'Offer Structure',
    risks: 'Risiken',
  };

  const sectionEmbeddings = embeddings.filter(e => e.agentName === 'prequal_section_agent');
  const dashboardHighlights = embeddings.filter(
    e => e.chunkType === 'dashboard_highlight' && typeof e.agentName === 'string'
  );

  for (const sectionId of BD_SECTION_IDS) {
    const findings = sectionEmbeddings.filter(e => e.chunkType === sectionId);
    const highlight = dashboardHighlights.find(e => e.agentName === `dashboard_${sectionId}`);

    if (findings.length === 0 && !highlight) continue;

    const lines: string[] = [];
    if (highlight) {
      const parsed = safeJsonParse<string[]>(highlight.content);
      if (parsed && parsed.length > 0) {
        lines.push('**Highlights:**');
        for (const h of parsed) lines.push(`- ${h}`);
        lines.push('');
      }
    }
    if (findings.length > 0) {
      lines.push('**Findings:**');
      for (const f of findings) {
        lines.push(`- ${f.content}`);
      }
    }

    sections.push({
      title: `BD-Section: ${bdSectionTitles[sectionId]}`,
      content: lines.join('\n') || 'Keine Inhalte verfügbar.',
      notes: notesBySection.get(`bd-${sectionId}`),
    });
  }

  // Additional embeddings (agent findings not covered above)
  const coveredAgents = new Set([
    'executive_summary',
    'tech_stack',
    'content_volume',
    'company_intelligence',
    'migration_complexity',
  ]);
  const additionalFindings = embeddings.filter(
    e => !coveredAgents.has(e.agentName) && e.chunkCategory === 'recommendation'
  );
  if (additionalFindings.length > 0) {
    sections.push({
      title: 'Weitere Empfehlungen',
      content: additionalFindings.map(f => `- ${f.content}`).join('\n'),
    });
  }

  // 5. Assemble document
  const lines: string[] = [];

  // Header
  lines.push(`# Qualification Scan — ${customerName}`);
  lines.push('');
  lines.push(`**Website:** ${scan?.websiteUrl ?? bid.websiteUrl ?? 'N/A'}`);
  lines.push(`**Status:** ${scan?.status ?? 'N/A'}`);
  lines.push(
    `**Erstellt:** ${bid.createdAt ? new Date(bid.createdAt).toLocaleDateString('de-DE') : 'N/A'}`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Sections
  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(section.content);
    if (section.notes?.length) {
      lines.push('');
      lines.push('> **Notizen:**');
      for (const note of section.notes) {
        lines.push(`> - ${note}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
