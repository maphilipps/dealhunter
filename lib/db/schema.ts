import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';
import { pgTable, text, integer, timestamp, boolean, index, customType } from 'drizzle-orm/pg-core';

// pgvector Typ für 3072-dimensionale Embeddings (text-embedding-3-large)
const vector3072 = customType<{ data: number[]; dpiData: string }>({
  dataType() {
    return 'vector(3072)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    // pgvector returns '[1,2,3]' format
    if (typeof value !== 'string') return [];
    const cleaned = value.replace(/^\[/, '').replace(/\]$/, '');
    return cleaned.split(',').map(Number);
  },
});

export const users = pgTable('users', {
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
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});

export const preQualifications = pgTable(
  'pre_qualifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    // Input
    source: text('source', { enum: ['reactive', 'proactive'] }).notNull(),
    stage: text('stage', { enum: ['cold', 'warm', 'pre-qualification'] }).notNull(),
    inputType: text('input_type', {
      enum: ['pdf', 'crm', 'freetext', 'email', 'combined'],
    }).notNull(),
    rawInput: text('raw_input').notNull(),
    metadata: text('metadata'), // JSON - für Email headers (from, subject, date)
    extractedRequirements: text('extracted_requirements'), // JSON

    // Status (WORKFLOW.md compliant + DEA-90 Auto-Trigger States + DEA-91 Error States)
    status: text('status', {
      enum: [
        'draft', // Initial state after upload
        'processing', // Background processing (PDF extraction, duplicate check, quickscan)
        'duplicate_checking', // Duplicate Check Agent running (DEA-90)
        'duplicate_check_failed', // Duplicate Check failed (DEA-91)
        'duplicate_warning', // Duplicate found, waiting for user override (DEA-90)
        'extracting', // AI is extracting requirements
        'extraction_failed', // Extract Agent failed after max retries (DEA-91)
        'manual_extraction', // Manual extraction mode after Extract failure (DEA-91)
        'reviewing', // User is reviewing extracted data
        'quick_scanning', // AI is doing quick scan
        'quick_scan_failed', // Quick Scan Agent failed (DEA-91, optional - can skip)
        'timeline_estimating', // Timeline Agent running after BID (DEA-90)
        'timeline_failed', // Timeline Agent failed (DEA-91, optional - can skip)
        'bit_pending', // Quick Scan done, waiting for BL routing (BID/NO-BID by BL, not BD)
        'questions_ready', // 10 questions ready, waiting for BID/NO-BID decision (DEA-91 fallback)
        'evaluating', // AI is doing full decision evaluation (after manual trigger)
        'decision_made', // Decision made + Timeline complete, ready for BL routing
        'bid_voted', // BL hat BID entschieden, ready for routing
        'archived', // NO BID - Archiviert
        'routed', // Routed to BL
        'full_scanning', // Deep Analysis läuft
        'bl_reviewing', // BL prüft Ergebnisse
        'team_assigned', // Team assigned
        'notified', // Team wurde benachrichtigt
        'handed_off', // Workflow abgeschlossen
        'analysis_complete', // Deep migration analysis complete (legacy)
      ],
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
    assignedBLNotifiedAt: timestamp('assigned_bl_notified_at'),

    // Extended Evaluation
    extendedEvaluation: text('extended_evaluation'), // JSON

    // Team
    assignedTeam: text('assigned_team'), // JSON
    teamNotifiedAt: timestamp('team_notified_at'),

    // Baseline Comparison (Phase 6)
    baselineComparisonResult: text('baseline_comparison_result'), // JSON - kategorisierte Baseline-Items
    baselineComparisonCompletedAt: timestamp('baseline_comparison_completed_at'),

    // Project Planning (Phase 7)
    projectPlanningResult: text('project_planning_result'), // JSON - Timeline + Disziplinen-Matrix
    projectPlanningCompletedAt: timestamp('project_planning_completed_at'),

    // Team Notifications (Phase 9)
    teamNotifications: text('team_notifications'), // JSON Array - Versandstatus pro Team-Mitglied

    // Website URL (for analysis)
    websiteUrl: text('website_url'),

    // Duplicate Check
    duplicateCheckResult: text('duplicate_check_result'), // JSON - result of duplicate detection
    descriptionEmbedding: vector3072('description_embedding'), // text-embedding-3-large (3072 dimensions)

    // Error Handling (DEA-91)
    agentErrors: text('agent_errors'), // JSON array - AgentError[] for error tracking

    // Analysis Results (TODO: move to separate tables)
    quickScanResults: text('quick_scan_results'), // JSON
    decisionEvaluation: text('decision_evaluation'), // JSON

    // Company Analysis Links
    quickScanId: text('quick_scan_id'),
    deepMigrationAnalysisId: text('deep_migration_analysis_id'),

    // Optimistic Locking
    version: integer('version').notNull().default(1),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    // CRITICAL: Performance Indexes (TODO-029 Fix)
    assignedBusinessUnitIdx: index('pre_qualifications_assigned_bu_idx').on(
      table.assignedBusinessUnitId
    ),
    statusIdx: index('pre_qualifications_status_idx').on(table.status),
    userIdIdx: index('pre_qualifications_user_id_idx').on(table.userId),
  })
);

export const references = pgTable(
  'references',
  {
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
      enum: ['pending', 'approved', 'rejected', 'needs_revision'],
    })
      .notNull()
      .default('pending'),
    adminFeedback: text('admin_feedback'), // Rejection reason
    isValidated: boolean('is_validated').notNull().default(false),
    validatedAt: timestamp('validated_at'),

    // Audit (Optimistic Locking - NEW for Epic 11)
    version: integer('version').notNull().default(1),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    // CRITICAL: Performance Indexes (PERF-001 Fix)
    projectNameIdx: index('references_project_name_idx').on(table.projectName),
    statusIdx: index('references_status_idx').on(table.status),
    validatedIdx: index('references_validated_idx').on(table.isValidated),
    statusValidatedIdx: index('references_status_validated_idx').on(
      table.status,
      table.isValidated
    ),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PreQualification = typeof preQualifications.$inferSelect;
export type NewPreQualification = typeof preQualifications.$inferInsert;
export type Reference = typeof references.$inferSelect;
export type NewReference = typeof references.$inferInsert;

