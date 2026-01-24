#!/bin/bash
set -e

# Configuration
FEATURE_NAME="dea-138-lead-detail"
BRANCH_NAME="feature-$FEATURE_NAME"
WORKTREE_PATH=".worktrees/$BRANCH_NAME"
PRD_FILE="EPICS/DEA-138-prd-items.json"
MAX_ITERATIONS=50
SLEEP_BETWEEN=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         RALPH PRD AUTONOMOUS WORKFLOW                      ║${NC}"
echo -e "${BLUE}║         DEA-138: Lead Detail Page Redesign                 ║${NC}"
echo -e "${BLUE}║         Working in isolated Git Worktree                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

# Store original directory
ORIGINAL_DIR=$(pwd)

# Setup worktree
setup_worktree() {
  echo -e "${CYAN}Setting up Git Worktree...${NC}"

  # Check if worktree already exists
  if [ -d "$WORKTREE_PATH" ]; then
    echo -e "${GREEN}✓ Worktree already exists at $WORKTREE_PATH${NC}"
  else
    # Check if branch exists
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
      echo -e "${YELLOW}Branch $BRANCH_NAME exists, creating worktree...${NC}"
      git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
    else
      echo -e "${YELLOW}Creating new branch and worktree...${NC}"
      git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main
    fi
    echo -e "${GREEN}✓ Worktree created at $WORKTREE_PATH${NC}"
  fi

  # Change to worktree directory
  cd "$WORKTREE_PATH"
  echo -e "${GREEN}✓ Working directory: $(pwd)${NC}"

  # Install dependencies if needed
  if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
  fi
}

# Cleanup function
cleanup() {
  echo -e "${CYAN}Returning to original directory...${NC}"
  cd "$ORIGINAL_DIR"
}

trap cleanup EXIT

# Function to count passing and failing items
count_items() {
  local passing=$(jq '[.items[] | select(.passes == true)] | length' "$PRD_FILE")
  local failing=$(jq '[.items[] | select(.passes == false)] | length' "$PRD_FILE")
  local total=$(jq '.items | length' "$PRD_FILE")
  echo "$passing $failing $total"
}

# Function to get next failing item
get_next_failing_item() {
  jq -r '.items[] | select(.passes == false) | "\(.id)|\(.category)|\(.description)"' "$PRD_FILE" | head -1
}

# Function to get item details by ID
get_item_details() {
  local item_id="$1"
  jq -r --arg id "$item_id" '.items[] | select(.id == $id)' "$PRD_FILE"
}

# Setup worktree first
setup_worktree

# Check if PRD file exists in worktree
if [ ! -f "$PRD_FILE" ]; then
  echo -e "${RED}ERROR: PRD file not found: $PRD_FILE${NC}"
  echo -e "${YELLOW}Copying from main worktree...${NC}"
  mkdir -p "$(dirname $PRD_FILE)"
  cp "$ORIGINAL_DIR/$PRD_FILE" "$PRD_FILE"
fi

iteration=0

