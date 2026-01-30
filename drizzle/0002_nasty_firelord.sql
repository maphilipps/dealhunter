CREATE TABLE "audit_results_v2" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"website_url" text NOT NULL,
	"tech_stack" text,
	"performance" text,
	"accessibility" text,
	"architecture" text,
	"hosting" text,
	"integrations" text,
	"component_library" text,
	"screenshots" text,
	"performance_score" integer,
	"accessibility_score" integer,
	"migration_complexity" text,
	"complexity_score" integer,
	"share_token" text,
	"share_expires_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp,
	CONSTRAINT "audit_results_v2_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "deep_scan_v2_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"tool_calls" text,
	"tool_results" text,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deep_scan_v2_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"document_type" text NOT NULL,
	"format" text NOT NULL,
	"cms_variant" text,
	"technology_id" text,
	"content" text,
	"file_data" text,
	"file_name" text,
	"file_size" integer,
	"confidence" integer,
	"flags" text,
	"generated_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deep_scan_v2_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_number" integer DEFAULT 1 NOT NULL,
	"snapshot_data" text,
	"target_cms_ids" text,
	"selected_cms_id" text,
	"current_phase" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"completed_agents" text,
	"failed_agents" text,
	"agent_confidences" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"token_count" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_file_name" text,
	"source_file_id" text,
	"embedding" vector(3072),
	"industry" text,
	"use_case" text,
	"cms" text,
	"phase" text,
	"document_type" text,
	"effort_range" text,
	"confidence" integer DEFAULT 50 NOT NULL,
	"business_unit" text,
	"customer_size" text,
	"project_volume" text,
	"contract_type" text,
	"region" text,
	"competitor_context" text,
	"legal_requirements" text,
	"accessibility_level" text,
	"hosting_model" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pitch_audit_results" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"website_url" text NOT NULL,
	"tech_stack" text,
	"performance" text,
	"accessibility" text,
	"architecture" text,
	"hosting" text,
	"integrations" text,
	"component_library" text,
	"screenshots" text,
	"performance_score" integer,
	"accessibility_score" integer,
	"migration_complexity" text,
	"complexity_score" integer,
	"share_token" text,
	"share_expires_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp,
	CONSTRAINT "pitch_audit_results_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "pitch_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"tool_calls" text,
	"tool_results" text,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pitch_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"document_type" text NOT NULL,
	"format" text NOT NULL,
	"cms_variant" text,
	"technology_id" text,
	"content" text,
	"file_data" text,
	"file_name" text,
	"file_size" integer,
	"confidence" integer,
	"flags" text,
	"generated_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pitch_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"qualification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_number" integer DEFAULT 1 NOT NULL,
	"snapshot_data" text,
	"target_cms_ids" text,
	"selected_cms_id" text,
	"current_phase" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"completed_agents" text,
	"failed_agents" text,
	"agent_confidences" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "audit_results_v2" ADD CONSTRAINT "audit_results_v2_run_id_deep_scan_v2_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."deep_scan_v2_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_results_v2" ADD CONSTRAINT "audit_results_v2_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_conversations" ADD CONSTRAINT "deep_scan_v2_conversations_run_id_deep_scan_v2_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."deep_scan_v2_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_conversations" ADD CONSTRAINT "deep_scan_v2_conversations_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_documents" ADD CONSTRAINT "deep_scan_v2_documents_run_id_deep_scan_v2_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."deep_scan_v2_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_documents" ADD CONSTRAINT "deep_scan_v2_documents_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_documents" ADD CONSTRAINT "deep_scan_v2_documents_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_runs" ADD CONSTRAINT "deep_scan_v2_runs_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_runs" ADD CONSTRAINT "deep_scan_v2_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_scan_v2_runs" ADD CONSTRAINT "deep_scan_v2_runs_selected_cms_id_technologies_id_fk" FOREIGN KEY ("selected_cms_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_audit_results" ADD CONSTRAINT "pitch_audit_results_run_id_pitch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pitch_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_audit_results" ADD CONSTRAINT "pitch_audit_results_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_conversations" ADD CONSTRAINT "pitch_conversations_run_id_pitch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pitch_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_conversations" ADD CONSTRAINT "pitch_conversations_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_run_id_pitch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pitch_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_runs" ADD CONSTRAINT "pitch_runs_qualification_id_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_runs" ADD CONSTRAINT "pitch_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_runs" ADD CONSTRAINT "pitch_runs_selected_cms_id_technologies_id_fk" FOREIGN KEY ("selected_cms_id") REFERENCES "public"."technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_v2_run_idx" ON "audit_results_v2" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "audit_v2_qualification_idx" ON "audit_results_v2" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "audit_v2_share_token_idx" ON "audit_results_v2" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "dsv2_conv_run_idx" ON "deep_scan_v2_conversations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "dsv2_conv_qualification_idx" ON "deep_scan_v2_conversations" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "dsv2_conv_sequence_idx" ON "deep_scan_v2_conversations" USING btree ("run_id","sequence_number");--> statement-breakpoint
CREATE INDEX "dsv2_docs_run_idx" ON "deep_scan_v2_documents" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "dsv2_docs_qualification_idx" ON "deep_scan_v2_documents" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "dsv2_docs_type_idx" ON "deep_scan_v2_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "dsv2_runs_qualification_idx" ON "deep_scan_v2_runs" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "dsv2_runs_status_idx" ON "deep_scan_v2_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dsv2_runs_user_idx" ON "deep_scan_v2_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_hash_idx" ON "knowledge_chunks" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_cms_idx" ON "knowledge_chunks" USING btree ("cms");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_industry_idx" ON "knowledge_chunks" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_type_idx" ON "knowledge_chunks" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_bu_idx" ON "knowledge_chunks" USING btree ("business_unit");--> statement-breakpoint
CREATE INDEX "pitch_audit_run_idx" ON "pitch_audit_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "pitch_audit_qualification_idx" ON "pitch_audit_results" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "pitch_audit_share_token_idx" ON "pitch_audit_results" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "pitch_conv_run_idx" ON "pitch_conversations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "pitch_conv_qualification_idx" ON "pitch_conversations" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "pitch_conv_sequence_idx" ON "pitch_conversations" USING btree ("run_id","sequence_number");--> statement-breakpoint
CREATE INDEX "pitch_docs_run_idx" ON "pitch_documents" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "pitch_docs_qualification_idx" ON "pitch_documents" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "pitch_docs_type_idx" ON "pitch_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "pitch_runs_qualification_idx" ON "pitch_runs" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "pitch_runs_status_idx" ON "pitch_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pitch_runs_user_idx" ON "pitch_runs" USING btree ("user_id");