export const competencies = pgTable(
  'competencies',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    validatedByUserId: text('validated_by_user_id').references(() => users.id),

    // Competency Details
    name: text('name').notNull(),
    category: text('category', {
      enum: ['technology', 'methodology', 'industry', 'soft_skill'],
    }).notNull(),
    level: text('level', { enum: ['basic', 'advanced', 'expert'] }).notNull(),

    // Additional Info
    certifications: text('certifications'), // JSON array
    description: text('description'),

    // Validation Workflow (NEW for Epic 11)
    status: text('status', {
      enum: ['pending', 'approved', 'rejected', 'needs_revision'],
    })
      .notNull()
      .default('pending'),
    adminFeedback: text('admin_feedback'),
    isValidated: boolean('is_validated').notNull().default(false),
    validatedAt: timestamp('validated_at'),

    // Audit (Optimistic Locking - NEW for Epic 11)
    version: integer('version').notNull().default(1),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    // CRITICAL: Performance Indexes (PERF-001 Fix)
    nameIdx: index('competencies_name_idx').on(table.name),
    statusIdx: index('competencies_status_idx').on(table.status),
    validatedIdx: index('competencies_validated_idx').on(table.isValidated),
    statusValidatedIdx: index('competencies_status_validated_idx').on(
      table.status,
      table.isValidated
    ),
  })
);

export type Competency = typeof competencies.$inferSelect;
export type NewCompetency = typeof competencies.$inferInsert;

export const businessUnits = pgTable('business_units', {
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
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

export type BusinessUnit = typeof businessUnits.$inferSelect;
export type NewBusinessUnit = typeof businessUnits.$inferInsert;

export const technologies = pgTable('technologies', {
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
  isDefault: boolean('is_default').notNull().default(false),

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
  lastResearchedAt: timestamp('last_researched_at'),
  researchStatus: text('research_status'), // pending, completed, failed

  // Timestamps
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

export type Technology = typeof technologies.$inferSelect;
export type NewTechnology = typeof technologies.$inferInsert;

export const employees = pgTable(
  'employees',
  {
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
    availabilityStatus: text('availability_status', {
      enum: ['available', 'on_project', 'unavailable'],
    })
      .notNull()
      .default('available'),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    // CRITICAL: Performance Indexes (TODO-029 Fix)
    businessUnitIdx: index('employees_business_unit_idx').on(table.businessUnitId),
  })
);

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export const auditTrails = pgTable(
  'audit_trails',
  {
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
        'reject',
      ],
    }).notNull(),
    entityType: text('entity_type', {
      enum: [
        'pre_qualification',
        'qualification',
        'business_unit',
        'employee',
        'reference',
        'competency',
        'competitor',
        'team_assignment',
        'pitchdeck',
      ],
    }).notNull(),
    entityId: text('entity_id').notNull(),

    // Override Details (DEA-25)
    previousValue: text('previous_value'), // JSON or text
    newValue: text('new_value'), // JSON or text
    reason: text('reason'), // Required for manual overrides

    // Legacy field (for backwards compatibility)
    changes: text('changes'), // JSON - deprecated, use previousValue/newValue

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    userIdx: index('audit_trails_user_idx').on(table.userId),
    actionIdx: index('audit_trails_action_idx').on(table.action),
    entityTypeIdx: index('audit_trails_entity_type_idx').on(table.entityType),
    entityIdIdx: index('audit_trails_entity_id_idx').on(table.entityId),
    createdAtIdx: index('audit_trails_created_at_idx').on(table.createdAt),
  })
);

export type AuditTrail = typeof auditTrails.$inferSelect;
export type NewAuditTrail = typeof auditTrails.$inferInsert;

export const accounts = pgTable('accounts', {
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
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export const quickScans = pgTable(
  'quick_scans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    preQualificationId: text('pre_qualification_id')
      .notNull()
      .references(() => preQualifications.id),

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
    cmsEvaluationCompletedAt: timestamp('cms_evaluation_completed_at'),

    // Timeline Estimate (Phase 1 - Quick Scan)
    timeline: text('timeline'), // JSON - ProjectTimeline from Timeline Agent
    timelineGeneratedAt: timestamp('timeline_generated_at'),

    // Timestamps
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    preQualificationIdx: index('quick_scans_pre_qualification_idx').on(table.preQualificationId),
  })
);

export type QuickScan = typeof quickScans.$inferSelect;
export type NewQuickScan = typeof quickScans.$inferInsert;

export const deepMigrationAnalyses = pgTable('deep_migration_analyses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  preQualificationId: text('pre_qualification_id')
    .notNull()
    .references(() => preQualifications.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  // Job Tracking
  jobId: text('job_id').notNull(), // Inngest run ID
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
  }).notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
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
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

export type DeepMigrationAnalysis = typeof deepMigrationAnalyses.$inferSelect;
export type NewDeepMigrationAnalysis = typeof deepMigrationAnalyses.$inferInsert;

export const documents = pgTable(
  'documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    preQualificationId: text('pre_qualification_id')
      .notNull()
      .references(() => preQualifications.id),
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
    uploadedAt: timestamp('uploaded_at').$defaultFn(() => new Date()),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    preQualificationIdx: index('documents_pre_qualification_idx').on(table.preQualificationId),
  })
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export const competitors = pgTable(
  'competitors',
  {
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
      enum: ['pending', 'approved', 'rejected', 'needs_revision'],
    })
      .notNull()
      .default('pending'),
    adminFeedback: text('admin_feedback'), // Rejection reason
    isValidated: boolean('is_validated').notNull().default(false),
    validatedAt: timestamp('validated_at'),

    // Audit (Optimistic Locking)
    version: integer('version').notNull().default(1),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    // CRITICAL: Performance Indexes (PERF-001 Fix)
    companyNameIdx: index('competitors_company_name_idx').on(table.companyName),
    statusIdx: index('competitors_status_idx').on(table.status),
    validatedIdx: index('competitors_validated_idx').on(table.isValidated),
    // Composite index für häufige Query: WHERE status='pending' AND isValidated=false
    statusValidatedIdx: index('competitors_status_validated_idx').on(
      table.status,
      table.isValidated
    ),
  })
);

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;

