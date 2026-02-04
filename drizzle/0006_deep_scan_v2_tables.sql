-- Deep Scan v2 Tables Migration
-- Created: 2026-02-04
-- Description: Add tables for Deep Scan v2 agent-native architecture

-- Main run tracking table
CREATE TABLE IF NOT EXISTS "deep_scan_v2_runs" (
    "id" text PRIMARY KEY NOT NULL,
    "pre_qualification_id" text NOT NULL REFERENCES "pre_qualifications"("id"),
    "user_id" text NOT NULL REFERENCES "users"("id"),
    "website_url" text NOT NULL,
    "target_cms_ids" text,
    "interview_results" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "current_phase" text,
    "current_agent" text,
    "checkpoint" text,
    "pending_question" text,
    "audit_results" text,
    "analysis_results" text,
    "confidence" integer,
    "activity_log" text,
    "error_message" text,
    "error_details" text,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "bullmq_job_id" text,
    "started_at" timestamp,
    "completed_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Indexes for deep_scan_v2_runs
CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_pre_qualification_idx" ON "deep_scan_v2_runs" ("pre_qualification_id");
CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_user_idx" ON "deep_scan_v2_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_status_idx" ON "deep_scan_v2_runs" ("status");
CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_created_at_idx" ON "deep_scan_v2_runs" ("created_at");

-- Generated documents table
CREATE TABLE IF NOT EXISTS "deep_scan_v2_documents" (
    "id" text PRIMARY KEY NOT NULL,
    "run_id" text NOT NULL REFERENCES "deep_scan_v2_runs"("id") ON DELETE CASCADE,
    "type" text NOT NULL,
    "format" text NOT NULL,
    "title" text NOT NULL,
    "storage_path" text,
    "public_url" text,
    "public_url_expires_at" timestamp,
    "version" integer DEFAULT 1 NOT NULL,
    "metadata" text,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Indexes for deep_scan_v2_documents
CREATE INDEX IF NOT EXISTS "deep_scan_v2_documents_run_idx" ON "deep_scan_v2_documents" ("run_id");
CREATE INDEX IF NOT EXISTS "deep_scan_v2_documents_type_idx" ON "deep_scan_v2_documents" ("type");

-- Audit results table
CREATE TABLE IF NOT EXISTS "deep_scan_v2_audit_results" (
    "id" text PRIMARY KEY NOT NULL,
    "run_id" text NOT NULL REFERENCES "deep_scan_v2_runs"("id") ON DELETE CASCADE,
    "audit_type" text NOT NULL,
    "results" text NOT NULL,
    "score" integer,
    "confidence" integer,
    "sources" text,
    "methodology" text,
    "started_at" timestamp,
    "completed_at" timestamp,
    "created_at" timestamp DEFAULT now()
);

-- Indexes for deep_scan_v2_audit_results
CREATE INDEX IF NOT EXISTS "deep_scan_v2_audit_results_run_idx" ON "deep_scan_v2_audit_results" ("run_id");
CREATE INDEX IF NOT EXISTS "deep_scan_v2_audit_results_audit_type_idx" ON "deep_scan_v2_audit_results" ("audit_type");
