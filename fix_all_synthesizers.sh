#!/bin/bash

# Fix all 7 Section Synthesizers to use correct pattern

FILES=(
  "lib/agents/section-synthesizers/cms-architecture-synthesizer.ts"
  "lib/agents/section-synthesizers/cms-comparison-synthesizer.ts"
  "lib/agents/section-synthesizers/hosting-synthesizer.ts"
  "lib/agents/section-synthesizers/integrations-synthesizer.ts"
  "lib/agents/section-synthesizers/migration-synthesizer.ts"
  "lib/agents/section-synthesizers/costs-synthesizer.ts"
  "lib/agents/section-synthesizers/decision-synthesizer.ts"
)

echo "Fixing synthesizer patterns..."

for file in "${FILES[@]}"; do
  echo "Processing: $file"

  # 1. Remove incorrect ai('openai') line
  sed -i '' '/const openai = ai/d' "$file"

  # 2. Replace generateObject call with generateContent + manual parsing
  # This is complex, so we'll do it in multiple steps

  # First, find the line with 'const result = await openai.generateObject'
  # and replace it with generateContent pattern

  # Replace sources mapping: r.id → r.chunkId
  sed -i '' 's/chunkId: r\.id,/chunkId: r.chunkId,/g' "$file"

  # Remove ragChunksUsed from return metadata
  sed -i '' '/ragChunksUsed: ragResults\.length,/d' "$file"

  echo "  ✓ Fixed basic patterns"
done

echo "✅ Basic patterns fixed. Now need to manually replace generateObject() calls..."
