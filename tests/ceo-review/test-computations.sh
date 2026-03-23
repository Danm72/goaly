#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /ceo-review skill
# Tests structural correctness, mode detection, read-only enforcement, and fixture queries.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/ceo-review/test-computations.sh

set -euo pipefail

FIXTURES="$(cd "$(dirname "$0")/../shared-fixtures" && pwd)"
SKILL="$(cd "$(dirname "$0")/../../.claude/skills/goaly-ceo-review" && pwd)/SKILL.md"
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

# --- Test 1: SKILL.md Structural Checks ---

echo ""
echo "=== Test 1: SKILL.md Structural Checks ==="

# SKILL.md exists
TESTS=$((TESTS + 1))
if [[ -f "$SKILL" ]]; then
  echo "  PASS: SKILL.md exists"
  PASS=$((PASS + 1))
else
  echo "  FAIL: SKILL.md does not exist at $SKILL"
  FAIL=$((FAIL + 1))
fi

skill_content=$(cat "$SKILL")

# Has frontmatter with name
assert_contains "Frontmatter has name field" "^name:" "$skill_content"

# Has frontmatter with description
assert_contains "Frontmatter has description field" "^description:" "$skill_content"

# Has frontmatter with allowed-tools
assert_contains "Frontmatter has allowed-tools field" "^allowed-tools:" "$skill_content"

# Has STEP 0 heading
assert_contains "Has STEP 0 heading" "STEP 0" "$skill_content"

# Has STEP 1 heading
assert_contains "Has STEP 1 heading" "STEP 1" "$skill_content"

# Contains read-only mention
assert_contains "Contains 'read-only' mention" "read-only" "$skill_content"

# --- Test 2: Mode Detection ---

echo ""
echo "=== Test 2: Mode Detection ==="

# Contains SCOPE EXPANSION mode
assert_contains "Contains SCOPE EXPANSION mode" "SCOPE EXPANSION" "$skill_content"

# Contains HOLD SCOPE mode
assert_contains "Contains HOLD SCOPE mode" "HOLD SCOPE" "$skill_content"

# Contains SCOPE REDUCTION mode
assert_contains "Contains SCOPE REDUCTION" "SCOPE REDUCTION" "$skill_content"

# Each mode has a posture-specific section with Use for
assert_contains "SCOPE EXPANSION has Use for description" "SCOPE EXPANSION Posture" "$skill_content"
assert_contains "HOLD SCOPE has Use for description" "HOLD SCOPE Posture" "$skill_content"
assert_contains "SCOPE REDUCTION has Use for description" "SCOPE REDUCTION Posture" "$skill_content"

# --- Test 3: Read-Only Enforcement ---

echo ""
echo "=== Test 3: Read-Only Enforcement ==="

# Extract allowed-tools block (between allowed-tools: and ---)
tools_block=$(sed -n '/^allowed-tools:/,/^---/p' "$SKILL")

# Allowed tools present
assert_contains "allowed-tools includes Read" "Read" "$tools_block"
assert_contains "allowed-tools includes Grep" "Grep" "$tools_block"
assert_contains "allowed-tools includes Glob" "Glob" "$tools_block"
assert_contains "allowed-tools includes Bash" "Bash" "$tools_block"
assert_contains "allowed-tools includes AskUserQuestion" "AskUserQuestion" "$tools_block"

# Forbidden tools absent
assert_not_contains "allowed-tools excludes Edit" "Edit" "$tools_block"
assert_not_contains "allowed-tools excludes Write" "Write" "$tools_block"
assert_not_contains "allowed-tools excludes MultiEdit" "MultiEdit" "$tools_block"

# Body enforces read-only behavior
assert_contains "Body contains 'You never write code'" "You never write code" "$skill_content"

# --- Test 4: Fixture-Based Checks ---

echo ""
echo "=== Test 4: Fixture-Based Checks ==="

# Can grep active goals from fixtures
active_goals=$(grep -rl '^status: In progress' "$FIXTURES/notion-mirror/goals/" 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Active goals (In progress) exist in fixtures" 0 "$active_goals"

# Can grep active KPIs from fixtures
active_kpis=$(grep -rl "^lifecycle: Active" "$FIXTURES/notion-mirror/kpis/" 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Active KPIs exist in fixtures" 0 "$active_kpis"

# --- Test 5: Cross-Reference Checks ---

echo ""
echo "=== Test 5: Cross-Reference Checks ==="

# SKILL.md mentions ikigai alignment
assert_contains "SKILL.md mentions ikigai alignment" "ikigai" "$skill_content"

# SKILL.md mentions retainer check
assert_contains "SKILL.md mentions retainer" "retainer" "$skill_content"

# SKILL.md mentions the AskUserQuestion handoff
assert_contains "SKILL.md uses AskUserQuestion for posture selection" "AskUserQuestion" "$skill_content"

# SKILL.md mentions handoff to /brainstorm or /plan
assert_contains "SKILL.md mentions /brainstorm handoff" "/brainstorm" "$skill_content"
assert_contains "SKILL.md mentions /plan handoff" "/plan" "$skill_content"

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
