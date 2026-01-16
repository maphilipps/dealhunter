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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type BidOpportunity = typeof bidOpportunities.$inferSelect;
export type NewBidOpportunity = typeof bidOpportunities.$inferInsert;
