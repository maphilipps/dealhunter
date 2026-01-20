import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['bd', 'bl', 'admin'] })
    .notNull()
    .default('bd'),
  businessUnitId: text('business_unit_id').references(() => businessUnits.id),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

export const rfps = sqliteTable('rfps', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Input
  source: text('source', { enum: ['reactive', 'proactive'] }).notNull(),
  stage: text('stage', { enum: ['cold', 'warm', 'rfp'] }).notNull(),
  inputType: text('input_type', { enum: ['pdf', 'crm', 'freetext', 'email', 'combined'] }).notNull(),
  rawInput: text('raw_input').notNull(),
  metadata: text('metadata'), // JSON - für Email headers (from, subject, date)
  extractedRequirements: text('extracted_requirements'), // JSON

  // Status (WORKFLOW.md compliant)
  status: text('status', {
    enum: [
      'draft',            // Initial state after upload
      'extracting',       // AI is extracting requirements
      'reviewing',        // User is reviewing extracted data
      'quick_scanning',   // AI is doing quick scan
      'bit_pending',      // Quick Scan done, waiting for manual BIT/NO BIT decision
      'evaluating',       // AI is doing full decision evaluation (after manual trigger)
      'decision_made',    // Decision made (Bid/No-Bid)
      'archived',         // NO BID - Archiviert
      'routed',           // Routed to BL
      'full_scanning',    // Deep Analysis läuft
      'bl_reviewing',     // BL prüft Ergebnisse
      'team_assigned',    // Team assigned
      'notified',         // Team wurde benachrichtigt
      'handed_off',       // Workflow abgeschlossen
      'analysis_complete' // Deep migration analysis complete (legacy)
    ]
  })
    .notNull()
    .default('draft'),

  // Decision (Bid/No-Bid)
  decision: text('decision', { enum: ['bid', 'no_bid', 'pending'] })
    .notNull()
    .default('pending'),
  decisionData: text('decision_data'), // JSON
  alternativeRecommendation: text('alternative_recommendation'),

  // Account Link
  accountId: text('account_id').references(() => accounts.id),

  // Routing
  assignedBusinessUnitId: text('assigned_business_unit_id'),
  assignedBLNotifiedAt: integer('assigned_bl_notified_at', { mode: 'timestamp' }),

  // Extended Evaluation
  extendedEvaluation: text('extended_evaluation'), // JSON

  // Team
  assignedTeam: text('assigned_team'), // JSON
  teamNotifiedAt: integer('team_notified_at', { mode: 'timestamp' }),

  // Baseline Comparison (Phase 6)
  baselineComparisonResult: text('baseline_comparison_result'), // JSON - kategorisierte Baseline-Items
  baselineComparisonCompletedAt: integer('baseline_comparison_completed_at', { mode: 'timestamp' }),

  // Project Planning (Phase 7)
  projectPlanningResult: text('project_planning_result'), // JSON - Timeline + Disziplinen-Matrix
  projectPlanningCompletedAt: integer('project_planning_completed_at', { mode: 'timestamp' }),

  // Team Notifications (Phase 9)
  teamNotifications: text('team_notifications'), // JSON Array - Versandstatus pro Team-Mitglied

  // Website URL (for analysis)
  websiteUrl: text('website_url'),

  // Duplicate Check
  duplicateCheckResult: text('duplicate_check_result'), // JSON - result of duplicate detection
  descriptionEmbedding: text('description_embedding'), // JSON array - text-embedding-3-large (3072 dimensions)

  // Analysis Results (TODO: move to separate tables)
  quickScanResults: text('quick_scan_results'), // JSON
  decisionEvaluation: text('decision_evaluation'), // JSON

  // Company Analysis Links
  quickScanId: text('quick_scan_id'),
  deepMigrationAnalysisId: text('deep_migration_analysis_id'),

  // Optimistic Locking
  version: integer('version').notNull().default(1),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  // CRITICAL: Performance Indexes (TODO-029 Fix)
  assignedBusinessUnitIdx: index("rfps_assigned_bu_idx")
    .on(table.assignedBusinessUnitId),
  statusIdx: index("rfps_status_idx")
    .on(table.status),
  userIdIdx: index("rfps_user_id_idx")
    .on(table.userId),
}));

