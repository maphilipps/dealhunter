#!/bin/bash
set -e

PRD_FILE="EPICS/DEA-136-prd-items.json"
MAX_ITERATIONS=50

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PRD Runner - DEA-136: RFP Sidebar Right Navigation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed.${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Check if PRD file exists
if [ ! -f "$PRD_FILE" ]; then
    echo -e "${RED}Error: PRD file not found: $PRD_FILE${NC}"
    exit 1
fi

# Function to count passing/failing items
count_status() {
    local passing=$(jq '[.items[] | select(.passes == true)] | length' "$PRD_FILE")
    local failing=$(jq '[.items[] | select(.passes == false)] | length' "$PRD_FILE")
    local total=$(jq '.items | length' "$PRD_FILE")
    echo "$passing $failing $total"
}

# Function to get next failing item
get_next_failing() {
    jq -r '.items[] | select(.passes == false) | .id' "$PRD_FILE" | head -1
}

# Function to get item details
get_item_details() {
    local id=$1
    jq -r --arg id "$id" '.items[] | select(.id == $id) | "\(.category): \(.description)"' "$PRD_FILE"
}

# Main loop
iteration=1
while [ $iteration -le $MAX_ITERATIONS ]; do
    read -r passing failing total <<< $(count_status)

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Iteration $iteration / $MAX_ITERATIONS${NC}"
    echo -e "${GREEN}  Passing: $passing${NC} | ${RED}Failing: $failing${NC} | Total: $total"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

    # Check if all passing
    if [ "$failing" -eq 0 ]; then
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✅ ALL PRD ITEMS PASSED! Feature complete.${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        exit 0
    fi

    # Get next failing item
    next_item=$(get_next_failing)
    item_details=$(get_item_details "$next_item")

    echo ""
    echo -e "${YELLOW}Next item to work on: ${NC}$next_item"
    echo -e "${YELLOW}Details: ${NC}$item_details"
    echo ""

    # Run Claude to implement/fix the item
    result=$(claude --dangerously-skip-permissions -p "
**PRD ITEM IMPLEMENTATION WORKFLOW**

You are working on feature DEA-136: RFP Detail - Sidebar Right Navigation.

**Current PRD Item to implement/fix:**
- ID: $next_item
- Details: $item_details

**Your task:**

1. **Read the PRD file** to get full item details:
   - File: $PRD_FILE
   - Find item with id '$next_item'
   - Read the 'stepsToVerify' array

2. **Implement or fix** whatever is needed for this item to pass:
   - If it's a Layout item: create/modify layout files
   - If it's a Navigation item: create/modify sidebar components
   - If it's an Unterseite item: create the page file
   - If it's a Component item: create the component
   - If it's Code Quality: fix errors
   - If it's Performance: optimize

3. **Reference files for context:**
   - Lead Layout (reference): /app/(dashboard)/leads/[id]/layout.tsx
   - Lead Sidebar Right (reference): /components/leads/lead-sidebar-right.tsx
   - Existing RFP page: /app/(dashboard)/rfps/[id]/page.tsx

4. **Verify** by checking if implementation matches stepsToVerify

5. **Update PRD file** - Set passes to true ONLY if ALL stepsToVerify can be confirmed:
   - Read the current PRD JSON
   - Update the specific item's 'passes' field to true
   - Write back the entire JSON

6. **If you cannot complete the item**, leave passes as false and explain why

**CRITICAL RULES:**
- Work on ONLY this ONE item per iteration
- Read existing code before making changes
- Use ShadCN components (check examples with MCP)
- Follow the Lead page structure as reference
- Update the PRD JSON file when done
- If build fails, fix it before marking as passed

**Working Directory:** /Users/marc.philipps/Sites/dealhunter/.worktrees/feature-dea-136-rfp-sidebar-right
")

    echo "$result"

    # Short pause between iterations
    sleep 3

    ((iteration++))
done

echo ""
echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${RED}  ⚠️  Max iterations reached. Some items may still be failing.${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"

read -r passing failing total <<< $(count_status)
echo -e "${GREEN}Final Status - Passing: $passing${NC} | ${RED}Failing: $failing${NC} | Total: $total"
