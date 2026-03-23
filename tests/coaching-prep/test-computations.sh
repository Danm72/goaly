#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /coaching-prep skill
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/coaching-prep/test-computations.sh

set -euo pipefail

FIXTURES="$(cd "$(dirname "$0")/../shared-fixtures" && pwd)"
PASS=0
FAIL=0
TESTS=0

# --- Helpers (same as mission) ---

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

# --- Test 1: Active Goals Detection ---

echo ""
echo "=== Test 1: Active Goals Detection ==="

active_goals=$(grep -l "^lifecycle: Active" "$FIXTURES"/notion-mirror/goals/*.md 2>/dev/null | wc -l | tr -d ' ')
archived_goals=$(grep -l "^lifecycle: Archived" "$FIXTURES"/notion-mirror/goals/*.md 2>/dev/null | wc -l | tr -d ' ')

assert_gt "At least 1 active goal" 0 "$active_goals"
assert_gt "At least 1 archived goal (excluded)" 0 "$archived_goals"

# --- Test 2: Active KPIs with Progress ---

echo ""
echo "=== Test 2: Active KPIs with Progress ==="

active_kpis=$(grep -l "^lifecycle: Active" "$FIXTURES"/notion-mirror/kpis/*.md 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Active KPI count" "3" "$active_kpis"

# Check each KPI has _progress, current_value, target_value
for f in "$FIXTURES"/notion-mirror/kpis/*.md; do
  lifecycle=$(grep "^lifecycle:" "$f" | head -1 | awk '{print $2}')
  [[ "$lifecycle" == "Archived" ]] && continue

  fname=$(basename "$f")
  has_progress=$(grep -c "^_progress:" "$f" || true)
  has_current=$(grep -c "^current_value:" "$f" || true)
  has_target=$(grep -c "^target_value:" "$f" || true)

  assert_eq "$fname has _progress" "1" "$has_progress"
  assert_eq "$fname has current_value" "1" "$has_current"
  assert_eq "$fname has target_value" "1" "$has_target"
done

# --- Test 3: Unmeasured Goal Detection ---

echo ""
echo "=== Test 3: Unmeasured Goal Detection ==="

# For each active goal, check if any KPI references its goal_id
unmeasured_count=0
while IFS= read -r goal_file; do
  goal_id=$(grep "^notion_id:" "$goal_file" | head -1 | awk '{print $2}')
  goal_title=$(grep "^title:" "$goal_file" | head -1 | sed 's/^title: *//')

  # Search KPIs for this goal_id
  kpi_refs=$( (grep -rl "^goal_id: $goal_id" "$FIXTURES"/notion-mirror/kpis/ 2>/dev/null || true) | wc -l | tr -d ' ')

  if [[ "$kpi_refs" -eq 0 ]]; then
    unmeasured_count=$((unmeasured_count + 1))
    echo "  INFO: Unmeasured — '$goal_title' (no KPIs reference goal_id: $goal_id)"
  fi
done < <(grep -l "^lifecycle: Active" "$FIXTURES"/notion-mirror/goals/*.md 2>/dev/null)

# unmeasured-goal.md has goal_id: test-goal-003, no KPI references it
assert_gt "At least 1 unmeasured goal" 0 "$unmeasured_count"

# --- Test 4: Task Status Filtering ---

echo ""
echo "=== Test 4: Task Status Filtering ==="

planned_this_week=$(grep -l "^status: Planned this week" "$FIXTURES"/notion-mirror/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
in_progress=$(grep -l "^status: In progress" "$FIXTURES"/notion-mirror/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
done_this_week=$(grep -l "^status: Done This Week" "$FIXTURES"/notion-mirror/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')

assert_gt "Planned this week > 0" 0 "$planned_this_week"
assert_gt "In progress > 0" 0 "$in_progress"
assert_gt "Done This Week > 0" 0 "$done_this_week"

# --- Test 5: Standing Items from MEMORY ---

echo ""
echo "=== Test 5: Standing Items from MEMORY ==="

memory_file="$FIXTURES/memory/MEMORY.md"
has_standing=$(grep -c "Coaching Prep — Standing Items" "$memory_file" || true)
assert_eq "MEMORY.md has standing items section" "1" "$has_standing"

has_mrr_standing=$(grep -c "ALWAYS ask [Owner] for current MRR" "$memory_file" || true)
assert_eq "Standing items include MRR question" "1" "$has_mrr_standing"

has_unmeasured_standing=$(grep -c "unmeasured goals" "$memory_file" || true)
assert_eq "Standing items include unmeasured goals check" "1" "$has_unmeasured_standing"

# --- Test 6: Deprioritized Detection ---

echo ""
echo "=== Test 6: Deprioritized Detection ==="

deprioritized=$(grep -l "^status: Deprioritized" "$FIXTURES"/notion-mirror/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Deprioritized tasks found" "1" "$deprioritized"

# Verify the deprioritized task has expected fields
dep_file=$(grep -l "^status: Deprioritized" "$FIXTURES"/notion-mirror/tasks/*.md 2>/dev/null | head -1)
dep_title=$(grep "^title:" "$dep_file" | head -1 | sed 's/^title: *//')
assert_contains "Deprioritized task has title" "Research" "$dep_title"

# --- Test 7: Granola Local Search ---

echo ""
echo "=== Test 7: Granola Local Search ==="

coaching_transcripts=$(grep -rl "[Coach]" "$FIXTURES"/granola-mirror/meetings/ 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Granola has coaching transcripts" 0 "$coaching_transcripts"

# Verify coaching transcript has action items
coaching_file=$(grep -rl "[Coach]" "$FIXTURES"/granola-mirror/meetings/ 2>/dev/null | head -1)
has_action_items=$(grep -c "Action Items" "$coaching_file" || true)
assert_gt "Coaching transcript has Action Items section" 0 "$has_action_items"

# --- Test 8: Stalled Task Detection ---

echo ""
echo "=== Test 8: Stalled Task Detection (Initiation Avoidance) ==="

today_epoch=$(date +%s)
stalled_count=0

for f in "$FIXTURES"/notion-mirror/tasks/*.md; do
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

assert_gt "Stalled tasks (>14 days) detected" 0 "$stalled_count"

# --- Test 9: Grep Patterns Match Skill STEP 3 ---

echo ""
echo "=== Test 9: Grep Pattern Verification ==="

# These patterns come directly from coaching-prep SKILL.md STEP 3
pattern_results=$(grep -rl "^lifecycle: Active" "$FIXTURES"/notion-mirror/goals/ 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Grep '^lifecycle: Active' on goals/" 0 "$pattern_results"

pattern_results=$(grep -rl "^lifecycle: Active" "$FIXTURES"/notion-mirror/kpis/ 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Grep '^lifecycle: Active' on kpis/" 0 "$pattern_results"

pattern_results=$(grep -rl "^status: Done This Week" "$FIXTURES"/notion-mirror/tasks/ 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Grep '^status: Done This Week' on tasks/" 0 "$pattern_results"

pattern_results=$(grep -rl "^status: In progress" "$FIXTURES"/notion-mirror/tasks/ 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Grep '^status: In progress' on tasks/" 0 "$pattern_results"

pattern_results=$(grep -rl "^status: Planned this week" "$FIXTURES"/notion-mirror/tasks/ 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Grep '^status: Planned this week' on tasks/" 0 "$pattern_results"

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
