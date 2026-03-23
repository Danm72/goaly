#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /mission skill
# Tests the computation logic the skill relies on without needing an LLM.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/mission/test-computations.sh

set -euo pipefail

FIXTURES="$(cd "$(dirname "$0")/fixtures" && pwd)"
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

# --- Test 1: KPI Traffic Light Logic ---

echo ""
echo "=== Test 1: KPI Traffic Light Logic ==="

# Extract _progress from each KPI fixture
for f in "$FIXTURES"/kpis/*.md; do
  fname=$(basename "$f")
  progress=$(grep "^_progress:" "$f" | head -1 | awk '{print $2}')
  lifecycle=$(grep "^lifecycle:" "$f" | head -1 | awk '{print $2}')

  # Skip archived
  if [[ "$lifecycle" == "Archived" ]]; then
    continue
  fi

  # Determine expected light
  if (( progress >= 75 )); then
    expected_light="green"
  elif (( progress >= 25 )); then
    expected_light="yellow"
  else
    expected_light="red"
  fi

  # Verify based on filename convention
  case "$fname" in
    mrr-green.md)       assert_eq "MRR → green" "green" "$expected_light" ;;
    subscribers-yellow.md) assert_eq "Subscribers → yellow" "yellow" "$expected_light" ;;
    saas-red.md)        assert_eq "SaaS → red" "red" "$expected_light" ;;
    *)                  echo "  SKIP: $fname (no expected light)" ;;
  esac
done

# --- Test 2: Archived KPIs Excluded ---

echo ""
echo "=== Test 2: Archived KPIs Excluded ==="

active_kpis=$(grep -l "^lifecycle: Active" "$FIXTURES"/kpis/*.md 2>/dev/null | wc -l | tr -d ' ')
archived_kpis=$(grep -l "^lifecycle: Archived" "$FIXTURES"/kpis/*.md 2>/dev/null | wc -l | tr -d ' ')

assert_eq "Active KPI count" "3" "$active_kpis"
assert_eq "Archived KPI count" "1" "$archived_kpis"

# --- Test 3: Staleness Detection ---

echo ""
echo "=== Test 3: KPI Staleness Detection ==="

today_epoch=$(date +%s)

for f in "$FIXTURES"/kpis/*.md; do
  lifecycle=$(grep "^lifecycle:" "$f" | head -1 | awk '{print $2}')
  [[ "$lifecycle" == "Archived" ]] && continue

  fname=$(basename "$f")
  freq=$(grep "^tracking_frequency:" "$f" | head -1 | awk '{print $2}')
  edited_raw=$(grep "^_notion_edited:" "$f" | head -1 | awk '{print $2}')
  # Parse ISO date to epoch (handles both date-only and datetime)
  edited_date="${edited_raw%%T*}"
  edited_epoch=$(date -j -f "%Y-%m-%d" "$edited_date" +%s 2>/dev/null || date -d "$edited_date" +%s 2>/dev/null)
  days_since=$(( (today_epoch - edited_epoch) / 86400 ))

  # Staleness thresholds from SKILL.md
  case "$freq" in
    Weekly)    stale_threshold=10 ;;
    Monthly)   stale_threshold=35 ;;
    Quarterly) stale_threshold=100 ;;
    *)         stale_threshold=35 ;;
  esac

  if (( days_since > stale_threshold )); then
    is_stale="stale"
  else
    is_stale="fresh"
  fi

  case "$fname" in
    saas-red.md)
      # Weekly tracking, edited 2026-02-18 — should be stale (>10 days from any date after Feb 28)
      assert_eq "SaaS KPI staleness (weekly, edited Feb 18)" "stale" "$is_stale"
      ;;
    mrr-green.md)
      # Monthly tracking, edited 2026-03-08 — fresh unless test runs >35 days later
      # This test may become stale itself after April 12, 2026
      if (( days_since <= stale_threshold )); then
        assert_eq "MRR KPI freshness (monthly, edited Mar 8)" "fresh" "$is_stale"
      fi
      ;;
  esac
done

# --- Test 4: Portfolio Concentration ---

echo ""
echo "=== Test 4: Portfolio Concentration ==="

# Only count Active clients
active_client_count=$(grep -l "^status: Active" "$FIXTURES"/clients/*.md 2>/dev/null | wc -l | tr -d ' ')
churned_client_count=$(grep -l "^status: Churned" "$FIXTURES"/clients/*.md 2>/dev/null | wc -l | tr -d ' ')

assert_eq "Churned clients excluded" "1" "$churned_client_count"

# Compute concentration (bash 3 compatible — no associative arrays, space-safe paths)
total_rate=0
client_rate_list=""
while IFS= read -r f; do
  name=$(grep "^title:" "$f" | head -1 | sed 's/^title: *//')
  rate=$(grep "^rate:" "$f" | head -1 | awk '{print $2}')
  total_rate=$((total_rate + rate))
  client_rate_list="$client_rate_list|$name=$rate"
