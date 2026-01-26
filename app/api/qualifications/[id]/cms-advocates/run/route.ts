/**
 * CMS Advocates Run API
 *
 * POST /api/qualifications/[id]/cms-advocates/run
 *
 * Triggers the CMS Advocate orchestrator to analyze and compare CMS options
 * for the given lead's requirements.
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { runCMSAdvocateOrchestrator } from '@/lib/agents/cms-advocates';
import { db } from '@/lib/db';
import { qualifications } from '@/lib/db/schema';
import { queryRagForLead, type LeadRAGResult } from '@/lib/rag/lead-retrieval-service';

export const maxDuration = 120; // 2 minutes for parallel advocate analysis

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;

  try {
    // 1. Get lead (lead has rfpId reference)
    const lead = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, leadId))
      .limit(1);

    if (!lead.length) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const leadData = lead[0];

    if (!leadData.preQualificationId) {
      return NextResponse.json({ error: 'No Pre-Qualification associated with lead' }, { status: 400 });
    }

    // 2. Extract requirements from RAG
    const requirementsData = await queryRagForLead({
      qualificationId: leadId,
      question: 'project requirements features functionality technical requirements',
    });

    // Parse requirements from RAG data
    const requirements = extractRequirementsFromRAG(requirementsData);

    // 3. Build customer profile from lead data
    const customerProfile = {
      industry: leadData.industry || 'Technology',
      companySize: inferCompanySize(leadData),
      techMaturity: inferTechMaturity(requirementsData),
      budget: inferBudget(leadData),
    };

    // 4. Run orchestrator
    const result = await runCMSAdvocateOrchestrator({
      leadId,
      preQualificationId: leadData.preQualificationId,
      requirements,
      customerProfile,
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendedCMS: result.comparison.summary.recommendedCMS,
        recommendationStrength: result.comparison.summary.recommendationStrength,
        alternativeCMS: result.comparison.summary.alternativeCMS,
        cmsCount: result.metadata.cmsCount,
        requirementCount: result.metadata.requirementCount,
        processingTimeMs: result.metadata.processingTimeMs,
      },
    });
  } catch (error) {
    console.error('[CMS Advocates API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function extractRequirementsFromRAG(ragData: LeadRAGResult[]): Array<{
  requirement: string;
  category:
    | 'functional'
    | 'technical'
    | 'integration'
    | 'compliance'
    | 'performance'
    | 'scalability'
    | 'security'
    | 'ux'
    | 'maintenance'
    | 'other';
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  source: 'extracted' | 'detected' | 'inferred' | 'researched';
}> {
  const requirements: Array<{
    requirement: string;
    category:
      | 'functional'
      | 'technical'
      | 'integration'
      | 'compliance'
      | 'performance'
      | 'scalability'
      | 'security'
      | 'ux'
      | 'maintenance'
      | 'other';
    priority: 'must-have' | 'should-have' | 'nice-to-have';
    source: 'extracted' | 'detected' | 'inferred' | 'researched';
  }> = [];

  // Combine all RAG content
  const content = ragData
    .map(r => r.content)
    .join(' ')
    .toLowerCase();

  // Functional requirements
  if (content.includes('e-commerce') || content.includes('shop') || content.includes('webshop')) {
    requirements.push({
      requirement: 'E-Commerce Funktionalität',
      category: 'functional',
      priority: 'must-have',
      source: 'detected',
    });
  }
  if (
    content.includes('mehrsprach') ||
    content.includes('multilingual') ||
    content.includes('i18n')
  ) {
    requirements.push({
      requirement: 'Mehrsprachigkeit',
      category: 'functional',
      priority: 'must-have',
      source: 'detected',
    });
  }
  if (
    content.includes('suche') ||
    content.includes('search') ||
    content.includes('volltextsuche')
  ) {
    requirements.push({
      requirement: 'Suchfunktion',
      category: 'functional',
      priority: 'should-have',
      source: 'detected',
    });
  }
  if (content.includes('blog') || content.includes('news') || content.includes('artikel')) {
    requirements.push({
      requirement: 'Blog/News Bereich',
      category: 'functional',
      priority: 'should-have',
      source: 'detected',
    });
  }
  if (content.includes('formular') || content.includes('form') || content.includes('kontakt')) {
    requirements.push({
      requirement: 'Formulare',
      category: 'functional',
      priority: 'should-have',
      source: 'detected',
    });
  }

  // Technical requirements
  if (content.includes('api') || content.includes('rest') || content.includes('json')) {
    requirements.push({
      requirement: 'API-Schnittstelle',
      category: 'technical',
      priority: 'should-have',
      source: 'detected',
    });
  }
  if (content.includes('headless') || content.includes('decoupled')) {
    requirements.push({
      requirement: 'Headless/Decoupled Architektur',
      category: 'technical',
      priority: 'should-have',
      source: 'detected',
    });
  }
  if (content.includes('graphql')) {
    requirements.push({
      requirement: 'GraphQL API',
      category: 'technical',
      priority: 'nice-to-have',
      source: 'detected',
    });
  }

  // Compliance
  if (content.includes('dsgvo') || content.includes('gdpr') || content.includes('datenschutz')) {
    requirements.push({
      requirement: 'DSGVO-Konformität',
      category: 'compliance',
      priority: 'must-have',
      source: 'inferred',
    });
  }
  if (
    content.includes('wcag') ||
    content.includes('barrierefrei') ||
    content.includes('accessibility')
  ) {
    requirements.push({
      requirement: 'WCAG Barrierefreiheit',
      category: 'compliance',
      priority: 'should-have',
      source: 'detected',
    });
  }

  // Performance
  if (
    content.includes('performance') ||
    content.includes('schnell') ||
    content.includes('ladezeit')
  ) {
    requirements.push({
      requirement: 'High Performance',
      category: 'performance',
      priority: 'should-have',
      source: 'detected',
    });
  }

  // Scalability
  if (
    content.includes('enterprise') ||
    content.includes('skalier') ||
    content.includes('hochverfügbar')
  ) {
    requirements.push({
      requirement: 'Enterprise-Skalierbarkeit',
      category: 'scalability',
      priority: 'should-have',
      source: 'detected',
    });
  }

  // Default requirements if none found
  if (requirements.length === 0) {
    requirements.push(
      {
        requirement: 'Content Management',
        category: 'functional',
        priority: 'must-have',
        source: 'inferred',
      },
      {
        requirement: 'Benutzerfreundlicher Editor',
        category: 'ux',
        priority: 'should-have',
        source: 'inferred',
      },
      {
        requirement: 'DSGVO-Konformität',
        category: 'compliance',
        priority: 'must-have',
        source: 'inferred',
      }
    );
  }

  return requirements;
}

function inferCompanySize(
  lead: typeof qualifications.$inferSelect
): 'small' | 'medium' | 'large' | 'enterprise' {
  // Try to infer from customer name
  const customerName = (lead.customerName || '').toLowerCase();

  if (
    customerName.includes('ag') ||
    customerName.includes('se') ||
    customerName.includes('group')
  ) {
    return 'enterprise';
  }
  if (customerName.includes('gmbh')) {
    return 'medium';
  }

  return 'medium'; // Default
}

function inferTechMaturity(ragData: LeadRAGResult[]): 'low' | 'medium' | 'high' {
  const content = ragData
    .map(r => r.content)
    .join(' ')
    .toLowerCase();

  if (content.includes('legacy') || content.includes('veraltet') || content.includes('migration')) {
    return 'low';
  }
  if (content.includes('modern') || content.includes('cloud') || content.includes('api-first')) {
    return 'high';
  }

  return 'medium';
}

function inferBudget(lead: typeof qualifications.$inferSelect): 'low' | 'medium' | 'high' {
  // Try to infer from lead budget field
  const budgetStr = lead.budget || '';

  // Parse budget string (e.g., "250k CHF", "500000", "1.5M EUR")
  const numMatch = budgetStr.match(/[\d,.]+/);
  if (numMatch) {
    let budget = parseFloat(numMatch[0].replace(/,/g, ''));

    // Handle K/M suffixes
    if (budgetStr.toLowerCase().includes('k')) {
      budget *= 1000;
    } else if (budgetStr.toLowerCase().includes('m')) {
      budget *= 1000000;
    }

    if (budget < 50000) return 'low';
    if (budget < 200000) return 'medium';
    return 'high';
  }

  return 'medium'; // Default
}
