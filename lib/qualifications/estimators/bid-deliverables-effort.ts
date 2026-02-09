/**
 * Bid Deliverables Effort Estimator
 *
 * Deterministic (non-LLM) estimator for offer submission deliverables
 * (Teilnahmeantrag/Angebot, Konzepte, Preisblatt, Präsentation).
 *
 * Outputs:
 * - effortHours: engineering hours (incl. review/QA overhead)
 * - effortPT: person-days (1 PT = 8h)
 * - calendarDays: rough calendar duration assuming 1 FTE and effective writing time per day
 * - WBS: simple task breakdown with disciplines and hours
 *
 * Notes:
 * - This is intentionally transparent: all assumptions are returned so they can be cited.
 * - It does NOT estimate project implementation effort (Go-Live).
 */

export type DeliverableCategory =
  | 'proposal_document'
  | 'commercial'
  | 'legal'
  | 'technical'
  | 'reference'
  | 'administrative'
  | 'presentation';

export type SubmissionMethod = 'email' | 'portal' | 'physical' | 'unknown';

export type Discipline = 'PL' | 'CON' | 'UX' | 'DEV' | 'SEO' | 'QA' | 'OPS';

export interface DeliverableInput {
  name: string;
  category: DeliverableCategory;
  mandatory: boolean;
  pageLimit: number | null;
  submissionMethod: SubmissionMethod;
}

export interface EstimatorAssumption {
  label: string;
  rationale: string;
}

export interface WBSTask {
  deliverableName: string;
  task: string;
  discipline: Discipline;
  hours: number;
}

export interface DeliverableEffort {
  deliverableName: string;
  effortHours: number;
  effortPT: number;
  calendarDays: number;
  wbs: WBSTask[];
  assumptions: EstimatorAssumption[];
}

export interface BidDeliverablesEstimate {
  perDeliverable: DeliverableEffort[];
  totals: {
    effortHours: number;
    effortPT: number;
    calendarDaysSequential: number;
  };
  assumptions: EstimatorAssumption[];
  parallelizationHints: string[];
}

export interface EstimatorConfig {
  ptHours: number; // 1 PT in hours
  effectiveWritingHoursPerDay: number; // calendar conversion baseline
  reviewQaOverheadPct: number; // e.g. 0.25 = +25%
  baseHoursByCategory: Record<DeliverableCategory, number>;
  pageLimitFactor: {
    defaultWhenUnknown: number;
    min: number;
    max: number;
    divisor: number; // factor = clamp(pageLimit/divisor)
  };
  optionalMultiplier: number;
  mandatoryMultiplier: number;
}

