#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for /client-email skill
# Tests the computation logic the skill relies on without needing an LLM.
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/client-email/test-computations.sh

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
  if echo "$haystack" | grep -qi "$needle"; then
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
  if echo "$haystack" | grep -qi "$needle"; then
    echo "  FAIL: $label (should NOT contain '$needle')"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  fi
}

assert_file_readable() {
  local label="$1" filepath="$2"
  TESTS=$((TESTS + 1))
  if [[ -r "$filepath" ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (file not readable: $filepath)"
    FAIL=$((FAIL + 1))
  fi
}

# --- Mode detection helper ---
# Mirrors SKILL.md STEP 1 logic
detect_mode() {
  local trigger="$1"
  local lower
  lower=$(echo "$trigger" | tr '[:upper:]' '[:lower:]')

  if echo "$lower" | grep -qi "slack"; then
    echo "SLACK"
  elif echo "$lower" | grep -qi "whatsapp"; then
    echo "WHATSAPP"
  elif echo "$lower" | grep -qi "reply to\|reply-to-message-id"; then
    echo "REPLY"
  elif echo "$lower" | grep -qi "email.*about\|draft.*response\|draft.*to"; then
    echo "DRAFT"
  elif echo "$lower" | grep -qi "check emails\|check email"; then
    echo "READ"
  else
    echo "DRAFT"
  fi
}

# --- Test 1: Mode — Read-only ---

echo ""
echo "=== Test 1: Mode — Read-only ==="

mode=$(detect_mode "check emails from BigCorp")
assert_eq "Trigger 'check emails from BigCorp' → READ" "READ" "$mode"
assert_not_contains "READ mode has no 'reply'" "reply" "$mode"
assert_not_contains "READ mode has no 'draft'" "draft" "$mode"

# --- Test 2: Mode — WhatsApp ---

echo ""
echo "=== Test 2: Mode — WhatsApp ==="

mode=$(detect_mode "check what BigCorp sent on WhatsApp")
assert_eq "Trigger 'check WhatsApp from BigCorp' → WHATSAPP" "WHATSAPP" "$mode"
assert_contains "WHATSAPP mode contains 'WhatsApp'" "whatsapp" "$mode"

# Additional WhatsApp trigger variants
mode=$(detect_mode "check WhatsApp from BigCorp")
assert_eq "Trigger 'check WhatsApp from BigCorp' → WHATSAPP" "WHATSAPP" "$mode"

# --- Test 3: Mode — Email reply ---

echo ""
echo "=== Test 3: Mode — Email reply ==="

mode=$(detect_mode "reply to BigCorp email")
assert_eq "Trigger 'reply to BigCorp email' → REPLY" "REPLY" "$mode"
assert_contains "REPLY mode contains 'reply'" "reply" "$mode"

# --- Test 4: Mode — Email draft ---

echo ""
echo "=== Test 4: Mode — Email draft ==="

mode=$(detect_mode "email BigCorp about Q2")
assert_eq "Trigger 'email BigCorp about Q2' → DRAFT" "DRAFT" "$mode"

mode=$(detect_mode "draft response to BigCorp")
assert_eq "Trigger 'draft response to BigCorp' → DRAFT" "DRAFT" "$mode"

# --- Test 5: Client Lookup ---

echo ""
echo "=== Test 5: Client Lookup ==="

client_files=$(grep -rl "^title: BigCorp" "$FIXTURES"/notion-mirror/clients/ 2>/dev/null | wc -l | tr -d ' ')
assert_eq "BigCorp found in clients/" "1" "$client_files"

# Verify the file has Strategy Notes (needed for draft context)
client_file=$(grep -rl "^title: BigCorp" "$FIXTURES"/notion-mirror/clients/ 2>/dev/null | head -1)
has_strategy=$(grep -c "## Strategy Notes" "$client_file" 2>/dev/null || echo "0")
TESTS=$((TESTS + 1))
if (( has_strategy > 0 )); then
  echo "  PASS: BigCorp file has Strategy Notes section"
  PASS=$((PASS + 1))
else
  echo "  FAIL: BigCorp file missing Strategy Notes section"
  FAIL=$((FAIL + 1))
fi

# --- Test 6: Recent Interactions Sort ---

echo ""
echo "=== Test 6: Recent Interactions Sort ==="

# Collect dates from BigCorp interactions, sorted descending
dates=""
for f in "$FIXTURES"/notion-mirror/interactions/*.md; do
  i_client=$(grep "^client:" "$f" | head -1 | sed 's/^client: *//')
  if [[ "$i_client" == "BigCorp" ]]; then
    i_date=$(grep "^date:" "$f" | head -1 | awk '{print $2}')
    dates="$dates $i_date"
  fi
done

# Sort descending and verify order
sorted_dates=$(echo "$dates" | tr ' ' '\n' | grep -v '^$' | sort -r)
first_date=$(echo "$sorted_dates" | head -1)
last_date=$(echo "$sorted_dates" | tail -1)

assert_eq "Most recent BigCorp interaction is 2026-03-12" "2026-03-12" "$first_date"
assert_eq "Oldest BigCorp interaction is 2026-03-08" "2026-03-08" "$last_date"

# Verify the sort order: 2026-03-12 > 2026-03-11 > 2026-03-08
date_count=$(echo "$sorted_dates" | wc -l | tr -d ' ')
TESTS=$((TESTS + 1))
if (( date_count >= 2 )); then
  echo "  PASS: Multiple BigCorp interactions found for sort verification ($date_count)"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Expected >= 2 BigCorp interactions, got $date_count"
  FAIL=$((FAIL + 1))
fi

# --- Test 7: Tone of Voice Exists ---

echo ""
echo "=== Test 7: Tone of Voice Exists ==="

assert_file_readable "clients/tone-of-voice.md is readable" "$FIXTURES/clients/tone-of-voice.md"

# Verify it has content the skill needs
tov_content=$(cat "$FIXTURES/clients/tone-of-voice.md")
assert_contains "Tone of voice mentions contractions" "contraction" "$tov_content"
assert_contains "Tone of voice mentions direct" "direct" "$tov_content"

# --- Test 8: Interaction File Validation ---

echo ""
echo "=== Test 8: Interaction File Validation ==="

required_fields=("title" "type" "date" "direction")

for f in "$FIXTURES"/notion-mirror/interactions/*.md; do
  fname=$(basename "$f")
  for field in "${required_fields[@]}"; do
    TESTS=$((TESTS + 1))
    if grep -q "^${field}:" "$f"; then
      echo "  PASS: $fname has '$field'"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: $fname missing required field '$field'"
      FAIL=$((FAIL + 1))
    fi
  done
done

# --- Test 9: Null contacts_ids Validation ---

echo ""
echo "=== Test 9: Null contacts_ids Validation ==="

# Detect files with the invalid pattern: contacts_ids: null
invalid_files=0
for f in "$FIXTURES"/notion-mirror/interactions/*.md; do
  if grep -q "^contacts_ids: null" "$f"; then
    invalid_files=$((invalid_files + 1))
    fname=$(basename "$f")
    echo "  INFO: Invalid null contacts_ids in $fname"
  fi
done

assert_eq "Files with null contacts_ids detected" "1" "$invalid_files"

# Verify it's the expected bad fixture
bad_file=$(grep -rl "^contacts_ids: null" "$FIXTURES"/notion-mirror/interactions/ 2>/dev/null | head -1)
bad_fname=$(basename "$bad_file")
assert_eq "Invalid file is bad-null-contacts.md" "bad-null-contacts.md" "$bad_fname"

# --- Test 10: Mode — Slack ---

echo ""
echo "=== Test 10: Mode — Slack ==="

mode=$(detect_mode "check slack with BigCorp")
assert_eq "Trigger 'check slack with BigCorp' → SLACK" "SLACK" "$mode"

mode=$(detect_mode "check what BigCorp sent on Slack")
assert_eq "Trigger 'check what BigCorp sent on Slack' → SLACK" "SLACK" "$mode"

mode=$(detect_mode "review slack messages from BigCorp")
assert_eq "Trigger 'review slack messages from BigCorp' → SLACK" "SLACK" "$mode"

# --- Test 11: Slack Interaction File Validation ---

echo ""
echo "=== Test 11: Slack Interaction File Validation ==="

slack_file="$FIXTURES/notion-mirror/interactions/2026-03-14-slack-feedback-on-proposal-bigcorp.md"
assert_file_readable "Slack interaction fixture exists" "$slack_file"

# Verify type is Slack
slack_type=$(grep "^type:" "$slack_file" | head -1 | sed 's/^type: *//' | tr -d '"')
assert_eq "Slack interaction has type 'Slack'" "Slack" "$slack_type"

# Verify it has Key Messages section (substance extraction)
slack_content=$(cat "$slack_file")
assert_contains "Slack interaction has Key Messages section" "Key Messages" "$slack_content"
assert_contains "Slack interaction has Pending Actions" "Pending Actions" "$slack_content"

# Verify required fields
for field in title type date direction; do
  TESTS=$((TESTS + 1))
  if grep -q "^${field}:" "$slack_file"; then
    echo "  PASS: Slack fixture has '$field'"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: Slack fixture missing required field '$field'"
    FAIL=$((FAIL + 1))
  fi
done

# Verify no null contacts_ids
TESTS=$((TESTS + 1))
if grep -q "^contacts_ids: null" "$slack_file"; then
  echo "  FAIL: Slack fixture has null contacts_ids"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: Slack fixture has valid contacts_ids"
  PASS=$((PASS + 1))
fi

# --- Test 12: Slack Mode Doesn't Interfere with Other Modes ---

echo ""
echo "=== Test 12: Slack Mode Doesn't Interfere ==="

# WhatsApp still works
mode=$(detect_mode "check what BigCorp sent on WhatsApp")
assert_eq "WhatsApp still detected correctly" "WHATSAPP" "$mode"

# Email read still works
mode=$(detect_mode "check emails from BigCorp")
assert_eq "Email read still detected correctly" "READ" "$mode"

# Email reply still works
mode=$(detect_mode "reply to BigCorp email")
assert_eq "Email reply still detected correctly" "REPLY" "$mode"

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
