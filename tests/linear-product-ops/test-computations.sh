#!/usr/bin/env bash
# test-computations.sh — Layer 1 deterministic tests for linear-product-ops skill
# Run: cd "/Users/dan/Admin/Goals & Tasks" && bash tests/linear-product-ops/test-computations.sh

set -euo pipefail

SKILL_DIR=".claude/skills/linear-product-ops"
PASS=0
FAIL=0
WARN=0

pass() { PASS=$((PASS+1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ FAIL: $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  WARN: $1"; }

echo "=== linear-product-ops ==="

# -------------------------------------------------------
# Test 1: Skill Structure
# -------------------------------------------------------
echo ""
echo "--- Test 1: Skill Structure ---"

# SKILL.md exists and has frontmatter
if [[ -f "$SKILL_DIR/SKILL.md" ]]; then
  pass "SKILL.md exists"
else
  fail "SKILL.md missing"
fi

if head -1 "$SKILL_DIR/SKILL.md" | grep -q "^---"; then
  pass "SKILL.md has frontmatter delimiter"
else
  fail "SKILL.md missing frontmatter"
fi

if grep -q "^name:" "$SKILL_DIR/SKILL.md"; then
  pass "SKILL.md has 'name' in frontmatter"
else
  fail "SKILL.md missing 'name' field in frontmatter"
fi

if grep -q "^description:" "$SKILL_DIR/SKILL.md"; then
  pass "SKILL.md has 'description' in frontmatter"
else
  fail "SKILL.md missing 'description' field in frontmatter"
fi

# gotchas.md exists and is non-empty
if [[ -f "$SKILL_DIR/gotchas.md" ]]; then
  pass "gotchas.md exists"
else
  fail "gotchas.md missing"
fi

if [[ -s "$SKILL_DIR/gotchas.md" ]]; then
  pass "gotchas.md is non-empty"
else
  fail "gotchas.md is empty"
fi

# config.json exists and is valid JSON
if [[ -f "$SKILL_DIR/config.json" ]]; then
  pass "config.json exists"
else
  fail "config.json missing"
fi

if python3 -c "import json; json.load(open('$SKILL_DIR/config.json'))" 2>/dev/null; then
  pass "config.json is valid JSON"
else
  fail "config.json is not valid JSON"
fi

# All referenced sub-files exist
for ref_file in issue-template.md epic-template.md project-template.md enrichment-guide.md posthog-setup.md posthog-event-registry.json; do
  if [[ -f "$SKILL_DIR/references/$ref_file" ]]; then
    pass "references/$ref_file exists"
  else
    fail "references/$ref_file missing"
  fi
done

# data/ directory exists
if [[ -d "$SKILL_DIR/data" ]]; then
  pass "data/ directory exists"
else
  fail "data/ directory missing"
fi

# -------------------------------------------------------
# Test 2: Registry Validation
# -------------------------------------------------------
echo ""
echo "--- Test 2: Registry Validation ---"

REGISTRY="$SKILL_DIR/references/posthog-event-registry.json"

if [[ -f "$REGISTRY" ]]; then
  pass "posthog-event-registry.json exists"
else
  fail "posthog-event-registry.json missing"
fi

if python3 -c "import json; json.load(open('$REGISTRY'))" 2>/dev/null; then
  pass "posthog-event-registry.json is valid JSON"
else
  fail "posthog-event-registry.json is not valid JSON"
fi

# Has events array
if python3 -c "import json; d=json.load(open('$REGISTRY')); assert isinstance(d.get('events'), list)" 2>/dev/null; then
  pass "Registry has 'events' array"
else
  fail "Registry missing 'events' array"
fi

# Has funnels array
if python3 -c "import json; d=json.load(open('$REGISTRY')); assert isinstance(d.get('funnels'), list)" 2>/dev/null; then
  pass "Registry has 'funnels' array"
else
  fail "Registry missing 'funnels' array"
fi

# Every event has required fields: name, project, issue
event_field_check=$(python3 -c "
import json, sys
d = json.load(open('$REGISTRY'))
missing = []
for i, e in enumerate(d['events']):
    for field in ['name', 'project', 'issue']:
        if field not in e or not e[field]:
            missing.append(f'Event {i}: missing {field}')
if missing:
    print('\n'.join(missing))
    sys.exit(1)
print('OK')
" 2>&1)
if [[ $? -eq 0 ]]; then
  pass "All events have required fields (name, project, issue)"
else
  fail "Events missing required fields: $event_field_check"
fi

# Event names are snake_case (no spaces, no uppercase)
snake_case_check=$(python3 -c "
import json, re, sys
d = json.load(open('$REGISTRY'))
bad = []
for e in d['events']:
    name = e['name']
    if ' ' in name or name != name.lower() or not re.match(r'^[a-z][a-z0-9_]*$', name):
        bad.append(name)
if bad:
    print(', '.join(bad[:5]))
    sys.exit(1)
print('OK')
" 2>&1)
if [[ $? -eq 0 ]]; then
  pass "All event names are snake_case"
else
  fail "Non-snake_case event names found: $snake_case_check"
fi

# No duplicate event names within same issue
dupe_check=$(python3 -c "
import json, sys
from collections import Counter
d = json.load(open('$REGISTRY'))
pairs = [(e['name'], e['issue']) for e in d['events']]
dupes = [f'{name} in {issue}' for (name, issue), count in Counter(pairs).items() if count > 1]
if dupes:
    print(', '.join(dupes[:5]))
    sys.exit(1)
print('OK')
" 2>&1)
if [[ $? -eq 0 ]]; then
  pass "No duplicate event names within same issue"
else
  fail "Duplicate event names within same issue: $dupe_check"
fi

# Every funnel has required fields: name, epic, steps
funnel_field_check=$(python3 -c "
import json, sys
d = json.load(open('$REGISTRY'))
missing = []
for i, f in enumerate(d['funnels']):
    for field in ['name', 'epic', 'steps']:
        if field not in f or not f[field]:
            missing.append(f'Funnel {i}: missing {field}')
if missing:
    print('\n'.join(missing))
    sys.exit(1)
print('OK')
" 2>&1)
if [[ $? -eq 0 ]]; then
  pass "All funnels have required fields (name, epic, steps)"
else
  fail "Funnels missing required fields: $funnel_field_check"
fi

# Funnel steps are non-empty arrays
funnel_steps_check=$(python3 -c "
import json, sys
d = json.load(open('$REGISTRY'))
bad = []
for i, f in enumerate(d['funnels']):
    if not isinstance(f.get('steps'), list) or len(f['steps']) == 0:
        bad.append(f'Funnel {i} ({f.get(\"name\",\"?\")}): steps empty or not array')
if bad:
    print('\n'.join(bad))
    sys.exit(1)
print('OK')
" 2>&1)
if [[ $? -eq 0 ]]; then
  pass "All funnel steps are non-empty arrays"
else
  fail "Funnel steps invalid: $funnel_steps_check"
fi

# -------------------------------------------------------
# Test 3: Template Completeness
# -------------------------------------------------------
echo ""
echo "--- Test 3: Template Completeness ---"

# issue-template.md has all 6 required sections
for section in "What This Is" "Intended User Experience" "Intended Outcomes" "Acceptance Criteria" "Dependencies" "PostHog Tracking Plan"; do
  if grep -q "$section" "$SKILL_DIR/references/issue-template.md"; then
    pass "issue-template.md contains '$section'"
  else
    fail "issue-template.md missing '$section'"
  fi
done

# epic-template.md required sections
for section in "Overview" "Sub-Issues" "User Flow" "Key Dependencies" "PostHog Tracking Plan"; do
  if grep -q "$section" "$SKILL_DIR/references/epic-template.md"; then
    pass "epic-template.md contains '$section'"
  else
    fail "epic-template.md missing '$section'"
  fi
done

# project-template.md required sections
for section in "Goal" "Key Outcomes" "Context" "Dependencies" "Success Criteria"; do
  if grep -q "$section" "$SKILL_DIR/references/project-template.md"; then
    pass "project-template.md contains '$section'"
  else
    fail "project-template.md missing '$section'"
  fi
done

# enrichment-guide.md required sections
for section in "Golden Rule" "Pattern" "Enrichment Section Format"; do
  if grep -q "$section" "$SKILL_DIR/references/enrichment-guide.md"; then
    pass "enrichment-guide.md contains '$section'"
  else
    fail "enrichment-guide.md missing '$section'"
  fi
done

# -------------------------------------------------------
# Test 4: Config Validation
# -------------------------------------------------------
echo ""
echo "--- Test 4: Config Validation ---"

config_check=$(python3 -c "
import json, re, sys
d = json.load(open('$SKILL_DIR/config.json'))
errors = []

# Required fields
for field in ['workspace', 'team_id', 'team_key', 'labels', 'statuses']:
    if field not in d:
        errors.append(f'missing field: {field}')

# labels is non-empty array
if not isinstance(d.get('labels'), list) or len(d.get('labels', [])) == 0:
    errors.append('labels is empty or not an array')

# statuses is non-empty array
if not isinstance(d.get('statuses'), list) or len(d.get('statuses', [])) == 0:
    errors.append('statuses is empty or not an array')

# team_id looks like UUID
tid = d.get('team_id', '')
uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
if not re.match(uuid_pattern, tid, re.IGNORECASE):
    errors.append(f'team_id does not look like a UUID: {tid}')

if errors:
    print('; '.join(errors))
    sys.exit(1)
print('OK')
" 2>&1)

if [[ $? -eq 0 ]]; then
  pass "config.json has all required fields"
  pass "config.json labels is non-empty array"
  pass "config.json statuses is non-empty array"
  pass "config.json team_id is a valid UUID"
else
  fail "config.json validation failed: $config_check"
fi

# -------------------------------------------------------
# Test 5: SKILL.md Mode Coverage
# -------------------------------------------------------
echo ""
echo "--- Test 5: SKILL.md Mode Coverage ---"

skill_content=$(cat "$SKILL_DIR/SKILL.md")

# All 4 modes mentioned
for mode in INGEST AUDIT UPDATE MEASURE; do
  if echo "$skill_content" | grep -q "$mode"; then
    pass "SKILL.md mentions mode: $mode"
  else
    fail "SKILL.md missing mode: $mode"
  fi
done

# References all template files
for ref in "issue-template.md" "epic-template.md" "project-template.md" "enrichment-guide.md" "posthog-setup.md"; do
  if echo "$skill_content" | grep -q "$ref"; then
    pass "SKILL.md references $ref"
  else
    fail "SKILL.md does not reference $ref"
  fi
done

# References gotchas.md
if echo "$skill_content" | grep -q "gotchas.md"; then
  pass "SKILL.md references gotchas.md"
else
  fail "SKILL.md does not reference gotchas.md"
fi

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
echo ""
echo "---"
echo "$PASS passed, $FAIL failed, $WARN warnings"
[ $FAIL -eq 0 ] && exit 0 || exit 1
