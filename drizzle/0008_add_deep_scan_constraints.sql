-- Add CHECK constraints for enum columns

ALTER TABLE "deep_scan_v2_runs"
ADD CONSTRAINT "deep_scan_v2_runs_status_check"
CHECK ("status" IN ('pending', 'running', 'audit_complete', 'generating',
  'waiting_for_user', 'review', 'completed', 'failed', 'cancelled'));

ALTER TABLE "deep_scan_v2_runs"
ADD CONSTRAINT "deep_scan_v2_runs_progress_check"
CHECK ("progress" >= 0 AND "progress" <= 100);

ALTER TABLE "deep_scan_v2_documents"
ADD CONSTRAINT "deep_scan_v2_documents_type_check"
CHECK ("type" IN ('indication', 'calculation', 'presentation', 'proposal'));

ALTER TABLE "deep_scan_v2_documents"
ADD CONSTRAINT "deep_scan_v2_documents_format_check"
CHECK ("format" IN ('html', 'xlsx', 'pptx', 'docx', 'pdf'));

ALTER TABLE "deep_scan_v2_audit_results"
ADD CONSTRAINT "deep_scan_v2_audit_results_audit_type_check"
CHECK ("audit_type" IN ('tech_detection', 'performance', 'accessibility',
  'component_analysis', 'seo', 'security'));
