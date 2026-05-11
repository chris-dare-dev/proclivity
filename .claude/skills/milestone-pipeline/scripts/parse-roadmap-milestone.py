#!/usr/bin/env python3
"""parse-roadmap-milestone.py — extract a milestone section from a roadmap doc.

Looks for a section heading matching `## Milestone <id>` or `### <id>` (case-
insensitive on the literal "milestone"). Returns the body of that section
(everything between the heading and the next heading at the same or higher
level).

Usage:
    parse-roadmap-milestone.py <roadmap-path> <milestone-id>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: parse-roadmap-milestone.py <roadmap-path> <milestone-id>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    mid = sys.argv[2].strip()

    if not path.exists():
        print(f"roadmap not found: {path}", file=sys.stderr)
        return 1

    text = path.read_text()
    lines = text.splitlines(keepends=True)

    # Match: "## Milestone `<id>`", "## Milestone <id>", "### <id>", "## <id>"
    esc = re.escape(mid)
    patterns = [
        re.compile(r"^(#{2,4})\s+Milestone\s+`?" + esc + r"`?\s*$", re.IGNORECASE),
        re.compile(r"^(#{2,4})\s+`?" + esc + r"`?\s*$"),
        re.compile(r"^(#{2,4})\s+.*\b" + esc + r"\b.*$"),
    ]

    start_idx = None
    start_level = None
    for i, line in enumerate(lines):
        for pat in patterns:
            m = pat.match(line.rstrip("\n"))
            if m:
                start_idx = i
                start_level = len(m.group(1))
                break
        if start_idx is not None:
            break

    if start_idx is None:
        print(f"milestone {mid!r} not found in {path}", file=sys.stderr)
        return 1

    end_idx = len(lines)
    heading_re = re.compile(r"^(#{1,6})\s+")
    for j in range(start_idx + 1, len(lines)):
        m = heading_re.match(lines[j])
        if m and len(m.group(1)) <= start_level:
            end_idx = j
            break

    body = "".join(lines[start_idx:end_idx]).strip()
    print(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
