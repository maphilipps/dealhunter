-- Qualifications Scan 2.0: Rename tables, columns, and status values
-- All renames are metadata-only operations in PostgreSQL (instant)

-- ═══════════════════════════════════════════════════════════════════
-- TABLE RENAMES
-- ═══════════════════════════════════════════════════════════════════

-- Lead Scan → Qualification Scan
ALTER TABLE lead_scans RENAME TO qualification_scans;

-- Pitch Scan Runs → Audit Scan Runs
ALTER TABLE pitch_scan_runs RENAME TO audit_scan_runs;

-- Pitch Scan Results → Audit Scan Results
ALTER TABLE pitch_scan_results RENAME TO audit_scan_results;

-- ═══════════════════════════════════════════════════════════════════
-- COLUMN RENAMES
-- ═══════════════════════════════════════════════════════════════════

-- pre_qualifications: lead_scan_id → qualification_scan_id
ALTER TABLE pre_qualifications RENAME COLUMN lead_scan_id TO qualification_scan_id;

-- pre_qualifications: lead_scan_results → qualification_scan_results
ALTER TABLE pre_qualifications RENAME COLUMN lead_scan_results TO qualification_scan_results;

-- pitches: lead_scan_id → qualification_scan_id
ALTER TABLE pitches RENAME COLUMN lead_scan_id TO qualification_scan_id;

-- ═══════════════════════════════════════════════════════════════════
-- STATUS VALUE UPDATES
-- ═══════════════════════════════════════════════════════════════════

-- pre_qualifications status: lead_scanning → qualification_scanning
UPDATE pre_qualifications SET status = 'qualification_scanning' WHERE status = 'lead_scanning';
UPDATE pre_qualifications SET status = 'qualification_scan_failed' WHERE status = 'lead_scan_failed';

-- pitches status: pitch_scanning → audit_scanning
UPDATE pitches SET status = 'audit_scanning' WHERE status = 'pitch_scanning';

-- ═══════════════════════════════════════════════════════════════════
-- BACKGROUND JOBS
-- ═══════════════════════════════════════════════════════════════════

-- Update jobType
UPDATE background_jobs SET job_type = 'qualification-scan' WHERE job_type = 'lead-scan';