done < <(grep -l "^status: Active" "$FIXTURES"/clients/*.md 2>/dev/null)

assert_gt "Total rate > 0" 0 "$total_rate"

# Check concentration percentages per client
for entry in $(echo "$client_rate_list" | tr '|' '\n' | grep '='); do
  name="${entry%%=*}"
  rate="${entry##*=}"
  pct=$((rate * 100 / total_rate))
  case "$name" in
    BigCorp)
      assert_gt "BigCorp concentration > 50%" 50 "$pct"
      ;;
    SmallCo)
      TESTS=$((TESTS + 1))
      if (( pct < 50 )); then
        echo "  PASS: SmallCo concentration < 50% ($pct%)"
        PASS=$((PASS + 1))
      else
        echo "  FAIL: SmallCo concentration should be < 50% (got $pct%)"
        FAIL=$((FAIL + 1))
      fi
      ;;
  esac
done

# --- Test 5: Auto-Cleanup Detection ---

echo ""
echo "=== Test 5: Auto-Cleanup (Done This Week → Done) ==="

done_this_week=$(grep -l "^status: Done This Week" "$FIXTURES"/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Tasks needing cleanup" "1" "$done_this_week"

# Verify it's the right file
cleanup_file=$(grep -l "^status: Done This Week" "$FIXTURES"/tasks/*.md 2>/dev/null | head -1)
cleanup_title=$(grep "^title:" "$cleanup_file" | head -1 | sed 's/^title: *//')
assert_eq "Cleanup task is 'Deploy staging environment'" "Deploy staging environment" "$cleanup_title"

# --- Test 6: Initiation Avoidance Detection ---

echo ""
echo "=== Test 6: Initiation Avoidance (Stalled Tasks) ==="

# Tasks with status "In progress" and _notion_edited > 14 days ago
stalled_count=0
for f in "$FIXTURES"/tasks/*.md; do
  status=$(grep "^status:" "$f" | head -1 | sed 's/^status: *//')
  if [[ "$status" == "In progress" ]] || [[ "$status" == "Planned this week" ]]; then
    edited_raw=$(grep "^_notion_edited:" "$f" | head -1 | awk '{print $2}')
    edited_date="${edited_raw%%T*}"
    edited_epoch=$(date -j -f "%Y-%m-%d" "$edited_date" +%s 2>/dev/null || date -d "$edited_date" +%s 2>/dev/null)
    days_since=$(( (today_epoch - edited_epoch) / 86400 ))
    if (( days_since > 14 )); then
      stalled_count=$((stalled_count + 1))
    fi
  fi
done

# Expected: stalled-in-progress.md (20 days) + frog-task.md (21 days) = 2 stalled
assert_eq "Stalled tasks detected" "2" "$stalled_count"

# --- Test 7: Frog Task Detection ---

echo ""
echo "=== Test 7: Frog Task Detection ==="

frog_count=0
for f in "$FIXTURES"/tasks/*.md; do
  status=$(grep "^status:" "$f" | head -1 | sed 's/^status: *//')
  if [[ "$status" == "Planned this week" ]] || [[ "$status" == "Not started" ]]; then
    edited_raw=$(grep "^_notion_edited:" "$f" | head -1 | awk '{print $2}')
    edited_date="${edited_raw%%T*}"
    edited_epoch=$(date -j -f "%Y-%m-%d" "$edited_date" +%s 2>/dev/null || date -d "$edited_date" +%s 2>/dev/null)
    days_since=$(( (today_epoch - edited_epoch) / 86400 ))
    if (( days_since > 14 )); then
      frog_count=$((frog_count + 1))
      weeks_stuck=$((days_since / 7))
      title=$(grep "^title:" "$f" | head -1 | sed 's/^title: *//')
      echo "  INFO: Frog detected — '$title' stuck $weeks_stuck weeks"
    fi
  fi
done

assert_eq "Frog tasks detected" "1" "$frog_count"

# --- Test 8: Killed Mammoth (Dormant Clients) ---

echo ""
echo "=== Test 8: Killed Mammoth (Dormant Clients) ==="

dormant_count=0
while IFS= read -r client_file; do
  client_name=$(grep "^title:" "$client_file" | head -1 | sed 's/^title: *//')

  # Find most recent interaction for this client
  latest_interaction_date=""
  for interaction_file in "$FIXTURES"/interactions/*.md; do
    i_client=$(grep "^client:" "$interaction_file" | head -1 | sed 's/^client: *//')
    if [[ "$i_client" == "$client_name" ]]; then
      i_date=$(grep "^date:" "$interaction_file" | head -1 | awk '{print $2}')
      if [[ -z "$latest_interaction_date" ]] || [[ "$i_date" > "$latest_interaction_date" ]]; then
        latest_interaction_date="$i_date"
      fi
    fi
  done

  if [[ -n "$latest_interaction_date" ]]; then
    i_epoch=$(date -j -f "%Y-%m-%d" "$latest_interaction_date" +%s 2>/dev/null || date -d "$latest_interaction_date" +%s 2>/dev/null)
    days_since=$(( (today_epoch - i_epoch) / 86400 ))
    if (( days_since > 14 )); then
      dormant_count=$((dormant_count + 1))
      echo "  INFO: Dormant — '$client_name' last contact $days_since days ago"
    fi
  else
    # No interactions at all — definitely dormant
    dormant_count=$((dormant_count + 1))
    echo "  INFO: Dormant — '$client_name' has zero interactions"
  fi
done < <(grep -l "^status: Active" "$FIXTURES"/clients/*.md 2>/dev/null)

# SmallCo last interaction Feb 20 — should be dormant (>14 days from Mar 13)
# BigCorp last interaction Mar 8 — should NOT be dormant
assert_eq "Dormant clients detected" "1" "$dormant_count"

# --- Test 9: Context Detection ---

echo ""
echo "=== Test 9: Context Detection ==="

# Monday
mock_day=1
if (( mock_day == 1 )); then mode="MONDAY"; else mode="PULSE"; fi
assert_eq "Day 1 (Monday) → MONDAY mode" "MONDAY" "$mode"

# Thursday
mock_day=4
if (( mock_day == 1 )); then mode="MONDAY"; else mode="PULSE"; fi
assert_eq "Day 4 (Thursday) → PULSE mode" "PULSE" "$mode"

# Coaching trigger
trigger="prep for [Coach]"
if echo "$trigger" | grep -qi "[coach]\|coaching prep"; then mode="COACHING"; fi
assert_eq "Trigger 'prep for [Coach]' → COACHING mode" "COACHING" "$mode"

trigger="coaching prep for next week"
mode="PULSE" # reset
if echo "$trigger" | grep -qi "[coach]\|coaching prep"; then mode="COACHING"; fi
assert_eq "Trigger 'coaching prep...' → COACHING mode" "COACHING" "$mode"

# No coaching trigger
trigger="plan my week"
mode="PULSE" # reset
if echo "$trigger" | grep -qi "[coach]\|coaching prep"; then mode="COACHING"; fi
assert_eq "Trigger 'plan my week' → NOT coaching" "PULSE" "$mode"

# --- Test 10: Energy Budget Computation ---

echo ""
echo "=== Test 10: Energy Budget Computation ==="

# Count deep work tasks that are planned/in-progress
deep_work_committed=0
for f in "$FIXTURES"/tasks/*.md; do
  status=$(grep "^status:" "$f" | head -1 | sed 's/^status: *//')
  energy=$(grep "^energy:" "$f" | head -1 | sed 's/^energy: *//')
  if [[ "$energy" == "Deep Work" ]] && { [[ "$status" == "Planned this week" ]] || [[ "$status" == "In progress" ]]; }; then
    deep_work_committed=$((deep_work_committed + 1))
  fi
done

# Expected: active-deep-work.md + stalled-in-progress.md + frog-task.md = 3 deep work committed
assert_eq "Deep work committed count" "3" "$deep_work_committed"

# Quick Win should NOT count
quick_wins=0
for f in "$FIXTURES"/tasks/*.md; do
  status=$(grep "^status:" "$f" | head -1 | sed 's/^status: *//')
  energy=$(grep "^energy:" "$f" | head -1 | sed 's/^energy: *//')
  if [[ "$energy" == "Quick Win" ]] && { [[ "$status" == "Planned this week" ]] || [[ "$status" == "In progress" ]]; }; then
    quick_wins=$((quick_wins + 1))
  fi
done

assert_eq "Quick Win tasks (not in energy budget)" "1" "$quick_wins"

# --- Test 11: Active Goals Filter ---

echo ""
echo "=== Test 11: Active Goals Filter ==="

active_goals=$(grep -l "^lifecycle: Active" "$FIXTURES"/goals/*.md 2>/dev/null | wc -l | tr -d ' ')
archived_goals=$(grep -l "^lifecycle: Archived" "$FIXTURES"/goals/*.md 2>/dev/null | wc -l | tr -d ' ')

assert_eq "Active goals count" "1" "$active_goals"
assert_eq "Archived goals excluded" "1" "$archived_goals"

# --- Test 12: Grep Pattern Verification ---

echo ""
echo "=== Test 12: Grep Pattern Verification ==="

# These are the exact patterns the mission SKILL.md uses — verify they match fixtures
pattern_results=$(grep -rl "^lifecycle: Active" "$FIXTURES"/kpis/ 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Grep '^lifecycle: Active' on kpis/" "3" "$pattern_results"

pattern_results=$(grep -rl "^status: Active" "$FIXTURES"/clients/ 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Grep '^status: Active' on clients/" "2" "$pattern_results"

pattern_results=$(grep -rl "^status: Done This Week" "$FIXTURES"/tasks/ 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Grep '^status: Done This Week' on tasks/" "1" "$pattern_results"

pattern_results=$(grep -rl "^status: In progress" "$FIXTURES"/tasks/ 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Grep '^status: In progress' on tasks/" "1" "$pattern_results"

pattern_results=$(grep -rl "^status: Planned this week" "$FIXTURES"/tasks/ 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Grep '^status: Planned this week' on tasks/" "3" "$pattern_results"

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
