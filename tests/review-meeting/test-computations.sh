#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /review-meeting skill
# Tests the computation logic the skill relies on without needing an LLM.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/review-meeting/test-computations.sh

set -euo pipefail

FIXTURES="$(cd "$(dirname "$0")/../shared-fixtures" && pwd)"
SKILL="$(cd "$(dirname "$0")/../../.claude/skills/goaly-review-meeting" && pwd)/SKILL.md"
PASS=0
FAIL=0
TESTS=0

# --- Helpers ---

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  TESTS=$((TESTS + 1))
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  TESTS=$((TESTS + 1))
  if echo "$haystack" | grep -q "$needle"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (expected to contain '$needle')"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local label="$1" needle="$2" haystack="$3"
  TESTS=$((TESTS + 1))
  if echo "$haystack" | grep -q "$needle"; then
    echo "  FAIL: $label (should NOT contain '$needle')"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  fi
}

assert_gt() {
  local label="$1" threshold="$2" actual="$3"
  TESTS=$((TESTS + 1))
  if (( actual > threshold )); then
    echo "  PASS: $label ($actual > $threshold)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label ($actual is NOT > $threshold)"
    FAIL=$((FAIL + 1))
  fi
}

# --- Test 1: Mode Detection — Coaching ---

echo ""
echo "=== Test 1: Mode Detection — Coaching ==="

# "[Coach]" trigger
trigger="review coaching call with [Coach]"
mode="UNKNOWN"
if echo "$trigger" | grep -qi "[coach]\|coaching"; then mode="COACHING"; fi
assert_eq "Trigger containing '[Coach]' → COACHING" "COACHING" "$mode"

# "coaching" trigger
trigger="review coaching session notes"
mode="UNKNOWN"
if echo "$trigger" | grep -qi "[coach]\|coaching"; then mode="COACHING"; fi
assert_eq "Trigger containing 'coaching' → COACHING" "COACHING" "$mode"

# Case-insensitive
trigger="Review COACHING Call"
mode="UNKNOWN"
if echo "$trigger" | grep -qi "[coach]\|coaching"; then mode="COACHING"; fi
assert_eq "Case-insensitive 'COACHING' → COACHING" "COACHING" "$mode"

# --- Test 2: Mode Detection — Client ---

echo ""
echo "=== Test 2: Mode Detection — Client ==="

# Match client name against fixture client filenames
# SKILL.md: Glob "notion-mirror/clients/*.md" filenames

detect_client_mode() {
  local trigger="$1"
  local mode="UNKNOWN"
  local matched=""
  while IFS= read -r f; do
    local client_title
    client_title=$(grep "^title:" "$f" | head -1 | sed 's/^title: *//')
    if echo "$trigger" | grep -qi "$client_title"; then
      mode="CLIENT"
      matched="$client_title"
      break
    fi
  done < <(find "$FIXTURES/notion-mirror/clients" -name "*.md" -type f)
  echo "$mode|$matched"
}

trigger="review BigCorp call"
result=$(detect_client_mode "$trigger")
mode="${result%%|*}"
matched_client="${result##*|}"
assert_eq "Trigger containing 'BigCorp' → CLIENT" "CLIENT" "$mode"
assert_eq "Matched client is BigCorp" "BigCorp" "$matched_client"

# SmallCo match
trigger="review SmallCo meeting"
result=$(detect_client_mode "$trigger")
mode="${result%%|*}"
assert_eq "Trigger containing 'SmallCo' → CLIENT" "CLIENT" "$mode"

# --- Test 3: Mode Detection — Unknown (Fallthrough) ---

echo ""
echo "=== Test 3: Mode Detection — Unknown (Fallthrough) ==="

detect_full_mode() {
  local trigger="$1"
  local mode="UNKNOWN"
  if echo "$trigger" | grep -qi "[coach]\|coaching"; then
    mode="COACHING"
  else
    local result
    result=$(detect_client_mode "$trigger")
    mode="${result%%|*}"
  fi
  echo "$mode"
}

trigger="review meeting with FooBar Inc"
mode=$(detect_full_mode "$trigger")
assert_eq "Unknown client 'FooBar Inc' → UNKNOWN" "UNKNOWN" "$mode"

# Coaching takes priority over client
trigger="review coaching call with BigCorp"
mode=$(detect_full_mode "$trigger")
assert_eq "Both coaching AND client → COACHING wins" "COACHING" "$mode"

# --- Test 4: Null contacts_ids Validation ---

echo ""
echo "=== Test 4: Null contacts_ids Validation ==="

# Find interaction files with contacts_ids: null (invalid pattern)
null_contacts_files=$(find "$FIXTURES/notion-mirror/interactions" -name "*.md" -type f -exec grep -l "^contacts_ids: null" {} \; 2>/dev/null | wc -l | tr -d ' ')
assert_gt "At least 1 fixture with contacts_ids: null" 0 "$null_contacts_files"

