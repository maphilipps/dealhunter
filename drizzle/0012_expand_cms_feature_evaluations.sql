-- Expand cms_feature_evaluations with additional columns for full feature library support
ALTER TABLE "cms_feature_evaluations" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "cms_feature_evaluations" ADD COLUMN IF NOT EXISTS "support_type" text;
ALTER TABLE "cms_feature_evaluations" ADD COLUMN IF NOT EXISTS "module_name" text;
ALTER TABLE "cms_feature_evaluations" ADD COLUMN IF NOT EXISTS "source_urls" text;
ALTER TABLE "cms_feature_evaluations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "cms_feature_evaluations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
