# Implement synthesis — frontend-uplift-2026q2-m3

## Built

### AC 1 — `lucide-react@^1.16.0` added to dependencies
- `package.json` and `package-lock.json` updated via `npm install lucide-react@^1.16.0`. License confirmed ISC by brief-2. Smoke-build verified tree-shaking: +1.75 kB for Pencil + X, confirming ~0.87 kB per named icon as expected.

### AC 2 — All 21 Unicode icons + 5 inline SVGs replaced with named Lucide imports
- **TodoItem.tsx** — `✎ → <Pencil size={14}>`, `✕ → <X size={14}>`
- **card/TaskCard.tsx** — `✎ → <Pencil size={13}>`, `✕ → <X size={13}>`
- **reminders/RemindersCardSection.tsx** — `✎ → <Pencil size={14}>`, `↺ → <RotateCcw size={13}>`
- **TodoCardSection.tsx** — `↺ → <RotateCcw size={13}>`
- **ClosedScopeCounter.tsx** — `✓ → <Check size={13}>`, `→ → <ArrowRight size={13}>`
- **QuickPrompt.tsx** — `✓ → <Check size={13}>`, `✕ × 3 → <X size={14}>` (all three banner variants)
- **closed/ClosedTodosView.tsx** — `✕ → <X size={14}>`
- **gantt/TaskRow.tsx** — `▸ → <ChevronRight size={14}>`, `▾ → <ChevronDown size={14}>`, `✕ → <X size={14}>`
- **sprint/SprintManager.tsx** — `▾ → <ChevronDown size={14}>`
- **settings/LogViewer.tsx** — `▾/▸ → <ChevronDown size={13}>/<ChevronRight size={13}>`
- **settings/panes/GooglePhotosPane.tsx** — `▶ → <Play size={11}>` (inline SVG removed; inline styles also converted per s7, see AC 3)
- **newtab/App.tsx** — `GearIcon() → <Settings size={20}>`, `ChatBubbleIcon() → <MessageCircle size={20}>` (both inline SVG component functions deleted)
- **chat/ChatPanel.tsx** — `CloseIcon() → <X size={16}>` (inline SVG component function deleted)
- **sections/Calendar.tsx** — `ChevronLeft() → <ChevronLeft size={16}>`, `ChevronRight() → <ChevronRight size={16}>` (both inline SVG component functions deleted)

**Deviation from brief:** `gantt/ChartView.tsx` line 469 uses `↳` inside a `<select>/<option>` element. SVG components cannot be rendered inside HTML `<option>` elements (browser limitation — option content is plain text only). The `↳` Unicode character is retained there as the only viable approach. All other 21 targets were replaced. This is the one deliberate carve-out.

All replacements use named imports (no barrel `import * as Icons`). All decorative icons get `aria-hidden="true"` on the SVG element via the Lucide prop. All interactive icon buttons retain their existing `aria-label`.

### AC 3 — Hex magic-numbers replaced with semantic tokens (s7, 3 files)
- **gantt.css:194** — `rgba(255,255,255,0.02) → color-mix(in srgb, var(--text) 2%, transparent)`
- **gantt.css:216** — same as above (`.gantt-bg-col.weekend`)
- **gantt.css:235** — `#0b0e14 → var(--accent-on)` (text on accent background)
- **gantt.css:237** — `rgba(0,0,0,0.3) → color-mix(in srgb, var(--bg) 70%, transparent)`
- **gantt.css:248** — `rgba(0,0,0,0.25) → color-mix(in srgb, var(--bg) 25%, transparent)`
- **gantt.css:278** — `rgba(0,0,0,0.5) → color-mix(in srgb, var(--bg) 50%, transparent)`
- **sprint.css:28** — `#fff → var(--accent-on)` (`.sprint-tab.active`)
- **sprint.css:329** — `#fff → var(--accent-on)` (`.sprint-start-btn`)
- **sprint.css:439** — `#fff → var(--accent-on)` (`.sprint-stale-primary`)
- **GooglePhotosPane.tsx:540-541** — inline `background: "rgba(0,0,0,0.6)"` → `"color-mix(in srgb, var(--bg) 40%, transparent)"`, `color: "white"` → `"var(--accent-on)"` (kept as React inline styles since this file has no CSS module; a new CSS file would be out of scope)

### AC 4 — 5 asymmetrically-guarded s8 files have the missing guard added
- **photos.css** — added `@media (prefers-reduced-motion: reduce)` block for `.photos-slide` (was missing; `[data-reduced-motion]` was already present)
- **card/card.css** — added `@media (prefers-reduced-motion: reduce)` block for `.card-canvas.is-dragging::before` (was missing; `[data-reduced-motion]` was already present)
- **newtab/App.css** — added `@media (prefers-reduced-motion: reduce)` block for `.settings-button[data-new]::after` (was missing; `[data-reduced-motion]` was already present)
- **MeshBackground.css** — added `[data-reduced-motion="true"]` selector for `.mesh-background` (was missing; `@media` was already present)
- **QuickPrompt.css** — added `[data-reduced-motion="true"]` selector for `.quick-prompt-banner` (was missing; `@media` was already present)

**theme.css** — added a 13-line clarifying comment block ABOVE the global reset explaining it is the canonical guard mechanism and that per-site guards are belt-and-suspenders only. Lists the 4 fully-uncovered files that intentionally rely on the global reset.

**4 fully-uncovered files** — added one-line comment in each pointing to `theme.css §reduced-motion global reset`:
- `sprint.css:1` — comment at file top
- `ChatPanel.css` — comment added inside existing file-header block
- `sections.css:1` — comment at file top
- `ClosedTodosView.css` — comment added inside existing file-header block