# Verify the specific bad fixture is detected
bad_file="$FIXTURES/notion-mirror/interactions/bad-null-contacts.md"
bad_content=$(cat "$bad_file")
assert_contains "bad-null-contacts.md has contacts_ids: null" "contacts_ids: null" "$bad_content"

# Valid interactions should NOT have contacts_ids: null
valid_file="$FIXTURES/notion-mirror/interactions/2026-03-08-meeting-recent.md"
valid_content=$(cat "$valid_file")
assert_not_contains "Valid interaction has no contacts_ids: null" "contacts_ids: null" "$valid_content"

# --- Test 5: Prep Cross-Reference ---

echo ""
echo "=== Test 5: Prep Cross-Reference ==="

# Find most recent type: Prep interaction for BigCorp
latest_prep_date=""
latest_prep_file=""

while IFS= read -r f; do
  type_val=$(grep "^type:" "$f" | head -1 | sed 's/^type: *//')
  client_val=$(grep "^client:" "$f" | head -1 | sed 's/^client: *//')
  if [[ "$type_val" == "Prep" ]] && [[ "$client_val" == "BigCorp" ]]; then
    i_date=$(grep "^date:" "$f" | head -1 | awk '{print $2}')
    if [[ -z "$latest_prep_date" ]] || [[ "$i_date" > "$latest_prep_date" ]]; then
      latest_prep_date="$i_date"
      latest_prep_file=$(basename "$f")
    fi
  fi
done < <(find "$FIXTURES/notion-mirror/interactions" -name "*.md" -type f)

assert_eq "Most recent Prep for BigCorp found" "2026-03-12-prep-bigcorp.md" "$latest_prep_file"
assert_eq "Prep date is 2026-03-12" "2026-03-12" "$latest_prep_date"

# Verify prep content has questions (for cross-referencing)
prep_content=$(cat "$FIXTURES/notion-mirror/interactions/2026-03-12-prep-bigcorp.md")
assert_contains "Prep has 'Questions to Ask' section" "Questions to Ask" "$prep_content"

# --- Test 6: Task Deduplication ---

echo ""
echo "=== Test 6: Task Deduplication ==="

# Simulate searching for an action item that matches an existing task
# Action item from BigCorp meeting: "Send architecture doc for API v2"
# Existing task: "Build API integration for Client-E" — should NOT match
action_item="Send architecture doc"
matching_tasks=$(find "$FIXTURES/notion-mirror/tasks" -name "*.md" -type f -exec grep -l "$action_item" {} \; 2>/dev/null | wc -l | tr -d ' ')
assert_eq "No exact match for 'Send architecture doc' in tasks" "0" "$matching_tasks"

# Action item that DOES match an existing task title fragment
# Existing: "Build API integration for Client-E"
action_item_match="API integration"
matching_tasks=$(find "$FIXTURES/notion-mirror/tasks" -name "*.md" -type f -exec grep -l "$action_item_match" {} \; 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Grep finds 'API integration' in existing tasks" "1" "$matching_tasks"

# --- Test 7: Required Interaction Fields ---

echo ""
echo "=== Test 7: Required Interaction Fields ==="

# Per SKILL.md Step 3, Interaction files need: title, type, date, direction
required_fields=("title" "type" "date" "direction")

while IFS= read -r f; do
  fname=$(basename "$f")
  for field in "${required_fields[@]}"; do
    has_field=$(grep -c "^${field}:" "$f" | tr -d ' ')
    TESTS=$((TESTS + 1))
    if (( has_field > 0 )); then
      echo "  PASS: $fname has '$field'"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: $fname missing required field '$field'"
      FAIL=$((FAIL + 1))
    fi
  done
done < <(find "$FIXTURES/notion-mirror/interactions" -name "*.md" -type f)

# --- Test 8: Handoff Suggestion ---

echo ""
echo "=== Test 8: Handoff Suggestion ==="

# SKILL.md Step 9 should suggest /goaly-triage, NOT /mission
skill_content=$(cat "$SKILL")
assert_contains "SKILL.md mentions /goaly-triage handoff" "/goaly-triage" "$skill_content"
assert_not_contains "SKILL.md does NOT suggest /mission" "/mission" "$skill_content"

# Verify the exact handoff text
assert_contains "Handoff text says 'Run \`/goaly-triage\`'" 'Run `/goaly-triage`' "$skill_content"

# --- Summary ---

echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed, $TESTS total"
echo "==============================="

if (( FAIL > 0 )); then
  exit 1
else
  echo "All tests passed!"
  exit 0
fi