export const references = sqliteTable('references', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  validatedByUserId: text('validated_by_user_id').references(() => users.id),

  // Project Details
  projectName: text('project_name').notNull(),
  customerName: text('customer_name').notNull(),
  industry: text('industry').notNull(),

  // Technical Details
  technologies: text('technologies').notNull(), // JSON array
  scope: text('scope').notNull(),
  teamSize: integer('team_size').notNull(),
  durationMonths: integer('duration_months').notNull(),

  // Business Details
  budgetRange: text('budget_range').notNull(),
  outcome: text('outcome').notNull(),

  // Highlights
  highlights: text('highlights'), // JSON array

  // Validation Workflow (UPDATED for Epic 11)
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'needs_revision']
  })
    .notNull()
    .default('pending'),
  adminFeedback: text('admin_feedback'), // Rejection reason
  isValidated: integer('is_validated', { mode: 'boolean' })
    .notNull()
    .default(false),
  validatedAt: integer('validated_at', { mode: 'timestamp' }),

  // Audit (Optimistic Locking - NEW for Epic 11)
  version: integer('version').notNull().default(1),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  // CRITICAL: Performance Indexes (PERF-001 Fix)
  projectNameIdx: index("references_project_name_idx").on(table.projectName),
  statusIdx: index("references_status_idx").on(table.status),
  validatedIdx: index("references_validated_idx").on(table.isValidated),
  statusValidatedIdx: index("references_status_validated_idx").on(table.status, table.isValidated),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Rfp = typeof rfps.$inferSelect;
export type NewRfp = typeof rfps.$inferInsert;
// Backwards compatibility aliases
export type RfpOpportunity = Rfp;
export type NewRfpOpportunity = NewRfp;
export type BidOpportunity = Rfp;
export type NewBidOpportunity = NewRfp;
export type Reference = typeof references.$inferSelect;
export type NewReference = typeof references.$inferInsert;

export const competencies = sqliteTable('competencies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  validatedByUserId: text('validated_by_user_id').references(() => users.id),

  // Competency Details
  name: text('name').notNull(),
  category: text('category', { enum: ['technology', 'methodology', 'industry', 'soft_skill'] }).notNull(),
  level: text('level', { enum: ['basic', 'advanced', 'expert'] }).notNull(),

  // Additional Info
  certifications: text('certifications'), // JSON array
  description: text('description'),

  // Validation Workflow (NEW for Epic 11)
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'needs_revision']
  })
    .notNull()
    .default('pending'),
  adminFeedback: text('admin_feedback'),
  isValidated: integer('is_validated', { mode: 'boolean' })
    .notNull()
    .default(false),
  validatedAt: integer('validated_at', { mode: 'timestamp' }),

  // Audit (Optimistic Locking - NEW for Epic 11)
  version: integer('version').notNull().default(1),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  // CRITICAL: Performance Indexes (PERF-001 Fix)
  nameIdx: index("competencies_name_idx").on(table.name),
  statusIdx: index("competencies_status_idx").on(table.status),
  validatedIdx: index("competencies_validated_idx").on(table.isValidated),
  statusValidatedIdx: index("competencies_status_validated_idx").on(table.status, table.isValidated),
}));

export type Competency = typeof competencies.$inferSelect;
export type NewCompetency = typeof competencies.$inferInsert;

