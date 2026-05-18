#!/usr/bin/env bash
# Initialize frontend-uplift state directory and state.json.
#
# Usage: init-uplift.sh <uplift-id> [--brief "verbatim user brief"] [--views "csv,of,view,ids"]
#
# Idempotent: if state.json exists, prints current phase and exits 0.
#
# <uplift-id> is a free-form slug.  Typical convention: date-tagged scope,
# e.g. "2026q2-visual-refresh" or "sprint-modernize-v1".
#
# --views is an optional CSV of view ids the visual scout should walk.
# Default (empty): the visual scout walks the canonical 8-view set documented
# in references/frontend-uplift/phase-discover.md.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: init-uplift.sh <uplift-id> [--brief \"...\"] [--views \"csv\"]" >&2
  exit 2
fi

ID="$1"
shift

BRIEF=""
VIEWS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --brief)
      BRIEF="${2:-}"
      shift 2
      ;;
    --views)
      VIEWS="${2:-}"
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
DIR="$REPO_ROOT/.claude/notes/frontend-uplifts/$ID"
STATE="$DIR/state.json"

if [[ -f "$STATE" ]]; then
  PHASE=$(python3 -c "import json; print(json.load(open('$STATE'))['phase'])")
  echo "state already exists at $STATE (phase=$PHASE) — resuming"
  exit 0
fi

mkdir -p "$DIR/discover" "$DIR/screenshots" "$DIR/artifacts"

NOW=$(python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")

python3 - "$STATE" "$ID" "$NOW" "$BRIEF" "$VIEWS" <<'PY'
import json, os, sys
state_path, sid, now, brief, views_csv = sys.argv[1:6]
views = [v.strip() for v in views_csv.split(",") if v.strip()] if views_csv else []
state = {
    "id": sid,
    "kind": "frontend-uplift",
    "created_at": now,
    "updated_at": now,
    "phase": "init",
    "phase_history": [{"phase": "init", "at": now}],
    "uplift_brief": brief,
    # Phase 1
    "discover_mode": None,        # "standard" (4 agents) | "lean" (visual + current-state-critic only)
    "views_to_walk": views,       # user override; empty → canonical 8-view set
    "agents_dispatched": [],
    "agents_returned": [],
    "discover_briefs": [],
    "screenshot_dir": f".claude/notes/frontend-uplifts/{sid}/screenshots",
    # Phase 2
    "synthesis_path": None,
    "candidate_count": 0,
    # Phase 3
    "challenge_path": None,
    "challenge_finding_counts": {"critical": 0, "high": 0, "medium": 0, "low": 0},
    # Phase 4
    "final_report_path": None,
    "ranked_candidates": [],
}
tmp = state_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(state, f, indent=2)
os.replace(tmp, state_path)
PY

echo "initialized $STATE"
echo "  brief: $(if [[ -n "$BRIEF" ]]; then echo "set ($(echo "$BRIEF" | wc -c | tr -d ' ') chars)"; else echo "(empty — pass --brief to populate)"; fi)"
echo "  views: $(if [[ -n "$VIEWS" ]]; then echo "$VIEWS"; else echo "(default — canonical 8-view set)"; fi)"
echo "  phase: init"
