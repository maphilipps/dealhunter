CREATE TABLE IF NOT EXISTS "cms_feature_evaluations" (
  "id" text PRIMARY KEY NOT NULL,
  "feature_id" text NOT NULL REFERENCES "features"("id"),
  "technology_id" text NOT NULL REFERENCES "technologies"("id"),
  "score" integer NOT NULL,
  "reasoning" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_feature_eval_feature_tech_unique_idx"
  ON "cms_feature_evaluations" ("feature_id", "technology_id");

CREATE INDEX IF NOT EXISTS "cms_feature_eval_expires_idx" ON "cms_feature_evaluations" ("expires_at");
CREATE INDEX IF NOT EXISTS "cms_feature_eval_tech_idx" ON "cms_feature_evaluations" ("technology_id");