export const teamAssignments = pgTable(
  'team_assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // References
    preQualificationId: text('pre_qualification_id')
      .notNull()
      .references(() => preQualifications.id),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id),

    // Assignment Details
    role: text('role', {
      enum: ['lead', 'architect', 'developer', 'designer', 'qa', 'pm', 'consultant'],
    }).notNull(),

    // Timestamps
    assignedAt: timestamp('assigned_at').$defaultFn(() => new Date()),
    notifiedAt: timestamp('notified_at'),
  },
  table => ({
    preQualificationIdx: index('team_assignments_pre_qualification_idx').on(
      table.preQualificationId
    ),
    employeeIdx: index('team_assignments_employee_idx').on(table.employeeId),
  })
);

export type TeamAssignment = typeof teamAssignments.$inferSelect;
export type NewTeamAssignment = typeof teamAssignments.$inferInsert;

export const subjectiveAssessments = pgTable(
  'subjective_assessments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // References
    preQualificationId: text('pre_qualification_id')
      .notNull()
      .references(() => preQualifications.id),
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
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    preQualificationIdx: index('subjective_assessments_pre_qualification_idx').on(
      table.preQualificationId
    ),
    userIdx: index('subjective_assessments_user_idx').on(table.userId),
  })
);

export type SubjectiveAssessment = typeof subjectiveAssessments.$inferSelect;
export type NewSubjectiveAssessment = typeof subjectiveAssessments.$inferInsert;

export const backgroundJobs = pgTable(
  'background_jobs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Job Details
    jobType: text('job_type', {
      enum: [
        'qualification',
        'deep-analysis',
        'deep-scan',
        'pitch',
        'quick-scan',
        'team-notification',
        'cleanup',
        'visualization',
      ],
    }).notNull(),
    inngestRunId: text('inngest_run_id'), // Inngest execution ID for tracking
    bullmqJobId: text('bullmq_job_id'), // BullMQ job ID for tracking

    // References
    preQualificationId: text('pre_qualification_id').references(() => preQualifications.id),
    qualificationId: text('qualification_id').references(() => qualifications.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    // Status
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),

    // Progress (0-100)
    progress: integer('progress').notNull().default(0),
    currentStep: text('current_step'), // Description of current operation

    // Deep Scan specific fields
    currentExpert: text('current_expert'), // Currently running expert name
    completedExperts: text('completed_experts'), // JSON array of completed expert names
    pendingExperts: text('pending_experts'), // JSON array of pending expert names (for selective re-scan)
    sectionConfidences: text('section_confidences'), // JSON object: { sectionId: confidence }

    // Results
    result: text('result'), // JSON - success result data
    errorMessage: text('error_message'),

    // Retry Tracking
    attemptNumber: integer('attempt_number').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(3),

    // Timestamps
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    preQualificationIdx: index('background_jobs_pre_qualification_idx').on(
      table.preQualificationId
    ),
    qualificationIdx: index('background_jobs_qualification_idx').on(table.qualificationId),
    statusIdx: index('background_jobs_status_idx').on(table.status),
    jobTypeIdx: index('background_jobs_job_type_idx').on(table.jobType),
    createdAtIdx: index('background_jobs_created_at_idx').on(table.createdAt),
  })
);

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;

// ===== Drizzle Relations =====

export const usersRelations = relations(users, ({ many, one }) => ({
  preQualifications: many(preQualifications),
  references: many(references),
  competencies: many(competencies),
  accounts: many(accounts),
  subjectiveAssessments: many(subjectiveAssessments),
  businessUnit: one(businessUnits, {
    fields: [users.businessUnitId],
    references: [businessUnits.id],
  }),
}));

