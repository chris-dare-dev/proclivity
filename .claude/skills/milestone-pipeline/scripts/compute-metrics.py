#!/usr/bin/env python3
"""compute-metrics.py — read state.json + audit.jsonl; emit metrics.json and
append a one-line summary to .claude/notes/milestones/_index.jsonl.

Usage:
    compute-metrics.py <id>
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def repo_root() -> Path:
    if env := os.environ.get("REPO_ROOT"):
        return Path(env)
    import subprocess
    out = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
    return Path(out)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: compute-metrics.py <id>", file=sys.stderr); return 2
    mid = sys.argv[1]
    base = repo_root() / ".claude" / "notes" / "milestones" / mid
    state_path = base / "state.json"
    audit_path = base / "audit.jsonl"
    metrics_path = base / "metrics.json"
    index_path = repo_root() / ".claude" / "notes" / "milestones" / "_index.jsonl"

    if not state_path.exists():
        print(f"no state for {mid}", file=sys.stderr); return 1

    state = json.loads(state_path.read_text())

    audit = []
    if audit_path.exists():
        for line in audit_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                audit.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    # Phase wall-clock from history
    phases: dict[str, dict] = {}
    for entry in state.get("phase_history", []):
        if entry.get("duration_seconds") is not None:
            ph = entry["phase"]
            phases.setdefault(ph, {"wall_seconds": 0.0})
            phases[ph]["wall_seconds"] += float(entry["duration_seconds"])

    # Token + USD usage from audit (if present in agent-return events)
    for ev in audit:
        if ev.get("event") == "agent-return":
            ph = ev.get("phase")
            if not ph:
                continue
            phases.setdefault(ph, {})
            phases[ph]["input_tokens"] = phases[ph].get("input_tokens", 0) + int(ev.get("input_tokens", 0) or 0)
            phases[ph]["output_tokens"] = phases[ph].get("output_tokens", 0) + int(ev.get("output_tokens", 0) or 0)
            phases[ph]["cache_read_tokens"] = phases[ph].get("cache_read_tokens", 0) + int(ev.get("cache_read_tokens", 0) or 0)
            phases[ph]["usd"] = round(phases[ph].get("usd", 0.0) + float(ev.get("usd", 0.0) or 0.0), 4)
            phases[ph]["agents"] = phases[ph].get("agents", 0) + 1

    started = state.get("created_at")
    completed = state.get("updated_at") if state.get("phase") == "complete" else None
    wall = None
    if started and completed:
        try:
            wall = (datetime.fromisoformat(completed.replace("Z", "+00:00"))
                    - datetime.fromisoformat(started.replace("Z", "+00:00"))).total_seconds()
        except Exception:
            wall = None

    counts = state.get("critique_finding_counts", {})

    metrics = {
        "milestone_id": mid,
        "started": started,
        "completed": completed,
        "wall_clock_seconds": wall,
        "phases": phases,
        "findings": counts,
        "fixed": state.get("fixed_findings", []),
        "deferred": state.get("deferred_findings", []),
        "invalidated": [f["id"] for f in state.get("invalidated_findings", [])],
        "invalidation_rate": (
            round(len(state.get("invalidated_findings", []))
                  / max(1, sum(counts.values())), 3)
        ),
        "external_writes_required": state.get("external_writes_required", []),
        "external_writes_completed": state.get("external_writes_completed", []),
        "total_usd": round(sum(p.get("usd", 0.0) for p in phases.values()), 4),
        "total_input_tokens": sum(p.get("input_tokens", 0) for p in phases.values()),
        "total_output_tokens": sum(p.get("output_tokens", 0) for p in phases.values()),
    }

    tmp = metrics_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(metrics, indent=2) + "\n")
    os.replace(tmp, metrics_path)

    # Append flat one-liner to the global index
    index_path.parent.mkdir(parents=True, exist_ok=True)
    summary = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "milestone_id": mid,
        "phase": state.get("phase"),
        "started": started,
        "completed": completed,
        "wall_clock_seconds": wall,
        "findings": counts,
        "fixed": len(state.get("fixed_findings", [])),
        "deferred": len(state.get("deferred_findings", [])),
        "invalidated": len(state.get("invalidated_findings", [])),
        "invalidation_rate": metrics["invalidation_rate"],
        "total_usd": metrics["total_usd"],
        "rect_commit": state.get("rectification_commit"),
        "external_writes_required": state.get("external_writes_required", []),
    }
    with open(index_path, "a") as f:
        f.write(json.dumps(summary) + "\n")

    print(f"wrote {metrics_path}")
    print(f"appended {index_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
