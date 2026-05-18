# Phase 1 — DISCOVER (parallel)

**Purpose:** dispatch 4 agents in a single assistant turn so they run concurrently in their own context windows.  The visual scout drives the live preview; the other 3 do code/web research in parallel.

## Preflight — verify dev server is up

BEFORE dispatching the visual scout, the slash command body MUST run:

```bash
.claude/scripts/frontend-uplift/ensure-preview-up.sh
```

If exit status != 0, halt and surface the recovery hint (`npm run dev`).  Re-invoke `/frontend-uplift <ID>` after starting the dev server — the `init-uplift.sh` script is idempotent, so it picks up where it left off.

The other 3 scouts (library, inspiration, current-state-critic) do NOT depend on the dev server.  In principle they could fire even if the preview is down.  In practice, the orchestrator should still halt the whole phase on preflight failure — partial discovery without visual evidence is low-signal.

## Dispatch matrix

| Mode | Agents fired | When to choose |
|---|---|---|
| **standard** (default) | visual-scout + library-scout + inspiration-scout + current-state-critic (4) | Default — the canonical configuration |
| **lean** | visual-scout + current-state-critic (2) | When the user wants a quick scan and library/inspiration discovery is intentionally deferred |

Set via `checkpoint.py <ID> --set discover_mode='"standard"'` BEFORE dispatch so resume can see the original choice.

## Dispatch protocol (CRITICAL — single turn)

Fire **all selected agents in one assistant message** containing N `Agent` tool blocks.  Sequential dispatch destroys diversity and doubles wall-clock.

Each agent receives the FULL canonical prompt from `references/frontend-uplift/agent-prompts.md` verbatim, with these substitutions:

- `{ID}` → uplift slug
- `{UPLIFT_BRIEF}` → `state.uplift_brief` verbatim
- `{BRIEF_PATH}` → `.claude/notes/frontend-uplifts/{ID}/discover/<agent-short-name>-brief.md`
- `{SCREENSHOT_DIR}` → `state.screenshot_dir` (only used by the visual scout)
- `{VIEWS}` → comma-joined `state.views_to_walk` (empty = default 8-view set)

Use `isolation: worktree` on every agent — each gets a worktree-isolated repo state.  Visual-scout uses the live newtab at `http://localhost:5173/src/newtab/index.html`; that's a process-external resource (worktrees don't affect it).

## Subagent_type and model

| Agent | Sub-agent type | Model | Tools beyond default |
|---|---|---|---|
| visual-scout | `general-purpose` | sonnet | Add `Bash` (for image-tool inspection), `mcp__Claude_Preview__*` family (load via ToolSearch if deferred) |
| library-scout | `general-purpose` | sonnet | Standard `Bash + Read + Grep + Glob + WebSearch + WebFetch + Write` |
| inspiration-scout | `general-purpose` | sonnet | Same as library-scout |
| current-state-critic | `general-purpose` | sonnet | Standard (no Web tools needed; codebase-only) |

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
- **All 4 scouts fail** → halt; surface to the user.
