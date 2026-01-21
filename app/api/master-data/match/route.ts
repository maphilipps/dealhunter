import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references, competencies, competitors } from '@/lib/db/schema';
import { eq, and, like, sql } from 'drizzle-orm';
import { z } from 'zod';

// ============================================================================
// Auto-Matching API for Bid Evaluation
// ============================================================================

const matchRequestSchema = z.object({
  // Matching criteria
  technologies: z.array(z.string()).optional(),
  industry: z.string().optional(),
  skills: z.array(z.string()).optional(),
  competitorNames: z.array(z.string()).optional(),

  // Result limits
  maxReferences: z.number().int().min(1).max(50).default(10),
  maxCompetencies: z.number().int().min(1).max(50).default(10),
  maxCompetitors: z.number().int().min(1).max(20).default(5),
});

export type MatchResult = {
  references: Array<{
    id: string;
    projectName: string;
    customerName: string;
    industry: string;
    technologies: string[];
    scope: string;
    outcome: string;
    matchScore: number;
    matchReasons: string[];
  }>;
  competencies: Array<{
    id: string;
    name: string;
    category: string;
    level: string;
    description: string | null;
    matchScore: number;
    matchReasons: string[];
  }>;
  competitors: Array<{
    id: string;
    companyName: string;
    strengths: string[];
    weaknesses: string[];
    typicalMarkets: string[];
    matchScore: number;
    matchReasons: string[];
  }>;
};

/**
 * POST /api/master-data/match
 *
 * Auto-matches references, competencies, and competitors based on RFP criteria.
 * Used during bid evaluation to surface relevant master data.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = matchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const {
      technologies = [],
      industry,
      skills = [],
      competitorNames = [],
      maxReferences,
      maxCompetencies,
      maxCompetitors,
    } = parsed.data;

    // ===== MATCH REFERENCES =====

    const referenceMatches = await matchReferences({
      technologies,
      industry,
      limit: maxReferences,
    });

    // ===== MATCH COMPETENCIES =====

    const competencyMatches = await matchCompetencies({
      technologies,
      skills,
      limit: maxCompetencies,
    });

    // ===== MATCH COMPETITORS =====

    const competitorMatches = await matchCompetitors({
      competitorNames,
      industry,
      limit: maxCompetitors,
    });

    const result: MatchResult = {
      references: referenceMatches,
      competencies: competencyMatches,
      competitors: competitorMatches,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/master-data/match error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// Matching Logic
// ============================================================================

async function matchReferences(params: {
  technologies: string[];
  industry?: string;
  limit: number;
}) {
  const { technologies, industry, limit } = params;

  // Build WHERE clause
  const conditions: any[] = [eq(references.isValidated, true)];

  if (industry) {
    conditions.push(eq(references.industry, industry));
  }

  let allReferences = await db
    .select()
    .from(references)
    .where(and(...conditions))
    .limit(limit * 3); // Get more candidates for scoring

  // Score and rank
  const scored = allReferences.map(ref => {
    let score = 0;
    const reasons: string[] = [];

    // Parse technologies JSON
    const refTechs = ref.technologies ? JSON.parse(ref.technologies) : [];

    // Technology matches (weighted heavily)
    const techMatches = technologies.filter(t =>
      refTechs.some((rt: string) => rt.toLowerCase().includes(t.toLowerCase()))
    );

    if (techMatches.length > 0) {
      score += techMatches.length * 10;
      reasons.push(`Matching technologies: ${techMatches.join(', ')}`);
    }

    // Industry match
    if (industry && ref.industry === industry) {
      score += 5;
      reasons.push(`Same industry: ${industry}`);
    }

    // Successful outcome boost
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

  // Sort by score and return top N
  return scored
    .filter(r => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

async function matchCompetencies(params: {
  technologies: string[];
  skills: string[];
  limit: number;
}) {
  const { technologies, skills, limit } = params;

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

    // Direct name matches
    const nameMatches = allSearchTerms.filter(term => compName.includes(term));

    if (nameMatches.length > 0) {
      score += nameMatches.length * 8;
      reasons.push(`Matching skills: ${nameMatches.join(', ')}`);
    }

    // Category boost for technology
    if (comp.category === 'technology') {
      score += 2;
    }

    // Level boost
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

async function matchCompetitors(params: {
  competitorNames: string[];
  industry?: string;
  limit: number;
}) {
  const { competitorNames, industry, limit } = params;

  const allCompetitors = await db
    .select()
    .from(competitors)
    .where(eq(competitors.isValidated, true))
    .limit(limit * 2);

  const scored = allCompetitors.map(comp => {
    let score = 0;
    const reasons: string[] = [];

    const compName = comp.companyName.toLowerCase();

    // Direct name match
    const nameMatch = competitorNames.some(
      cn => compName.includes(cn.toLowerCase()) || cn.toLowerCase().includes(compName)
    );

    if (nameMatch) {
      score += 20;
      reasons.push('Mentioned competitor');
    }

    // Industry match
    if (industry && comp.industry) {
      const industries = JSON.parse(comp.industry);
      if (industries.includes(industry)) {
        score += 5;
        reasons.push(`Active in ${industry}`);
      }
    }

    // Has intelligence data
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
