# State schema — frontend-uplift

`scripts/init-uplift.sh`, `scripts/checkpoint.py`, and `scripts/status.sh` all read/write `.claude/notes/frontend-uplifts/{ID}/state.json`.

## Path layout

```
.claude/notes/frontend-uplifts/{ID}/
├── state.json                        ← THIS schema
├── discover/                         ← Phase 1 outputs (4 briefs)
│   ├── visual-scout-brief.md
│   ├── library-scout-brief.md
│   ├── inspiration-scout-brief.md
│   └── current-state-critic-brief.md
├── screenshots/                      ← visual-scout dumps PNGs here
│   ├── today-desktop.png
│   ├── today-mobile.png
│   ├── sprint-desktop.png
│   ├── …
└── artifacts/
    ├── synthesis.md                  ← Phase 2 deliverable
    ├── challenge.md                  ← Phase 3 deliverable
    └── final-report.md               ← Phase 4 deliverable (user-facing)
```

## State.json schema

```json
{
  "id": "2026q2-visual-refresh",
  "kind": "frontend-uplift",
  "created_at": "2026-05-18T15:00:00Z",
  "updated_at": "2026-05-18T15:47:00Z",
  "phase": "discover-complete",
  "phase_history": [
    { "phase": "init", "at": "..." },
    { "phase": "discover-running", "at": "..." },
    { "phase": "discover-complete", "at": "..." }
  ],
  "uplift_brief": "Modernize Proclivity's visual feel; bias toward motion + skeleton choreography on Today/Sprint/LongTerm",
  "discover_mode": "standard",
  "views_to_walk": [],
  "agents_dispatched": ["visual-scout", "library-scout", "inspiration-scout", "current-state-critic"],
  "agents_returned":   ["visual-scout", "library-scout", "inspiration-scout", "current-state-critic"],
  "discover_briefs": [
    ".claude/notes/frontend-uplifts/2026q2-visual-refresh/discover/visual-scout-brief.md",
    "..."
  ],
  "screenshot_dir": ".claude/notes/frontend-uplifts/2026q2-visual-refresh/screenshots",
  "synthesis_path": ".claude/notes/frontend-uplifts/2026q2-visual-refresh/artifacts/synthesis.md",
  "candidate_count": 14,
  "challenge_path": ".claude/notes/frontend-uplifts/2026q2-visual-refresh/artifacts/challenge.md",
  "challenge_finding_counts": { "critical": 1, "high": 3, "medium": 5, "low": 2 },
  "final_report_path": ".claude/notes/frontend-uplifts/2026q2-visual-refresh/artifacts/final-report.md",
  "ranked_candidates": [
    { "id": "UPL-1", "title": "Adopt Framer Motion (lazy) as foundation", "rice": 80.0, "rank": 1 }
  ]
}
```

## Field reference

| Field | Type | Mutator | Notes |
|---|---|---|---|
| `id` | str | init | Slug.  Immutable. |
| `kind` | str | init | Always `"frontend-uplift"`. |
| `created_at` / `updated_at` | str | init / every write | UTC ISO8601 with `Z`. |
| `phase` | str | `checkpoint.py <ID> <new-phase>` | Forward-only. |
| `phase_history` | list[{phase, at}] | every advance | Append-only audit. |
| `uplift_brief` | str | init `--brief` | Free-form user scope.  Read by every Phase 1 agent. |
| `discover_mode` | str \| null | main session `--set` | `"standard"` (4 agents — default), `"lean"` (visual-scout + current-state-critic). |
| `views_to_walk` | list[str] | init `--views` | User override for the visual scout's view list.  Empty = default 8-view set. |
| `agents_dispatched` | list[str] | main session `--append` at dispatch | Subset of `{visual-scout, library-scout, inspiration-scout, current-state-critic}`. |
| `agents_returned` | list[str] | main session `--append` per return | Subset of `agents_dispatched`. |
| `discover_briefs` | list[str] | main session `--append` per return | Paths to written briefs. |
| `screenshot_dir` | str | init | Pre-populated path; visual-scout writes PNGs here. |
| `synthesis_path` | str \| null | Phase 2 `--set` | Path to `artifacts/synthesis.md`. |
| `candidate_count` | int | Phase 2 `--set` | Count of distinct candidates. |
| `challenge_path` | str \| null | Phase 3 `--set` | Path to `artifacts/challenge.md`. |
| `challenge_finding_counts` | dict | Phase 3 `--set` | `{critical, high, medium, low}` mapped from BLOCKER/MAJOR/MINOR/NONE. |
| `final_report_path` | str \| null | Phase 4 `--set` | Path to `artifacts/final-report.md`. |
| `ranked_candidates` | list[{id, title, rice, rank}] | Phase 4 `--set` | Top-N RICE-ranked candidates. |

## Phase transitions (forward-only, single-step)

```
init
 └─→ discover-running         (Phase 1 — preflight check + dispatch 4 agents)
      └─→ discover-complete    (all agents returned)
           └─→ synthesize-running   (Phase 2 — main session)
                └─→ synthesize-complete  (synthesis.md written)
                     └─→ challenge-running   (Phase 3 — challenger sub-agent)
                          └─→ challenge-complete  (challenge.md written)
                               └─→ prioritize-running   (Phase 4 — main session)
                                    └─→ complete         (final-report.md written)
```
