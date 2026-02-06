-- Lead Scan: Rename quickScans → leadScans
ALTER TABLE quick_scans RENAME TO lead_scans;

-- Pitch Scan: Rename pitchRuns → pitchScanRuns
ALTER TABLE pitch_runs RENAME TO pitch_scan_runs;

-- Pitch Scan: Rename pitchAuditResults → pitchScanResults
ALTER TABLE pitch_audit_results RENAME TO pitch_scan_results;

-- Update FK columns
ALTER TABLE pre_qualifications RENAME COLUMN quick_scan_id TO lead_scan_id;
ALTER TABLE pitches RENAME COLUMN quick_scan_id TO lead_scan_id;

-- Update status values
UPDATE pre_qualifications SET status = 'lead_scanning' WHERE status = 'quick_scanning';
UPDATE pre_qualifications SET status = 'lead_scan_failed' WHERE status = 'quick_scan_failed';
UPDATE pitches SET status = 'pitch_scanning' WHERE status = 'full_scanning';

-- Rename quickScanResults column in preQualifications
ALTER TABLE pre_qualifications RENAME COLUMN quick_scan_results TO lead_scan_results;

-- Update backgroundJobs jobType
UPDATE background_jobs SET job_type = 'lead-scan' WHERE job_type = 'quick-scan';