export const DEFAULT_ESTIMATOR_CONFIG: EstimatorConfig = {
  ptHours: 8,
  effectiveWritingHoursPerDay: 6, // assumption: meetings/context switching included
  reviewQaOverheadPct: 0.25,
  baseHoursByCategory: {
    proposal_document: 12,
    technical: 16,
    commercial: 8,
    legal: 4,
    reference: 10,
    administrative: 6,
    presentation: 12,
  },
  pageLimitFactor: {
    defaultWhenUnknown: 1.0,
    min: 0.7,
    max: 2.5,
    divisor: 10,
  },
  optionalMultiplier: 0.6,
  mandatoryMultiplier: 1.0,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computePageFactor(pageLimit: number | null, cfg: EstimatorConfig): number {
  if (!pageLimit || pageLimit <= 0) return cfg.pageLimitFactor.defaultWhenUnknown;
  const raw = pageLimit / cfg.pageLimitFactor.divisor;
  return clamp(raw, cfg.pageLimitFactor.min, cfg.pageLimitFactor.max);
}

function computeMultiplier(mandatory: boolean, cfg: EstimatorConfig): number {
  return mandatory ? cfg.mandatoryMultiplier : cfg.optionalMultiplier;
}

function defaultWbsAllocation(
  category: DeliverableCategory
): Array<{ task: string; discipline: Discipline; pct: number }> {
  // Keep this simple and predictable; it's a planning aid, not a full project plan.
  switch (category) {
    case 'technical':
      return [
        { task: 'Anforderungen verstehen & Struktur', discipline: 'CON', pct: 0.15 },
        { task: 'Technischer Draft (Architektur/Details)', discipline: 'DEV', pct: 0.55 },
        { task: 'Review (Tech/Stakeholder)', discipline: 'DEV', pct: 0.15 },
        { task: 'QA/Proofreading & Finalisierung', discipline: 'QA', pct: 0.15 },
      ];
    case 'presentation':
      return [
        { task: 'Storyboard & Messages', discipline: 'PL', pct: 0.25 },
        { task: 'Folien/Assets erstellen', discipline: 'CON', pct: 0.45 },
        { task: 'Trockenlauf & Anpassungen', discipline: 'PL', pct: 0.15 },
        { task: 'QA/Final Check', discipline: 'QA', pct: 0.15 },
      ];
    case 'commercial':
      return [
        { task: 'Preisstruktur/Annahmen', discipline: 'CON', pct: 0.35 },
        { task: 'Kalkulation & Tabellen', discipline: 'CON', pct: 0.35 },
        { task: 'Review (PL/Finance)', discipline: 'PL', pct: 0.15 },
        { task: 'QA/Finalisierung', discipline: 'QA', pct: 0.15 },
      ];
    case 'legal':
      return [
        { task: 'Anforderungen extrahieren', discipline: 'CON', pct: 0.35 },
        { task: 'Dokumente/Erklärungen vorbereiten', discipline: 'PL', pct: 0.35 },
        { task: 'Review (Legal/Compliance)', discipline: 'PL', pct: 0.15 },
        { task: 'QA/Finalisierung', discipline: 'QA', pct: 0.15 },
      ];
    case 'reference':
      return [
        { task: 'Passende Referenz auswählen', discipline: 'CON', pct: 0.25 },
        { task: 'Case-Study Draft', discipline: 'CON', pct: 0.45 },
        { task: 'Review (Fach/PL)', discipline: 'PL', pct: 0.15 },
        { task: 'QA/Finalisierung', discipline: 'QA', pct: 0.15 },
      ];
    case 'administrative':
      return [
        { task: 'Unterlagen sammeln', discipline: 'PL', pct: 0.4 },
        { task: 'Formblätter ausfüllen', discipline: 'CON', pct: 0.3 },
        { task: 'Review', discipline: 'PL', pct: 0.15 },
        { task: 'QA/Finalisierung', discipline: 'QA', pct: 0.15 },
      ];
    case 'proposal_document':
    default:
      return [
        { task: 'Struktur & Outline', discipline: 'CON', pct: 0.25 },
        { task: 'Draft schreiben', discipline: 'CON', pct: 0.45 },
        { task: 'Review (Stakeholder)', discipline: 'PL', pct: 0.15 },
        { task: 'QA/Proofreading & Finalisierung', discipline: 'QA', pct: 0.15 },
      ];
  }
}

export function estimateBidDeliverablesEffort(
  deliverables: DeliverableInput[],
  config: Partial<EstimatorConfig> = {}
): BidDeliverablesEstimate {
  const cfg: EstimatorConfig = {
    ...DEFAULT_ESTIMATOR_CONFIG,
    ...config,
    baseHoursByCategory: {
      ...DEFAULT_ESTIMATOR_CONFIG.baseHoursByCategory,
      ...(config.baseHoursByCategory ?? {}),
    },
    pageLimitFactor: {
      ...DEFAULT_ESTIMATOR_CONFIG.pageLimitFactor,
      ...(config.pageLimitFactor ?? {}),
    },
  };

  const globalAssumptions: EstimatorAssumption[] = [
    {
      label: 'PT=8h',
      rationale: `1 Personentag (PT) wird als ${cfg.ptHours} Stunden gerechnet.`,
    },
    {
      label: 'Effektive Schreibzeit=6h/Tag',
      rationale: `Kalenderdauer wird mit ${cfg.effectiveWritingHoursPerDay} effektiven Stunden pro Tag (bei 1 FTE) abgeschätzt.`,
    },
    {
      label: 'Review/QA Overhead',
      rationale: `Auf alle Deliverables wird ein Overhead von ${(
        cfg.reviewQaOverheadPct * 100
      ).toFixed(0)}% für Review/QA/Finalisierung aufgeschlagen.`,
    },
  ];

  const perDeliverable: DeliverableEffort[] = deliverables.map(d => {
    const base = cfg.baseHoursByCategory[d.category] ?? 8;
    const pageFactor = computePageFactor(d.pageLimit, cfg);
    const mandFactor = computeMultiplier(d.mandatory, cfg);
    const beforeOverhead = base * pageFactor * mandFactor;
    const withOverhead = beforeOverhead * (1 + cfg.reviewQaOverheadPct);

    const effortHours = round1(withOverhead);
    const effortPT = round1(effortHours / cfg.ptHours);
    const calendarDays = Math.max(1, Math.ceil(effortHours / cfg.effectiveWritingHoursPerDay));

    const localAssumptions: EstimatorAssumption[] = [
      {
        label: 'Base Hours',
        rationale: `Kategorie "${d.category}" wird mit ${base}h Baseline angesetzt.`,
      },
      {
        label: 'Seitenlimit-Faktor',
        rationale:
          d.pageLimit && d.pageLimit > 0
            ? `Seitenlimit ${d.pageLimit} ⇒ Faktor ${round2(pageFactor)} (clamp).`
            : `Kein Seitenlimit ⇒ Faktor ${cfg.pageLimitFactor.defaultWhenUnknown}.`,
      },
      {
        label: d.mandatory ? 'Mandatory' : 'Optional',
        rationale: d.mandatory
          ? `Pflichtdeliverable ⇒ Multiplikator ${cfg.mandatoryMultiplier}.`
          : `Optional ⇒ Multiplikator ${cfg.optionalMultiplier}.`,
      },
    ];

    const allocation = defaultWbsAllocation(d.category);
    const wbs = allocation.map(a => ({
      deliverableName: d.name,
      task: a.task,
      discipline: a.discipline,
      hours: round1(effortHours * a.pct),
    }));

    return {
      deliverableName: d.name,
      effortHours,
      effortPT,
      calendarDays,
      wbs,
      assumptions: [...globalAssumptions, ...localAssumptions],
    };
  });

  const totalsHours = round1(perDeliverable.reduce((sum, d) => sum + d.effortHours, 0));
  const totalsPT = round1(totalsHours / cfg.ptHours);
  const totalsCalendarDaysSequential = perDeliverable.reduce((sum, d) => sum + d.calendarDays, 0);

  const parallelizationHints: string[] = [];
  if (deliverables.length >= 2) {
    parallelizationHints.push(
      'Mehrere Deliverables lassen sich parallelisieren (z.B. Technical Proposal und Commercial parallel).'
    );
  }
  parallelizationHints.push(
    'Kalenderdauer ist eine 1-FTE-Baseline; mit 2 FTE reduziert sie sich näherungsweise (nicht linear wegen Reviews).'
  );

  return {
    perDeliverable,
    totals: {
      effortHours: totalsHours,
      effortPT: totalsPT,
      calendarDaysSequential: totalsCalendarDaysSequential,
    },
    assumptions: globalAssumptions,
    parallelizationHints,
  };
}
