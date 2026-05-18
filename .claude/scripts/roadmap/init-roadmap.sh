#!/usr/bin/env bash
# Initialize a roadmap doc + state pointer for the /roadmap skill.
#
# Usage:
#   init-roadmap.sh <slug> [--brief "verbatim brief"] [--title "Display title"]
#   init-roadmap.sh <slug> --advance <phase>     # update state.json phase
#   init-roadmap.sh <slug> --status              # print current phase + roadmap path
#
# Idempotent on re-run: if plans/<slug>-roadmap.md exists, prints first
# unpopulated section marker and exits 0 (the "resume" signal).
#
# Repo root detection (in order):
#   1. --repo-root <path> flag
#   2. $REPO_ROOT env var
#   3. git rev-parse --show-toplevel from CWD
#   4. walk up from script dir
#
# Exit codes:
#   0 success (including resume detection)
#   1 user-actionable failure (no repo root, no template, etc.)
#   2 input/usage error

set -euo pipefail

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
  exit 2
}

# ---------- arg parse ----------
SLUG=""
BRIEF=""
TITLE=""
ADVANCE=""
STATUS_ONLY=0
REPO_ROOT_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --brief)        BRIEF="${2:-}"; shift 2 ;;
    --title)        TITLE="${2:-}"; shift 2 ;;
    --advance)      ADVANCE="${2:-}"; shift 2 ;;
    --status)       STATUS_ONLY=1; shift ;;
    --repo-root)    REPO_ROOT_FLAG="${2:-}"; shift 2 ;;
    -h|--help)      usage ;;
    --*)            echo "unknown flag: $1" >&2; exit 2 ;;
    *)              if [[ -z "$SLUG" ]]; then SLUG="$1"; shift; else echo "unexpected: $1" >&2; exit 2; fi ;;
  esac
done

[[ -z "$SLUG" ]] && { echo "error: <slug> is required" >&2; exit 2; }

# Slug shape — kebab-case, lowercase, starts with a letter, ≤30 chars.
# OSE-canonical: ^[a-z][a-z0-9-]{0,29}$
# (Also blocks path-traversal class of bad input like "../../etc/passwd".)
if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]{0,29}$ ]]; then
  echo "error: invalid slug '$SLUG' — must match ^[a-z][a-z0-9-]{0,29}\$ (kebab-case, lowercase, starts with letter, ≤30 chars)" >&2
  echo "examples: gantt-drag, reminders-recurrence, photos-redesign" >&2
  exit 2
fi

# ---------- repo root ----------
if [[ -n "$REPO_ROOT_FLAG" ]]; then
  REPO_ROOT="$REPO_ROOT_FLAG"
elif [[ -n "${REPO_ROOT:-}" ]]; then
  : # use env
elif REPO_ROOT_TRY=$(git rev-parse --show-toplevel 2>/dev/null); then
  REPO_ROOT="$REPO_ROOT_TRY"
else
  # Walk up from script dir looking for .git
  d="$(cd "$(dirname "$0")" && pwd)"
  while [[ "$d" != "/" && ! -d "$d/.git" ]]; do d="$(dirname "$d")"; done
  if [[ -d "$d/.git" ]]; then
    REPO_ROOT="$d"
  else
    echo "error: cannot find repo root (no .git ancestor and no flag/env)" >&2
    exit 1
  fi
fi

# ---------- paths ----------
TEMPLATE="$REPO_ROOT/.claude/references/roadmap/templates/roadmap.md"
PLANS_DIR="$REPO_ROOT/plans"
ROADMAP_PATH="$PLANS_DIR/$SLUG-roadmap.md"
STATE_DIR="$REPO_ROOT/.claude/notes/roadmaps/$SLUG"
STATE_PATH="$STATE_DIR/state.json"

# ---------- --status mode ----------
if [[ $STATUS_ONLY -eq 1 ]]; then
  if [[ ! -f "$STATE_PATH" ]]; then
    echo "no state for $SLUG — run init-roadmap.sh $SLUG first" >&2
    exit 1
  fi
  python3 -c "import json; s=json.load(open('$STATE_PATH')); print(f\"slug: {s['slug']}\\nphase: {s['phase']}\\nroadmap: {s.get('roadmap_path','?')}\\nupdated: {s['updated_at']}\")"
  exit 0
fi