export const businessUnits = sqliteTable('business_units', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Business Unit Details
  name: text('name').notNull(),

  // Leader
  leaderName: text('leader_name').notNull(),
  leaderEmail: text('leader_email').notNull(),

  // NLP Matching
  keywords: text('keywords').notNull(), // JSON array of strings

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

export type BusinessUnit = typeof businessUnits.$inferSelect;
export type NewBusinessUnit = typeof businessUnits.$inferInsert;

export const technologies = sqliteTable('technologies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Technology Details
  name: text('name').notNull(),

  // Business Unit Reference
  businessUnitId: text('business_unit_id')
    .notNull()
    .references(() => businessUnits.id),

  // Baseline Information (optional - not all technologies need baseline data)
  baselineHours: integer('baseline_hours'),
  baselineName: text('baseline_name'),
  baselineEntityCounts: text('baseline_entity_counts'), // JSON

  // Default Flag
  isDefault: integer('is_default', { mode: 'boolean' })
    .notNull()
    .default(false),

  // === Extended Metadata ===

  // Basis-Informationen
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  description: text('description'),
  category: text('category'), // CMS, Framework, Library, etc.

  // Technische Details
  license: text('license'), // MIT, GPL, Proprietary, etc.
  latestVersion: text('latest_version'),
  githubUrl: text('github_url'),
  githubStars: integer('github_stars'),
  lastRelease: text('last_release'),
  communitySize: text('community_size'), // small, medium, large

  // Vor-/Nachteile (JSON Arrays)
  pros: text('pros'), // JSON array
  cons: text('cons'), // JSON array

  // Marketing/Verkauf
  usps: text('usps'), // Unique Selling Points (JSON array)
  targetAudiences: text('target_audiences'), // Zielgruppen (JSON array)
  useCases: text('use_cases'), // Typische Use Cases (JSON array)

  // Feature Support (auto-researched via CMS Evaluation)
  features: text('features'), // JSON object: { featureName: { supported: boolean, score: number, notes: string, researchedAt: string } }

  // adesso-spezifisch
  adessoExpertise: text('adesso_expertise'),
  adessoReferenceCount: integer('adesso_reference_count'),

  // Research Metadata
  lastResearchedAt: integer('last_researched_at', { mode: 'timestamp' }),
  researchStatus: text('research_status'), // pending, completed, failed

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

export type Technology = typeof technologies.$inferSelect;
export type NewTechnology = typeof technologies.$inferInsert;

export const employees = sqliteTable('employees', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Employee Details
  name: text('name').notNull(),
  email: text('email').notNull().unique(),

  // Business Unit
  businessUnitId: text('business_unit_id')
    .notNull()
    .references(() => businessUnits.id),

  // Skills & Roles
  skills: text('skills').notNull(), // JSON array
  roles: text('roles').notNull(), // JSON array of enum values
  availabilityStatus: text('availability_status', { enum: ['available', 'on_project', 'unavailable'] })
    .notNull()
    .default('available'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  // CRITICAL: Performance Indexes (TODO-029 Fix)
  businessUnitIdx: index("employees_business_unit_idx")
    .on(table.businessUnitId),
}));

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export const auditTrails = sqliteTable('audit_trails', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Audit Details
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  action: text('action', {
    enum: [
      'bl_override',
      'bid_override',
      'team_change',
      'status_change',
      'create',
      'update',
      'delete',
      'validate',
      'reject'
    ]
  }).notNull(),
  entityType: text('entity_type', {
    enum: ['rfp', 'business_unit', 'employee', 'reference', 'competency', 'competitor', 'team_assignment']
  }).notNull(),
  entityId: text('entity_id').notNull(),

  // Override Details (DEA-25)
  previousValue: text('previous_value'), // JSON or text
  newValue: text('new_value'), // JSON or text
  reason: text('reason'), // Required for manual overrides

  // Legacy field (for backwards compatibility)
  changes: text('changes'), // JSON - deprecated, use previousValue/newValue

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  userIdx: index('audit_trails_user_idx').on(table.userId),
  actionIdx: index('audit_trails_action_idx').on(table.action),
  entityTypeIdx: index('audit_trails_entity_type_idx').on(table.entityType),
  entityIdIdx: index('audit_trails_entity_id_idx').on(table.entityId),
  createdAtIdx: index('audit_trails_created_at_idx').on(table.createdAt),
}));

export type AuditTrail = typeof auditTrails.$inferSelect;
export type NewAuditTrail = typeof auditTrails.$inferInsert;