export const preQualificationsRelations = relations(preQualifications, ({ one, many }) => ({
  user: one(users, {
    fields: [preQualifications.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [preQualifications.accountId],
    references: [accounts.id],
  }),
  quickScan: one(quickScans, {
    fields: [preQualifications.quickScanId],
    references: [quickScans.id],
  }),
  deepMigrationAnalysis: one(deepMigrationAnalyses, {
    fields: [preQualifications.deepMigrationAnalysisId],
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
  preQualifications: many(preQualifications),
}));

export const quickScansRelations = relations(quickScans, ({ one }) => ({
  preQualification: one(preQualifications, {
    fields: [quickScans.preQualificationId],
    references: [preQualifications.id],
  }),
}));

export const deepMigrationAnalysesRelations = relations(deepMigrationAnalyses, ({ one }) => ({
  preQualification: one(preQualifications, {
    fields: [deepMigrationAnalyses.preQualificationId],
    references: [preQualifications.id],
  }),
  user: one(users, {
    fields: [deepMigrationAnalyses.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  preQualification: one(preQualifications, {
    fields: [documents.preQualificationId],
    references: [preQualifications.id],
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
  preQualification: one(preQualifications, {
    fields: [teamAssignments.preQualificationId],
    references: [preQualifications.id],
  }),
  employee: one(employees, {
    fields: [teamAssignments.employeeId],
    references: [employees.id],
  }),
}));

export const subjectiveAssessmentsRelations = relations(subjectiveAssessments, ({ one }) => ({
  preQualification: one(preQualifications, {
    fields: [subjectiveAssessments.preQualificationId],
    references: [preQualifications.id],
  }),
  user: one(users, {
    fields: [subjectiveAssessments.userId],
    references: [users.id],
  }),
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
  preQualification: one(preQualifications, {
    fields: [backgroundJobs.preQualificationId],
    references: [preQualifications.id],
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

// ===== Phase 2: Qualification Management (DEA-66) =====

export const qualifications = pgTable(
  'qualifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Source PreQualification
    preQualificationId: text('pre_qualification_id')
      .notNull()
      .references(() => preQualifications.id),

    // Qualification Status (Phase 2 Workflow)
    status: text('status', {
      enum: [
        'routed', // Neu von der PreQualification konvertiert
        'full_scanning', // Full-Scan Agent läuft
        'bl_reviewing', // BL prüft Ergebnisse
        'bid_voted', // BL hat BID/NO-BID entschieden
        'archived', // NO-BID - archiviert
      ],
    })
      .notNull()
      .default('routed'),

    // Extracted from PreQualification (denormalized for quick access)
    customerName: text('customer_name').notNull(),
    websiteUrl: text('website_url'),
    industry: text('industry'),
    projectDescription: text('project_description'),
    budget: text('budget'),
    requirements: text('requirements'), // JSON - key requirements

    // Quick Scan Reference (from Phase 1)
    quickScanId: text('quick_scan_id').references(() => quickScans.id),
    decisionMakers: text('decision_makers'), // JSON - decision makers from Quick Scan 2.0

    // Business Unit Assignment (from Phase 1)
    businessUnitId: text('business_unit_id')
      .notNull()
      .references(() => businessUnits.id),

    // BL Decision
    blVote: text('bl_vote', { enum: ['BID', 'NO-BID'] }),
    blVotedAt: timestamp('bl_voted_at'),
    blVotedByUserId: text('bl_voted_by_user_id').references(() => users.id),
    blReasoning: text('bl_reasoning'),
    blConfidenceScore: integer('bl_confidence_score'), // 0-100

    // Request More Info
    moreInfoRequested: boolean('more_info_requested').notNull().default(false),
    moreInfoRequestedAt: timestamp('more_info_requested_at'),
    moreInfoNotes: text('more_info_notes'),

    // Deep Scan Status (DEA-139)
    deepScanStatus: text('deep_scan_status', {
      enum: ['pending', 'running', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),
    deepScanStartedAt: timestamp('deep_scan_started_at'),
    deepScanCompletedAt: timestamp('deep_scan_completed_at'),

    // Deep Scan Checkpoints (Robust Resume Support)
    deepScanCurrentPhase: text('deep_scan_current_phase'), // 'scraping' | 'phase2' | 'phase3'
    deepScanCompletedExperts: text('deep_scan_completed_experts'), // JSON array: ['website', 'tech', ...]
    deepScanLastCheckpoint: timestamp('deep_scan_last_checkpoint'),
    deepScanError: text('deep_scan_error'), // Last error for debugging

    // CMS Selection (DEA-151)
    selectedCmsId: text('selected_cms_id').references(() => technologies.id),

    // Timestamps
    routedAt: timestamp('routed_at').$defaultFn(() => new Date()),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    preQualificationIdx: index('qualifications_pre_qualification_idx').on(table.preQualificationId),
    statusIdx: index('qualifications_status_idx').on(table.status),
    businessUnitIdx: index('qualifications_business_unit_idx').on(table.businessUnitId),
    blVoteIdx: index('qualifications_bl_vote_idx').on(table.blVote),
  })
);

export type Qualification = typeof qualifications.$inferSelect;
export type NewQualification = typeof qualifications.$inferInsert;

export const qualificationSectionData = pgTable(
  'qualification_section_data',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Qualification Reference
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id, { onDelete: 'cascade' }),

    // Section Identification
    sectionId: text('section_id').notNull(), // e.g., 'technology', 'website-analysis', 'cms-comparison'

    // Section Content
    content: text('content').notNull(), // JSON - section-specific data structure
    confidence: integer('confidence'), // 0-100
    sources: text('sources'), // JSON - array of source references

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationSectionIdx: index('qualification_section_data_qualification_section_idx').on(
      table.qualificationId,
      table.sectionId
    ),
    qualificationIdx: index('qualification_section_data_qualification_idx').on(
      table.qualificationId
    ),
  })
);

export type QualificationSectionData = typeof qualificationSectionData.$inferSelect;
export type NewQualificationSectionData = typeof qualificationSectionData.$inferInsert;

export const websiteAudits = pgTable(
  'website_audits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Qualification Reference
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Audit Status
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] })
      .notNull()
      .default('pending'),

    // Website Details
    websiteUrl: text('website_url').notNull(),
    homepage: text('homepage'), // JSON - homepage analysis

    // Tech Stack Detection
    cms: text('cms'),
    cmsVersion: text('cms_version'),
    framework: text('framework'),
    hosting: text('hosting'),
    server: text('server'),
    techStack: text('tech_stack'), // JSON - complete tech stack

    // Performance Audit (Core Web Vitals)
    performanceScore: integer('performance_score'), // 0-100
    lcp: integer('lcp'), // Largest Contentful Paint (ms)
    fid: integer('fid'), // First Input Delay (ms)
    cls: text('cls'), // Cumulative Layout Shift (decimal as string)
    ttfb: integer('ttfb'), // Time to First Byte (ms)
    performanceBottlenecks: text('performance_bottlenecks'), // JSON array

    // Accessibility Audit (Axe-core)
    accessibilityScore: integer('accessibility_score'), // 0-100
    wcagLevel: text('wcag_level'), // A, AA, AAA
    a11yViolations: text('a11y_violations'), // JSON - axe violations
    a11yIssueCount: integer('a11y_issue_count'),
    estimatedFixHours: integer('estimated_fix_hours'),

    // Content Architecture
    pageCount: integer('page_count'),
    contentTypes: text('content_types'), // JSON - detected content types
    navigationStructure: text('navigation_structure'), // JSON - nav tree
    siteTree: text('site_tree'), // JSON - hierarchical sitemap
    contentVolume: text('content_volume'), // JSON - volume analysis

    // Migration Complexity
    migrationComplexity: text('migration_complexity', {
      enum: ['low', 'medium', 'high', 'very_high'],
    }),
    complexityScore: integer('complexity_score'), // 0-100
    complexityFactors: text('complexity_factors'), // JSON - contributing factors
    migrationRisks: text('migration_risks'), // JSON array

    // Screenshots & Assets
    screenshots: text('screenshots'), // JSON - screenshot paths
    assetInventory: text('asset_inventory'), // JSON - images, videos, documents

    // SEO Audit (optional)
    seoScore: integer('seo_score'), // 0-100
    seoIssues: text('seo_issues'), // JSON array

    // Legal Compliance (GDPR, Cookie Banner, etc.)
    legalCompliance: text('legal_compliance'), // JSON

    // Raw Data (for debugging/reprocessing)
    rawAuditData: text('raw_audit_data'), // JSON

    // Timestamps
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('website_audits_qualification_idx').on(table.qualificationId),
    statusIdx: index('website_audits_status_idx').on(table.status),
  })
);

export type WebsiteAudit = typeof websiteAudits.$inferSelect;
export type NewWebsiteAudit = typeof websiteAudits.$inferInsert;

export const cmsMatchResults = pgTable(
  'cms_match_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Qualification Reference
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // CMS Reference
    technologyId: text('technology_id')
      .notNull()
      .references(() => technologies.id),

    // Scoring (0-100)
    totalScore: integer('total_score').notNull(),
    featureScore: integer('feature_score').notNull(), // 40% weight
    industryScore: integer('industry_score').notNull(), // 20% weight
    sizeScore: integer('size_score').notNull(), // 15% weight
    budgetScore: integer('budget_score').notNull(), // 15% weight
    migrationScore: integer('migration_score').notNull(), // 10% weight

    // Details
    matchedFeatures: text('matched_features'), // JSON - feature breakdown
    reasoning: text('reasoning'),

    // Recommendation
    rank: integer('rank').notNull(), // 1 = best match
    isRecommended: boolean('is_recommended').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('cms_match_results_qualification_idx').on(table.qualificationId),
    rankIdx: index('cms_match_results_rank_idx').on(table.rank),
    recommendedIdx: index('cms_match_results_recommended_idx').on(table.isRecommended),
  })
);

export type CmsMatchResult = typeof cmsMatchResults.$inferSelect;
export type NewCmsMatchResult = typeof cmsMatchResults.$inferInsert;

export const baselineComparisons = pgTable(
  'baseline_comparisons',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Qualification & CMS Reference
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),
    technologyId: text('technology_id')
      .notNull()
      .references(() => technologies.id),

    // Baseline Info (from Technology)
    baselineName: text('baseline_name').notNull(),
    baselineHours: integer('baseline_hours').notNull(),
    baselineEntityCounts: text('baseline_entity_counts'), // JSON

    // Delta Analysis
    deltaContentTypes: integer('delta_content_types'), // additional content types vs baseline
    deltaParagraphs: integer('delta_paragraphs'),
    deltaTaxonomies: integer('delta_taxonomies'),
    deltaViews: integer('delta_views'),
    deltaCustomModules: integer('delta_custom_modules'),

    // PT Adjustment
    additionalPT: integer('additional_pt'), // hours on top of baseline
    totalEstimatedPT: integer('total_estimated_pt'), // baseline + additional

    // Categorization (Above/Below/At Baseline)
    category: text('category', {
      enum: ['below_baseline', 'at_baseline', 'above_baseline'],
    }).notNull(),

    // Complexity Factors
    complexityFactors: text('complexity_factors'), // JSON - reasons for additional PT
    recommendations: text('recommendations'), // JSON - optimization suggestions

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('baseline_comparisons_qualification_idx').on(table.qualificationId),
    technologyIdx: index('baseline_comparisons_technology_idx').on(table.technologyId),
  })
);

