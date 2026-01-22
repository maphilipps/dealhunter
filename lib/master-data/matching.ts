'use server';

import { eq, and } from 'drizzle-orm';

import { db } from '@/lib/db';
import { references, competencies, competitors } from '@/lib/db/schema';

// ============================================================================
// Master Data Matching Functions
// For use in AI Agents during bid evaluation
// ============================================================================

export type ReferenceMatch = {
  id: string;
  projectName: string;
  customerName: string;
  industry: string;
  technologies: string[];
  scope: string;
  outcome: string;
  matchScore: number;
  matchReasons: string[];
};

export type CompetencyMatch = {
  id: string;
  name: string;
  category: string;
  level: string;
  description: string | null;
  matchScore: number;
  matchReasons: string[];
};

export type CompetitorMatch = {
  id: string;
  companyName: string;
  strengths: string[];
  weaknesses: string[];
  typicalMarkets: string[];
  matchScore: number;
  matchReasons: string[];
};

/**
 * Find matching references based on technologies and industry
 */
export async function findMatchingReferences(params: {
  technologies: string[];
  industry?: string;
  limit?: number;
}): Promise<ReferenceMatch[]> {
  const { technologies, industry, limit = 10 } = params;

  const conditions: any[] = [eq(references.isValidated, true)];

  if (industry) {
    conditions.push(eq(references.industry, industry));
  }

  const allReferences = await db
    .select()
    .from(references)
    .where(and(...conditions))
    .limit(limit * 3);

  const scored = allReferences.map(ref => {
    let score = 0;
    const reasons: string[] = [];

    const refTechs = ref.technologies ? JSON.parse(ref.technologies) : [];

    const techMatches = technologies.filter(t =>
      refTechs.some((rt: string) => rt.toLowerCase().includes(t.toLowerCase()))
    );

    if (techMatches.length > 0) {
      score += techMatches.length * 10;
      reasons.push(`Matching technologies: ${techMatches.join(', ')}`);
    }

    if (industry && ref.industry === industry) {
      score += 5;
      reasons.push(`Same industry: ${industry}`);
    }

    if (ref.outcome.toLowerCase().includes('success')) {
      score += 3;
      reasons.push('Successful project outcome');
    }

    return {
      id: ref.id,
      projectName: ref.projectName,
      customerName: ref.customerName,
      industry: ref.industry,
      technologies: refTechs,
      scope: ref.scope,
      outcome: ref.outcome,
      matchScore: score,
      matchReasons: reasons,
    };
  });

  return scored
    .filter(r => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Find matching competencies based on required skills and technologies
 */
export async function findMatchingCompetencies(params: {
  technologies: string[];
  skills?: string[];
  limit?: number;
}): Promise<CompetencyMatch[]> {
  const { technologies, skills = [], limit = 10 } = params;

  const allCompetencies = await db
    .select()
    .from(competencies)
    .where(eq(competencies.isValidated, true))
    .limit(limit * 3);

  const allSearchTerms = [...technologies, ...skills].map(s => s.toLowerCase());

  const scored = allCompetencies.map(comp => {
    let score = 0;
    const reasons: string[] = [];

    const compName = comp.name.toLowerCase();

    const nameMatches = allSearchTerms.filter(term => compName.includes(term));

    if (nameMatches.length > 0) {
      score += nameMatches.length * 8;
      reasons.push(`Matching skills: ${nameMatches.join(', ')}`);
    }

    if (comp.category === 'technology') {
      score += 2;
    }

    if (comp.level === 'expert') {
      score += 3;
      reasons.push('Expert level');
    } else if (comp.level === 'advanced') {
      score += 1;
    }

    return {
      id: comp.id,
      name: comp.name,
      category: comp.category,
      level: comp.level,
      description: comp.description,
      matchScore: score,
      matchReasons: reasons,
    };
  });

  return scored
    .filter(c => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Find matching competitors based on company names and industry
 */
export async function findMatchingCompetitors(params: {
  competitorNames: string[];
  industry?: string;
  limit?: number;
}): Promise<CompetitorMatch[]> {
  const { competitorNames, industry, limit = 5 } = params;

  const allCompetitors = await db
    .select()
    .from(competitors)
    .where(eq(competitors.isValidated, true))
    .limit(limit * 2);

  const scored = allCompetitors.map(comp => {
    let score = 0;
    const reasons: string[] = [];

    const compName = comp.companyName.toLowerCase();

    const nameMatch = competitorNames.some(
      cn => compName.includes(cn.toLowerCase()) || cn.toLowerCase().includes(compName)
    );

    if (nameMatch) {
      score += 20;
      reasons.push('Mentioned competitor');
    }

    if (industry && comp.industry) {
      const industries = JSON.parse(comp.industry);
      if (industries.includes(industry)) {
        score += 5;
        reasons.push(`Active in ${industry}`);
      }
    }

    if (comp.strengths || comp.weaknesses) {
      score += 2;
      reasons.push('Intelligence data available');
    }

    return {
      id: comp.id,
      companyName: comp.companyName,
      strengths: comp.strengths ? JSON.parse(comp.strengths) : [],
      weaknesses: comp.weaknesses ? JSON.parse(comp.weaknesses) : [],
      typicalMarkets: comp.typicalMarkets ? JSON.parse(comp.typicalMarkets) : [],
      matchScore: score,
      matchReasons: reasons,
    };
  });

  return scored
    .filter(c => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Comprehensive matching function that returns all three types
 */
export async function matchMasterData(params: {
  technologies: string[];
  industry?: string;
  skills?: string[];
  competitorNames?: string[];
  maxReferences?: number;
  maxCompetencies?: number;
  maxCompetitors?: number;
}) {
  const {
    technologies,
    industry,
    skills = [],
    competitorNames = [],
    maxReferences = 10,
    maxCompetencies = 10,
    maxCompetitors = 5,
  } = params;

  const [references, competencies, competitors] = await Promise.all([
    findMatchingReferences({ technologies, industry, limit: maxReferences }),
    findMatchingCompetencies({ technologies, skills, limit: maxCompetencies }),
    findMatchingCompetitors({ competitorNames, industry, limit: maxCompetitors }),
  ]);

  return {
    references,
    competencies,
    competitors,
  };
}
