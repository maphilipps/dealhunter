-- Migration: Rename qualifications → pitches (namespace alignment)
-- This renames tables and columns to match the new "pitch" terminology.

-- Step 1: Rename main tables
ALTER TABLE "qualifications" RENAME TO "pitches";--> statement-breakpoint
ALTER TABLE "qualification_section_data" RENAME TO "pitch_section_data";--> statement-breakpoint

-- Step 2: Rename qualification_id → pitch_id in all tables
ALTER TABLE "background_jobs" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "baseline_comparisons" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "cms_match_results" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "competitor_matches" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "deal_embeddings" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pitchdecks" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pt_estimations" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pitch_section_data" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "reference_matches" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "website_audits" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint

-- Step 3: Rename qualification_id → pitch_id in pitch-specific tables (from migration 0002)
ALTER TABLE "audit_results_v2" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pitch_audit_results" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pitch_conversations" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pitch_documents" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint
ALTER TABLE "pitch_runs" RENAME COLUMN "qualification_id" TO "pitch_id";--> statement-breakpoint

-- Step 4: Drop removed deep_scan columns from pitches table
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_status";--> statement-breakpoint
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_started_at";--> statement-breakpoint
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_completed_at";--> statement-breakpoint
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_current_phase";--> statement-breakpoint
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_completed_experts";--> statement-breakpoint
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_last_checkpoint";--> statement-breakpoint
ALTER TABLE "pitches" DROP COLUMN IF EXISTS "deep_scan_error";--> statement-breakpoint

-- Step 5: Drop removed deep_scan_v2 tables (CASCADE for FK dependencies)
DROP TABLE IF EXISTS "deep_scan_v2_conversations";--> statement-breakpoint
DROP TABLE IF EXISTS "deep_scan_v2_documents";--> statement-breakpoint
DROP TABLE IF EXISTS "deep_scan_v2_runs" CASCADE;--> statement-breakpoint

-- Step 6: Remove deep-scan job types from background_jobs enum
-- (PostgreSQL doesn't support ALTER TYPE DROP VALUE, so we leave the enum as-is.
-- The old values simply won't be used anymore.)
