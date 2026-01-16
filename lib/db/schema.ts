import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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
  inputType: text('input_type', { enum: ['pdf', 'crm', 'freetext', 'email'] }).notNull(),
  rawInput: text('raw_input').notNull(),
  metadata: text('metadata'), // JSON - für Email headers (from, subject, date)
  extractedRequirements: text('extracted_requirements'), // JSON

  // Status
  status: text('status', { enum: ['draft', 'evaluating', 'bit_decided', 'routed', 'team_assigned'] })
    .notNull()
    .default('draft'),

  // Bit Decision
  bitDecision: text('bit_decision', { enum: ['bit', 'no_bit', 'pending'] })
    .notNull()
    .default('pending'),
  bitDecisionData: text('bit_decision_data'), // JSON
  alternativeRecommendation: text('alternative_recommendation'),

  // Routing
  assignedBusinessLineId: text('assigned_business_line_id'),
  assignedBLNotifiedAt: integer('assigned_bl_notified_at', { mode: 'timestamp' }),

  // Extended Evaluation
  extendedEvaluation: text('extended_evaluation'), // JSON

  // Team
  assignedTeam: text('assigned_team'), // JSON
  teamNotifiedAt: integer('team_notified_at', { mode: 'timestamp' }),

  // Company Analysis Links
  quickScanId: text('quick_scan_id'),
  deepMigrationAnalysisId: text('deep_migration_analysis_id'),

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

  // Validation
  isValidated: integer('is_validated', { mode: 'boolean' })
    .notNull()
    .default(false),
  validatedAt: integer('validated_at', { mode: 'timestamp' }),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

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

  // Competency Details
  name: text('name').notNull(),
  category: text('category', { enum: ['technology', 'methodology', 'industry', 'soft_skill'] }).notNull(),
  level: text('level', { enum: ['basic', 'advanced', 'expert'] }).notNull(),

  // Additional Info
  certifications: text('certifications'), // JSON array
  description: text('description'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
});

export type Competency = typeof competencies.$inferSelect;
export type NewCompetency = typeof competencies.$inferInsert;

export const businessLines = sqliteTable('business_lines', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Business Line Details
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

export type BusinessLine = typeof businessLines.$inferSelect;
export type NewBusinessLine = typeof businessLines.$inferInsert;

export const technologies = sqliteTable('technologies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Technology Details
  name: text('name').notNull(),

  // Business Line Reference
  businessLineId: text('business_line_id')
    .notNull()
    .references(() => businessLines.id),

  // Baseline Information
  baselineHours: integer('baseline_hours').notNull(),
  baselineName: text('baseline_name').notNull(),
  baselineEntityCounts: text('baseline_entity_counts').notNull(), // JSON

  // Default Flag
  isDefault: integer('is_default', { mode: 'boolean' })
    .notNull()
    .default(false),

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

  // Business Line
  businessLineId: text('business_line_id')
    .notNull()
    .references(() => businessLines.id),

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