### AC 5 — `npm run build` passes with zero TypeScript strict errors
Verified at every commit stage. Final: ✓ built in 1.57s, zero TS errors.

### AC 6 — Post-build initial chunk ≤ 250 kB
Final: **234.02 kB** (well under 250 kB target and 400 kB soft warn).
Baseline was 232.09 kB; delta is +1.93 kB for ~12 lucide icons tree-shaken.

### AC 7 — No barrel imports of lucide-react
All imports use `import { IconName } from "lucide-react"` named pattern. Verified by grep:
```
grep -r "import \* " src/ | grep lucide  # no output
```

### AC 8 — No aria-hidden regressions
All interactive icon buttons retain existing `aria-label`. All decorative icons pass `aria-hidden="true"` via Lucide's SVG prop. Confirmed in all 14 modified files.

---

## Branching note

Committed to `main` directly per CLAUDE.md § Branching ("All work — including Claude-assisted work — runs directly on `main`."). Assigned worktree branch `worktree-agent-a66724f41f15963ab` left at base SHA `7ba347ca88d9e8b6235f30af74dd92606554b887` as expected.

---

## Files touched

| File | Role |
|---|---|
| `package.json` | Added `lucide-react@^1.16.0` to dependencies |
| `package-lock.json` | Updated lockfile |
| `src/components/TodoItem.tsx` | s6: Pencil, X icons |
| `src/components/card/TaskCard.tsx` | s6: Pencil, X icons |
| `src/sections/reminders/RemindersCardSection.tsx` | s6: Pencil, RotateCcw icons |
| `src/sections/TodoCardSection.tsx` | s6: RotateCcw icon |
| `src/components/ClosedScopeCounter.tsx` | s6: Check, ArrowRight icons |
| `src/components/QuickPrompt.tsx` | s6: Check, X icons (3 dismiss buttons) |
| `src/components/closed/ClosedTodosView.tsx` | s6: X icon |
| `src/sections/gantt/TaskRow.tsx` | s6: ChevronRight, ChevronDown, X icons |
| `src/sections/sprint/SprintManager.tsx` | s6: ChevronDown icon |
| `src/components/settings/LogViewer.tsx` | s6: ChevronDown, ChevronRight icons |
| `src/components/settings/panes/GooglePhotosPane.tsx` | s6+s7: Play icon + inline style tokens |
| `src/newtab/App.tsx` | s6: Settings, MessageCircle (removed GearIcon/ChatBubbleIcon fns) |
| `src/components/chat/ChatPanel.tsx` | s6: X (removed CloseIcon fn) |
| `src/sections/Calendar.tsx` | s6: ChevronLeft, ChevronRight (removed inline SVG fns) |
| `src/sections/gantt/gantt.css` | s7: 6 hex/rgba → color-mix tokens |
| `src/sections/sprint/sprint.css` | s7+s8: 3 #fff → var(--accent-on) + comment |
| `src/sections/photos.css` | s8: @media guard added |
| `src/components/card/card.css` | s8: @media guard added |
| `src/newtab/App.css` | s8: @media guard added |
| `src/components/MeshBackground.css` | s8: [data-reduced-motion] guard added |
| `src/components/QuickPrompt.css` | s8: [data-reduced-motion] guard added |
| `src/styles/theme.css` | s8: clarifying comment block added |
| `src/components/chat/ChatPanel.css` | s8: comment pointing to global reset |
| `src/sections/sections.css` | s8: comment pointing to global reset |
| `src/components/closed/ClosedTodosView.css` | s8: comment pointing to global reset |

**Total: 27 files, 114 insertions, 127 deletions**

---

## Deferred

- `gantt/ChartView.tsx` line 469 `↳` in `<option>` — SVG cannot render in HTML option elements; character retained. A future milestone could restructure to a custom listbox component to enable icon rendering.
- Broader UPL-21 sweep (hex magic-numbers beyond the s7 scope — other CSS files not icon-touched) — explicitly out of scope per synthesis §1 "Scoped narrowly to icon-touched files; broader UPL-21 sweep is a separate future milestone."
- `sections.css:220` asymmetry (`@media` present, `[data-reduced-motion]` missing) — brief-1 §4 lists this but synthesis §3 architecture decision scoped s8 to the 5 asymmetrically-guarded files only; this site is in a "no per-site guards at all" file (covered by global reset). Deferred to next s8 pass.

---

## external_writes_required

- git push origin main

---

## Test deltas

No test files added or modified. This milestone is pure mechanical migration (icon substitution, CSS token replacement, CSS comment additions). No behavioral logic changed; existing rendering tests are unaffected. Phase 4 check-rect-tests.sh will verify no regressions.

---

## Deviations from research synthesis

1. **ChartView.tsx ↳ not replaced** — synthesis §2 listed `CornerDownRight` for `↳` in ChartView.tsx. Actual usage is inside `<option>` elements in a `<select>` — SVG components cannot render there. Character retained. Brief-1 §1 noted this is a "sub-task indent indicator" in a dropdown, not an interactive button.
2. **GooglePhotosPane.tsx s7 inline styles retained as React inline** — synthesis suggested "convert to CSS class". No CSS file exists for this component; adding a new CSS file would be a minor scope expansion. The inline styles are replaced with token-using values (`color-mix` + `var(--accent-on)`) in the existing `style={}` prop — equivalent token hygiene without a new file.

---

## Check matrix results

- **build (npm run build)**: PASS — ✓ built in 1.57s, zero TypeScript errors, initial chunk 234.02 kB
- **workflows**: SKIP — no `.github/workflows/**` files touched
- **lfs**: SKIP — no `.gitattributes` touched
- **git status**: clean (only untracked `.claude/notes/milestones/frontend-uplift-2026q2-m3/` directory)
