#!/bin/bash
# check-sync-status.sh — Check .sync-log/push.log for errors
# Usage: bash check-sync-status.sh <project-root>
# Returns last push status. Exit 0 = OK, Exit 1 = error detected.
set -euo pipefail

PROJECT_ROOT="${1:?Usage: check-sync-status.sh <project-root>}"
LOG="$PROJECT_ROOT/.sync-log/push.log"

if [ ! -f "$LOG" ]; then
  echo "NO_LOG: .sync-log/push.log not found"
  exit 0
fi

LAST=$(tail -1 "$LOG")
if echo "$LAST" | grep -qi "error\|fail"; then
  echo "ERROR: $LAST"
  exit 1
fi

echo "OK: $LAST"
