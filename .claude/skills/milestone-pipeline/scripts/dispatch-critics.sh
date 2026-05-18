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

# Proclivity-specific gates. This codebase has no web/, bin/site, infra/,
# Pulumi.*.yaml, or docker-compose.yml — those checks lived in the upstream
# personal-website pipeline and are inert here. The trigger surfaces below
# reflect proclivity's actual structure (Vite + MV3 Chrome extension + a
# single GitHub Actions workflow).
touches_web=0
touches_infra=0
touches_lfs=0

# Web/client surface — any TS/CSS/HTML/manifest/build-config change.
if echo "$DIFF_FILES" | grep -qE '^(src/|public/|manifest\.config\.ts$|vite\.config\.ts$|tsconfig\.json$|package(-lock)?\.json$|index\.html$)'; then
  touches_web=1
fi
# CI/workflow surface — proclivity's only "infra" today.
if echo "$DIFF_FILES" | grep -qE '^\.github/workflows/'; then
  touches_infra=1
fi
# LFS surface — proclivity has no .gitattributes today; the gate fires
# when one is introduced or when binary assets are added/replaced.
if echo "$DIFF_FILES" | grep -qE '^(\.gitattributes$|.*\.(png|jpg|jpeg|gif|webp|heic|mp4|mov|webm|m4a|mp3|pdf|woff2?)$)'; then
  touches_lfs=1
fi

# Canonical critic names match agent file names under .claude/agents/ so
# the orchestrator's `subagent_type` lookup resolves directly — no legacy
# name → file mapping required. See H8 in the conversion critique.
conditional_critics=()
[[ "$touches_web" -eq 1 ]] && conditional_critics+=("milestone-web-perf-critic")
[[ "$touches_infra" -eq 1 ]] && conditional_critics+=("milestone-infra-critic")
[[ "$touches_lfs" -eq 1 ]] && conditional_critics+=("milestone-lfs-critic")

optional_critics=()
[[ "$INCLUDE_OSS" -eq 1 ]] && optional_critics+=("milestone-oss-scout")

# Emit JSON
python3 - "${conditional_critics[@]}" --opt "${optional_critics[@]}" <<'PYEOF'
import json, sys
args = sys.argv[1:]
opt_idx = args.index("--opt") if "--opt" in args else len(args)
conditional = args[:opt_idx]
optional = args[opt_idx + 1:] if opt_idx < len(args) else []
print(json.dumps({
    "always": ["milestone-adversary-critic"],
    "conditional": conditional,
    "optional": optional,
}, indent=2))
PYEOF
