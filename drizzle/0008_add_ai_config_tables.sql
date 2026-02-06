-- AI Provider & Model Slot Configuration Tables
-- These tables may already exist from the deep-scan-v2 branch.
-- Using IF NOT EXISTS to be safe.

CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_key" text NOT NULL,
  "api_key" text,
  "base_url" text,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp,
  CONSTRAINT "ai_provider_configs_provider_key_unique" UNIQUE("provider_key")
);

CREATE TABLE IF NOT EXISTS "ai_model_slot_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "slot" text NOT NULL,
  "provider_id" text NOT NULL REFERENCES "ai_provider_configs"("id"),
  "model_name" text NOT NULL,
  "is_overridden" boolean DEFAULT false NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp,
  CONSTRAINT "ai_model_slot_configs_slot_unique" UNIQUE("slot")
);