export const accounts = sqliteTable('accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Account Details
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  website: text('website'),
  notes: text('notes'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export const quickScans = sqliteTable('quick_scans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  rfpId: text('rfp_id')
    .notNull()
    .references(() => rfps.id),

  // Target Website
  websiteUrl: text('website_url').notNull(),

  // Scan Status
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] })
    .notNull()
    .default('pending'),

  // Detection Results
  techStack: text('tech_stack'), // JSON - detected technologies
  cms: text('cms'), // Detected CMS (WordPress, Drupal, etc.)
  framework: text('framework'), // Detected framework (React, Vue, etc.)
  hosting: text('hosting'), // Detected hosting (AWS, Azure, etc.)

  // Content Analysis
  pageCount: integer('page_count'),
  contentVolume: text('content_volume'), // JSON - content analysis
  features: text('features'), // JSON - detected features
  integrations: text('integrations'), // JSON - detected integrations

  // Enhanced Audits (NEW)
  navigationStructure: text('navigation_structure'), // JSON - navigation analysis
  accessibilityAudit: text('accessibility_audit'), // JSON - a11y audit results
  seoAudit: text('seo_audit'), // JSON - SEO audit results
  legalCompliance: text('legal_compliance'), // JSON - legal/GDPR check
  performanceIndicators: text('performance_indicators'), // JSON - performance metrics
  screenshots: text('screenshots'), // JSON - screenshot paths
  companyIntelligence: text('company_intelligence'), // JSON - company research data

  // QuickScan 2.0 Fields
  siteTree: text('site_tree'), // JSON - hierarchical sitemap structure
  contentTypes: text('content_types'), // JSON - content type distribution
  migrationComplexity: text('migration_complexity'), // JSON - migration complexity analysis
  decisionMakers: text('decision_makers'), // JSON - identified decision makers
  tenQuestions: text('ten_questions'), // JSON - generated questions for BL
  rawScanData: text('raw_scan_data'), // JSON - raw scan data for debugging/reprocessing

  // Business Unit Recommendation
  recommendedBusinessUnit: text('recommended_business_unit'),
  confidence: integer('confidence'), // 0-100
  reasoning: text('reasoning'),

  // Agent Activity
  activityLog: text('activity_log'), // JSON - agent activity steps

  // Visualization (json-render tree - cached)
  visualizationTree: text('visualization_tree'), // JSON - cached json-render tree

  // CMS Evaluation (persisted after matching)
  cmsEvaluation: text('cms_evaluation'), // JSON - CMSMatchingResult
  cmsEvaluationCompletedAt: integer('cms_evaluation_completed_at', { mode: 'timestamp' }),

  // Timeline Estimate (Phase 1 - Quick Scan)
  timeline: text('timeline'), // JSON - ProjectTimeline from Timeline Agent
  timelineGeneratedAt: integer('timeline_generated_at', { mode: 'timestamp' }),

  // Timestamps
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
}, (table) => ({
  rfpIdx: index('quick_scans_rfp_idx').on(table.rfpId),
}));

export type QuickScan = typeof quickScans.$inferSelect;
export type NewQuickScan = typeof quickScans.$inferInsert;

export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  rfpId: text('rfp_id')
    .notNull()
    .references(() => rfps.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Job Tracking
  jobId: text('job_id').notNull(), // Inngest run ID
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
  }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  errorMessage: text('error_message'),

  // Input Context
  sourceCMS: text('source_cms'), // WordPress, Drupal, Typo3, Custom
  targetCMS: text('target_cms'), // Drupal, Magnolia, Ibexa
  websiteUrl: text('website_url').notNull(),

  // Results (JSON columns)
  fullScanResult: text('full_scan_result'), // JSON stringified - Full-Scan Agent output
  contentArchitecture: text('content_architecture'), // JSON stringified
  migrationComplexity: text('migration_complexity'), // JSON stringified
  accessibilityAudit: text('accessibility_audit'), // JSON stringified
  ptEstimation: text('pt_estimation'), // JSON stringified

  // Metadata
  version: integer('version').notNull().default(1), // For re-runs
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

export type DeepMigrationAnalysis = typeof deepMigrationAnalyses.$inferSelect;
export type NewDeepMigrationAnalysis = typeof deepMigrationAnalyses.$inferInsert;

