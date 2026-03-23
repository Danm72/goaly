#!/bin/bash
# Usage: bash tests/concat-fixtures.sh <fixture-dir> [<extra-dir>...]
# Outputs all .md files concatenated with file path headers.
# Used to pre-generate fixture content for promptfoo eval prompts.

for FIXTURE_DIR in "$@"; do
    if [ ! -d "$FIXTURE_DIR" ]; then
        echo "WARNING: Directory not found: $FIXTURE_DIR" >&2
        continue
    fi
    find "$FIXTURE_DIR" -name "*.md" -type f | sort | while read -r f; do
        # Show path relative to the fixture root's parent for readability
        rel=$(python3 -c "import os; print(os.path.relpath('$f', '$(dirname "$FIXTURE_DIR")'))")
        echo "=== $rel ==="
        cat "$f"
        echo
    done
done