export type BaselineComparison = typeof baselineComparisons.$inferSelect;
export type NewBaselineComparison = typeof baselineComparisons.$inferInsert;

export const ptEstimations = pgTable(
  'pt_estimations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Qualification Reference
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Total Estimation
    totalPT: integer('total_pt').notNull(), // hours
    totalCost: integer('total_cost'), // EUR (optional)
    durationMonths: integer('duration_months'),

    // Phase Breakdown
    phases: text('phases'), // JSON array - phase breakdown

    // Discipline Matrix (Rollen-Breakdown)
    disciplines: text('disciplines'), // JSON - hours per role

    // Timeline
    timeline: text('timeline'), // JSON - milestones with dates
    startDate: text('start_date'), // ISO date
    endDate: text('end_date'), // ISO date

    // Risk Buffer
    riskBuffer: integer('risk_buffer'), // % buffer
    confidenceLevel: text('confidence_level', { enum: ['low', 'medium', 'high'] }),

    // Assumptions
    assumptions: text('assumptions'), // JSON array

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('pt_estimations_qualification_idx').on(table.qualificationId),
  })
);

export type PtEstimation = typeof ptEstimations.$inferSelect;
export type NewPtEstimation = typeof ptEstimations.$inferInsert;

export const referenceMatches = pgTable(
  'reference_matches',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // References
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),
    referenceId: text('reference_id')
      .notNull()
      .references(() => references.id),

    // Matching Scores
    totalScore: integer('total_score').notNull(), // 0-100
    techStackScore: integer('tech_stack_score').notNull(), // 60% weight
    industryScore: integer('industry_score').notNull(), // 40% weight

    // Details
    matchedTechnologies: text('matched_technologies'), // JSON array
    matchedIndustries: text('matched_industries'), // JSON array
    reasoning: text('reasoning'),

    // Ranking
    rank: integer('rank').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('reference_matches_qualification_idx').on(table.qualificationId),
    referenceIdx: index('reference_matches_reference_idx').on(table.referenceId),
    rankIdx: index('reference_matches_rank_idx').on(table.rank),
  })
);

export type ReferenceMatch = typeof referenceMatches.$inferSelect;
export type NewReferenceMatch = typeof referenceMatches.$inferInsert;

export const competitorMatches = pgTable(
  'competitor_matches',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // References
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),
    competitorId: text('competitor_id')
      .notNull()
      .references(() => competitors.id),

    // Matching Details
    source: text('source', { enum: ['database', 'web_search'] }).notNull(),
    relevanceScore: integer('relevance_score'), // 0-100
    reasoning: text('reasoning'),

    // Intelligence
    likelyInvolved: boolean('likely_involved').notNull().default(false),
    encounterHistory: text('encounter_history'), // JSON - past encounters

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('competitor_matches_qualification_idx').on(table.qualificationId),
    competitorIdx: index('competitor_matches_competitor_idx').on(table.competitorId),
  })
);

export type CompetitorMatch = typeof competitorMatches.$inferSelect;
export type NewCompetitorMatch = typeof competitorMatches.$inferInsert;

// ===== Relations for Phase 2 Tables =====

export const qualificationsRelations = relations(qualifications, ({ one, many }) => ({
  preQualification: one(preQualifications, {
    fields: [qualifications.preQualificationId],
    references: [preQualifications.id],
  }),
  businessUnit: one(businessUnits, {
    fields: [qualifications.businessUnitId],
    references: [businessUnits.id],
  }),
  quickScan: one(quickScans, {
    fields: [qualifications.quickScanId],
    references: [quickScans.id],
  }),
  blVotedBy: one(users, {
    fields: [qualifications.blVotedByUserId],
    references: [users.id],
  }),
  websiteAudit: one(websiteAudits),
  cmsMatchResults: many(cmsMatchResults),
  baselineComparisons: many(baselineComparisons),
  ptEstimations: many(ptEstimations),
  referenceMatches: many(referenceMatches),
  competitorMatches: many(competitorMatches),
  sectionData: many(qualificationSectionData),
  pitchdeck: one(pitchdecks),
  dealEmbeddings: many(dealEmbeddings),
}));

