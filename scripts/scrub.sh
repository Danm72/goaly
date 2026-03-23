#!/usr/bin/env bash
# scrub.sh — Replace PII patterns in all tracked files using scrub-patterns.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PATTERNS_FILE="$SCRIPT_DIR/scrub-patterns.json"

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed." >&2
  exit 1
fi

if [[ ! -f "$PATTERNS_FILE" ]]; then
  echo "ERROR: $PATTERNS_FILE not found." >&2
  exit 1
fi

# Collect all files to process (excluding .git, node_modules, the patterns file itself, and binary files)
FILES=()
while IFS= read -r f; do
  FILES+=("$f")
done < <(
  find "$REPO_DIR" \
    -type f \
    ! -path '*/.git/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/scripts/scrub-patterns.json' \
    ! -name '*.png' ! -name '*.jpg' ! -name '*.jpeg' ! -name '*.gif' \
    ! -name '*.ico' ! -name '*.woff' ! -name '*.woff2' ! -name '*.ttf' \
    ! -name '*.eot' ! -name '*.pdf' ! -name '*.zip' ! -name '*.tar.gz' \
    2>/dev/null
)

total_replacements=0

# Extract all key-value pairs from all categories, processing longer patterns first
# to avoid partial replacements (e.g., "[Your Name]" before "[Owner]")
PAIRS=()
while IFS= read -r line; do
  PAIRS+=("$line")
done < <(
  jq -r '
    to_entries[]
    | .value
    | to_entries[]
    | "\(.key)\t\(.value)"
  ' "$PATTERNS_FILE" | awk '{ print length($0) "\t" $0 }' | sort -t$'\t' -k1 -rn | cut -f2-
)

for pair in "${PAIRS[@]}"; do
  pattern="$(printf '%s' "$pair" | cut -f1)"
  replacement="$(printf '%s' "$pair" | cut -f2)"

  # Skip empty patterns
  [[ -z "$pattern" ]] && continue

  count=0
  for file in "${FILES[@]}"; do
    [[ -f "$file" ]] || continue
    # Count occurrences before replacing
    matches=$(grep -cF "$pattern" "$file" 2>/dev/null || true)
    if [[ "$matches" -gt 0 ]]; then
      count=$((count + matches))
      # Use perl for reliable literal string replacement (avoids sed escaping issues)
      perl -pi -e "
        BEGIN { \$p = quotemeta(q{$pattern}); \$r = q{$replacement}; }
        s/\$p/\$r/g;
      " "$file"
    fi
  done

  if [[ "$count" -gt 0 ]]; then
    echo "  Replaced '$pattern' -> '$replacement' ($count occurrences)"
    total_replacements=$((total_replacements + count))
  fi
done

echo ""
echo "Scrub complete. Total replacements: $total_replacements"
