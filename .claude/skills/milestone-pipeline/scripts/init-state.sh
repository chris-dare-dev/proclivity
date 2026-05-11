#!/usr/bin/env bash
# init-state.sh — idempotent state init for milestone-pipeline.
# Doubles as a resume signal: re-running on existing state prints
# RESUMING phase=<X> and exits 0.
#
# Usage:
#   init-state.sh <id> [--brief "<text>" | --from-roadmap <path>] [--repo-root <path>]
#                       [--release-lock] [--research-mode default|deep|single]

set -uo pipefail

usage() {
  cat <<EOF
init-state.sh <id> [options]

Options:
  --brief "<text>"            Inline milestone brief (when no roadmap is paired)
  --from-roadmap <path>       Roadmap file; brief is parsed from the milestone section
  --repo-root <path>          Override repo root detection
  --release-lock              Force-clear a stale lock (only if PID is dead)
  --research-mode <mode>      default | deep | single (default: default)
EOF
}

ID=""
BRIEF=""
ROADMAP=""
REPO_ROOT_OVERRIDE=""
RELEASE_LOCK=0
RESEARCH_MODE="default"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --brief) BRIEF="$2"; shift 2 ;;
    --from-roadmap) ROADMAP="$2"; shift 2 ;;
    --repo-root) REPO_ROOT_OVERRIDE="$2"; shift 2 ;;
    --release-lock) RELEASE_LOCK=1; shift ;;
    --research-mode) RESEARCH_MODE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
    *) if [[ -z "$ID" ]]; then ID="$1"; else echo "extra arg: $1" >&2; exit 2; fi; shift ;;
  esac
done

if [[ -z "$ID" ]]; then echo "missing milestone id" >&2; usage >&2; exit 2; fi

# Repo-root detection: explicit > env > git > walk-up
if [[ -n "$REPO_ROOT_OVERRIDE" ]]; then
  REPO_ROOT="$REPO_ROOT_OVERRIDE"
elif [[ -n "${REPO_ROOT:-}" ]]; then
  : # use existing
elif REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  d="$(cd "$(dirname "$0")" && pwd)"
  while [[ "$d" != "/" && ! -d "$d/.git" ]]; do d="$(dirname "$d")"; done
  REPO_ROOT="$d"
fi
export REPO_ROOT

NOTES_DIR="$REPO_ROOT/.claude/notes/milestones/$ID"
STATE="$NOTES_DIR/state.json"
LOCK="$REPO_ROOT/.claude/notes/milestones/.lock"

mkdir -p "$NOTES_DIR" "$NOTES_DIR/research" "$NOTES_DIR/implement" "$NOTES_DIR/critique" "$NOTES_DIR/rectify"

# Lock handling
if [[ "$RELEASE_LOCK" -eq 1 ]]; then
  if [[ -f "$LOCK" ]]; then
    pid="$(cut -d: -f1 < "$LOCK")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "lock holder PID $pid is alive; refusing to release" >&2; exit 1
    fi
    rm -f "$LOCK"
    echo "released stale lock"
  else
    echo "no lock to release"
  fi
fi

if [[ -f "$LOCK" ]]; then
  pid="$(cut -d: -f1 < "$LOCK")"
  locked_id="$(cut -d: -f2 < "$LOCK")"
  if [[ "$locked_id" == "$ID" ]]; then
    : # same milestone — re-runs are fine; silently re-take below if stale
    echo "$$:$ID:$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK"
  elif kill -0 "$pid" 2>/dev/null; then
    echo "lock held by milestone $locked_id (pid $pid); only one milestone at a time" >&2; exit 1
  else
    echo "WARN: stale lock from dead pid $pid (milestone $locked_id); re-run with --release-lock to clear" >&2
    exit 1
  fi
else
  echo "$$:$ID:$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK"
fi

# Idempotent: existing state -> print resume signal and exit
if [[ -f "$STATE" ]]; then
  phase="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["phase"])' "$STATE" 2>/dev/null || echo "unknown")"
  echo "RESUMING phase=$phase milestone=$ID"
  exit 0
fi

# Resolve brief
if [[ -n "$ROADMAP" ]]; then
  if [[ ! -f "$ROADMAP" ]]; then
    echo "roadmap file not found: $ROADMAP" >&2; exit 1
  fi
  BRIEF_CONTENT="$(python3 "$(dirname "$0")/parse-roadmap-milestone.py" "$ROADMAP" "$ID")"
  if [[ $? -ne 0 || -z "$BRIEF_CONTENT" ]]; then
    echo "could not extract milestone $ID from $ROADMAP" >&2; exit 1
  fi
  BRIEF_SOURCE="$ROADMAP"
elif [[ -n "$BRIEF" ]]; then
  BRIEF_CONTENT="$BRIEF"
  BRIEF_SOURCE="inline"
else
  echo "must provide --brief or --from-roadmap" >&2; exit 2
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export STATE_PATH="$STATE" MID="$ID" NOW BRIEF_SOURCE RESEARCH_MODE BRIEF_CONTENT

python3 <<'PYEOF'
import json, os
state = {
    "id": os.environ["MID"],
    "created_at": os.environ["NOW"],
    "updated_at": os.environ["NOW"],
    "phase": "init",
    "phase_history": [{"phase": "init", "entered_at": os.environ["NOW"], "exited_at": None, "duration_seconds": None}],
    "milestone_brief": os.environ["BRIEF_CONTENT"],
    "milestone_brief_source": os.environ["BRIEF_SOURCE"],
    "research_mode": os.environ["RESEARCH_MODE"],
    "research_briefs": [],
    "research_synthesis": None,
    "implementation_path": None,
    "implementation_base": None,
    "implementation_commits": [],
    "implementation_branch": None,
    "external_writes_required": [],
    "critique_path": None,
    "critics_run": [],
    "critique_finding_counts": {"critical": 0, "high": 0, "medium": 0, "low": 0},
    "rectification_commit": None,
    "fixed_findings": [],
    "deferred_findings": [],
    "invalidated_findings": [],
    "regression_tests_added": [],
    "external_writes_authorized": [],
    "external_writes_completed": [],
}
sp = os.environ["STATE_PATH"]
tmp = sp + ".tmp"
with open(tmp, "w") as f:
    json.dump(state, f, indent=2)
    f.write("\n")
os.replace(tmp, sp)
PYEOF

echo "INITIALIZED phase=init milestone=$ID"
echo "  state: $STATE"
echo "  brief: $BRIEF_SOURCE"
exit 0
