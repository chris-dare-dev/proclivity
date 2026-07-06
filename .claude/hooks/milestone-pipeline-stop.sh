#!/usr/bin/env bash
# milestone-pipeline-stop.sh — run status.sh if a milestone is in-flight when
# the session ends, so the user knows where the pipeline paused.
#
# Hook type: Stop (PostSession)
# To wire up, add to .claude/settings.json under "Stop":
#
#   "Stop": [
#     {
#       "hooks": [
#         {
#           "type": "command",
#           "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/milestone-pipeline-stop.sh\""
#         }
#       ]
#     }
#   ]
#
# NOTE: Wired into .claude/settings.json as a Stop hook (2026-05-17). The
# hook fires when the user ends the Claude Code session and prints a resume
# line if a milestone lock is held.

# Intentional: no `set -e`. A Stop hook must never block session exit, so
# non-critical failures (e.g. status.sh not executable, lock-file race)
# should be tolerated. `set -uo pipefail` is enough to catch unset-var
# bugs without aborting on any non-zero return.
set -uo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
SCRIPTS="$REPO_ROOT/.claude/scripts"
LOCK="$REPO_ROOT/.claude/notes/milestones/.lock"

# No lock = no active milestone; exit silently.
[[ -f "$LOCK" ]] || exit 0

LOCK_CONTENT=$(cat "$LOCK" 2>/dev/null || true)
MILESTONE_ID=$(echo "$LOCK_CONTENT" | cut -d: -f2)

[[ -z "$MILESTONE_ID" ]] && exit 0

# Check if the lock PID is still alive (i.e. the session might still be running
# in another window). If so, don't print — we're not the terminating session.
LOCK_PID=$(echo "$LOCK_CONTENT" | cut -d: -f1)
if kill -0 "$LOCK_PID" 2>/dev/null && [[ "$LOCK_PID" != "$$" ]]; then
  exit 0
fi

echo ""
echo "=== milestone-pipeline: session ended mid-pipeline ==="
echo "Milestone: $MILESTONE_ID"
echo ""

# milestone-pipeline-status.sh exits 1 if no state exists; tolerate either way.
if [[ -f "$SCRIPTS/milestone-pipeline-status.sh" ]]; then
  bash "$SCRIPTS/milestone-pipeline-status.sh" "$MILESTONE_ID" || true
fi

echo ""
echo "To resume: /milestone-pipeline $MILESTONE_ID --resume"
echo "======================================================="
