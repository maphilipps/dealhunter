-- Initialize web-search model slot
-- Run with: psql $DATABASE_URL -f scripts/init-web-search-slot.sql

-- Check if slot already exists
DO $$
DECLARE
  slot_exists BOOLEAN;
  openai_provider_id TEXT;
BEGIN
  -- Check if web-search slot exists
  SELECT EXISTS(SELECT 1 FROM ai_model_slot_configs WHERE slot = 'web-search') INTO slot_exists;

  IF slot_exists THEN
    RAISE NOTICE 'web-search slot already exists';
  ELSE
    -- Get OpenAI provider ID
    SELECT id INTO openai_provider_id FROM ai_provider_configs WHERE provider_key = 'openai' LIMIT 1;

    IF openai_provider_id IS NULL THEN
      RAISE EXCEPTION 'OpenAI provider not found. Please seed ai_provider_configs first.';
    END IF;

    -- Insert web-search slot
    INSERT INTO ai_model_slot_configs (id, slot, provider_id, model_name, is_overridden, created_at, updated_at)
    VALUES (
      gen_random_uuid()::text,
      'web-search',
      openai_provider_id,
      'gpt-4o-mini',
      false,
      NOW(),
      NOW()
    );

    RAISE NOTICE 'web-search slot created successfully (provider: openai, model: gpt-4o-mini)';
  END IF;
END $$;