export const websiteAuditsRelations = relations(websiteAudits, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [websiteAudits.qualificationId],
    references: [qualifications.id],
  }),
}));

export const qualificationSectionDataRelations = relations(qualificationSectionData, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [qualificationSectionData.qualificationId],
    references: [qualifications.id],
  }),
}));

export const cmsMatchResultsRelations = relations(cmsMatchResults, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [cmsMatchResults.qualificationId],
    references: [qualifications.id],
  }),
  technology: one(technologies, {
    fields: [cmsMatchResults.technologyId],
    references: [technologies.id],
  }),
}));

// Chunk Category Types - Distinguish between facts, elaborations, and estimates
export const CHUNK_CATEGORIES = [
  'fact', // Extrahierte Fakten, Rohdaten (Quick Scan, Scraper)
  'elaboration', // AI-generierte Ausarbeitungen (Content Architecture, Component Library)
  'recommendation', // Empfehlungen
  'risk', // Risiko-Bewertungen
  'estimate', // Schätzungen (Hours, Budget, Migration Complexity)
] as const;
export type ChunkCategory = (typeof CHUNK_CATEGORIES)[number];

// ============================================================================
// UNIFIED Deal Embeddings - Single table for PreQualification and Qualification embeddings (DEA-143)
// ============================================================================
// Replaces both rfpEmbeddings and leadEmbeddings with a single unified table.
// Either preQualificationId OR qualificationId must be set (constraint enforced at application level).
export const dealEmbeddings = pgTable(
  'deal_embeddings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Foreign Keys - At least one must be set
    preQualificationId: text('pre_qualification_id').references(() => preQualifications.id, {
      onDelete: 'cascade',
    }),
    qualificationId: text('qualification_id').references(() => qualifications.id, {
      onDelete: 'cascade',
    }),

    // Agent & Chunk Metadata
    agentName: text('agent_name').notNull(), // 'extract', 'quick_scan', 'scraper', 'audit_website_expert', etc.
    chunkType: text('chunk_type').notNull(), // 'tech_stack', 'performance', 'page_content', 'screenshot', etc.
    chunkIndex: integer('chunk_index').notNull().default(0), // 0, 1, 2... for ordering

    // Content
    content: text('content').notNull(), // The text chunk
    metadata: text('metadata'), // JSON - additional chunk metadata

    // Vector Embedding
    embedding: vector3072('embedding'), // 3072 dimensions (text-embedding-3-large), nullable for screenshots

    // === RAG Architektur: Fakten vs. Ausarbeitungen ===
    chunkCategory: text('chunk_category', {
      enum: ['fact', 'elaboration', 'recommendation', 'risk', 'estimate'],
    }).default('elaboration'),
    confidence: integer('confidence').default(50), // 0-100 scale
    requiresValidation: boolean('requires_validation').default(false),
    validatedAt: timestamp('validated_at'),
    validatedBy: text('validated_by'), // User ID

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    // PreQualification-specific indexes
    preQualificationIdx: index('deal_embeddings_pre_qualification_idx').on(
      table.preQualificationId
    ),
    preQualificationChunkIdx: index('deal_embeddings_pre_qualification_chunk_idx').on(
      table.preQualificationId,
      table.chunkType
    ),
    preQualificationAgentIdx: index('deal_embeddings_pre_qualification_agent_idx').on(
      table.preQualificationId,
      table.agentName
    ),
    // Qualification-specific indexes
    qualificationIdx: index('deal_embeddings_qualification_idx').on(table.qualificationId),
    qualificationAgentIdx: index('deal_embeddings_qualification_agent_idx').on(
      table.qualificationId,
      table.agentName
    ),
    qualificationCategoryIdx: index('deal_embeddings_qualification_category_idx').on(
      table.qualificationId,
      table.chunkCategory
    ),
  })
);

export type DealEmbedding = typeof dealEmbeddings.$inferSelect;
export type NewDealEmbedding = typeof dealEmbeddings.$inferInsert;

export const dealEmbeddingsRelations = relations(dealEmbeddings, ({ one }) => ({
  preQualification: one(preQualifications, {
    fields: [dealEmbeddings.preQualificationId],
    references: [preQualifications.id],
  }),
  qualification: one(qualifications, {
    fields: [dealEmbeddings.qualificationId],
    references: [qualifications.id],
  }),
}));

// RAW PDF Chunks - Original document text for RAG-based extraction (DEA-108)
export const rawChunks = pgTable(
  'raw_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    preQualificationId: text('pre_qualification_id')
      .notNull()
      .references(() => preQualifications.id, { onDelete: 'cascade' }),

    // Chunk Metadata
    chunkIndex: integer('chunk_index').notNull(), // 0, 1, 2... for ordering
    content: text('content').notNull(), // The raw text chunk
    tokenCount: integer('token_count').notNull(), // Estimated token count

    // Vector
    embedding: vector3072('embedding').notNull(), // 3072 dimensions (text-embedding-3-large)

    // Additional Metadata
    metadata: text('metadata'), // JSON - position, type, etc.

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    preQualificationIdx: index('raw_chunks_pre_qualification_idx').on(table.preQualificationId),
  })
);

export type RawChunk = typeof rawChunks.$inferSelect;
export type NewRawChunk = typeof rawChunks.$inferInsert;

export const baselineComparisonsRelations = relations(baselineComparisons, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [baselineComparisons.qualificationId],
    references: [qualifications.id],
  }),
  technology: one(technologies, {
    fields: [baselineComparisons.technologyId],
    references: [technologies.id],
  }),
}));

export const ptEstimationsRelations = relations(ptEstimations, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [ptEstimations.qualificationId],
    references: [qualifications.id],
  }),
}));

export const referenceMatchesRelations = relations(referenceMatches, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [referenceMatches.qualificationId],
    references: [qualifications.id],
  }),
  reference: one(references, {
    fields: [referenceMatches.referenceId],
    references: [references.id],
  }),
}));

