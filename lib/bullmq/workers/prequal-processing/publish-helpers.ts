import { publishFinding } from '@/lib/streaming/redis/qualification-publisher';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

export function fireAndForget(promise: Promise<unknown>, label: string): void {
  void promise.catch(err => console.error(`[PreQual Worker] ${label} failed:`, err));
}

export function publishExtractedRequirementsFindings(
  preQualificationId: string,
  extractedRequirements: ExtractedRequirements
): void {
  const pf = (finding: Parameters<typeof publishFinding>[2]) =>
    fireAndForget(
      publishFinding(preQualificationId, 'requirements_extraction', finding),
      'publishFinding'
    );

  // Customer & Company
  if (extractedRequirements.customerName) {
    pf({ type: 'customer', label: 'Kundenname', value: extractedRequirements.customerName });
  }
  if (extractedRequirements.industry) {
    pf({ type: 'industry', label: 'Branche', value: extractedRequirements.industry });
  }
  if (extractedRequirements.companyLocation) {
    pf({ type: 'location', label: 'Standort', value: extractedRequirements.companyLocation });
  }
  if (extractedRequirements.companySize) {
    const sizeLabels: Record<string, string> = {
      startup: 'Startup',
      small: 'Klein',
      medium: 'Mittelstand',
      large: 'Großunternehmen',
      enterprise: 'Konzern',
    };
    pf({
      type: 'customer',
      label: 'Unternehmensgröße',
      value: sizeLabels[extractedRequirements.companySize] || extractedRequirements.companySize,
    });
  }
  if (extractedRequirements.procurementType) {
    const procLabels: Record<string, string> = {
      public: 'Öffentlich',
      private: 'Privat',
      'semi-public': 'Halböffentlich',
    };
    pf({
      type: 'contract',
      label: 'Vergabeart',
      value:
        procLabels[extractedRequirements.procurementType] || extractedRequirements.procurementType,
    });
  }

  // Project Details
  if (extractedRequirements.projectName) {
    pf({ type: 'requirement', label: 'Projektname', value: extractedRequirements.projectName });
  }
  if (extractedRequirements.projectDescription) {
    pf({
      type: 'scope',
      label: 'Projektbeschreibung',
      value:
        extractedRequirements.projectDescription.length > 200
          ? extractedRequirements.projectDescription.slice(0, 200) + '...'
          : extractedRequirements.projectDescription,
    });
  }
  if (extractedRequirements.scope) {
    pf({ type: 'scope', label: 'Projektumfang', value: extractedRequirements.scope });
  }

  // Project Goal
  if (extractedRequirements.projectGoal?.objective) {
    pf({
      type: 'goal',
      label: 'Projektziel',
      value: extractedRequirements.projectGoal.objective,
    });
  }
  if (extractedRequirements.projectGoal?.businessDrivers?.length) {
    pf({
      type: 'goal',
      label: 'Treiber',
      value: extractedRequirements.projectGoal.businessDrivers.join(', '),
    });
  }

  // Budget
  if (extractedRequirements.budgetRange) {
    const br = extractedRequirements.budgetRange;
    const budgetStr =
      br.min && br.max
        ? `${br.min.toLocaleString('de-DE')}–${br.max.toLocaleString('de-DE')} ${
            br.currency ?? 'EUR'
          }`
        : br.max
          ? `bis ${br.max.toLocaleString('de-DE')} ${br.currency ?? 'EUR'}`
          : JSON.stringify(br);
    pf({ type: 'budget', label: 'Budget', value: budgetStr, confidence: br.confidence });
  }

  // Timeline & Deadlines
  if (extractedRequirements.timeline) {
    pf({ type: 'timeline', label: 'Projektzeitrahmen', value: extractedRequirements.timeline });
  }
  if (extractedRequirements.submissionDeadline) {
    pf({
      type: 'deadline',
      label: 'Abgabefrist',
      value: `${extractedRequirements.submissionDeadline}${
        extractedRequirements.submissionTime
          ? ` um ${extractedRequirements.submissionTime} Uhr`
          : ''
      }`,
    });
  }
  if (extractedRequirements.projectStartDate) {
    pf({
      type: 'timeline',
      label: 'Projektstart',
      value: extractedRequirements.projectStartDate,
    });
  }
  if (extractedRequirements.projectEndDate) {
    pf({ type: 'timeline', label: 'Projektende', value: extractedRequirements.projectEndDate });
  }
  if (extractedRequirements.contractDuration) {
    pf({
      type: 'timeline',
      label: 'Vertragslaufzeit',
      value: extractedRequirements.contractDuration,
    });
  }

  // Technologies
  if (extractedRequirements.technologies?.length) {
    pf({
      type: 'tech_stack',
      label: 'Technologien',
      value: extractedRequirements.technologies.join(', '),
    });
  }

  if (extractedRequirements.cmsConstraints) {
    const cms = extractedRequirements.cmsConstraints;
    const parts: string[] = [];
    if (cms.required?.length) parts.push(`Pflicht: ${cms.required.join(', ')}`);
    if (cms.preferred?.length) parts.push(`Bevorzugt: ${cms.preferred.join(', ')}`);
    if (cms.excluded?.length) parts.push(`Ausgeschlossen: ${cms.excluded.join(', ')}`);
    if (parts.length > 0) {
      pf({
        type: 'cms',
        label: 'CMS-Vorgaben',
        value: parts.join(' | '),
        confidence: cms.confidence,
      });
    }
  }

  // Contract
  if (extractedRequirements.contractType) {
    pf({ type: 'contract', label: 'Vertragstyp', value: extractedRequirements.contractType });
  }
  if (extractedRequirements.contractModel) {
    pf({ type: 'contract', label: 'Vertragsmodell', value: extractedRequirements.contractModel });
  }
  if (extractedRequirements.procedureType) {
    pf({
      type: 'contract',
      label: 'Vergabeverfahren',
      value: extractedRequirements.procedureType,
    });
  }

  // Contacts
  if (extractedRequirements.contactPerson) {
    pf({
      type: 'contact',
      label: 'Ansprechpartner',
      value: `${extractedRequirements.contactPerson}${
        extractedRequirements.contactEmail ? ` (${extractedRequirements.contactEmail})` : ''
      }`,
    });
  }

  if (extractedRequirements.contacts?.length) {
    for (const contact of extractedRequirements.contacts) {
      const catLabels: Record<string, string> = {
        decision_maker: 'Entscheider',
        influencer: 'Einflussnehmer',
        coordinator: 'Koordinator',
        unknown: '',
      };
      const catLabel = catLabels[contact.category] || '';
      pf({
        type: 'contact',
        label: catLabel ? `Kontakt (${catLabel})` : 'Kontakt',
        value: `${contact.name} — ${contact.role}${contact.email ? ` (${contact.email})` : ''}`,
        confidence: contact.confidence,
      });
    }
  }

  // Required Services
  if (extractedRequirements.requiredServices?.length) {
    pf({
      type: 'service',
      label: 'Geforderte Leistungen',
      value: extractedRequirements.requiredServices.join(', '),
    });
  }

  // Key Requirements
  if (extractedRequirements.keyRequirements?.length) {
    for (const req of extractedRequirements.keyRequirements.slice(0, 8)) {
      pf({ type: 'requirement', label: 'Anforderung', value: req });
    }
  }

  // Required Deliverables
  if (extractedRequirements.requiredDeliverables?.length) {
    for (const del of extractedRequirements.requiredDeliverables.slice(0, 5)) {
      const parts = [del.name];
      if (del.deadline) parts.push(`bis ${del.deadline}`);
      if (del.format) parts.push(`Format: ${del.format}`);
      pf({
        type: 'deliverable',
        label: del.mandatory ? 'Pflichtunterlage' : 'Unterlage',
        value: parts.join(' — '),
        confidence: del.confidence,
      });
    }
  }

  // Award Criteria
  if (extractedRequirements.awardCriteria?.criteria?.length) {
    for (let i = 0; i < extractedRequirements.awardCriteria.criteria.length && i < 6; i++) {
      const crit = extractedRequirements.awardCriteria.criteria[i];
      const weight = extractedRequirements.awardCriteria.weights?.[i];
      pf({
        type: 'criterion',
        label: 'Zuschlagskriterium',
        value: weight ? `${crit} (${weight})` : crit,
      });
    }
  }

  // References
  if (extractedRequirements.referenceRequirements) {
    const ref = extractedRequirements.referenceRequirements;
    const parts: string[] = [];
    if (ref.count) parts.push(`${ref.count} Referenzen`);
    if (ref.requiredIndustries?.length)
      parts.push(`Branchen: ${ref.requiredIndustries.join(', ')}`);
    if (ref.requiredTechnologies?.length)
      parts.push(`Technologien: ${ref.requiredTechnologies.join(', ')}`);
    if (ref.description && !parts.length) parts.push(ref.description);
    if (parts.length > 0) {
      pf({ type: 'reference', label: 'Referenzanforderungen', value: parts.join(' | ') });
    }
  }

  // Submission Portal
  if (extractedRequirements.submissionPortal?.name) {
    pf({
      type: 'deadline',
      label: 'Vergabeportal',
      value: `${extractedRequirements.submissionPortal.name}${
        extractedRequirements.submissionPortal.url
          ? ` (${extractedRequirements.submissionPortal.url})`
          : ''
      }`,
    });
  }

  // Team Size
  if (extractedRequirements.teamSize) {
    pf({
      type: 'requirement',
      label: 'Teamgröße',
      value: `${extractedRequirements.teamSize} Personen`,
    });
  }

  // Constraints
  if (extractedRequirements.constraints?.length) {
    pf({
      type: 'requirement',
      label: 'Einschränkungen',
      value: extractedRequirements.constraints.join(', '),
    });
  }

  // Note: publishFinding is fire-and-forget. The background job should not fail if the UI
  // stream is temporarily unavailable.
}
