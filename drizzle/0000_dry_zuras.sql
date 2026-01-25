CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"website" text,
	"notes" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_trails" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"reason" text,
	"changes" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"inngest_run_id" text,
	"bullmq_job_id" text,
	"pre_qualification_id" text,
	"qualification_id" text,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"current_expert" text,
	"completed_experts" text,
	"pending_experts" text,
	"section_confidences" text,
	"result" text,
	"error_message" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "baseline_comparisons" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"technology_id" text NOT NULL,
	"baseline_name" text NOT NULL,
	"baseline_hours" integer NOT NULL,
	"baseline_entity_counts" text,
	"delta_content_types" integer,
	"delta_paragraphs" integer,
	"delta_taxonomies" integer,
	"delta_views" integer,
	"delta_custom_modules" integer,
	"additional_pt" integer,
	"total_estimated_pt" integer,
	"category" text NOT NULL,
	"complexity_factors" text,
	"recommendations" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"leader_name" text NOT NULL,
	"leader_email" text NOT NULL,
	"keywords" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cms_match_results" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"technology_id" text NOT NULL,
	"total_score" integer NOT NULL,
	"feature_score" integer NOT NULL,
	"industry_score" integer NOT NULL,
	"size_score" integer NOT NULL,
	"budget_score" integer NOT NULL,
	"migration_score" integer NOT NULL,
	"matched_features" text,
	"reasoning" text,
	"rank" integer NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"validated_by_user_id" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"level" text NOT NULL,
	"certifications" text,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_feedback" text,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "competitor_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"competitor_id" text NOT NULL,
	"source" text NOT NULL,
	"relevance_score" integer,
	"reasoning" text,
	"likely_involved" boolean DEFAULT false NOT NULL,
	"encounter_history" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"validated_by_user_id" text,
	"company_name" text NOT NULL,
	"website" text,
	"industry" text,
	"description" text,
	"strengths" text,
	"weaknesses" text,
	"typical_markets" text,
	"encounter_notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_feedback" text,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deal_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text,
	"qualification_id" text,
	"agent_name" text NOT NULL,
	"chunk_type" text NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"embedding" vector(3072),
	"chunk_category" text DEFAULT 'elaboration',
	"confidence" integer DEFAULT 50,
	"requires_validation" boolean DEFAULT false,
	"validated_at" timestamp,
	"validated_by" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deep_migration_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"source_cms" text,
	"target_cms" text,
	"website_url" text NOT NULL,
	"full_scan_result" text,
	"content_architecture" text,
	"migration_complexity" text,
	"accessibility_audit" text,
	"pt_estimation" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_data" text NOT NULL,
	"upload_source" text DEFAULT 'initial_upload' NOT NULL,
	"uploaded_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"business_unit_id" text NOT NULL,
	"skills" text NOT NULL,
	"roles" text NOT NULL,
	"availability_status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "pitchdeck_deliverables" (
	"id" text PRIMARY KEY NOT NULL,
	"pitchdeck_id" text NOT NULL,
	"deliverable_name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"internal_deadline" timestamp,
	"assigned_to_employee_id" text,
	"outline" text,
	"draft" text,
	"talking_points" text,
	"visual_ideas" text,
	"generated_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pitchdeck_team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"pitchdeck_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pitchdecks" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"team_confirmed_at" timestamp,
	"team_confirmed_by_user_id" text,
	"submitted_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pre_qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"stage" text NOT NULL,
	"input_type" text NOT NULL,
	"raw_input" text NOT NULL,
	"metadata" text,
	"extracted_requirements" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"decision_data" text,
	"alternative_recommendation" text,
	"account_id" text,
	"assigned_business_unit_id" text,
	"assigned_bl_notified_at" timestamp,
	"extended_evaluation" text,
	"assigned_team" text,
	"team_notified_at" timestamp,
	"baseline_comparison_result" text,
	"baseline_comparison_completed_at" timestamp,
	"project_planning_result" text,
	"project_planning_completed_at" timestamp,
	"team_notifications" text,
	"website_url" text,
	"duplicate_check_result" text,
	"description_embedding" vector(3072),
	"agent_errors" text,
	"quick_scan_results" text,
	"decision_evaluation" text,
	"quick_scan_id" text,
	"deep_migration_analysis_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pt_estimations" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"total_pt" integer NOT NULL,
	"total_cost" integer,
	"duration_months" integer,
	"phases" text,
	"disciplines" text,
	"timeline" text,
	"start_date" text,
	"end_date" text,
	"risk_buffer" integer,
	"confidence_level" text,
	"assumptions" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "qualification_section_data" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"section_id" text NOT NULL,
	"content" text NOT NULL,
	"confidence" integer,
	"sources" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"status" text DEFAULT 'routed' NOT NULL,
	"customer_name" text NOT NULL,
	"website_url" text,
	"industry" text,
	"project_description" text,
	"budget" text,
	"requirements" text,
	"quick_scan_id" text,
	"decision_makers" text,
	"business_unit_id" text NOT NULL,
	"bl_vote" text,
	"bl_voted_at" timestamp,
	"bl_voted_by_user_id" text,
	"bl_reasoning" text,
	"bl_confidence_score" integer,
	"more_info_requested" boolean DEFAULT false NOT NULL,
	"more_info_requested_at" timestamp,
	"more_info_notes" text,
	"deep_scan_status" text DEFAULT 'pending' NOT NULL,
	"deep_scan_started_at" timestamp,
	"deep_scan_completed_at" timestamp,
	"deep_scan_current_phase" text,
	"deep_scan_completed_experts" text,
	"deep_scan_last_checkpoint" timestamp,
	"deep_scan_error" text,
	"selected_cms_id" text,
	"routed_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quick_scans" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"website_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tech_stack" text,
	"cms" text,
	"framework" text,
	"hosting" text,
	"page_count" integer,
	"content_volume" text,
	"features" text,
	"integrations" text,
	"navigation_structure" text,
	"accessibility_audit" text,
	"seo_audit" text,
	"legal_compliance" text,
	"performance_indicators" text,
	"screenshots" text,
	"company_intelligence" text,
	"site_tree" text,
	"content_types" text,
	"migration_complexity" text,
	"decision_makers" text,
	"ten_questions" text,
	"raw_scan_data" text,
	"recommended_business_unit" text,
	"confidence" integer,
	"reasoning" text,
	"activity_log" text,
	"visualization_tree" text,
	"cms_evaluation" text,
	"cms_evaluation_completed_at" timestamp,
	"timeline" text,
	"timeline_generated_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "raw_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(3072) NOT NULL,
	"metadata" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reference_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"reference_id" text NOT NULL,
	"total_score" integer NOT NULL,
	"tech_stack_score" integer NOT NULL,
	"industry_score" integer NOT NULL,
	"matched_technologies" text,
	"matched_industries" text,
	"reasoning" text,
	"rank" integer NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"validated_by_user_id" text,
	"project_name" text NOT NULL,
	"customer_name" text NOT NULL,
	"industry" text NOT NULL,
	"technologies" text NOT NULL,
	"scope" text NOT NULL,
	"team_size" integer NOT NULL,
	"duration_months" integer NOT NULL,
	"budget_range" text NOT NULL,
	"outcome" text NOT NULL,
	"highlights" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_feedback" text,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "subjective_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"customer_relationship" integer NOT NULL,
	"strategic_importance" integer NOT NULL,
	"win_probability" integer NOT NULL,
	"resource_availability" integer NOT NULL,
	"technical_fit" integer NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"pre_qualification_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"role" text NOT NULL,
	"assigned_at" timestamp,
	"notified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business_unit_id" text NOT NULL,
	"baseline_hours" integer,
	"baseline_name" text,
	"baseline_entity_counts" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"logo_url" text,
	"website_url" text,
	"description" text,
	"category" text,
	"license" text,
	"latest_version" text,
	"github_url" text,
	"github_stars" integer,
	"last_release" text,
	"community_size" text,
	"pros" text,
	"cons" text,
	"usps" text,
	"target_audiences" text,
	"use_cases" text,
	"features" text,
	"adesso_expertise" text,
	"adesso_reference_count" integer,
	"last_researched_at" timestamp,
	"research_status" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'bd' NOT NULL,
	"business_unit_id" text,
	"deleted_at" timestamp,
	"created_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "website_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"website_url" text NOT NULL,
	"homepage" text,
	"cms" text,
	"cms_version" text,
	"framework" text,
	"hosting" text,
	"server" text,
	"tech_stack" text,
	"performance_score" integer,
	"lcp" integer,
	"fid" integer,
	"cls" text,
	"ttfb" integer,
	"performance_bottlenecks" text,
	"accessibility_score" integer,
	"wcag_level" text,
	"a11y_violations" text,
	"a11y_issue_count" integer,
	"estimated_fix_hours" integer,
	"page_count" integer,
	"content_types" text,
	"navigation_structure" text,
	"site_tree" text,
	"content_volume" text,
	"migration_complexity" text,
	"complexity_score" integer,
	"complexity_factors" text,
	"migration_risks" text,
	"screenshots" text,
	"asset_inventory" text,
	"seo_score" integer,
	"seo_issues" text,
	"legal_compliance" text,
	"raw_audit_data" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trails" ADD CONSTRAINT "audit_trails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_comparisons" ADD CONSTRAINT "baseline_comparisons_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_comparisons" ADD CONSTRAINT "baseline_comparisons_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_match_results" ADD CONSTRAINT "cms_match_results_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_match_results" ADD CONSTRAINT "cms_match_results_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_matches" ADD CONSTRAINT "competitor_matches_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_matches" ADD CONSTRAINT "competitor_matches_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_embeddings" ADD CONSTRAINT "deal_embeddings_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_embeddings" ADD CONSTRAINT "deal_embeddings_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_migration_analyses" ADD CONSTRAINT "deep_migration_analyses_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_migration_analyses" ADD CONSTRAINT "deep_migration_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitchdeck_deliverables" ADD CONSTRAINT "pitchdeck_deliverables_pitchdeck_id_pitchdecks_id_fk" FOREIGN KEY ("pitchdeck_id") REFERENCES "public"."pitchdecks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitchdeck_deliverables" ADD CONSTRAINT "pitchdeck_deliverables_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitchdeck_team_members" ADD CONSTRAINT "pitchdeck_team_members_pitchdeck_id_pitchdecks_id_fk" FOREIGN KEY ("pitchdeck_id") REFERENCES "public"."pitchdecks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitchdeck_team_members" ADD CONSTRAINT "pitchdeck_team_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitchdecks" ADD CONSTRAINT "pitchdecks_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitchdecks" ADD CONSTRAINT "pitchdecks_team_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("team_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_qualifications" ADD CONSTRAINT "pre_qualifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_qualifications" ADD CONSTRAINT "pre_qualifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_estimations" ADD CONSTRAINT "pt_estimations_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_section_data" ADD CONSTRAINT "qualification_section_data_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_quick_scan_id_quick_scans_id_fk" FOREIGN KEY ("quick_scan_id") REFERENCES "public"."quick_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_bl_voted_by_user_id_users_id_fk" FOREIGN KEY ("bl_voted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_selected_cms_id_technologies_id_fk" FOREIGN KEY ("selected_cms_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_scans" ADD CONSTRAINT "quick_scans_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_chunks" ADD CONSTRAINT "raw_chunks_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_matches" ADD CONSTRAINT "reference_matches_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_matches" ADD CONSTRAINT "reference_matches_reference_id_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjective_assessments" ADD CONSTRAINT "subjective_assessments_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjective_assessments" ADD CONSTRAINT "subjective_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_pre_qualification_id_pre_qualifications_id_fk" FOREIGN KEY ("pre_qualification_id") REFERENCES "public"."pre_qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_audits" ADD CONSTRAINT "website_audits_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_trails_user_idx" ON "audit_trails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_trails_action_idx" ON "audit_trails" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_trails_entity_type_idx" ON "audit_trails" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_trails_entity_id_idx" ON "audit_trails" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_trails_created_at_idx" ON "audit_trails" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "background_jobs_pre_qualification_idx" ON "background_jobs" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "background_jobs_qualification_idx" ON "background_jobs" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "background_jobs_status_idx" ON "background_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "background_jobs_job_type_idx" ON "background_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "background_jobs_created_at_idx" ON "background_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "baseline_comparisons_qualification_idx" ON "baseline_comparisons" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "baseline_comparisons_technology_idx" ON "baseline_comparisons" USING btree ("technology_id");--> statement-breakpoint
CREATE INDEX "cms_match_results_qualification_idx" ON "cms_match_results" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "cms_match_results_rank_idx" ON "cms_match_results" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "cms_match_results_recommended_idx" ON "cms_match_results" USING btree ("is_recommended");--> statement-breakpoint
CREATE INDEX "competencies_name_idx" ON "competencies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "competencies_status_idx" ON "competencies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "competencies_validated_idx" ON "competencies" USING btree ("is_validated");--> statement-breakpoint
CREATE INDEX "competencies_status_validated_idx" ON "competencies" USING btree ("status","is_validated");--> statement-breakpoint
CREATE INDEX "competitor_matches_qualification_idx" ON "competitor_matches" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "competitor_matches_competitor_idx" ON "competitor_matches" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "competitors_company_name_idx" ON "competitors" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "competitors_status_idx" ON "competitors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "competitors_validated_idx" ON "competitors" USING btree ("is_validated");--> statement-breakpoint
CREATE INDEX "competitors_status_validated_idx" ON "competitors" USING btree ("status","is_validated");--> statement-breakpoint
CREATE INDEX "deal_embeddings_pre_qualification_idx" ON "deal_embeddings" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "deal_embeddings_pre_qualification_chunk_idx" ON "deal_embeddings" USING btree ("pre_qualification_id","chunk_type");--> statement-breakpoint
CREATE INDEX "deal_embeddings_pre_qualification_agent_idx" ON "deal_embeddings" USING btree ("pre_qualification_id","agent_name");--> statement-breakpoint
CREATE INDEX "deal_embeddings_qualification_idx" ON "deal_embeddings" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "deal_embeddings_qualification_agent_idx" ON "deal_embeddings" USING btree ("qualification_id","agent_name");--> statement-breakpoint
CREATE INDEX "deal_embeddings_qualification_category_idx" ON "deal_embeddings" USING btree ("qualification_id","chunk_category");--> statement-breakpoint
CREATE INDEX "documents_pre_qualification_idx" ON "documents" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "employees_business_unit_idx" ON "employees" USING btree ("business_unit_id");--> statement-breakpoint
CREATE INDEX "pitchdeck_deliverables_pitchdeck_idx" ON "pitchdeck_deliverables" USING btree ("pitchdeck_id");--> statement-breakpoint
CREATE INDEX "pitchdeck_deliverables_status_idx" ON "pitchdeck_deliverables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pitchdeck_team_members_pitchdeck_idx" ON "pitchdeck_team_members" USING btree ("pitchdeck_id");--> statement-breakpoint
CREATE INDEX "pitchdeck_team_members_employee_idx" ON "pitchdeck_team_members" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "pitchdecks_qualification_idx" ON "pitchdecks" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "pitchdecks_status_idx" ON "pitchdecks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pre_qualifications_assigned_bu_idx" ON "pre_qualifications" USING btree ("assigned_business_unit_id");--> statement-breakpoint
CREATE INDEX "pre_qualifications_status_idx" ON "pre_qualifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pre_qualifications_user_id_idx" ON "pre_qualifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pt_estimations_qualification_idx" ON "pt_estimations" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "qualification_section_data_qualification_section_idx" ON "qualification_section_data" USING btree ("qualification_id","section_id");--> statement-breakpoint
CREATE INDEX "qualification_section_data_qualification_idx" ON "qualification_section_data" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "qualifications_pre_qualification_idx" ON "qualifications" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "qualifications_status_idx" ON "qualifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qualifications_business_unit_idx" ON "qualifications" USING btree ("business_unit_id");--> statement-breakpoint
CREATE INDEX "qualifications_bl_vote_idx" ON "qualifications" USING btree ("bl_vote");--> statement-breakpoint
CREATE INDEX "quick_scans_pre_qualification_idx" ON "quick_scans" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "raw_chunks_pre_qualification_idx" ON "raw_chunks" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "reference_matches_qualification_idx" ON "reference_matches" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "reference_matches_reference_idx" ON "reference_matches" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "reference_matches_rank_idx" ON "reference_matches" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "references_project_name_idx" ON "references" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "references_status_idx" ON "references" USING btree ("status");--> statement-breakpoint
CREATE INDEX "references_validated_idx" ON "references" USING btree ("is_validated");--> statement-breakpoint
CREATE INDEX "references_status_validated_idx" ON "references" USING btree ("status","is_validated");--> statement-breakpoint
CREATE INDEX "subjective_assessments_pre_qualification_idx" ON "subjective_assessments" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "subjective_assessments_user_idx" ON "subjective_assessments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_assignments_pre_qualification_idx" ON "team_assignments" USING btree ("pre_qualification_id");--> statement-breakpoint
CREATE INDEX "team_assignments_employee_idx" ON "team_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "website_audits_qualification_idx" ON "website_audits" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "website_audits_status_idx" ON "website_audits" USING btree ("status");