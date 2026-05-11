#!/usr/bin/env python3
"""validate-artifact.py — validate state / brief / critique / rect-summary.

State and rect-summary are pure JSON. Brief and critique are markdown — we
validate (a) optional YAML frontmatter against the schema and (b) required
section headings.

Usage:
    validate-artifact.py state <path>
    validate-artifact.py rect-summary <path>
    validate-artifact.py brief <path>
    validate-artifact.py critique <path>

Exit 0 = valid; 1 = invalid; 2 = usage error.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import jsonschema  # type: ignore
except ImportError:
    jsonschema = None


SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "references" / "schemas"


def _load_schema(name: str) -> dict:
    return json.loads((SCHEMAS_DIR / f"{name}.schema.json").read_text())


def _validate_json(path: Path, schema_name: str) -> int:
    data = json.loads(path.read_text())
    if jsonschema is None:
        print("WARN: jsonschema not installed; skipping schema check (pip install jsonschema)")
        return 0
    schema = _load_schema(schema_name)
    try:
        jsonschema.validate(data, schema)
    except jsonschema.ValidationError as e:  # type: ignore[attr-defined]
        print(f"INVALID {path}: {e.message}", file=sys.stderr)
        return 1
    print(f"OK {path}")
    return 0


def _split_frontmatter(text: str) -> tuple[dict | None, str]:
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    fm_text = text[3:end].strip()
    body = text[end + 4:]
    try:
        import yaml  # type: ignore
        return yaml.safe_load(fm_text), body
    except ImportError:
        # Fall back to a tiny YAML-like parser for k: v lines
        d: dict = {}
        for line in fm_text.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                d[k.strip()] = v.strip()
        return d, body


def _check_sections(body: str, required: list[str]) -> list[str]:
    missing = []
    for h in required:
        if not re.search(rf"^#+\s+{re.escape(h)}\s*$", body, re.MULTILINE):
            missing.append(h)
    return missing


def validate_brief(path: Path) -> int:
    text = path.read_text()
    fm, body = _split_frontmatter(text)
    if fm is not None and jsonschema is not None:
        try:
            jsonschema.validate(fm, _load_schema("brief"))
        except jsonschema.ValidationError as e:  # type: ignore[attr-defined]
            print(f"INVALID frontmatter {path}: {e.message}", file=sys.stderr)
            return 1
    # Section presence: at least one of the expected sections
    has_any = any(re.search(rf"^#+\s+", body, re.MULTILINE) for _ in [None])
    if not has_any:
        print(f"INVALID {path}: brief has no section headings", file=sys.stderr)
        return 1
    print(f"OK {path}")
    return 0


def validate_critique(path: Path) -> int:
    text = path.read_text()
    fm, body = _split_frontmatter(text)
    required = ["Verdict", "Executive summary", "Findings", "What was done well"]
    missing = _check_sections(body, required)
    if missing:
        print(f"INVALID {path}: missing sections: {missing}", file=sys.stderr)
        return 1
    # Verdict must mention SHIP/SHIP-WITH-FIXES/DO-NOT-SHIP
    if not re.search(r"\b(SHIP|SHIP-WITH-FIXES|DO-NOT-SHIP)\b", body):
        print(f"INVALID {path}: no verdict keyword found", file=sys.stderr)
        return 1
    # "What was done well" must have ≥ 5 bullets
    well = re.search(r"^#+\s+What was done well\s*$(.*?)(^#+\s+|\Z)", body, re.DOTALL | re.MULTILINE)
    if well:
        bullet_count = sum(1 for ln in well.group(1).splitlines() if ln.strip().startswith(("-", "*", "+")))
        if bullet_count < 5:
            print(f"INVALID {path}: 'What was done well' has {bullet_count} bullets, need ≥ 5", file=sys.stderr)
            return 1
    print(f"OK {path}")
    return 0


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: validate-artifact.py {state|brief|critique|rect-summary} <path>", file=sys.stderr)
        return 2
    kind, p = sys.argv[1], Path(sys.argv[2])
    if not p.exists():
        print(f"file not found: {p}", file=sys.stderr); return 1
    if kind == "state":
        return _validate_json(p, "state")
    if kind == "rect-summary":
        return _validate_json(p, "rect-summary")
    if kind == "brief":
        return validate_brief(p)
    if kind == "critique":
        return validate_critique(p)
    print(f"unknown kind: {kind}", file=sys.stderr); return 2


if __name__ == "__main__":
    sys.exit(main())
