/**
 * Field Projection Constants for Database Queries
 *
 * These constants define which fields should be selected from the database
 * for different use cases, helping to minimize data transfer to client components.
 *
 * Usage:
 * ```typescript
 * import { LEAD_PUBLIC_FIELDS } from '@/lib/db/projections';
 *
 * const [lead] = await db
 *   .select(LEAD_PUBLIC_FIELDS)
 *   .from(leads)
 *   .where(eq(leads.id, id));
 * ```
 */

import {
  leads,
  rfps,
  accounts,
  businessUnits,
  websiteAudits,
  cmsMatchResults,
  ptEstimations,
  referenceMatches,
} from './schema';

/**
 * Lead fields safe for public/client access
 * Excludes: internal metadata, timestamps used only for server-side logic
 */
export const LEAD_PUBLIC_FIELDS = {
  id: leads.id,
  customerName: leads.customerName,
  industry: leads.industry,
  budget: leads.budget,
  status: leads.status,
  blVote: leads.blVote,
  blConfidenceScore: leads.blConfidenceScore,
  blReasoning: leads.blReasoning,
  blVotedAt: leads.blVotedAt,
  createdAt: leads.createdAt,
  businessUnitId: leads.businessUnitId,
  rfpId: leads.rfpId,
} as const;

/**
 * Lead fields for internal/admin use
 * Includes all public fields plus internal metadata
 */
export const LEAD_INTERNAL_FIELDS = {
  ...LEAD_PUBLIC_FIELDS,
  updatedAt: leads.updatedAt,
} as const;

/**
 * RFP fields safe for public/client access
 */
export const RFP_PUBLIC_FIELDS = {
  id: rfps.id,
  status: rfps.status,
  stage: rfps.stage,
  source: rfps.source,
  inputType: rfps.inputType,
  decision: rfps.decision,
  accountId: rfps.accountId,
  assignedBusinessUnitId: rfps.assignedBusinessUnitId,
  createdAt: rfps.createdAt,
} as const;

/**
 * Account fields safe for public/client access
 */
export const ACCOUNT_PUBLIC_FIELDS = {
  id: accounts.id,
  name: accounts.name,
  industry: accounts.industry,
  website: accounts.website,
  notes: accounts.notes,
  createdAt: accounts.createdAt,
} as const;

/**
 * Business Unit fields safe for public/client access
 */
export const BUSINESS_UNIT_PUBLIC_FIELDS = {
  id: businessUnits.id,
  name: businessUnits.name,
  leaderName: businessUnits.leaderName,
  leaderEmail: businessUnits.leaderEmail,
} as const;

/**
 * Website Audit fields safe for public/client access
 */
export const WEBSITE_AUDIT_PUBLIC_FIELDS = {
  id: websiteAudits.id,
  leadId: websiteAudits.leadId,
  status: websiteAudits.status,
  performanceScore: websiteAudits.performanceScore,
  accessibilityScore: websiteAudits.accessibilityScore,
  cms: websiteAudits.cms,
  pageCount: websiteAudits.pageCount,
  migrationComplexity: websiteAudits.migrationComplexity,
} as const;

/**
 * PT Estimation fields safe for public/client access
 */
export const PT_ESTIMATION_PUBLIC_FIELDS = {
  id: ptEstimations.id,
  leadId: ptEstimations.leadId,
  totalPT: ptEstimations.totalPT,
  durationMonths: ptEstimations.durationMonths,
  confidenceLevel: ptEstimations.confidenceLevel,
  riskBuffer: ptEstimations.riskBuffer,
} as const;

/**
 * CMS Match Result fields safe for public/client access
 */
export const CMS_MATCH_PUBLIC_FIELDS = {
  id: cmsMatchResults.id,
  leadId: cmsMatchResults.leadId,
  technologyId: cmsMatchResults.technologyId,
  rank: cmsMatchResults.rank,
  totalScore: cmsMatchResults.totalScore,
  featureScore: cmsMatchResults.featureScore,
  industryScore: cmsMatchResults.industryScore,
  budgetScore: cmsMatchResults.budgetScore,
  sizeScore: cmsMatchResults.sizeScore,
  migrationScore: cmsMatchResults.migrationScore,
  reasoning: cmsMatchResults.reasoning,
} as const;

/**
 * Reference Match fields safe for public/client access
 */
export const REFERENCE_MATCH_PUBLIC_FIELDS = {
  id: referenceMatches.id,
  leadId: referenceMatches.leadId,
  referenceId: referenceMatches.referenceId,
  rank: referenceMatches.rank,
  totalScore: referenceMatches.totalScore,
  techStackScore: referenceMatches.techStackScore,
  industryScore: referenceMatches.industryScore,
} as const;
