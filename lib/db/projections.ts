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
 *   .where(eq(qualifications.id, id));
 * ```
 */

import {
  qualifications,
  preQualifications,
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
  id: qualifications.id,
  customerName: qualifications.customerName,
  industry: qualifications.industry,
  budget: qualifications.budget,
  websiteUrl: qualifications.websiteUrl,
  projectDescription: qualifications.projectDescription,
  status: qualifications.status,
  blVote: qualifications.blVote,
  blConfidenceScore: qualifications.blConfidenceScore,
  blReasoning: qualifications.blReasoning,
  blVotedAt: qualifications.blVotedAt,
  createdAt: qualifications.createdAt,
  businessUnitId: qualifications.businessUnitId,
  preQualificationId: qualifications.preQualificationId,
  quickScanId: qualifications.quickScanId,
  selectedCmsId: qualifications.selectedCmsId,
} as const;

/**
 * Lead fields for internal/admin use
 * Includes all public fields plus internal metadata
 */
export const LEAD_INTERNAL_FIELDS = {
  ...LEAD_PUBLIC_FIELDS,
  updatedAt: qualifications.updatedAt,
} as const;

/**
 * Pre-Qualification fields safe for public/client access
 */
export const Pre-Qualification_PUBLIC_FIELDS = {
  id: preQualifications.id,
  status: preQualifications.status,
  stage: preQualifications.stage,
  source: preQualifications.source,
  inputType: preQualifications.inputType,
  decision: preQualifications.decision,
  accountId: preQualifications.accountId,
  assignedBusinessUnitId: preQualifications.assignedBusinessUnitId,
  createdAt: preQualifications.createdAt,
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
  qualificationId: websiteAudits.qualificationId,
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
  qualificationId: ptEstimations.qualificationId,
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
  qualificationId: cmsMatchResults.qualificationId,
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
  qualificationId: referenceMatches.qualificationId,
  referenceId: referenceMatches.referenceId,
  rank: referenceMatches.rank,
  totalScore: referenceMatches.totalScore,
  techStackScore: referenceMatches.techStackScore,
  industryScore: referenceMatches.industryScore,
} as const;
