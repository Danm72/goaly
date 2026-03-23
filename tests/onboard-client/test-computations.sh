#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /onboard-client skill
# Tests the computation logic the skill relies on without needing an LLM.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/onboard-client/test-computations.sh

set -euo pipefail

FIXTURES="$(cd "$(dirname "$0")/../shared-fixtures" && pwd)"
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

# Safe grep -c wrapper (grep -c exits 1 on no matches, breaks pipefail)
count_matches() {
  local result
  result=$(grep -c "$1" "$2" 2>/dev/null) || result="0"
  echo "$result"
}

# Safe grep -l wrapper (grep -l exits 1 on no matches)
find_matches() {
  grep -l "$@" 2>/dev/null || true
}

# --- Test 1: Mode Detection — Full Onboarding ---

echo ""
echo "=== Test 1: Mode Detection — Full Onboarding ==="

for trigger in "new client TestCo" "onboard TestCo" "New client Acme Corp" "Onboard BigCorp"; do
  mode="UNKNOWN"
  if echo "$trigger" | grep -qi "new client\|onboard"; then mode="FULL"; fi
  assert_eq "Trigger '$trigger' → FULL mode" "FULL" "$mode"
done

# --- Test 2: Mode Detection — Contract-Only ---

echo ""
echo "=== Test 2: Mode Detection — Contract-Only ==="

for trigger in "create a contract for BigCorp" "draft proposal for SmallCo" "Create a contract for Acme"; do
  mode="UNKNOWN"
  if echo "$trigger" | grep -qi "create a contract\|draft proposal"; then mode="CONTRACT"; fi
  assert_eq "Trigger '$trigger' → CONTRACT mode" "CONTRACT" "$mode"
done

# Verify contract-only mode requires existing client
client_exists=$(find_matches "^title: BigCorp" "$FIXTURES"/notion-mirror/clients/*.md | wc -l | tr -d ' ')
assert_eq "BigCorp client file exists for contract-only mode" "1" "$client_exists"

# Non-existent client should fail lookup
client_missing=$(find_matches "^title: NonExistentCo" "$FIXTURES"/notion-mirror/clients/*.md | wc -l | tr -d ' ')
assert_eq "NonExistentCo client file does NOT exist" "0" "$client_missing"

# --- Test 3: Client Required Fields ---

echo ""
echo "=== Test 3: Client Required Fields ==="

for f in "$FIXTURES"/notion-mirror/clients/*.md; do
  fname=$(basename "$f")
  has_title=$(count_matches "^title:" "$f")
  has_status=$(count_matches "^status:" "$f")
  assert_eq "Client '$fname' has title" "1" "$has_title"
  assert_eq "Client '$fname' has status" "1" "$has_status"
done

# --- Test 4: Contact Required Fields ---

echo ""
echo "=== Test 4: Contact Required Fields ==="

for f in "$FIXTURES"/notion-mirror/contacts/*.md; do
  fname=$(basename "$f")
  has_title=$(count_matches "^title:" "$f")
  has_client=$(count_matches "^client:" "$f")
  assert_eq "Contact '$fname' has title" "1" "$has_title"
  assert_eq "Contact '$fname' has client relation" "1" "$has_client"
done

# --- Test 5: Project Required Fields ---

echo ""
echo "=== Test 5: Project Required Fields ==="

# test-project.md should have all required fields for a client project
proj_file="$FIXTURES/notion-mirror/projects/test-project.md"
has_title=$(count_matches "^title:" "$proj_file")
has_status=$(count_matches "^status:" "$proj_file")
has_lifecycle=$(count_matches "^lifecycle:" "$proj_file")
has_goal_id=$(count_matches "^goal_id:" "$proj_file")
has_goal=$(count_matches "^goal:" "$proj_file")

assert_eq "Project has title" "1" "$has_title"
assert_eq "Project has status" "1" "$has_status"
assert_eq "Project has lifecycle" "1" "$has_lifecycle"
assert_eq "Project has goal_id" "1" "$has_goal_id"
assert_eq "Project has goal" "1" "$has_goal"

# --- Test 6: Null Relation ID Validation ---

echo ""
echo "=== Test 6: Null Relation ID Validation ==="

# project-with-null-client.md has client_id: null — this is INVALID per SKILL.md behavioral rule 1
null_file="$FIXTURES/notion-mirror/projects/project-with-null-client.md"
client_id_line=$(grep "^client_id:" "$null_file" | head -1)

assert_contains "project-with-null-client.md has client_id field" "client_id:" "$client_id_line"
assert_contains "client_id value is null (INVALID)" "null" "$client_id_line"

# Detect the pattern: any _id field set to null is invalid
null_id_count=0
for f in "$FIXTURES"/notion-mirror/projects/*.md; do
  while IFS= read -r line; do
    if echo "$line" | grep -qE "^[a-z_]+_id: null$" 2>/dev/null; then
      null_id_count=$((null_id_count + 1))
    fi
  done < "$f"
done

# project-with-null-client.md has client_id: null — exactly 1 invalid file
assert_eq "Files with null _id fields detected" "1" "$null_id_count"

# --- Test 7: Omitted Relation Is Valid ---

echo ""
echo "=== Test 7: Omitted Relation Is Valid ==="

# project-without-client-field.md omits client_id entirely — this is VALID per SKILL.md step 11
omit_file="$FIXTURES/notion-mirror/projects/project-without-client-field.md"
has_client_id=$(count_matches "^client_id:" "$omit_file")

assert_eq "project-without-client-field.md omits client_id (valid)" "0" "$has_client_id"

# Verify it still has required fields (title, status, lifecycle, goal_id, goal)
has_title=$(count_matches "^title:" "$omit_file")
has_status=$(count_matches "^status:" "$omit_file")
has_lifecycle=$(count_matches "^lifecycle:" "$omit_file")
has_goal_id=$(count_matches "^goal_id:" "$omit_file")

assert_eq "Omitted-client project still has title" "1" "$has_title"
assert_eq "Omitted-client project still has status" "1" "$has_status"
assert_eq "Omitted-client project still has lifecycle" "1" "$has_lifecycle"
assert_eq "Omitted-client project still has goal_id" "1" "$has_goal_id"

# --- Test 8: MEMORY.md Active Leads Format ---

echo ""
echo "=== Test 8: MEMORY.md Active Leads Format ==="

memory_file="$FIXTURES/memory/MEMORY.md"

# Verify Active Leads section exists
assert_contains "MEMORY.md has Active Leads section" "## Active Leads" "$(cat "$memory_file")"

# Extract Active Leads section (between ## Active Leads and next ## or EOF)
# Use sed compatible with macOS (no head -n -1)
leads_section=$(sed -n '/^## Active Leads/,/^## [^A]/p' "$memory_file" | sed '1d;$d')
# If no trailing section header, grab to EOF
if [[ -z "$leads_section" ]]; then
  leads_section=$(sed -n '/^## Active Leads/,$p' "$memory_file" | sed '1d')
fi

lead_count=$(echo "$leads_section" | grep -c "^- \*\*" || echo "0")
assert_eq "Active Leads has 3 entries" "3" "$lead_count"

# Verify format pattern: **Name** — STATUS.
for lead_name in "Client-B" "Client-A" "Client-E"; do
  assert_contains "Active Leads contains $lead_name" "$lead_name" "$leads_section"
done

# Verify the format matches what STEP 14 expects to append to
assert_contains "Active Leads entry has bold name pattern" "\*\*.*\*\*" "$leads_section"

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
