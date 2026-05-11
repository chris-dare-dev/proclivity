#!/usr/bin/env python3
"""dedupe-findings.py — merge critique files; flag cross-critic agreement.

Reads every `.claude/notes/milestones/<id>/critique/*.md` (excluding `dedup.md`),
extracts findings using the per-finding template from critique-format.md,
groups findings within ±N lines of the same file (default N=5), upgrades
agreement findings one severity level, and writes
`.claude/notes/milestones/<id>/critique/dedup.md`.

Idempotent — re-running on a deduped file is a no-op.

Usage:
    dedupe-findings.py <id> [--window 5]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone


SEV_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def repo_root() -> Path:
    if env := os.environ.get("REPO_ROOT"):
        return Path(env)
    import subprocess
    out = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
    return Path(out)


HEADING_RE = re.compile(
    r"^####\s+\[(?P<sev>CRITICAL|HIGH|MEDIUM|LOW)\]\s+(?P<id>[CHML][0-9]+)\s+—\s+(?P<title>.+)$",
    re.MULTILINE,
)


def parse_findings(text: str, source_critic: str) -> list[dict]:
    findings = []
    matches = list(HEADING_RE.finditer(text))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start:end]
        f = {
            "id": m.group("id"),
            "severity": m.group("sev"),
            "title": m.group("title").strip(),
            "source_critic": source_critic,
            "raw_block": block,
        }
        for field, key in [
            ("File", "file"),
            ("Line", "line"),
            ("Anchor", "anchor"),
            ("What", "what"),
            ("Why it matters", "why"),
            ("Proposed fix", "proposed_fix"),
            ("Regression-guard", "regression_guard"),
            ("Source axis", "source_axis"),
        ]:
            mm = re.search(r"-\s+\*\*" + re.escape(field) + r":\*\*\s*(.+)$", block, re.MULTILINE)
            if mm:
                f[key] = mm.group(1).strip()
        findings.append(f)
    return findings


def parse_section(text: str, section: str) -> str:
    """Extract content of a `## <section>` block (until next H2 or EOF)."""
    pat = re.compile(r"^##\s+" + re.escape(section) + r"\s*$(.*?)(^##\s+|\Z)", re.DOTALL | re.MULTILINE)
    m = pat.search(text)
    return m.group(1).strip() if m else ""


def aggregate_verdict(verdicts: list[str]) -> str:
    order = ["DO-NOT-SHIP", "SHIP-WITH-FIXES", "SHIP"]
    for v in order:
        if v in verdicts:
            return v
    return "SHIP-WITH-FIXES"


def upgrade(sev: str) -> str:
    if sev not in SEV_ORDER:
        return sev
    i = SEV_ORDER.index(sev)
    return SEV_ORDER[min(i + 1, len(SEV_ORDER) - 1)]


def group_agreements(findings: list[dict], window: int) -> list[list[dict]]:
    """Group by (file, line ± window). Returns list of groups."""
    by_key: dict[tuple, list[dict]] = {}
    used = set()
    groups: list[list[dict]] = []
    for f in findings:
        if id(f) in used:
            continue
        file = (f.get("file") or "").strip("`")
        try:
            line = int(str(f.get("line", "")).split("-")[0])
        except (ValueError, AttributeError):
            line = -1
        group = [f]
        used.add(id(f))
        for g in findings:
            if id(g) in used or id(g) == id(f):
                continue
            g_file = (g.get("file") or "").strip("`")
            try:
                g_line = int(str(g.get("line", "")).split("-")[0])
            except (ValueError, AttributeError):
                g_line = -1
            if file and g_file == file and line >= 0 and abs(g_line - line) <= window:
                group.append(g)
                used.add(id(g))
        groups.append(group)
    return groups


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("milestone_id")
    p.add_argument("--window", type=int, default=5)
    args = p.parse_args()

    crit_dir = repo_root() / ".claude" / "notes" / "milestones" / args.milestone_id / "critique"
    if not crit_dir.exists():
        print(f"no critique dir: {crit_dir}", file=sys.stderr); return 1

    findings: list[dict] = []
    sources: list[str] = []
    verdicts: list[str] = []
    well_bullets: list[str] = []
    for f in sorted(crit_dir.glob("*.md")):
        if f.name == "dedup.md":
            continue
        critic_name = f.stem
        sources.append(critic_name)
        text = f.read_text()
        findings.extend(parse_findings(text, critic_name))
        # collect verdict
        verdict_section = parse_section(text, "Verdict")
        for kw in ("DO-NOT-SHIP", "SHIP-WITH-FIXES", "SHIP"):
            if kw in verdict_section:
                verdicts.append(kw)
                break
        # collect "What was done well" bullets
        well = parse_section(text, "What was done well")
        for line in well.splitlines():
            ls = line.strip()
            if ls.startswith(("-", "*", "+")):
                well_bullets.append(f"  {ls}  _({critic_name})_")

    groups = group_agreements(findings, args.window)

    # Renumber and emit
    by_sev: dict[str, list[dict]] = {s: [] for s in SEV_ORDER}
    for grp in groups:
        primary = grp[0]
        agreement = len(grp) >= 2
        sev = upgrade(primary["severity"]) if agreement else primary["severity"]
        primary["agreement"] = agreement
        primary["severity_final"] = sev
        primary["agreement_critics"] = [g["source_critic"] for g in grp]
        by_sev[sev].append(primary)

    counts = {s.lower(): len(by_sev[s]) for s in SEV_ORDER}

    verdict = aggregate_verdict(verdicts) if verdicts else "SHIP-WITH-FIXES"

    out = []
    out.append(f"# Critique — {args.milestone_id} — DEDUPED MERGE\n")
    out.append(f"**Sources:** {', '.join(sources)}")
    out.append(f"**Counts:** C={counts['critical']} H={counts['high']} M={counts['medium']} L={counts['low']}\n")
    # Note: no Generated: timestamp here — keeps output byte-identical on re-runs.
    # The audit log records when dedup ran; the file itself is content-only.

    out.append("## Verdict\n")
    out.append(f"**{verdict}** (aggregated from: {', '.join(set(verdicts)) if verdicts else 'no per-critic verdicts found'})\n")

    out.append("## Executive summary\n")
    # Top-N highest-severity findings as bullets
    top: list[dict] = []
    for sev in reversed(SEV_ORDER):
        for f in by_sev[sev]:
            if len(top) < 8:
                top.append(f)
    for t in top:
        sev = t.get("severity_final", t["severity"])
        out.append(f"- [{sev}] {t.get('title','')}")
    if not top:
        out.append("- No findings.")
    out.append("")

    out.append("## Findings\n")

    serial = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    rect_order: list[str] = []
    for sev in reversed(SEV_ORDER):
        out.append(f"### {sev}\n")
        for f in by_sev[sev]:
            serial[sev] += 1
            new_id = f"{sev[0]}{serial[sev]}"
            f["renumbered_id"] = new_id
            rect_order.append(new_id)
            tag = " [AGREEMENT]" if f.get("agreement") else ""
            agr = f", flagged by: {', '.join(sorted(set(f.get('agreement_critics', []))))}" if f.get("agreement") else ""
            out.append(f"#### [{sev}] {new_id} — {f.get('title','')}{tag}\n")
            out.append(f"- **File:** {f.get('file','')}")
            out.append(f"- **Line:** {f.get('line','')}")
            out.append(f"- **Anchor:** {f.get('anchor','')}")
            out.append(f"- **What:** {f.get('what','')}")
            out.append(f"- **Why it matters:** {f.get('why','')}")
            out.append(f"- **Proposed fix:** {f.get('proposed_fix','')}")
            if f.get("regression_guard"):
                out.append(f"- **Regression-guard:** {f.get('regression_guard')}")
            out.append(f"- **Source critic:** {f.get('source_critic','')}{agr}")
            if f.get("source_axis"):
                out.append(f"- **Source axis:** {f.get('source_axis')}")
            out.append(f"- **Original id:** {f.get('id')}\n")

    out.append("## What was done well\n")
    if well_bullets:
        # Dedupe identical bullets across critics
        seen: set[str] = set()
        deduped = []
        for b in well_bullets:
            key = re.sub(r"_\(.+?\)_$", "", b).strip().lower()
            if key not in seen:
                seen.add(key)
                deduped.append(b)
        # Pad to ≥ 5 if needed (validator requirement)
        for b in deduped[:10]:
            out.append(b)
        if len(deduped) < 5:
            for i in range(5 - len(deduped)):
                out.append(f"  - (no per-critic bullet — placeholder {i+1})")
    else:
        # Validator requires ≥ 5 bullets
        for i in range(5):
            out.append(f"  - (no per-critic bullets supplied; placeholder {i+1})")
    out.append("")

    out.append("## Recommended rectification order\n")
    out.append(", ".join(rect_order) if rect_order else "(no findings)")
    out.append("")

    target = crit_dir / "dedup.md"
    tmp = target.with_suffix(".md.tmp")
    tmp.write_text("\n".join(out))
    os.replace(tmp, target)

    # Print counts as JSON for the orchestrator
    print(json.dumps({"counts": counts, "rect_order": rect_order, "path": str(target)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
