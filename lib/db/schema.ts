import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
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

export const bidOpportunities = sqliteTable('bid_opportunities', {
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
      'evaluating',       // AI is doing full bit/no bit evaluation
      'bit_decided',      // Decision made
      'archived',         // NO BIT - Archiviert
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

  // Bit Decision
  bitDecision: text('bit_decision', { enum: ['bit', 'no_bit', 'pending'] })
    .notNull()
    .default('pending'),
  bitDecisionData: text('bit_decision_data'), // JSON
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

  // Analysis Results (TODO: move to separate tables)
  quickScanResults: text('quick_scan_results'), // JSON
  bitEvaluation: text('bit_evaluation'), // JSON

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
});

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
export type BidOpportunity = typeof bidOpportunities.$inferSelect;
export type NewBidOpportunity = typeof bidOpportunities.$inferInsert;
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
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export const auditTrails = sqliteTable('audit_trails', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Audit Details
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  changes: text('changes'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

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
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id),

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

  // Business Unit Recommendation
  recommendedBusinessUnit: text('recommended_business_unit'),
  confidence: integer('confidence'), // 0-100
  reasoning: text('reasoning'),

  // Agent Activity
  activityLog: text('activity_log'), // JSON - agent activity steps

  // Visualization (json-render tree - cached)
  visualizationTree: text('visualization_tree'), // JSON - cached json-render tree

  // Timestamps
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
});

export type QuickScan = typeof quickScans.$inferSelect;
export type NewQuickScan = typeof quickScans.$inferInsert;

export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id),
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
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id),
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
});

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
