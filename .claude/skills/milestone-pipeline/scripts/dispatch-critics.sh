#!/usr/bin/env bash
# dispatch-critics.sh — decide which critics fire for a milestone based on
# `git diff --name-only <base>..HEAD`. Emits JSON to stdout.
#
# Usage: dispatch-critics.sh <id> [<base-sha>] [--include-oss]
# Reads BASE from state.implementation_base if not given.

set -o pipefail

ID="$1"; shift || true
BASE=""
INCLUDE_OSS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-oss) INCLUDE_OSS=1; shift ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) if [[ -z "$BASE" ]]; then BASE="$1"; fi; shift ;;
  esac
done

if [[ -n "${REPO_ROOT:-}" ]]; then
  :
elif REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  echo "cannot determine repo root" >&2; exit 1
fi

if [[ -z "$BASE" ]]; then
  STATE="$REPO_ROOT/.claude/notes/milestones/$ID/state.json"
  if [[ -f "$STATE" ]]; then
    BASE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("implementation_base") or "")' "$STATE")"
  fi
fi
if [[ -z "$BASE" ]]; then
  BASE="HEAD~1"
fi

DIFF_FILES="$(git -C "$REPO_ROOT" diff --name-only "${BASE}..HEAD" 2>/dev/null || true)"

touches_web=0
touches_infra=0
touches_lfs=0

if echo "$DIFF_FILES" | grep -qE '^web/'; then touches_web=1; fi
if echo "$DIFF_FILES" | grep -qE '^(infra/|bin/site$|docker-compose\.yml$|.*Pulumi\..*\.yaml$|web/Dockerfile$|\.claude/scripts/(release-preflight|stack-outputs)\.sh$)'; then
  touches_infra=1
fi
if echo "$DIFF_FILES" | grep -qE '^\.gitattributes$'; then touches_lfs=1; fi

# web/Dockerfile and docker-compose.yml route to infra-auditor (production runtime),
# NOT web-perf-reviewer (client bundle). Even if web/ matches, prefer infra for these.
# (We still let web-perf-reviewer also fire when other web/ files are touched.)

conditional_critics=()
[[ "$touches_web" -eq 1 ]] && conditional_critics+=("web-perf-reviewer")
[[ "$touches_infra" -eq 1 ]] && conditional_critics+=("infra-auditor")
[[ "$touches_lfs" -eq 1 ]] && conditional_critics+=("lfs")

optional_critics=()
[[ "$INCLUDE_OSS" -eq 1 ]] && optional_critics+=("oss-scout")

# Emit JSON
python3 - "${conditional_critics[@]}" --opt "${optional_critics[@]}" <<'PYEOF'
import json, sys
args = sys.argv[1:]
opt_idx = args.index("--opt") if "--opt" in args else len(args)
conditional = args[:opt_idx]
optional = args[opt_idx + 1:] if opt_idx < len(args) else []
print(json.dumps({
    "always": ["adversary"],
    "conditional": conditional,
    "optional": optional,
}, indent=2))
PYEOF
