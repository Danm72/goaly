#!/bin/bash
# append-run-log.sh — Append a timestamped entry to a skill's run log
# Usage: bash append-run-log.sh <skill-dir> <message>
# Creates data/ dir if missing. Appends ISO timestamp + message.
set -euo pipefail

SKILL_DIR="${1:?Usage: append-run-log.sh <skill-dir> <message>}"
MESSAGE="${2:?Usage: append-run-log.sh <skill-dir> <message>}"

mkdir -p "$SKILL_DIR/data"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $MESSAGE" >> "$SKILL_DIR/data/run-log.txt"
