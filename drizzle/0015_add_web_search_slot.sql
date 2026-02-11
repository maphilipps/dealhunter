-- Migration: Add web-search model slot
-- Date: 2026-02-11

-- 1. Extend the slot enum type to include 'web-search'
DO $$ BEGIN
  -- Check if the enum value already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'web-search'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ai_model_slot_configs_slot')
  ) THEN
    -- Add 'web-search' to the enum
    ALTER TYPE "ai_model_slot_configs_slot" ADD VALUE 'web-search';
  END IF;
END $$;

-- 2. Insert the web-search slot (only if it doesn't exist)
DO $$
DECLARE
  openai_provider_id TEXT;
BEGIN
  -- Get OpenAI provider ID
  SELECT id INTO openai_provider_id
  FROM ai_provider_configs
  WHERE provider_key = 'openai'
  LIMIT 1;

  -- Only insert if the slot doesn't exist and we have an OpenAI provider
  IF openai_provider_id IS NOT NULL THEN
    INSERT INTO ai_model_slot_configs (id, slot, provider_id, model_name, is_overridden, created_at, updated_at)
    SELECT
      gen_random_uuid()::text,
      'web-search',
      openai_provider_id,
      'gpt-4o-mini',
      false,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_model_slot_configs WHERE slot = 'web-search'
    );
  END IF;
END $$;
