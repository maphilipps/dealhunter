-- Add composite indexes for common query patterns on deep_scan_v2_runs table
-- These indexes optimize list queries that filter by userId+status or preQualificationId+status

CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_user_status_idx"
ON "deep_scan_v2_runs" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_prequal_status_idx"
ON "deep_scan_v2_runs" ("pre_qualification_id", "status");

CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_bullmq_job_idx"
ON "deep_scan_v2_runs" ("bullmq_job_id")
WHERE "bullmq_job_id" IS NOT NULL;
