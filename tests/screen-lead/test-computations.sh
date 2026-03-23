#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /screen-lead skill
# Tests the skill structure, flag references, communication rules, and fixture queries.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/screen-lead/test-computations.sh

set -euo pipefail

FIXTURES="$(cd "$(dirname "$0")/../shared-fixtures" && pwd)"
SKILL="$(cd "$(dirname "$0")/../../.claude/skills/goaly-screen-lead" && pwd)/SKILL.md"
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

SKILL_CONTENT=$(cat "$SKILL")

# --- Test 1: SKILL.md Structural Checks ---

echo ""
echo "=== Test 1: SKILL.md Structural Checks ==="

# File exists
TESTS=$((TESTS + 1))
if [[ -f "$SKILL" ]]; then
  echo "  PASS: SKILL.md exists"
  PASS=$((PASS + 1))
else
  echo "  FAIL: SKILL.md does not exist at $SKILL"
  FAIL=$((FAIL + 1))
fi

# Has frontmatter with name
assert_contains "Frontmatter has name field" "^name:" "$SKILL_CONTENT"

# Has frontmatter with description
assert_contains "Frontmatter has description field" "^description:" "$SKILL_CONTENT"

# Has GATHER/ANALYZE/ACT phase headings
assert_contains "Has Phase 1: GATHER heading" "GATHER" "$SKILL_CONTENT"
assert_contains "Has Phase 2: ANALYZE heading" "ANALYZE" "$SKILL_CONTENT"
assert_contains "Has Phase 3: ACT heading" "ACT" "$SKILL_CONTENT"

# Has Trigger Phrases section
assert_contains "Has Trigger Phrases section" "## Trigger Phrases" "$SKILL_CONTENT"

# Has Input section
assert_contains "Has Input section" "## Input" "$SKILL_CONTENT"

# --- Test 2: Description Check ---

echo ""
echo "=== Test 2: Description Check ==="

# Extract description value
description=$(grep "^description:" "$SKILL" | head -1 | sed 's/^description: *//')

# Description should be trigger-phrased (starts with "Use when")
TESTS=$((TESTS + 1))
if echo "$description" | grep -q "^.Use when"; then
  echo "  PASS: Description is trigger-phrased (starts with 'Use when')"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Description should start with 'Use when' (got: $description)"
  FAIL=$((FAIL + 1))
fi

# Description should be non-empty
TESTS=$((TESTS + 1))
if [[ -n "$description" ]]; then
  echo "  PASS: Description is non-empty"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Description is empty"
  FAIL=$((FAIL + 1))
fi

# --- Test 3: Red/Green Flags ---

echo ""
echo "=== Test 3: Red/Green Flags ==="

# Contains red flags section
assert_contains "Has Red Flags section" "Red Flags" "$SKILL_CONTENT"

# Contains specific red flag references
assert_contains "Red flag: scope ambiguity (ASAP + ambitious)" "ASAP" "$SKILL_CONTENT"
assert_contains "Red flag: no budget mentioned" "No budget" "$SKILL_CONTENT"
assert_contains "Red flag: title shifting" "Title shifting" "$SKILL_CONTENT"

# Contains green flags section
assert_contains "Has Green Flags section" "Green Flags" "$SKILL_CONTENT"

# Contains specific green flag references
assert_contains "Green flag: specific budget" "Specific budget" "$SKILL_CONTENT"
assert_contains "Green flag: clear problem" "Clear problem" "$SKILL_CONTENT"

# --- Test 4: Communication Rules ---

echo ""
echo "=== Test 4: Communication Rules ==="

# Never offer calls ([Owner]'s preference)
assert_contains "Contains 'never offer' calls rule" "never offer" "$SKILL_CONTENT"
assert_contains "Contains 'NEVER' calls emphasis" "NEVER.*call" "$SKILL_CONTENT"

# References tone-of-voice for reply drafting
assert_contains "References tone-of-voice file" "tone-of-voice" "$SKILL_CONTENT"

# Retainer-first framing
assert_contains "Mentions retainer-first approach" "retainer" "$SKILL_CONTENT"

# --- Test 5: Research Tools ---

echo ""
echo "=== Test 5: Research Tools ==="

# Contains Exa reference
assert_contains "References Exa research tool" "exa" "$SKILL_CONTENT"

# Contains Perplexity reference
assert_contains "References Perplexity research tool" "perplexity" "$SKILL_CONTENT"

# Contains local-first search (qmd or local search mention)
# The skill references gog gmail search and curl for local/fast-first approach
assert_contains "References gog CLI for email search" "gog" "$SKILL_CONTENT"

# Contains sherlock for social media scanning
assert_contains "References sherlock for social scan" "sherlock" "$SKILL_CONTENT"

# --- Test 6: Fixture-Based Checks ---

echo ""
echo "=== Test 6: Fixture-Based Checks ==="

# Can grep active clients from fixtures
active_clients=$(grep -l "^status: Active" "$FIXTURES/notion-mirror/clients/"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Active clients in fixtures" 0 "$active_clients"

# Can find contacts in fixtures
contact_count=$(ls "$FIXTURES/notion-mirror/contacts/"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Contacts exist in fixtures" 0 "$contact_count"

# Can find interactions (for cross-referencing lead history)
interaction_count=$(ls "$FIXTURES/notion-mirror/interactions/"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Interactions exist in fixtures" 0 "$interaction_count"

# --- Test 7: Output Structure ---

echo ""
echo "=== Test 7: Output Structure ==="

# SKILL.md mentions structured report output
assert_contains "Mentions structured report" "structured report" "$SKILL_CONTENT"

# SKILL.md mentions reply draft as optional output
assert_contains "Mentions reply draft" "reply" "$SKILL_CONTENT"
assert_contains "Draft is optional (only on interest)" "[Owner] confirms interest" "$SKILL_CONTENT"

# SKILL.md mentions qualifying questions in output
assert_contains "Mentions qualifying questions" "Qualifying Questions" "$SKILL_CONTENT"

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
