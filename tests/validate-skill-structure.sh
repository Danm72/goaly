#!/usr/bin/env bash
# validate-skill-structure.sh — Check whether a skill folder meets engineering standards.
#
# Standards enforced:
#   - SKILL.md with YAML frontmatter including a description field
#   - gotchas.md documenting known pitfalls
#   - Description phrased as a trigger ("Use when...") not a summary
#   - Progressive disclosure: large SKILL.md should have companion .md files
#   - No hardcoded /Users/ paths (belong in config)
#   - References to sub-files (references/, assets/, scripts/) noted as good practice
#
# Usage:
#   bash tests/validate-skill-structure.sh <skill-folder-path>
#   bash tests/validate-skill-structure.sh                       # scans all .claude/skills/goaly-*
#
# Exit codes:
#   0 — all checks passed (warnings are OK)
#   1 — at least one FAIL

set -euo pipefail

# Counters (global, accumulated across all skills)
total_pass=0
total_fail=0
total_warn=0
total_info=0

pass()  { echo "  ✅ PASS: $1"; total_pass=$((total_pass + 1)); }
fail()  { echo "  ❌ FAIL: $1"; total_fail=$((total_fail + 1)); }
warn()  { echo "  ⚠️  WARN: $1"; total_warn=$((total_warn + 1)); }
info()  { echo "  ℹ️  INFO: $1"; total_info=$((total_info + 1)); }

validate_skill() {
  local skill_dir="$1"

  # Skip symlinks
  if [[ -L "$skill_dir" ]]; then
    info "Skipping symlink: $skill_dir"
    return
  fi

  # Skip _shared/ directory (not a skill, it's a shared resource)
  if [[ "$(basename "$skill_dir")" == "_shared" ]]; then
    info "Skipping shared resource: $skill_dir"
    return
  fi

  # Must be a directory
  if [[ ! -d "$skill_dir" ]]; then
    fail "Not a directory: $skill_dir"
    return
  fi

  local skill_name
  skill_name="$(basename "$skill_dir")"
  echo ""
  echo "=== $skill_name ==="

  local skill_md="$skill_dir/SKILL.md"
  local gotchas_md="$skill_dir/gotchas.md"

  # 1. SKILL.md exists
  if [[ ! -f "$skill_md" ]]; then
    fail "SKILL.md missing"
    # Can't check anything else without it
    fail "gotchas.md missing (skipped — no SKILL.md)"
    return
  fi
  pass "SKILL.md exists"

  # 2. gotchas.md exists and is referenced from SKILL.md
  if [[ -f "$gotchas_md" ]]; then
    pass "gotchas.md exists"
    if grep -q 'gotchas.md' "$skill_md"; then
      pass "gotchas.md is referenced from SKILL.md"
    else
      fail "gotchas.md exists but is not referenced from SKILL.md"
    fi
  else
    fail "gotchas.md missing"
  fi

  # 3. SKILL.md has frontmatter (--- delimiters)
  local first_line
  first_line="$(head -1 "$skill_md")"
  if [[ "$first_line" != "---" ]]; then
    fail "SKILL.md has no frontmatter (first line is not '---')"
    # Can't check description without frontmatter
    return
  fi

  # Find closing --- (line 2+)
  local closing_line
  closing_line="$(awk 'NR > 1 && /^---$/ { print NR; exit }' "$skill_md")"
  if [[ -z "$closing_line" ]]; then
    fail "SKILL.md frontmatter not closed (missing second '---')"
    return
  fi
  pass "SKILL.md has frontmatter"

  # 4. Frontmatter has description field
  # Extract frontmatter block (between the two --- lines)
  local frontmatter
  frontmatter="$(sed -n "2,$((closing_line - 1))p" "$skill_md")"

  local description
  description="$(echo "$frontmatter" | grep -E '^description:' | head -1 | sed 's/^description:[[:space:]]*//' | sed 's/^"//' | sed 's/"$//')"

  if [[ -z "$description" ]]; then
    fail "Frontmatter missing 'description' field"
  else
    pass "Frontmatter has description"

    # 5. Description reads as a trigger
    # Good: starts with "Use when", "Use for", "Use after", "Triggered by"
    # Bad: starts with a summary verb/noun like "Deep", "Create", "Generate", etc.
    local bad_prefixes="^(Deep|Create|Generate|Automate|Build|Run|Execute|Perform|Handle|Manage|Process|Analyze|Check|Fetch|Send|Delete|Update|A |An |The )"
    local good_prefixes="^Use (when|for|after|to|if)|^Triggered|^Invoke|^Run when|^Call when"

    if echo "$description" | grep -qEi "$good_prefixes"; then
      pass "Description reads as a trigger"
    elif echo "$description" | grep -qEi "$bad_prefixes"; then
      warn "Description looks like a summary, not a trigger. Should start with 'Use when...', 'Use for...', etc."
    else
      pass "Description reads as a trigger"
    fi
  fi

  # 6. Not a monolith — warn if SKILL.md > 200 lines and no other .md files
  local line_count
  line_count="$(wc -l < "$skill_md" | tr -d ' ')"
  local other_md_count
  other_md_count="$(find "$skill_dir" -maxdepth 1 -name '*.md' ! -name 'SKILL.md' -type f 2>/dev/null | wc -l | tr -d ' ')"

  if [[ "$line_count" -gt 200 ]] && [[ "$other_md_count" -eq 0 ]]; then
    warn "SKILL.md is $line_count lines with no companion .md files — consider progressive disclosure"
  else
    pass "Not a monolith ($line_count lines, $other_md_count companion .md files)"
  fi

  # 7. No hardcoded paths (exempt _shared/ references — intentional absolute paths)
  local hardcoded_paths
  hardcoded_paths="$(grep '/Users/' "$skill_md" 2>/dev/null | grep -cv '_shared/' || true)"
  if [[ "$hardcoded_paths" -gt 0 ]]; then
    warn "SKILL.md contains $hardcoded_paths hardcoded /Users/ path(s) — consider moving to config"
  else
    pass "No hardcoded /Users/ paths"
  fi

  # 8. References sub-files (informational)
  local has_refs=false
  for subdir in references assets scripts; do
    if grep -q "$subdir/" "$skill_md" 2>/dev/null; then
      has_refs=true
      break
    fi
  done
  if [[ "$has_refs" == "true" ]]; then
    info "SKILL.md references sub-files (references/, assets/, or scripts/) — good practice"
  fi
}

# --- Main ---

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ $# -gt 0 ]]; then
  # Validate specific skill folder(s)
  for arg in "$@"; do
    # Resolve relative paths against cwd
    if [[ "$arg" = /* ]]; then
      validate_skill "$arg"
    else
      validate_skill "$(pwd)/$arg"
    fi
  done
else
  # Scan all goaly-* skill folders
  echo "Scanning all goaly-* skills in $PROJECT_ROOT/.claude/skills/"
  found=0
  for skill_dir in "$PROJECT_ROOT"/.claude/skills/goaly-*/; do
    # Glob expands to literal if no match
    [[ -e "$skill_dir" ]] || continue
    # Remove trailing slash
    skill_dir="${skill_dir%/}"
    validate_skill "$skill_dir"
    found=$((found + 1))
  done
  if [[ "$found" -eq 0 ]]; then
    echo "No goaly-* skill folders found."
    exit 1
  fi
fi

# Summary
echo ""
echo "---"
echo "$total_pass passed, $total_fail failed, $total_warn warnings"

if [[ "$total_fail" -gt 0 ]]; then
  exit 1
fi
exit 0
