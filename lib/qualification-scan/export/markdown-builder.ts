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
    const cms = JSON.parse(scan.cmsEvaluation);
    const lines: string[] = [];
    if (cms.winner) lines.push(`- **Empfohlenes CMS:** ${cms.winner}`);
    if (cms.results?.length) {
      lines.push('\n| CMS | Score | Kategorie |');
      lines.push('|-----|-------|-----------|');
      for (const r of cms.results) {
        lines.push(
          `| ${r.cms ?? r.name ?? '?'} | ${r.totalScore ?? r.score ?? '?'} | ${r.category ?? '—'} |`
        );
      }
    }
    sections.push({
      title: 'CMS-Matrix',
      content: lines.join('\n') || 'Keine CMS-Bewertung verfügbar.',
      notes: notesBySection.get('cms-matrix'),
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
  const customerName = bid.rawInput?.substring(0, 80) ?? 'Unbekannt';
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
