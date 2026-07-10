# Phase 1 — DISCOVER (two waves, parallel within each wave)

**Purpose:** dispatch scouts in TWO waves so the **art-direction frame** is grounded in live evidence before any direction is proposed.  **Wave 1 (evidence):** the visual-scout drives the live preview + the current-state-critic reads the code.  **Wave 2 (direction + outward), fed the wave-1 briefs + screenshots:** the **art-direction-scout** (EVERY mode) produces the design frame, and the library / inspiration / experiential scouts do code/web research.  Parallel WITHIN each wave; never one-at-a-time, never one blind wave.

The `frontend-uplift-art-direction-scout` is the anti-cookie-cutter lens: it reads `.claude/references/frontend-design-language.md` (canon) + `.claude/references/frontend-uplift/proclivity-design-system.md` §9 (this repo's house thesis) and emits a visual thesis + 3 divergent directions + the active BAN-1..15 list + a surface map.  Synthesis OPENS with that frame.  It is **never** dropped — not even in lean mode.

## Preflight — verify dev server is up

BEFORE dispatching the visual scout, the slash command body MUST run:

```bash
.claude/scripts/frontend-uplift/ensure-preview-up.sh
```

If exit status != 0, halt and surface the recovery hint (`npm run dev`).  Re-invoke `/frontend-uplift <ID>` after starting the dev server — the `init-uplift.sh` script is idempotent, so it picks up where it left off.

The other 3 scouts (library, inspiration, current-state-critic) do NOT depend on the dev server.  In principle they could fire even if the preview is down.  In practice, the orchestrator should still halt the whole phase on preflight failure — partial discovery without visual evidence is low-signal.

## Dispatch matrix (mode → wave-2 scout set; the art-direction-scout fires in EVERY mode)

| Mode | Wave 1 (evidence) | Wave 2 (direction + outward) | When to choose |
|---|---|---|---|
| **lean** | visual + current-state | **art-direction only** | Quick scan; library/inspiration deferred.  The frame is still produced. |
| **standard** (default) | visual + current-state | art-direction + library + inspiration | The canonical configuration |
| **deep** | visual + current-state | art-direction + library + inspiration | Same set as standard, but note in the current-state-critic's dispatch that it should reason at maximum depth |
| **experiential** | visual + current-state | art-direction + library + experiential | Marketing/brand work — ONLY meaningful when `--surface` ≠ `tool`; drops inspiration |

**Surface gate (absolute):** the `frontend-uplift-experiential-scout` is dispatched ONLY when `--surface` ≠ `tool`.  Proclivity's default is `tool` (every working view is S-2; the MeshBackground is a bounded S-1m island — §9 surface map), so by default the experiential-scout does NOT fire; its parallax/WebGL candidates would be axis-11 BLOCKERs on an S-2 surface.

Set the mode via `checkpoint.py <ID> --set discover_mode='"standard"'` BEFORE dispatch so resume can see the original choice.  `--surface` is threaded into dispatch as `{SURFACE}` (not persisted; default `tool`).

## Dispatch protocol (CRITICAL — two waves, parallel within each)

Fire **each wave's agents in one assistant message** containing N `Agent` tool blocks.  Wave 1 first; when its briefs return, fire wave 2 fed the wave-1 evidence.  Do NOT serialize to one-at-a-time (destroys diversity, doubles wall-clock) and do NOT collapse both waves into one blind turn (the frame must see the evidence).

Dispatch each agent **by its `subagent_type` name** — the agent's `.claude/agents/<name>.md` body IS its canonical prompt.  (The `agent-prompts.md` subdir copies are superseded and pending retirement — do not dispatch from them.  Fallback: if a just-synced agent fails name dispatch this session, use `subagent_type: general-purpose` with that agent's file body pasted inline.)  Substitutions:

- `{ID}` → uplift slug
- `{UPLIFT_BRIEF}` → `state.uplift_brief` verbatim
- `{BRIEF_PATH}` → `.claude/notes/frontend-uplifts/{ID}/discover/<agent-short-name>-brief.md`
- `{SCREENSHOT_DIR}` → `state.screenshot_dir` (visual scout)
- `{VIEWS}` → comma-joined `state.views_to_walk` (empty = default 8-view set)
- `{SURFACE}` → the parsed `--surface` (default `tool`) — art-direction + experiential scouts
- Wave-2 evidence for the art-direction-scout: `{VISUAL_MANIFEST}` = the `screenshots/` dir (Read renders PNGs), `{CURRENT_STATE_BRIEF}` = the current-state-critic brief path

