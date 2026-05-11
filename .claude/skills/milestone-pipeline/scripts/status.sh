#!/usr/bin/env bash
# status.sh — human-readable state dump for a milestone.
# Usage: status.sh <id> [--repo-root <path>]

set -uo pipefail

ID="$1"
REPO_ROOT_OVERRIDE=""
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root) REPO_ROOT_OVERRIDE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -n "$REPO_ROOT_OVERRIDE" ]]; then
  REPO_ROOT="$REPO_ROOT_OVERRIDE"
elif [[ -n "${REPO_ROOT:-}" ]]; then
  :
elif REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  d="$(cd "$(dirname "$0")" && pwd)"
  while [[ "$d" != "/" && ! -d "$d/.git" ]]; do d="$(dirname "$d")"; done
  REPO_ROOT="$d"
fi

STATE="$REPO_ROOT/.claude/notes/milestones/$ID/state.json"
if [[ ! -f "$STATE" ]]; then
  echo "no state for milestone $ID at $STATE" >&2; exit 1
fi

export STATE_PATH="$STATE"
python3 <<'PYEOF'
import json, os
s = json.load(open(os.environ["STATE_PATH"]))
print(f"milestone: {s['id']}")
print(f"phase:     {s['phase']}")
print(f"created:   {s['created_at']}")
print(f"updated:   {s['updated_at']}")
print(f"brief src: {s.get('milestone_brief_source','')}")
print(f"research:  mode={s.get('research_mode','')}  briefs={len(s.get('research_briefs',[]))}")
print(f"impl:      path={s.get('implementation_path')}  commits={len(s.get('implementation_commits',[]))}  branch={s.get('implementation_branch')}")
print(f"critics:   {[c['name'] for c in s.get('critics_run',[])]}")
fc = s.get("critique_finding_counts", {})
print(f"findings:  C={fc.get('critical',0)} H={fc.get('high',0)} M={fc.get('medium',0)} L={fc.get('low',0)}")
print(f"fixed:     {s.get('fixed_findings',[])}")
print(f"deferred:  {s.get('deferred_findings',[])}")
print(f"invalid:   {[f['id'] for f in s.get('invalidated_findings',[])]}")
print(f"rect SHA:  {s.get('rectification_commit')}")
ew_req = s.get("external_writes_required", [])
ew_auth = s.get("external_writes_authorized", [])
ew_done = s.get("external_writes_completed", [])
print(f"ext writes required:    {ew_req}")
print(f"ext writes authorized:  {ew_auth}")
print(f"ext writes completed:   {ew_done}")
print()
print("phase history:")
for p in s.get("phase_history", []):
    dur = p.get("duration_seconds")
    dur_s = f"{dur:.0f}s" if isinstance(dur, (int, float)) else "(in progress)" if p.get("exited_at") is None else ""
    print(f"  {p['phase']:30s}  {p.get('entered_at','')}  {dur_s}")
PYEOF