export const documents = sqliteTable('documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  rfpId: text('rfp_id')
    .notNull()
    .references(() => rfps.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // File Details
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // application/pdf, etc.
  fileSize: integer('file_size').notNull(), // bytes

  // Storage
  fileData: text('file_data').notNull(), // Base64-encoded file content

  // Metadata
  uploadSource: text('upload_source', { enum: ['initial_upload', 'additional_upload'] })
    .notNull()
    .default('initial_upload'),

  // Timestamps
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  rfpIdx: index('documents_rfp_idx').on(table.rfpId),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export const competitors = sqliteTable('competitors', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // User Tracking
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  validatedByUserId: text('validated_by_user_id').references(() => users.id),

  // Competitor Details
  companyName: text('company_name').notNull(),
  website: text('website'),
  industry: text('industry'), // JSON array
  description: text('description'),

  // Intelligence
  strengths: text('strengths'), // JSON array
  weaknesses: text('weaknesses'), // JSON array
  typicalMarkets: text('typical_markets'), // JSON array
  encounterNotes: text('encounter_notes'), // JSON array of past encounters

  // Validation Workflow
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'needs_revision']
  })
    .notNull()
    .default('pending'),
  adminFeedback: text('admin_feedback'), // Rejection reason
  isValidated: integer('is_validated', { mode: 'boolean' })
    .notNull()
    .default(false),
  validatedAt: integer('validated_at', { mode: 'timestamp' }),

  // Audit (Optimistic Locking)
  version: integer('version').notNull().default(1),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  // CRITICAL: Performance Indexes (PERF-001 Fix)
  companyNameIdx: index("competitors_company_name_idx").on(table.companyName),
  statusIdx: index("competitors_status_idx").on(table.status),
  validatedIdx: index("competitors_validated_idx").on(table.isValidated),
  // Composite index für häufige Query: WHERE status='pending' AND isValidated=false
  statusValidatedIdx: index("competitors_status_validated_idx").on(table.status, table.isValidated),
}));

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;

export const teamAssignments = sqliteTable('team_assignments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // References
  rfpId: text('rfp_id')
    .notNull()
    .references(() => rfps.id),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id),

  // Assignment Details
  role: text('role', {
    enum: ['lead', 'architect', 'developer', 'designer', 'qa', 'pm', 'consultant']
  }).notNull(),

  // Timestamps
  assignedAt: integer('assigned_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  notifiedAt: integer('notified_at', { mode: 'timestamp' })
}, (table) => ({
  rfpIdx: index('team_assignments_rfp_idx').on(table.rfpId),
  employeeIdx: index('team_assignments_employee_idx').on(table.employeeId),
}));

export type TeamAssignment = typeof teamAssignments.$inferSelect;
export type NewTeamAssignment = typeof teamAssignments.$inferInsert;

export const subjectiveAssessments = sqliteTable('subjective_assessments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // References
  rfpId: text('rfp_id')
    .notNull()
    .references(() => rfps.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Assessment Ratings (1-5 scale)
  customerRelationship: integer('customer_relationship').notNull(), // 1-5
  strategicImportance: integer('strategic_importance').notNull(), // 1-5
  winProbability: integer('win_probability').notNull(), // 1-5
  resourceAvailability: integer('resource_availability').notNull(), // 1-5
  technicalFit: integer('technical_fit').notNull(), // 1-5

  // Additional Notes
  notes: text('notes'),

  // Optimistic Locking
  version: integer('version').notNull().default(1),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  rfpIdx: index('subjective_assessments_rfp_idx').on(table.rfpId),
  userIdx: index('subjective_assessments_user_idx').on(table.userId),
}));

export type SubjectiveAssessment = typeof subjectiveAssessments.$inferSelect;
export type NewSubjectiveAssessment = typeof subjectiveAssessments.$inferInsert;

export const backgroundJobs = sqliteTable('background_jobs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Job Details
  jobType: text('job_type', { enum: ['deep-analysis', 'team-notification', 'cleanup'] }).notNull(),
  inngestRunId: text('inngest_run_id'), // Inngest execution ID for tracking

  // References
  rfpId: text('rfp_id').references(() => rfps.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Status
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
  })
    .notNull()
    .default('pending'),

  // Progress (0-100)
  progress: integer('progress').notNull().default(0),
  currentStep: text('current_step'), // Description of current operation

  // Results
  result: text('result'), // JSON - success result data
  errorMessage: text('error_message'),

  // Retry Tracking
  attemptNumber: integer('attempt_number').notNull().default(1),
  maxAttempts: integer('max_attempts').notNull().default(3),

  // Timestamps
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
}, (table) => ({
  rfpIdx: index('background_jobs_rfp_idx').on(table.rfpId),
  statusIdx: index('background_jobs_status_idx').on(table.status),
  jobTypeIdx: index('background_jobs_job_type_idx').on(table.jobType),
  createdAtIdx: index('background_jobs_created_at_idx').on(table.createdAt),
}));

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;

