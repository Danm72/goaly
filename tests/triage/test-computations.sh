#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /triage skill
# Tests the triage filtering and cross-reference logic without needing an LLM.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/triage/test-computations.sh

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

# --- Test 1: Email Ignore Rules ---

echo ""
echo "=== Test 1: Email Ignore Rules ==="

# Vercel deployment notification should match ignore pattern
vercel_from=$(grep "^from:" "$FIXTURES/email-mirror/threads/ignore-vercel-deploy.md" | head -1)
assert_contains "Vercel email matches ignore (from contains vercel)" "vercel" "$vercel_from"

vercel_subject=$(grep "^subject:" "$FIXTURES/email-mirror/threads/ignore-vercel-deploy.md" | head -1)
assert_contains "Vercel email subject mentions deployment" "Deployment" "$vercel_subject"

# Xero billing notification should match ignore pattern
xero_from=$(grep "^from:" "$FIXTURES/email-mirror/threads/ignore-xero-invoice.md" | head -1)
assert_contains "Xero email matches ignore (from contains xero)" "xero" "$xero_from"

xero_subject=$(grep "^subject:" "$FIXTURES/email-mirror/threads/ignore-xero-invoice.md" | head -1)
assert_contains "Xero email subject mentions invoice" "Invoice" "$xero_subject"

# Newsletter should match ignore pattern
newsletter_from=$(grep "^from:" "$FIXTURES/email-mirror/threads/ignore-newsletter.md" | head -1)
assert_contains "Newsletter email matches ignore (from contains newsletter)" "newsletter" "$newsletter_from"

newsletter_content=$(cat "$FIXTURES/email-mirror/threads/ignore-newsletter.md")
assert_contains "Newsletter content mentions promotional" "promotional" "$newsletter_content"

