#!/usr/bin/env python3
"""Lint a roadmap doc against the canonical schema.

Checks performed (each becomes a separate issue with a code):
  S001  All canonical sections present (<!-- ROADMAP:section:* -->)
  S002  No template placeholders left ({{TOKEN}})
  S003  Every [MUST] assumption has a spike OR an evidence citation
  S004  Every Now-lane story has Given / When / Then
  S005  Every epic id matches <slug>-eN[a-z]?
  S006  MoSCoW Must cap satisfied (delegates to score-moscow.py logic)
  S007  Dependency graph is a DAG (no cycles, no self-deps)

Usage:
  validate-roadmap.py <slug>                          # full lint
  validate-roadmap.py <slug> --report-first-unpopulated   # print first marker with placeholders
  validate-roadmap.py <slug> --allow S003,S004        # skip listed checks (use sparingly)

Exit codes:
  0 clean
  1 lint failure (issues printed to stderr)
  2 usage error
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

CANONICAL_SECTIONS = [
    "meta",
    "refine",
    "decompose",
    "sequence",
    "lanes",
    "spikes",
    "tracking",
    "handoff",
]

EPIC_ID_RE = re.compile(r"^[a-z][a-z0-9-]*-e\d+[a-z]?$")
SECTION_HEADER_RE = re.compile(r"<!--\s*ROADMAP:section:([a-z-]+)\s*-->")
PLACEHOLDER_RE = re.compile(r"\{\{[A-Z][A-Z0-9_]*\}\}")
STORY_BLOCK_RE = re.compile(
    r"\*\*`([a-z][a-z0-9-]*-e\d+[a-z]?-s\d+[a-z]?)`[^*]*\*\*\s*\((XS|S|M)\)\s*(.*?)(?=\n\*\*`|\n###|\Z)",
    re.DOTALL,
)
GWT_RE = re.compile(r"^\s*Given\s+.+\n.*^\s*When\s+.+\n.*^\s*Then\s+.+", re.MULTILINE | re.DOTALL)


def find_repo_root(flag: str | None) -> Path:
    if flag:
        return Path(flag).resolve()
    env = os.environ.get("REPO_ROOT")
    if env:
        return Path(env).resolve()
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        return Path(out.stdout.strip()).resolve()
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    d = Path(__file__).resolve().parent
    for p in [d, *d.parents]:
        if (p / ".git").exists():
            return p
    sys.exit("error: cannot find repo root")


def section_bodies(text: str) -> dict[str, str]:
    matches = list(SECTION_HEADER_RE.finditer(text))
    bodies = {}
    for i, m in enumerate(matches):
        name = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        bodies[name] = text[start:end]
    return bodies


def check_s001_sections(bodies: dict[str, str]) -> list[str]:
    missing = [s for s in CANONICAL_SECTIONS if s not in bodies]
    return [f"S001 missing section: {s}" for s in missing]


def check_s002_placeholders(text: str) -> list[str]:
    found = set(PLACEHOLDER_RE.findall(text))
    return [f"S002 placeholder remains: {p}" for p in sorted(found)]


def check_s003_must_assumptions(bodies: dict[str, str]) -> list[str]:
    refine = bodies.get("refine", "")
    spikes = bodies.get("spikes", "")
    must_lines = re.findall(r"`\[MUST\]`\s*([^\n—]+)", refine)
    issues = []
    for line in must_lines:
        text = line.strip()
        # Heuristic: a [MUST] is "covered" if it has a literal "spike" OR a
        # file:line citation (e.g., `path:123`) on the same line.
        has_spike_word = "spike" in text.lower()
        has_citation = bool(re.search(r"`[^`]+:\d+`", text)) or bool(re.search(r"\[[^\]]+\]\([^)]+\)", text))
        # Or the spike lane mentions this assumption verbatim
        in_spike_lane = bool(text) and text[:30] in spikes
        if not (has_spike_word or has_citation or in_spike_lane):
            issues.append(f"S003 [MUST] assumption needs spike or evidence: {text[:80]}...")
    return issues


def check_s004_story_acceptance(bodies: dict[str, str]) -> list[str]:
    """Check that every Now-lane story has Given/When/Then acceptance criteria.

    The sequencer references this check by name (roadmap-sequencer.md §Sanity checks).
    It reads the `lanes` section body; if you skip the lanes marker the Now-lane
    stories silently never get validated and the materializer may produce ZERO
    issue drafts.
    """
    lanes = bodies.get("lanes", "")
    # Only stories under "Now" should be checked — Next/Later are intentionally less detailed
    now_section = re.search(r"###\s+Now\s*\([^)]*\)(.*?)(?=^###\s+Next|\Z)", lanes, re.DOTALL | re.MULTILINE)
    if not now_section:
        return []
    now_body = now_section.group(1)
    issues = []
    for m in STORY_BLOCK_RE.finditer(now_body):
        story_id, _size, body = m.groups()
        if not GWT_RE.search(body):
            issues.append(f"S004 story {story_id} missing Given/When/Then")
    return issues


def check_s005_epic_ids(bodies: dict[str, str]) -> list[str]:
    decompose = bodies.get("decompose", "")
    # Find all `<id>` epic identifiers in code spans
    candidates = re.findall(r"`([^`]+)`", decompose)
    issues = []
    seen = set()
    for c in candidates:
        # Filter to things that look like epic ids
        if "-e" in c and "-s" not in c and not c.startswith("epic"):
            if c in seen:
                continue
            seen.add(c)
            if not EPIC_ID_RE.match(c):
                issues.append(f"S005 epic id does not match <slug>-eN pattern: {c}")
    return issues


def check_s006_must_cap(bodies: dict[str, str]) -> list[str]:
    seq = bodies.get("sequence", "")
    rows = re.findall(r"\|\s*`([^`]+)`\s*\|\s*(Must|Should|Could|Won't)\s*\|", seq, re.IGNORECASE)
    if not rows:
        return ["S006 no MoSCoW rows in §7.1"]
    total = len(rows)
    musts = sum(1 for _, t in rows if t.capitalize() == "Must")
    if musts / total > 0.60:
        return [f"S006 Must cap exceeded: {musts}/{total} = {musts / total:.0%} > 60%"]
    return []


def check_s007_dag(bodies: dict[str, str]) -> list[str]:
    decompose = bodies.get("decompose", "")
    # Parse "| `slug-e2` | e1 |" rows
    rows = re.findall(r"\|\s*`([^`]+)`\s*\|\s*([^\|]+?)\s*\|", decompose)
    deps: dict[str, list[str]] = {}
    for epic, dep_field in rows:
        if not EPIC_ID_RE.match(epic):
            continue
        if dep_field.strip() in ("—", "-", "", "None"):
            deps[epic] = []
        else:
            slug = epic.rsplit("-e", 1)[0]
            d_ids = []
            for tok in re.split(r"[,\s]+", dep_field):
                tok = tok.strip().strip("`")
                if not tok:
                    continue
                if tok.startswith("e"):
                    tok = f"{slug}-{tok}"
                if EPIC_ID_RE.match(tok):
                    d_ids.append(tok)
            deps[epic] = d_ids
    issues = []
    # Self-dep check
    for e, ds in deps.items():
        if e in ds:
            issues.append(f"S007 self-dependency: {e}")
    # Cycle check via DFS
    WHITE, GREY, BLACK = 0, 1, 2
    color = {e: WHITE for e in deps}

    def dfs(node: str, stack: list[str]) -> None:
        if node not in deps:
            return
        if color[node] == GREY:
            issues.append(f"S007 cycle detected: {' -> '.join([*stack, node])}")
            return
        if color[node] == BLACK:
            return
        color[node] = GREY
        for d in deps[node]:
            dfs(d, [*stack, node])
        color[node] = BLACK

    for e in deps:
        if color[e] == WHITE:
            dfs(e, [])
    return issues


def report_first_unpopulated(text: str) -> str | None:
    bodies = section_bodies(text)
    for name in CANONICAL_SECTIONS:
        if name not in bodies:
            return name
        if PLACEHOLDER_RE.search(bodies[name]):
            return name
    return None


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug")
    ap.add_argument("--report-first-unpopulated", action="store_true")
    ap.add_argument("--allow", help="comma-separated check codes to skip (e.g., S003,S004)")
    ap.add_argument("--repo-root")
    args = ap.parse_args(argv)

    repo = find_repo_root(args.repo_root)
    roadmap = repo / "plans" / f"{args.slug}-roadmap.md"
    if not roadmap.exists():
        print(f"error: {roadmap} not found", file=sys.stderr)
        return 1

    text = roadmap.read_text()

    if args.report_first_unpopulated:
        first = report_first_unpopulated(text)
        if first is None:
            print("none — all sections populated")
        else:
            print(first)
        return 0

    skip = set((args.allow or "").split(",")) if args.allow else set()
    skip.discard("")

    bodies = section_bodies(text)

    all_issues: list[str] = []
    checks = [
        ("S001", lambda: check_s001_sections(bodies)),
        ("S002", lambda: check_s002_placeholders(text)),
        ("S003", lambda: check_s003_must_assumptions(bodies)),
        ("S004", lambda: check_s004_story_acceptance(bodies)),
        ("S005", lambda: check_s005_epic_ids(bodies)),
        ("S006", lambda: check_s006_must_cap(bodies)),
        ("S007", lambda: check_s007_dag(bodies)),
    ]
    for code, fn in checks:
        if code in skip:
            print(f"{code} SKIPPED (--allow)")
            continue
        issues = fn()
        all_issues.extend(issues)

    if not all_issues:
        print(f"{roadmap}: clean")
        return 0

    for issue in all_issues:
        print(issue, file=sys.stderr)
    print(f"\n{len(all_issues)} issue(s)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