export const competitorMatchesRelations = relations(competitorMatches, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [competitorMatches.qualificationId],
    references: [qualifications.id],
  }),
  competitor: one(competitors, {
    fields: [competitorMatches.competitorId],
    references: [competitors.id],
  }),
}));

// ===== Pitchdeck Assembly (DEA-155) =====

export const pitchdecks = pgTable(
  'pitchdecks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Qualification Reference
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Pitchdeck Status
    status: text('status', {
      enum: ['draft', 'team_proposed', 'team_confirmed', 'in_progress', 'submitted'],
    })
      .notNull()
      .default('draft'),

    // Team Confirmation
    teamConfirmedAt: timestamp('team_confirmed_at'),
    teamConfirmedByUserId: text('team_confirmed_by_user_id').references(() => users.id),

    // Submission
    submittedAt: timestamp('submitted_at'),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('pitchdecks_qualification_idx').on(table.qualificationId),
    statusIdx: index('pitchdecks_status_idx').on(table.status),
  })
);

export type Pitchdeck = typeof pitchdecks.$inferSelect;
export type NewPitchdeck = typeof pitchdecks.$inferInsert;

export const pitchdeckDeliverables = pgTable(
  'pitchdeck_deliverables',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Pitchdeck Reference
    pitchdeckId: text('pitchdeck_id')
      .notNull()
      .references(() => pitchdecks.id),

    // Deliverable Details
    deliverableName: text('deliverable_name').notNull(),

    // Status Tracking
    status: text('status', { enum: ['open', 'in_progress', 'review', 'done'] })
      .notNull()
      .default('open'),

    // Timeline
    internalDeadline: timestamp('internal_deadline'),

    // Assignment
    assignedToEmployeeId: text('assigned_to_employee_id').references(() => employees.id),

    // AI-Generated Solution Sketches
    outline: text('outline'), // Structured outline
    draft: text('draft'), // Full-text draft
    talkingPoints: text('talking_points'), // Presentation talking points
    visualIdeas: text('visual_ideas'), // Visualization ideas

    // Generation Timestamp
    generatedAt: timestamp('generated_at'),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    pitchdeckIdx: index('pitchdeck_deliverables_pitchdeck_idx').on(table.pitchdeckId),
    statusIdx: index('pitchdeck_deliverables_status_idx').on(table.status),
  })
);

export type PitchdeckDeliverable = typeof pitchdeckDeliverables.$inferSelect;
export type NewPitchdeckDeliverable = typeof pitchdeckDeliverables.$inferInsert;

export const pitchdeckTeamMembers = pgTable(
  'pitchdeck_team_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Pitchdeck Reference
    pitchdeckId: text('pitchdeck_id')
      .notNull()
      .references(() => pitchdecks.id),

    // Employee Reference
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id),

    // Role in Pitchdeck Team
    role: text('role', {
      enum: ['pm', 'ux', 'frontend', 'backend', 'devops', 'qa'],
    }).notNull(),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    pitchdeckIdx: index('pitchdeck_team_members_pitchdeck_idx').on(table.pitchdeckId),
    employeeIdx: index('pitchdeck_team_members_employee_idx').on(table.employeeId),
  })
);

export type PitchdeckTeamMember = typeof pitchdeckTeamMembers.$inferSelect;
export type NewPitchdeckTeamMember = typeof pitchdeckTeamMembers.$inferInsert;

export const pitchdecksRelations = relations(pitchdecks, ({ one, many }) => ({
  qualification: one(qualifications, {
    fields: [pitchdecks.qualificationId],
    references: [qualifications.id],
  }),
  teamConfirmedBy: one(users, {
    fields: [pitchdecks.teamConfirmedByUserId],
    references: [users.id],
  }),
  deliverables: many(pitchdeckDeliverables),
  teamMembers: many(pitchdeckTeamMembers),
}));

export const pitchdeckDeliverablesRelations = relations(pitchdeckDeliverables, ({ one }) => ({
  pitchdeck: one(pitchdecks, {
    fields: [pitchdeckDeliverables.pitchdeckId],
    references: [pitchdecks.id],
  }),
  assignedToEmployee: one(employees, {
    fields: [pitchdeckDeliverables.assignedToEmployeeId],
    references: [employees.id],
  }),
}));

export const pitchdeckTeamMembersRelations = relations(pitchdeckTeamMembers, ({ one }) => ({
  pitchdeck: one(pitchdecks, {
    fields: [pitchdeckTeamMembers.pitchdeckId],
    references: [pitchdecks.id],
  }),
  employee: one(employees, {
    fields: [pitchdeckTeamMembers.employeeId],
    references: [employees.id],
  }),
}));

// ===== Pitch Pipeline =====

export const pitchRuns = pgTable(
  'pitch_runs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    // Status
    status: text('status', {
      enum: [
        'pending',
        'running',
        'audit_complete',
        'generating',
        'waiting_for_user',
        'review',
        'completed',
        'failed',
      ],
    })
      .notNull()
      .default('pending'),

    // Snapshot
    runNumber: integer('run_number').notNull().default(1),
    snapshotData: text('snapshot_data'), // JSON: full orchestrator state

    // CMS Context
    targetCmsIds: text('target_cms_ids'), // JSON array
    selectedCmsId: text('selected_cms_id').references(() => technologies.id),

    // Progress
    currentPhase: text('current_phase'),
    progress: integer('progress').notNull().default(0),
    currentStep: text('current_step'),

    // Agent Tracking
    completedAgents: text('completed_agents'), // JSON array
    failedAgents: text('failed_agents'), // JSON array
    agentConfidences: text('agent_confidences'), // JSON object

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('pitch_runs_qualification_idx').on(table.qualificationId),
    statusIdx: index('pitch_runs_status_idx').on(table.status),
    userIdx: index('pitch_runs_user_idx').on(table.userId),
  })
);

export type PitchRun = typeof pitchRuns.$inferSelect;
export type NewPitchRun = typeof pitchRuns.$inferInsert;

