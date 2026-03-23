#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /meeting-prep skill
# Tests the computation logic the skill relies on without needing an LLM.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/meeting-prep/test-computations.sh

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

# --- Test 1: [Coach] Redirect ---

echo ""
echo "=== Test 1: [Coach] Redirect ==="

# STEP 2 from SKILL.md: If trigger contains "[Coach]", "coaching", or "coaching prep" → STOP
for trigger in "prep for [Coach]" "coaching prep" "prep for coaching" "[Coach] meeting agenda"; do
  mode="PROCEED"
  if echo "$trigger" | grep -qi "[coach]\|coaching"; then
    mode="REDIRECT"
  fi
  assert_eq "Trigger '$trigger' → REDIRECT" "REDIRECT" "$mode"
done

# --- Test 2: Normal Client Trigger ---

echo ""
echo "=== Test 2: Normal Client Trigger ==="

# These should NOT trigger the [Coach] redirect
for trigger in "prep for BigCorp meeting" "agenda for Client-B" "meeting prep Client-E" "prep for SmallCo call"; do
  mode="PROCEED"
  if echo "$trigger" | grep -qi "[coach]\|coaching"; then
    mode="REDIRECT"
  fi
  assert_eq "Trigger '$trigger' → PROCEED" "PROCEED" "$mode"
done

# --- Test 3: Calendar Baseline Filter ---

echo ""
echo "=== Test 3: Calendar Baseline Filter ==="

# STEP 3 from SKILL.md: Ignore baseline calendar events
baseline_events=("Fitzwilliam" "Liffey Founders Club" "Dock Yard" "Give a Go")

for event in "${baseline_events[@]}"; do
  is_baseline="no"
  if echo "$event" | grep -qi "Fitzwilliam\|Liffey Founders Club\|Dock Yard\|Give a Go"; then
    is_baseline="yes"
  fi
  assert_eq "Baseline event '$event' → ignored" "yes" "$is_baseline"
done

# Non-baseline event should pass through
event="Weekly sync — BigCorp"
is_baseline="no"
if echo "$event" | grep -qi "Fitzwilliam\|Liffey Founders Club\|Dock Yard\|Give a Go"; then
  is_baseline="yes"
fi
assert_eq "Non-baseline event '$event' → NOT ignored" "no" "$is_baseline"

# --- Test 4: Prep Handoff Contract ---

echo ""
echo "=== Test 4: Prep Handoff Contract ==="

# The Prep Interaction file must have minimum fields for /review-meeting handoff
prep_file="$FIXTURES/notion-mirror/interactions/2026-03-12-prep-bigcorp.md"

# Check required fields exist
title=$(grep "^title:" "$prep_file" | head -1 | sed 's/^title: *//')
type=$(grep "^type:" "$prep_file" | head -1 | sed 's/^type: *//')
date=$(grep "^date:" "$prep_file" | head -1 | awk '{print $2}')
direction=$(grep "^direction:" "$prep_file" | head -1 | sed 's/^direction: *//')
client=$(grep "^client:" "$prep_file" | head -1 | sed 's/^client: *//')
client_id=$(grep "^client_id:" "$prep_file" | head -1 | sed 's/^client_id: *//')

assert_not_contains "title is not empty" "^$" "$title"
assert_eq "type is Prep" "Prep" "$type"
assert_not_contains "date is not empty" "^$" "$date"
assert_eq "direction is Outbound" "Outbound" "$direction"
assert_not_contains "client is not empty" "^$" "$client"
assert_not_contains "client_id is not null" "null" "$client_id"

# --- Test 5: Previous Interactions Sort ---

echo ""
echo "=== Test 5: Previous Interactions Sort (Date Descending) ==="

# Collect dates from BigCorp interactions, sorted descending
bigcorp_dates=""
for f in "$FIXTURES"/notion-mirror/interactions/*.md; do
  i_client=$(grep "^client:" "$f" | head -1 | sed 's/^client: *//')
  i_type=$(grep "^type:" "$f" | head -1 | sed 's/^type: *//')
  if [[ "$i_client" == "BigCorp" ]]; then
    i_date=$(grep "^date:" "$f" | head -1 | awk '{print $2}')
    bigcorp_dates="$bigcorp_dates $i_date"
  fi
done

# Sort descending and verify order
sorted_desc=$(echo "$bigcorp_dates" | tr ' ' '\n' | grep -v '^$' | sort -r)
first_date=$(echo "$sorted_desc" | head -1)
last_date=$(echo "$sorted_desc" | tail -1)

assert_gt "BigCorp has multiple interactions" 1 "$(echo "$sorted_desc" | wc -l | tr -d ' ')"
# Most recent should be 2026-03-12 (prep) or 2026-03-08 (meeting)
assert_eq "Most recent BigCorp interaction date" "2026-03-12" "$first_date"
# Oldest should be 2026-03-08 (meeting)
assert_eq "Oldest BigCorp interaction date" "2026-03-08" "$last_date"

# --- Test 6: Client File Exists ---

echo ""
echo "=== Test 6: Client File Exists ==="

# STEP 4: Can find client file by name using grep in clients/
client_search="BigCorp"
client_file=$(grep -rl "^title: $client_search" "$FIXTURES/notion-mirror/clients/" 2>/dev/null | head -1)
found="no"
if [[ -n "$client_file" ]]; then
  found="yes"
fi
assert_eq "Client file found for '$client_search'" "yes" "$found"

# Negative case — non-existent client
client_search="NonExistentCorp"
client_file=$(grep -rl "^title: $client_search" "$FIXTURES/notion-mirror/clients/" 2>/dev/null | head -1 || true)
found="no"
if [[ -n "$client_file" ]]; then
  found="yes"
fi
assert_eq "No client file for '$client_search'" "no" "$found"

# --- Test 7: Strategy Notes Present ---

echo ""
echo "=== Test 7: Strategy Notes Present ==="

# STEP 4: Client file body must contain "## Strategy Notes"
bigcorp_file=$(grep -rl "^title: BigCorp" "$FIXTURES/notion-mirror/clients/" 2>/dev/null | head -1)
body_has_strategy="no"
if grep -q "## Strategy Notes" "$bigcorp_file"; then
  body_has_strategy="yes"
fi
assert_eq "BigCorp has '## Strategy Notes' section" "yes" "$body_has_strategy"

# Strategy Notes should have content (not empty)
strategy_content=$(sed -n '/^## Strategy Notes/,/^## /p' "$bigcorp_file" | grep -v "^##" | grep -v "^$" | head -1)
assert_not_contains "Strategy Notes has content" "^$" "$strategy_content"

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
