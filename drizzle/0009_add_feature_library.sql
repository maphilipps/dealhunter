CREATE TABLE IF NOT EXISTS "features" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "category" text NOT NULL DEFAULT 'functional',
  "description" text,
  "priority" integer NOT NULL DEFAULT 50,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "features_slug_unique" UNIQUE("slug")
);

CREATE INDEX IF NOT EXISTS "features_slug_idx" ON "features" ("slug");
CREATE INDEX IF NOT EXISTS "features_active_idx" ON "features" ("is_active");
CREATE INDEX IF NOT EXISTS "features_category_idx" ON "features" ("category");