export const pitchDocuments = pgTable(
  'pitch_documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => pitchRuns.id),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Document Type
    documentType: text('document_type', {
      enum: ['indication', 'calculation', 'presentation', 'proposal'],
    }).notNull(),
    format: text('format', {
      enum: ['html', 'xlsx', 'pptx', 'docx'],
    }).notNull(),

    // CMS Variant
    cmsVariant: text('cms_variant'),
    technologyId: text('technology_id').references(() => technologies.id),

    // Content
    content: text('content'), // HTML for indication
    fileData: text('file_data'), // Base64 for binary files
    fileName: text('file_name'),
    fileSize: integer('file_size'),

    // Quality
    confidence: integer('confidence'),
    flags: text('flags'), // JSON array

    // Timestamps
    generatedAt: timestamp('generated_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('pitch_docs_run_idx').on(table.runId),
    qualificationIdx: index('pitch_docs_qualification_idx').on(table.qualificationId),
    typeIdx: index('pitch_docs_type_idx').on(table.documentType),
  })
);

export type PitchDocument = typeof pitchDocuments.$inferSelect;
export type NewPitchDocument = typeof pitchDocuments.$inferInsert;

export const pitchAuditResults = pgTable(
  'pitch_audit_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => pitchRuns.id),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Website
    websiteUrl: text('website_url').notNull(),

    // Audit Sections (all JSON)
    techStack: text('tech_stack'),
    performance: text('performance'),
    accessibility: text('accessibility'),
    architecture: text('architecture'),
    hosting: text('hosting'),
    integrations: text('integrations'),
    componentLibrary: text('component_library'),
    screenshots: text('screenshots'),

    // Scores
    performanceScore: integer('performance_score'),
    accessibilityScore: integer('accessibility_score'),
    migrationComplexity: text('migration_complexity', {
      enum: ['low', 'medium', 'high', 'very_high'],
    }),
    complexityScore: integer('complexity_score'),

    // Share Link
    shareToken: text('share_token').unique(),
    shareExpiresAt: timestamp('share_expires_at'),

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('pitch_audit_run_idx').on(table.runId),
    qualificationIdx: index('pitch_audit_qualification_idx').on(table.qualificationId),
    shareTokenIdx: index('pitch_audit_share_token_idx').on(table.shareToken),
  })
);

export type PitchAuditResult = typeof pitchAuditResults.$inferSelect;
export type NewPitchAuditResult = typeof pitchAuditResults.$inferInsert;

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Content
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    tokenCount: integer('token_count').notNull(),

    // Source
    sourceType: text('source_type', {
      enum: ['upload', 'reference', 'baseline', 'template'],
    }).notNull(),
    sourceFileName: text('source_file_name'),
    sourceFileId: text('source_file_id'),

    // Embedding
    embedding: vector3072('embedding'),

    // Metadata (MVP: 5 core fields)
    industry: text('industry'),
    useCase: text('use_case'),
    cms: text('cms'),
    phase: text('phase'),
    documentType: text('document_type'),
    effortRange: text('effort_range'),
    confidence: integer('confidence').notNull().default(50),
    businessUnit: text('business_unit'),

    // Extended metadata (nullable, filled post-MVP)
    customerSize: text('customer_size'),
    projectVolume: text('project_volume'),
    contractType: text('contract_type'),
    region: text('region'),
    competitorContext: text('competitor_context'),
    legalRequirements: text('legal_requirements'),
    accessibilityLevel: text('accessibility_level'),
    hostingModel: text('hosting_model'),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    contentHashIdx: index('knowledge_chunks_hash_idx').on(table.contentHash),
    cmsIdx: index('knowledge_chunks_cms_idx').on(table.cms),
    industryIdx: index('knowledge_chunks_industry_idx').on(table.industry),
    sourceTypeIdx: index('knowledge_chunks_source_type_idx').on(table.sourceType),
    businessUnitIdx: index('knowledge_chunks_bu_idx').on(table.businessUnit),
  })
);

export type KnowledgeChunkRow = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunkRow = typeof knowledgeChunks.$inferInsert;

export const pitchConversations = pgTable(
  'pitch_conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => pitchRuns.id),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Message
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    messageType: text('message_type', {
      enum: ['interview', 'progress', 'question', 'answer'],
    }).notNull(),

    // Tool Calls
    toolCalls: text('tool_calls'), // JSON
    toolResults: text('tool_results'), // JSON

    // Ordering
    sequenceNumber: integer('sequence_number').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('pitch_conv_run_idx').on(table.runId),
    qualificationIdx: index('pitch_conv_qualification_idx').on(table.qualificationId),
    sequenceIdx: index('pitch_conv_sequence_idx').on(table.runId, table.sequenceNumber),
  })
);

export type PitchConversation = typeof pitchConversations.$inferSelect;
export type NewPitchConversation = typeof pitchConversations.$inferInsert;

// ===== Pitch Relations =====

export const pitchRunsRelations = relations(pitchRuns, ({ one, many }) => ({
  qualification: one(qualifications, {
    fields: [pitchRuns.qualificationId],
    references: [qualifications.id],
  }),
  user: one(users, {
    fields: [pitchRuns.userId],
    references: [users.id],
  }),
  selectedCms: one(technologies, {
    fields: [pitchRuns.selectedCmsId],
    references: [technologies.id],
  }),
  documents: many(pitchDocuments),
  auditResults: many(pitchAuditResults),
  conversations: many(pitchConversations),
}));

export const pitchDocumentsRelations = relations(pitchDocuments, ({ one }) => ({
  run: one(pitchRuns, {
    fields: [pitchDocuments.runId],
    references: [pitchRuns.id],
  }),
  qualification: one(qualifications, {
    fields: [pitchDocuments.qualificationId],
    references: [qualifications.id],
  }),
  technology: one(technologies, {
    fields: [pitchDocuments.technologyId],
    references: [technologies.id],
  }),
}));

export const pitchAuditResultsRelations = relations(pitchAuditResults, ({ one }) => ({
  run: one(pitchRuns, {
    fields: [pitchAuditResults.runId],
    references: [pitchRuns.id],
  }),
  qualification: one(qualifications, {
    fields: [pitchAuditResults.qualificationId],
    references: [qualifications.id],
  }),
}));

export const pitchConversationsRelations = relations(pitchConversations, ({ one }) => ({
  run: one(pitchRuns, {
    fields: [pitchConversations.runId],
    references: [pitchRuns.id],
  }),
  qualification: one(qualifications, {
    fields: [pitchConversations.qualificationId],
    references: [qualifications.id],
  }),
}));