Use `isolation: worktree` on every agent.  Visual-scout uses the live newtab at `http://localhost:5173/src/newtab/index.html`; that's a process-external resource (worktrees don't affect it).

## Subagent_type and model

| Agent (`subagent_type`) | Wave | Model | Notes |
|---|---|---|---|
| `frontend-uplift-visual-scout` | 1 | sonnet | Drives the live preview (`mcp__Claude_Preview__*` / Claude-in-Chrome fallback — load via ToolSearch if deferred); writes PNGs to `screenshots/` |
| `frontend-uplift-current-state-critic` | 1 | sonnet | Codebase-only; reads the canon + §9 overlay, flags BAN-N tells |
| `frontend-uplift-art-direction-scout` | 2 | opus / effort high | **EVERY mode.**  Produces the frame; reads the canon + §9 overlay + wave-1 evidence |
| `frontend-uplift-library-scout` | 2 | sonnet | standard / deep / experiential |
| `frontend-uplift-inspiration-scout` | 2 | sonnet | standard / deep (dropped in experiential) |
| `frontend-uplift-experiential-scout` | 2 | sonnet / effort high | ONLY when `--surface` ≠ `tool` |

## Canonical 8-view set (visual-scout default)

When `views_to_walk` is empty, the visual scout drives the newtab through these section / modal states.  Proclivity is a single-page newtab (no router) — these are state captures, not route navigations.  The agent triggers each state via user-facing affordances (click section tabs, open modals, etc.).

1. `today` — Today section (representative todos visible)
2. `sprint` — Sprint section (active sprint view)
3. `long-term` — LongTerm section
4. `gantt` — Gantt section (timeline rendering)
5. `reminders` — Reminders section
6. `settings-general` — Settings modal at "general" pane (deep-link via `?settings=general`)
7. `settings-appearance` — Settings modal at "appearance" pane (`?settings=appearance`)
8. `modal-todo-edit` — TodoEditModal open over a representative section

User override via `init-uplift.sh --views "today,sprint"` replaces this list verbatim (stored in `state.views_to_walk`).

## Per-view capture spec (visual-scout)

For each view:
- Viewport screenshot at 1440×900 → `{SCREENSHOT_DIR}/<view-id>-desktop.png`
- Mobile screenshot at 390×844 (iPhone 12) → `{SCREENSHOT_DIR}/<view-id>-mobile.png` (Proclivity is desktop-first; capture so the critic can flag the gap)
- DOM snapshot of the primary content area
- Console-log dump (warnings + errors)
- Network summary (4xx/5xx, slow >1500ms)

`<view-id>` is the literal id from `views_to_walk` (e.g. `today`, `gantt`, `settings-general`).

## Returning briefs into state

When an agent returns, the main session:

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --append agents_returned='"<agent-name>"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --append discover_briefs='"<brief-path>"'
```

When `len(agents_returned) == len(agents_dispatched)`:

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> discover-complete
```

## Severity rubric (visual-scout + current-state-critic)

| Severity | Meaning |
|---|---|
| **CRITICAL** | Visual gap that erodes credibility on first load (e.g., section genuinely broken, mesh background hard-crashes in light theme).  Rare. |
| **HIGH** | Visual gap that competitors all have and Proclivity lacks (e.g., no skeleton choreography on Photos / Gemini-backed surfaces). |
| **MEDIUM** | Quality-of-life gap that compounds across many surfaces. |
| **LOW** | Cosmetic / single-surface paper-cut. |

Calibrate HONESTLY.  A clean view with no gaps is a credible result.

## Failure modes

- **Visual scout's preview tool can't reach localhost:5173** → preflight should have caught this; if it failed silently, the visual scout returns a "preview-unreachable" brief and the orchestrator surfaces to the user before advancing state.
- **A library / inspiration scout returns a thin brief** (< 5 candidates) → re-dispatch ONCE with a stricter prompt suffix.  Accept the second attempt's result; weight accordingly in synthesis.
- **A scout hangs for >30 min** → kill the task; re-dispatch with the same prompt.
- **The art-direction-scout fails to return a frame** → the run is FRAME-DEGRADED.  Say so loudly.  Synthesis builds a PROVISIONAL frame from `frontend-design-language.md` §8 + the §9 overlay; the challenger's axis 11 treats a frameless catalog as a run-level BLOCKER.  Prefer re-dispatching the art-direction-scout once before falling back.
- **All dispatched scouts fail** → halt; surface to the user.
