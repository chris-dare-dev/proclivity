#!/usr/bin/env python3
"""checkpoint.py — state-machine validator + field ops for milestone-pipeline.

Forward-only state machine. Refuses backward transitions and skipped phases.
Atomic writes via temp+rename in the same dir as the target.

Usage:
    checkpoint.py <id> <next-phase>            # advance state
    checkpoint.py <id> --get <field>           # read field (dotted-path)
    checkpoint.py <id> --set 'field=value'     # set field; value parsed as JSON
    checkpoint.py <id> --append 'field=value'  # append to array field
    checkpoint.py <id> --rollback-to <phase>   # explicit unwind, logs to audit

Exit codes:
    0 success
    1 user-actionable failure (refused transition, bad field, etc.)
    2 input/usage error
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PHASES = [
    "init",
    "research-running", "research-complete",
    "implement-running", "implement-complete",
    "critique-running", "critique-complete",
    "rectify-running",
    "complete",
]
# implement-aborted-scope is a side branch off implement-running; documented
# in state-schema.md.
ABORT_PHASES = {"implement-aborted-scope"}

NEXT = {phase: PHASES[i + 1] if i + 1 < len(PHASES) else None for i, phase in enumerate(PHASES)}
INDEX = {phase: i for i, phase in enumerate(PHASES)}


def repo_root() -> Path:
    if env := os.environ.get("REPO_ROOT"):
        return Path(env)
    import subprocess
    try:
        out = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], stderr=subprocess.DEVNULL)
        return Path(out.decode().strip())
    except Exception:
        # Walk up from script dir to nearest .git/
        p = Path(__file__).resolve()
        while p != p.parent:
            if (p / ".git").exists():
                return p
            p = p.parent
        return Path.cwd()


def state_path(milestone_id: str) -> Path:
    return repo_root() / ".claude" / "notes" / "milestones" / milestone_id / "state.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def atomic_write(path: Path, data: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(data)
    os.replace(tmp, path)


def load(milestone_id: str) -> dict[str, Any]:
    p = state_path(milestone_id)
    if not p.exists():
        raise SystemExit(f"state file not found: {p} (did you run init-state.sh?)")
    return json.loads(p.read_text())


def save(milestone_id: str, state: dict[str, Any]) -> None:
    state["updated_at"] = now_iso()
    atomic_write(state_path(milestone_id), json.dumps(state, indent=2) + "\n")


def transition(state: dict[str, Any], next_phase: str) -> dict[str, Any]:
    current = state["phase"]

    # Allow side branch: implement-running -> implement-aborted-scope
    if current == "implement-running" and next_phase == "implement-aborted-scope":
        pass
    # From implement-aborted-scope, allow either back-to-research-running (replan) or complete-via-skip is not allowed.
    elif current == "implement-aborted-scope" and next_phase == "research-running":
        # explicit re-plan is a controlled rollback, log it.
        pass
    elif current not in INDEX:
        raise SystemExit(f"current phase {current!r} is not a known forward state; use --rollback-to to recover")
    elif next_phase not in INDEX and next_phase not in ABORT_PHASES:
        raise SystemExit(f"unknown target phase {next_phase!r}")
    elif next_phase in INDEX and INDEX[next_phase] < INDEX[current]:
        raise SystemExit(f"refused: backward transition {current} -> {next_phase}")
    elif next_phase in INDEX and INDEX[next_phase] != INDEX[current] + 1:
        # also reject "stay in place"
        raise SystemExit(f"refused: skipped transition {current} -> {next_phase} (one step at a time)")

    # exit current phase
    history = state.setdefault("phase_history", [])
    if history and history[-1].get("exited_at") is None:
        entered = history[-1]["entered_at"]
        exited = now_iso()
        try:
            d = (datetime.fromisoformat(exited.replace("Z", "+00:00"))
                 - datetime.fromisoformat(entered.replace("Z", "+00:00"))).total_seconds()
            history[-1]["duration_seconds"] = d
        except Exception:
            history[-1]["duration_seconds"] = None
        history[-1]["exited_at"] = exited

    state["phase"] = next_phase
    history.append({"phase": next_phase, "entered_at": now_iso(), "exited_at": None, "duration_seconds": None})
    return state


def get_field(state: dict[str, Any], dotted: str) -> Any:
    cur: Any = state
    for part in dotted.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def set_field(state: dict[str, Any], spec: str) -> None:
    if "=" not in spec:
        raise SystemExit("--set expects 'field=json-value'")
    field, raw = spec.split("=", 1)
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        # Treat as a string literal
        value = raw
    cur: Any = state
    parts = field.split(".")
    for part in parts[:-1]:
        cur = cur.setdefault(part, {})
    cur[parts[-1]] = value


def append_field(state: dict[str, Any], spec: str) -> None:
    if "=" not in spec:
        raise SystemExit("--append expects 'field=json-value'")
    field, raw = spec.split("=", 1)
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        value = raw
    cur: Any = state
    parts = field.split(".")
    for part in parts[:-1]:
        cur = cur.setdefault(part, {})
    arr = cur.setdefault(parts[-1], [])
    if not isinstance(arr, list):
        raise SystemExit(f"--append: field {field} is not a list")
    arr.append(value)


def rollback_to(state: dict[str, Any], target_phase: str) -> dict[str, Any]:
    if target_phase not in INDEX:
        raise SystemExit(f"--rollback-to: unknown phase {target_phase!r}")
    if target_phase == state["phase"]:
        return state
    history = state.setdefault("phase_history", [])
    history.append({
        "phase": target_phase,
        "entered_at": now_iso(),
        "exited_at": None,
        "duration_seconds": None,
        "rollback": True,
    })
    state["phase"] = target_phase
    return state


def main() -> int:
    p = argparse.ArgumentParser(description="milestone-pipeline state machine")
    p.add_argument("milestone_id")
    p.add_argument("next_phase", nargs="?", help="phase to transition to")
    p.add_argument("--get", help="read a field via dotted path")
    p.add_argument("--set", dest="set_field_spec", help="set a field: 'field=json-value'")
    p.add_argument("--append", dest="append_field_spec", help="append to array field: 'field=json-value'")
    p.add_argument("--rollback-to", help="explicit rollback to phase (logged)")
    args = p.parse_args()

    state = load(args.milestone_id)

    if args.get is not None:
        v = get_field(state, args.get)
        if v is None:
            return 1
        if isinstance(v, (dict, list)):
            print(json.dumps(v))
        else:
            print(v)
        return 0

    if args.set_field_spec:
        set_field(state, args.set_field_spec)
        save(args.milestone_id, state)
        return 0

    if args.append_field_spec:
        append_field(state, args.append_field_spec)
        save(args.milestone_id, state)
        return 0

    if args.rollback_to:
        state = rollback_to(state, args.rollback_to)
        save(args.milestone_id, state)
        return 0

    if args.next_phase:
        state = transition(state, args.next_phase)
        save(args.milestone_id, state)
        return 0

    p.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
