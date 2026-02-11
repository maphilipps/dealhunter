-- Migration: Add web-search model slot (v2 - fixed for CHECK constraint)
-- Date: 2026-02-11

-- 1. Drop old CHECK constraint and create new one with 'web-search'
DO $$ BEGIN
  -- Drop existing constraint if exists
  ALTER TABLE ai_model_slot_configs DROP CONSTRAINT IF EXISTS ai_model_slot_configs_slot_check;

  -- Add new constraint with 'web-search' included
  ALTER TABLE ai_model_slot_configs
  ADD CONSTRAINT ai_model_slot_configs_slot_check
  CHECK (slot IN ('fast', 'default', 'quality', 'premium', 'synthesizer', 'research', 'vision', 'embedding', 'web-search'));
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

    RAISE NOTICE 'web-search slot created successfully (provider: openai, model: gpt-4o-mini)';
  ELSE
    RAISE NOTICE 'OpenAI provider not found - skipping slot creation';
  END IF;
END $$;
