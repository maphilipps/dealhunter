-- Add ON DELETE CASCADE to pitch scan tables so deleting a pitch cleans up related data

-- audit_scan_runs.pitch_id → pitches.id
ALTER TABLE "audit_scan_runs" DROP CONSTRAINT "audit_scan_runs_pitch_id_pitches_id_fk";
ALTER TABLE "audit_scan_runs" ADD CONSTRAINT "audit_scan_runs_pitch_id_pitches_id_fk"
  FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;

-- audit_scan_results.pitch_id → pitches.id
ALTER TABLE "audit_scan_results" DROP CONSTRAINT "audit_scan_results_pitch_id_pitches_id_fk";
ALTER TABLE "audit_scan_results" ADD CONSTRAINT "audit_scan_results_pitch_id_pitches_id_fk"
  FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;

-- audit_scan_results.run_id → audit_scan_runs.id
ALTER TABLE "audit_scan_results" DROP CONSTRAINT "audit_scan_results_run_id_audit_scan_runs_id_fk";
ALTER TABLE "audit_scan_results" ADD CONSTRAINT "audit_scan_results_run_id_audit_scan_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "audit_scan_runs"("id") ON DELETE CASCADE;

-- pitch_documents.pitch_id → pitches.id
ALTER TABLE "pitch_documents" DROP CONSTRAINT "pitch_documents_pitch_id_pitches_id_fk";
ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_pitch_id_pitches_id_fk"
  FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;

-- pitch_documents.run_id → audit_scan_runs.id
ALTER TABLE "pitch_documents" DROP CONSTRAINT "pitch_documents_run_id_audit_scan_runs_id_fk";
ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_run_id_audit_scan_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "audit_scan_runs"("id") ON DELETE CASCADE;
