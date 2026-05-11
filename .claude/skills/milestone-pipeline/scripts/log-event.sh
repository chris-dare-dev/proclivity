#!/usr/bin/env bash
# log-event.sh — append a JSON line to the audit log for a milestone.
#
# Usage:
#   log-event.sh <id> <event-type> [k=v ...]
# Example:
#   log-event.sh articles-redesign-m1 phase-enter phase=research-running prev=init
#
# All extra args are recorded as fields. Values are JSON-parsed if possible,
# otherwise stored as strings.

set -uo pipefail

ID="$1"; shift
EVENT="$1"; shift

if [[ -n "${REPO_ROOT:-}" ]]; then
  :
elif REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  echo "no repo root" >&2; exit 1
fi

LOG="$REPO_ROOT/.claude/notes/milestones/$ID/audit.jsonl"
mkdir -p "$(dirname "$LOG")"

export EVENT ID
python3 - "$LOG" "$@" <<'PYEOF'
import json, os, sys, datetime, re
log = sys.argv[1]
extras = sys.argv[2:]
record = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    "milestone": os.environ["ID"],
    "event": os.environ["EVENT"],
}
for kv in extras:
    if "=" not in kv:
        continue
    k, v = kv.split("=", 1)
    try:
        record[k] = json.loads(v)
    except json.JSONDecodeError:
        record[k] = v
with open(log, "a") as f:
    f.write(json.dumps(record) + "\n")
PYEOF