while [ $iteration -lt $MAX_ITERATIONS ]; do
  iteration=$((iteration + 1))

  # Get current status
  read passing failing total <<< $(count_items)

  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  ITERATION $iteration / $MAX_ITERATIONS${NC}"
  echo -e "${YELLOW}  Branch: $BRANCH_NAME${NC}"
  echo -e "${YELLOW}  Status: ${GREEN}$passing PASSING${NC} | ${RED}$failing FAILING${NC} | Total: $total${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

  # Check if all items pass
  if [ "$failing" -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    ALL ITEMS PASS!                         ║${NC}"
    echo -e "${GREEN}║              PRD Implementation Complete                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

    echo ""
    echo -e "${CYAN}Creating Pull Request...${NC}"

    # Push branch and create PR
    git push -u origin "$BRANCH_NAME" 2>/dev/null || git push origin "$BRANCH_NAME"

    # Check if gh CLI is available
    if command -v gh &> /dev/null; then
      gh pr create \
        --title "feat(DEA-138): Lead Detail Page Redesign - Deep Scan Navigation & RAG Integration" \
        --body "## Summary
- Implemented all 40 PRD acceptance criteria items
- Added LeadSidebarRight with 13 hierarchical sections
- Deep Scan Orchestrator with parallel agents
- RAG integration for all sections
- Web Research with Exa API + fallback
- All verification steps pass

## PRD Items Completed
$(jq -r '.items[] | "- [x] \(.id): \(.description)"' "$PRD_FILE")

---
🤖 Generated with Ralph PRD Autonomous Workflow
Linear Issue: https://linear.app/adessocms/issue/DEA-138" \
        --base main \
        --head "$BRANCH_NAME" || echo -e "${YELLOW}PR may already exist${NC}"
    else
      echo -e "${YELLOW}gh CLI not found, please create PR manually${NC}"
      echo -e "Branch: $BRANCH_NAME"
    fi

    exit 0
  fi

  # Get next failing item
  next_item=$(get_next_failing_item)
  item_id=$(echo "$next_item" | cut -d'|' -f1)
  item_category=$(echo "$next_item" | cut -d'|' -f2)
  item_description=$(echo "$next_item" | cut -d'|' -f3)

  echo ""
  echo -e "${BLUE}Working on: $item_id${NC}"
  echo -e "Category: $item_category"
  echo -e "Description: $item_description"
  echo ""

  # Get full item details as JSON
  item_json=$(get_item_details "$item_id")
  steps=$(echo "$item_json" | jq -r '.stepsToVerify | map("  - " + .) | join("\n")')

  # Get test URL from PRD
  test_url=$(jq -r '.testUrl' "$PRD_FILE")

  # Run Claude to implement and verify this PRD item
  result=$(claude --dangerously-skip-permissions -p "
**PRD ITEM IMPLEMENTATION TASK**

You are working in a Git Worktree at: $(pwd)
Branch: $BRANCH_NAME
Linear Issue: https://linear.app/adessocms/issue/DEA-138

Your task is to:
1. IMPLEMENT the feature if not already implemented
2. VERIFY all steps pass
3. UPDATE the PRD JSON file marking this item as passes: true (if all steps verify)

**PRD Item Details:**
- ID: $item_id
- Category: $item_category
- Description: $item_description
- Steps to Verify:
$steps

**PRD File Location:** $PRD_FILE
**Test URL:** $test_url

**WORKFLOW:**

1. **Read existing code first** - Check what already exists in the codebase
   - For Layout items: Check app/(dashboard)/leads/[id]/layout.tsx
   - For Navigation items: Check components/leads/lead-sidebar-right.tsx
   - For Section pages: Check app/(dashboard)/leads/[id]/<section>/page.tsx
   - For RAG: Check lib/rag/query-service.ts
   - For Schema: Check lib/db/schema.ts

2. **Implement missing pieces** - Only add what's needed
   - Use ShadCN components (Sidebar, Card, Collapsible, etc.)
   - Follow existing patterns in the codebase
   - Keep changes minimal and focused

3. **Verify each step** - Use browser automation:
   - Use d3k (dev3000) MCP tools for testing
   - agent_browser_action for navigation and verification
   - take_screenshot for visual verification
   - Check console for errors

4. **Update PRD file** - If ALL verification steps pass:
   - Read the current $PRD_FILE
   - Find item with id '$item_id'
   - Set passes: true
   - Write back the updated JSON
   - If any step fails, leave passes: false and explain what's missing

5. **Commit changes** - If implementation was needed:
   - git add .
   - git commit -m 'feat(DEA-138): $item_id - $item_description'

**IMPORTANT RULES:**
- ONLY work on this ONE item ($item_id)
- You are in a WORKTREE - commit directly to this branch
- Read existing code BEFORE writing new code
- Use existing components and patterns
- Don't over-engineer - minimal changes only
- If the feature already works, just verify and update JSON
- Output '<ITEM_COMPLETE>' when done with this item
- Output '<ITEM_FAILED>' if verification fails (explain why)

**Current PRD JSON content:**
$(cat $PRD_FILE)
")

  echo "$result"

  # Check if item was completed
  if echo "$result" | grep -q "<ITEM_COMPLETE>"; then
    echo -e "${GREEN}✓ $item_id completed successfully${NC}"
  elif echo "$result" | grep -q "<ITEM_FAILED>"; then
    echo -e "${RED}✗ $item_id failed verification${NC}"
  fi

  # Update progress.txt
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Iteration $iteration - $item_id ($item_category) - Branch: $BRANCH_NAME" >> progress.txt

  # Short pause between iterations
  echo ""
  echo -e "${YELLOW}Sleeping ${SLEEP_BETWEEN}s before next iteration...${NC}"
  sleep $SLEEP_BETWEEN

done

echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          MAX ITERATIONS REACHED ($MAX_ITERATIONS)                      ║${NC}"
echo -e "${RED}║          Some items may still be failing                   ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"

# Final status
read passing failing total <<< $(count_items)
echo -e "Final Status: ${GREEN}$passing PASSING${NC} | ${RED}$failing FAILING${NC} | Total: $total"
echo -e "Branch: $BRANCH_NAME"
echo -e "You can continue manually with: cd $WORKTREE_PATH"

exit 1