// ===== Drizzle Relations =====

export const usersRelations = relations(users, ({ many, one }) => ({
  rfps: many(rfps),
  references: many(references),
  competencies: many(competencies),
  accounts: many(accounts),
  subjectiveAssessments: many(subjectiveAssessments),
  businessUnit: one(businessUnits, {
    fields: [users.businessUnitId],
    references: [businessUnits.id],
  }),
}));

export const rfpsRelations = relations(rfps, ({ one, many }) => ({
  user: one(users, {
    fields: [rfps.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [rfps.accountId],
    references: [accounts.id],
  }),
  quickScan: one(quickScans, {
    fields: [rfps.quickScanId],
    references: [quickScans.id],
  }),
  deepMigrationAnalysis: one(deepMigrationAnalyses, {
    fields: [rfps.deepMigrationAnalysisId],
    references: [deepMigrationAnalyses.id],
  }),
  documents: many(documents),
  teamAssignments: many(teamAssignments),
  subjectiveAssessments: many(subjectiveAssessments),
}));

export const businessUnitsRelations = relations(businessUnits, ({ many }) => ({
  technologies: many(technologies),
  employees: many(employees),
  users: many(users),
}));

export const technologiesRelations = relations(technologies, ({ one }) => ({
  businessUnit: one(businessUnits, {
    fields: [technologies.businessUnitId],
    references: [businessUnits.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  businessUnit: one(businessUnits, {
    fields: [employees.businessUnitId],
    references: [businessUnits.id],
  }),
  teamAssignments: many(teamAssignments),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  rfps: many(rfps),
}));

export const quickScansRelations = relations(quickScans, ({ one }) => ({
  rfp: one(rfps, {
    fields: [quickScans.rfpId],
    references: [rfps.id],
  }),
}));

export const deepMigrationAnalysesRelations = relations(deepMigrationAnalyses, ({ one }) => ({
  rfp: one(rfps, {
    fields: [deepMigrationAnalyses.rfpId],
    references: [rfps.id],
  }),
  user: one(users, {
    fields: [deepMigrationAnalyses.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  rfp: one(rfps, {
    fields: [documents.rfpId],
    references: [rfps.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const referencesRelations = relations(references, ({ one }) => ({
  user: one(users, {
    fields: [references.userId],
    references: [users.id],
  }),
  validatedBy: one(users, {
    fields: [references.validatedByUserId],
    references: [users.id],
  }),
}));

export const competenciesRelations = relations(competencies, ({ one }) => ({
  user: one(users, {
    fields: [competencies.userId],
    references: [users.id],
  }),
  validatedBy: one(users, {
    fields: [competencies.validatedByUserId],
    references: [users.id],
  }),
}));

export const competitorsRelations = relations(competitors, ({ one }) => ({
  user: one(users, {
    fields: [competitors.userId],
    references: [users.id],
  }),
  validatedBy: one(users, {
    fields: [competitors.validatedByUserId],
    references: [users.id],
  }),
}));

export const teamAssignmentsRelations = relations(teamAssignments, ({ one }) => ({
  rfp: one(rfps, {
    fields: [teamAssignments.rfpId],
    references: [rfps.id],
  }),
  employee: one(employees, {
    fields: [teamAssignments.employeeId],
    references: [employees.id],
  }),
}));

export const subjectiveAssessmentsRelations = relations(subjectiveAssessments, ({ one }) => ({
  rfp: one(rfps, {
    fields: [subjectiveAssessments.rfpId],
    references: [rfps.id],
  }),
  user: one(users, {
    fields: [subjectiveAssessments.userId],
    references: [users.id],
  }),
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
  rfp: one(rfps, {
    fields: [backgroundJobs.rfpId],
    references: [rfps.id],
  }),
  user: one(users, {
    fields: [backgroundJobs.userId],
    references: [users.id],
  }),
}));

export const auditTrailsRelations = relations(auditTrails, ({ one }) => ({
  user: one(users, {
    fields: [auditTrails.userId],
    references: [users.id],
  }),
}));
