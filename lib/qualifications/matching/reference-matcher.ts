/**
 * Deterministic Reference Matcher
 *
 * Matches internal references to RFP reference requirements without using an LLM.
 * The LLM may be used upstream to EXTRACT requirement constraints, but scoring must be stable.
 */

export type ReferenceRequirementConstraints = {
  requiredIndustries?: string[]; // normalized match targets (e.g. "öffentlicher sektor")
  requiredTechnologies?: string[]; // normalized match targets (e.g. "react", "aem", "sap")
  teamSizeMin?: number | null;
  teamSizeMax?: number | null;
  durationMonthsMin?: number | null;
  durationMonthsMax?: number | null;
};

export type InternalReferenceForMatching = {
  id: string;
  projectName: string;
  customerName: string;
  industry: string;
  technologies: string; // JSON array string
  teamSize: number;
  durationMonths: number;
};

export type ReferenceMatch = {
  referenceId: string;
  projectName: string;
  customerName: string;
  score: number; // 0..1
  scoreBreakdown: {
    tech: number;
    industry: number;
    size: number;
  };
  fits: string[];
  gaps: string[];
  howToPositionIt: string[];
};

export function normalizeToken(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toSet(items: string[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const item of items ?? []) {
    const n = normalizeToken(item);
    if (!n) continue;
    out.add(n);
  }
  return out;
}

export function parseTechnologiesJson(technologiesJson: string): string[] {
  try {
    const parsed = JSON.parse(technologiesJson) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore
  }
  return [];
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  if (union === 0) return 0;
  return inter / union;
}

function industryScore(
  reqIndustries: Set<string>,
  refIndustry: string
): { score: number; note?: string } {
  if (reqIndustries.size === 0) {
    return { score: 0.5, note: 'Branchenanforderung unklar/nicht genannt' };
  }

  const ref = normalizeToken(refIndustry);
  if (!ref) return { score: 0, note: 'Referenz-Branche fehlt' };

  for (const target of reqIndustries) {
    if (ref === target) return { score: 1 };
    if (ref.includes(target) || target.includes(ref)) return { score: 0.7 };
  }

  return { score: 0 };
}

function inRange(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined
): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function sizeScore(
  req: ReferenceRequirementConstraints,
  ref: Pick<InternalReferenceForMatching, 'teamSize' | 'durationMonths'>
): { score: number; notes: string[] } {
  const notes: string[] = [];

  const hasTeam = req.teamSizeMin != null || req.teamSizeMax != null;
  const hasDuration = req.durationMonthsMin != null || req.durationMonthsMax != null;

  if (!hasTeam && !hasDuration) {
    return { score: 0.5, notes: ['Größen-/Zeitraum-Anforderungen unklar/nicht genannt'] };
  }

  const subscores: number[] = [];

  if (hasTeam) {
    const ok = inRange(ref.teamSize, req.teamSizeMin, req.teamSizeMax);
    subscores.push(ok ? 1 : 0.3);
    if (!ok) {
      notes.push(
        `Teamgröße außerhalb Anforderung (Ref: ${ref.teamSize}, Req: ${req.teamSizeMin ?? '—'}-${req.teamSizeMax ?? '—'})`
      );
    }
  }

  if (hasDuration) {
    const ok = inRange(ref.durationMonths, req.durationMonthsMin, req.durationMonthsMax);
    subscores.push(ok ? 1 : 0.3);
    if (!ok) {
      notes.push(
        `Dauer außerhalb Anforderung (Ref: ${ref.durationMonths} Monate, Req: ${req.durationMonthsMin ?? '—'}-${req.durationMonthsMax ?? '—'})`
      );
    }
  }

  const score = subscores.reduce((a, b) => a + b, 0) / subscores.length;
  return { score, notes };
}

export function scoreReference(
  req: ReferenceRequirementConstraints,
  ref: InternalReferenceForMatching
): ReferenceMatch {
  const reqTech = toSet(req.requiredTechnologies);
  const reqIndustries = toSet(req.requiredIndustries);

  const refTech = toSet(parseTechnologiesJson(ref.technologies));
  const tech = reqTech.size === 0 ? 0.5 : jaccardSimilarity(reqTech, refTech);

  const ind = industryScore(reqIndustries, ref.industry);

  const size = sizeScore(req, { teamSize: ref.teamSize, durationMonths: ref.durationMonths });

  // Fixed weights (per spec).
  const score = 0.5 * tech + 0.3 * ind.score + 0.2 * size.score;

  const overlaps = reqTech.size > 0 ? [...reqTech].filter(t => refTech.has(t)).slice(0, 6) : [];

  const fits: string[] = [];
  const gaps: string[] = [];
  const howToPositionIt: string[] = [];

  if (overlaps.length > 0) {
    fits.push(`Technologie-Overlap: ${overlaps.join(', ')}`);
  } else if (reqTech.size > 0) {
    gaps.push('Kein klarer Technologie-Overlap zu den RFP-Anforderungen gefunden');
  } else {
    gaps.push('Technologie-Anforderungen im RFP unklar/nicht genannt');
  }

  if (ind.score >= 0.7) {
    fits.push(`Branche passt: ${ref.industry}`);
  } else if (ind.note) {
    gaps.push(ind.note);
  } else {
    gaps.push(`Branche passt nicht (Ref: ${ref.industry})`);
  }

  for (const n of size.notes) gaps.push(n);

  // Positioning hints (deterministic heuristics).
  if (fits.length > 0) {
    howToPositionIt.push('In der Referenz-Zusammenfassung zuerst die 2-3 stärksten Fits nennen.');
  }
  if (overlaps.length > 0) {
    howToPositionIt.push('Technologie-Stack als kurzer Bullet-Block (max 6) aufnehmen.');
  }
  howToPositionIt.push(
    'Ergebnis/Outcome messbar formulieren (KPIs, Zeitersparnis, Nutzer, Verfügbarkeit).'
  );

  return {
    referenceId: ref.id,
    projectName: ref.projectName,
    customerName: ref.customerName,
    score: Math.round(score * 1000) / 1000,
    scoreBreakdown: {
      tech: Math.round(tech * 1000) / 1000,
      industry: Math.round(ind.score * 1000) / 1000,
      size: Math.round(size.score * 1000) / 1000,
    },
    fits,
    gaps: gaps.slice(0, 8),
    howToPositionIt: howToPositionIt.slice(0, 6),
  };
}

export function matchTopReferences(options: {
  requirements: ReferenceRequirementConstraints;
  references: InternalReferenceForMatching[];
  topN?: number;
}): ReferenceMatch[] {
  const { requirements, references, topN = 5 } = options;

  const scored = references.map(r => scoreReference(requirements, r));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}
