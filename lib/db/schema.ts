import { pgTable, uuid, text, timestamp, integer, jsonb, index, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
  })
);

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companyName: text('company_name').notNull(),
    location: text('location'),
    type: text('type').notNull().default('quick_scan'), // 'quick_scan' | 'deep_dive' | 'competitor' | 'batch'
    status: text('status').notNull().default('pending'),
    // 'pending' | 'discovering' | 'crawling' | 'detecting' | 'analyzing' |
    // 'researching' | 'vetting' | 'valuing' | 'generating' | 'completed' | 'failed'
    progress: integer('progress').notNull().default(0), // 0-100
    currentPhase: text('current_phase').default('discovery'),
    result: jsonb('result'), // CompanyAnalysisResult
    leadScore: integer('lead_score'), // 0-100
    maturityLevel: text('maturity_level'), // 'emerging' | 'growing' | 'mature' | 'leader'
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    userIdIdx: index('analyses_user_id_idx').on(table.userId),
    statusIdx: index('analyses_status_idx').on(table.status),
    createdAtIdx: index('analyses_created_at_idx').on(table.createdAt),
    leadScoreIdx: index('analyses_lead_score_idx').on(table.leadScore),
  })
);

export const websites = pgTable(
  'websites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    type: text('type').notNull(), // 'primary' | 'subsidiary' | 'blog' | 'career' | 'other'
    language: text('language'), // ISO 639-1 code
    isActive: boolean('is_active').notNull().default(true),
    crawledAt: timestamp('crawled_at'),
    techStack: jsonb('tech_stack'), // TechStack data
    performance: jsonb('performance'), // PerformanceMetrics
    uxScore: integer('ux_score'), // 0-100
    seoScore: integer('seo_score'), // 0-100
    accessibilityScore: integer('accessibility_score'), // 0-100
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    analysisIdIdx: index('websites_analysis_id_idx').on(table.analysisId),
    urlIdx: index('websites_url_idx').on(table.url),
    typeIdx: index('websites_type_idx').on(table.type),
  })
);

// Agent Activities Table - For Agent Native Transparency
export const agentActivities = pgTable(
  'agent_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(), // 'company-discovery' | 'crawling' | 'tech-detection' etc.
    phase: text('phase').notNull(), // Current phase this agent is working on
    action: text('action').notNull(), // 'searching' | 'crawling' | 'analyzing' | 'completed' | 'failed'
    message: text('message').notNull(), // Human-readable message
    metadata: jsonb('metadata'), // Additional agent-specific data (URLs found, tools used, etc.)
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    analysisIdIdx: index('agent_activities_analysis_id_idx').on(table.analysisId),
    agentNameIdx: index('agent_activities_agent_name_idx').on(table.agentName),
    timestampIdx: index('agent_activities_timestamp_idx').on(table.timestamp),
  })
);

// Phase Errors Table - For Debugging and Error Recovery
export const phaseErrors = pgTable(
  'phase_errors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(), // The phase where error occurred
    agentName: text('agent_name'), // Optional: Which agent caused the error
    errorType: text('error_type').notNull(), // 'timeout' | '404' | 'parse_error' | 'api_error' | 'validation_error'
    errorMessage: text('error_message').notNull(),
    url: text('url'), // Optional: URL that caused the error
    stackTrace: text('stack_trace'), // Optional: Stack trace for debugging
    isResolved: boolean('is_resolved').notNull().default(false),
    resolvedAt: timestamp('resolved_at'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    analysisIdIdx: index('phase_errors_analysis_id_idx').on(table.analysisId),
    phaseIdx: index('phase_errors_phase_idx').on(table.phase),
    isResolvedIdx: index('phase_errors_is_resolved_idx').on(table.isResolved),
    timestampIdx: index('phase_errors_timestamp_idx').on(table.timestamp),
  })
);

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;

export type Website = typeof websites.$inferSelect;
export type NewWebsite = typeof websites.$inferInsert;

export type AgentActivity = typeof agentActivities.$inferSelect;
export type NewAgentActivity = typeof agentActivities.$inferInsert;

export type PhaseError = typeof phaseErrors.$inferSelect;
export type NewPhaseError = typeof phaseErrors.$inferInsert;