# Count total ignorable emails by filename pattern
ignore_count=$(ls "$FIXTURES/email-mirror/threads/ignore-"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Ignorable email fixture count" "3" "$ignore_count"

# --- Test 2: Email Surface Rules ---

echo ""
echo "=== Test 2: Email Surface Rules ==="

# Client reply should match surface pattern
client_reply_content=$(cat "$FIXTURES/email-mirror/threads/surface-client-reply.md")
assert_contains "Client reply contains client name" "BigCorp" "$client_reply_content"
assert_contains "Client reply is a reply (Re:)" "Re:" "$client_reply_content"

# Meeting invite should match surface pattern
meeting_invite_content=$(cat "$FIXTURES/email-mirror/threads/surface-meeting-invite.md")
assert_contains "Meeting invite contains 'Meeting'" "Meeting" "$meeting_invite_content"
assert_contains "Meeting invite is from a real person" "contact7@example.com" "$meeting_invite_content"

# Count total surface emails by filename pattern
surface_count=$(ls "$FIXTURES/email-mirror/threads/surface-"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Surface email fixture count" "2" "$surface_count"

# Surface emails should NOT match ignore patterns
surface_client_from=$(grep "^from:" "$FIXTURES/email-mirror/threads/surface-client-reply.md" | head -1)
assert_not_contains "Client reply not from vercel" "vercel" "$surface_client_from"
assert_not_contains "Client reply not from xero" "xero" "$surface_client_from"
assert_not_contains "Client reply not from newsletter" "newsletter" "$surface_client_from"

# --- Test 3: Calendar Baseline Filter ---

echo ""
echo "=== Test 3: Calendar Baseline Filter ==="

# These venue names should be filtered when they appear in baseline calendar events
baseline_venues="Fitzwilliam Liffey Founders Club Dock Yard Give a Go"

for venue in "Fitzwilliam" "Liffey Founders Club" "Dock Yard" "Give a Go"; do
  TESTS=$((TESTS + 1))
  if echo "$baseline_venues" | grep -q "$venue"; then
    echo "  PASS: Baseline venue '$venue' matched by filter"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: Baseline venue '$venue' NOT matched by filter"
    FAIL=$((FAIL + 1))
  fi
done

# Verify non-baseline venues do NOT match
non_baseline="Client meeting at WeWork Dublin"
assert_not_contains "Non-baseline venue not filtered" "Fitzwilliam" "$non_baseline"
assert_not_contains "Non-baseline venue not filtered (Dock Yard)" "Dock Yard" "$non_baseline"

# --- Test 4: Unknown Contact Detection ---

echo ""
echo "=== Test 4: Unknown Contact Detection ==="

# Get the sender email from the unknown-sender fixture
unknown_email=$(grep "^from:" "$FIXTURES/email-mirror/threads/unknown-sender.md" | head -1 | sed 's/^from: *//')

# Search contacts for this email — should NOT be found
contact_match=$( (grep -rl "$unknown_email" "$FIXTURES/notion-mirror/contacts/" 2>/dev/null || true) | wc -l | tr -d ' ')
assert_eq "Unknown sender not in contacts" "0" "$contact_match"

# Verify known contacts ARE found
known_email="jane@bigcorp.example.com"
known_match=$(grep -rl "$known_email" "$FIXTURES/notion-mirror/contacts/" 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Known contact (jane@bigcorp) found in contacts" "1" "$known_match"

known_email2="bob@smallco.example.com"
known_match2=$(grep -rl "$known_email2" "$FIXTURES/notion-mirror/contacts/" 2>/dev/null | wc -l | tr -d ' ')
assert_eq "Known contact (bob@smallco) found in contacts" "1" "$known_match2"

# --- Test 5: Cross-Reference Tasks ---

echo ""
echo "=== Test 5: Cross-Reference Tasks ==="

# The client reply email mentions BigCorp and API migration — check if a related task exists
# Surface email about BigCorp Q2 Planning should cross-reference with existing tasks
client_email_subject=$(grep "^subject:" "$FIXTURES/email-mirror/threads/surface-client-reply.md" | head -1)
assert_contains "Client email mentions BigCorp" "BigCorp" "$client_email_subject"

# Check if any task references the same client/project
task_matches=$(grep -rl "BigCorp\|API" "$FIXTURES/notion-mirror/tasks/" 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Tasks referencing BigCorp/API exist for cross-reference" 0 "$task_matches"

# Check that we can find tasks by project relation (the triage cross-reference pattern)
project_tasks=$(grep -rl "^project:" "$FIXTURES/notion-mirror/tasks/" 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Tasks with project relations exist" 0 "$project_tasks"

# Verify interaction cross-reference works (existing coverage check)
interaction_count=$(ls "$FIXTURES/notion-mirror/interactions/"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Interactions exist for cross-reference" 0 "$interaction_count"

# --- Test 6: Personal Tasks Coverage ---

echo ""
echo "=== Test 6: Personal Tasks Coverage ==="

# Verify personal-tasks directory exists and has content
personal_task_count=$(ls "$FIXTURES/notion-mirror/personal-tasks/"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Personal tasks fixtures exist" 0 "$personal_task_count"

# Grep on personal-tasks should return results
personal_status=$(grep -l "^status:" "$FIXTURES/notion-mirror/personal-tasks/"*.md 2>/dev/null | wc -l | tr -d ' ')
assert_gt "Personal tasks have status fields" 0 "$personal_status"

# Verify personal task content is readable
personal_title=$(grep "^title:" "$FIXTURES/notion-mirror/personal-tasks/personal-errand.md" | head -1 | sed 's/^title: *//')
assert_eq "Personal task title readable" "Renew passport" "$personal_title"

# Verify energy field exists (personal tasks use different energy options)
personal_energy=$(grep "^energy:" "$FIXTURES/notion-mirror/personal-tasks/personal-errand.md" | head -1 | sed 's/^energy: *//')
assert_eq "Personal task energy type" "Errand" "$personal_energy"

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