# ---------- --advance mode ----------
if [[ -n "$ADVANCE" ]]; then
  if [[ ! -f "$STATE_PATH" ]]; then
    echo "error: no state for $SLUG; init it first" >&2
    exit 1
  fi
  python3 - "$STATE_PATH" "$ADVANCE" <<'PY'
import json, sys, os
from datetime import datetime, timezone
state_path, new_phase = sys.argv[1:3]
allowed = {"init","refine","decompose","sequence","materialize","complete"}
if new_phase not in allowed:
    sys.exit(f"unknown phase: {new_phase}. Valid: {sorted(allowed)}")
with open(state_path) as f:
    s = json.load(f)
s["phase"] = new_phase
s["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
tmp = state_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(s, f, indent=2)
os.replace(tmp, state_path)
print(f"ADVANCED: {s['slug']} phase={new_phase}")
PY
  exit 0
fi

# ---------- create mode ----------
[[ ! -f "$TEMPLATE" ]] && { echo "error: template not found: $TEMPLATE" >&2; exit 1; }

if [[ -f "$ROADMAP_PATH" ]]; then
  # Idempotent resume signal — parse current phase from state.json
  RESUME_PHASE="init"
  if [[ -f "$STATE_PATH" ]]; then
    RESUME_PHASE=$(python3 -c "import json; s=json.load(open('$STATE_PATH')); print(s['phase'])" 2>/dev/null || echo "init")
  fi
  echo "RESUMING phase=$RESUME_PHASE: $ROADMAP_PATH"
  # Best-effort: report first marker still containing template placeholders
  python3 - "$ROADMAP_PATH" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
# A section is "unpopulated" if its body still contains the literal {{TOKEN}} pattern
sections = {}
for m in re.finditer(r"<!-- ROADMAP:section:([a-z-]+) -->", text):
    sections[m.group(1)] = m.start()
ordered = sorted(sections.items(), key=lambda kv: kv[1])
for i, (name, start) in enumerate(ordered):
    end = ordered[i+1][1] if i+1 < len(ordered) else len(text)
    body = text[start:end]
    if "{{" in body and "}}" in body:
        print(f"  first unpopulated section: {name}")
        break
else:
    print("  all sections populated")
PY
  exit 0
fi

mkdir -p "$PLANS_DIR" "$STATE_DIR"

NOW=$(python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")
TODAY=$(python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%d'))")
[[ -z "$TITLE" ]] && TITLE="$(echo "$SLUG" | sed 's/-/ /g' | python3 -c "import sys; print(sys.stdin.read().strip().title())")"
[[ -z "$BRIEF" ]] && BRIEF="*(brief not yet provided — populate from conversation summary or re-invoke with --brief)*"
AUTHOR="$(git -C "$REPO_ROOT" config user.email 2>/dev/null || echo "unknown")"
BRIEF_SOURCE_LABEL="--brief flag"
[[ "$BRIEF" == *"brief not yet provided"* ]] && BRIEF_SOURCE_LABEL="unspecified"

# Substitute placeholders. Use Python heredoc to avoid bash quoting traps.
python3 - "$TEMPLATE" "$ROADMAP_PATH" "$SLUG" "$TITLE" "$TODAY" "$AUTHOR" "$BRIEF_SOURCE_LABEL" "$BRIEF" <<'PY'
import sys
template_path, out_path, slug, title, today, author, brief_source, brief = sys.argv[1:]
text = open(template_path).read()
subs = {
    "{{SLUG}}": slug,
    "{{TITLE}}": title,
    "{{DATE}}": today,
    "{{AUTHOR}}": author,
    "{{BRIEF_SOURCE}}": brief_source,
    "{{BRIEF}}": brief,
}
for k, v in subs.items():
    text = text.replace(k, v)
with open(out_path, "w") as f:
    f.write(text)
PY

# Write state.json
python3 - "$STATE_PATH" "$SLUG" "$NOW" "$ROADMAP_PATH" <<'PY'
import json, sys
state_path, slug, now, roadmap_path = sys.argv[1:5]
state = {
    "slug": slug,
    "phase": "init",
    "started_at": now,
    "updated_at": now,
    "roadmap_path": roadmap_path,
    "first_unpopulated_section": "refine",
    "gh_issues_requested": False,
    "gh_issues_created": [],
}
with open(state_path, "w") as f:
    json.dump(state, f, indent=2)
PY

echo "INITIALIZED: $ROADMAP_PATH"
echo "state:     $STATE_PATH"
echo "phase:     init"
echo "next:      run /roadmap $SLUG and start Phase 1 (REFINE)"
