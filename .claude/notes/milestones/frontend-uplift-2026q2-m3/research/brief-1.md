---
milestone_id: "frontend-uplift-2026q2-m3"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://lucide.dev/guide/packages/lucide-react"
    sha256: "not-fetched-npm-registry-used-instead"
    takeaway: "lucide-react uses named exports; each icon is a standalone component — zero barrel-import risk with Vite tree-shaking"
injection_attempts: 0
---

# Codebase Research Brief — frontend-uplift-2026q2-m3

## 1. Unicode icon site inventory (s6)

All rendering Unicode characters found by exhaustive grep across `src/**/*.tsx` and `src/**/*.ts`. Comment-only occurrences are excluded.

| Char | Codepoint | File | Line | Context |
|------|-----------|------|------|---------|
| `✎`  | U+270E pencil | `src/components/TodoItem.tsx` | 68 | todo-edit button label |
| `✕`  | U+2715 close | `src/components/TodoItem.tsx` | 80 | todo-close button label |
| `✎`  | U+270E pencil | `src/components/card/TaskCard.tsx` | 82 | task-edit button label (card mode) |
| `✕`  | U+2715 close | `src/components/card/TaskCard.tsx` | 92 | task-close button label (card mode) |
| `✎`  | U+270E pencil | `src/sections/reminders/RemindersCardSection.tsx` | 239 | reminder-edit button label |
| `↺`  | U+21BA rotate | `src/sections/reminders/RemindersCardSection.tsx` | 364 | "Reset layout" button prefix |
| `↺`  | U+21BA rotate | `src/sections/TodoCardSection.tsx` | 130 | "Reset layout" button prefix |
| `→`  | U+2192 arrow | `src/components/ClosedScopeCounter.tsx` | 35 | closed-pile arrow affordance |
| `✓`  | U+2713 check | `src/components/ClosedScopeCounter.tsx` | 29 | "0 closed" empty-state check |
| `✓`  | U+2713 check | `src/components/QuickPrompt.tsx` | 117 | banner success prefix |
| `✕`  | U+2715 close | `src/components/QuickPrompt.tsx` | 133 | dismiss button (variant A) |
| `✕`  | U+2715 close | `src/components/QuickPrompt.tsx` | 150 | dismiss button (variant B) |
| `✕`  | U+2715 close | `src/components/QuickPrompt.tsx` | 166 | dismiss button (variant C) |
| `✕`  | U+2715 close | `src/components/closed/ClosedTodosView.tsx` | 409 | closed-item dismiss button |
| `▸`  | U+25B8 right caret | `src/sections/gantt/TaskRow.tsx` | 129 | collapsed-row indicator |
| `▾`  | U+25BE down caret | `src/sections/gantt/TaskRow.tsx` | 129 | expanded-row indicator |
| `✕`  | U+2715 close | `src/sections/gantt/TaskRow.tsx` | 185 | gantt task delete button |
| `▾`  | U+25BE down caret | `src/sections/sprint/SprintManager.tsx` | 582 | archived-sprint caret (open) |
| `▾`/`▸` | both | `src/components/settings/LogViewer.tsx` | 267 | log-group expand/collapse toggle |
| `▶`  | U+25B6 play | `src/components/settings/panes/GooglePhotosPane.tsx` | 545 | video overlay play indicator |
| `↳`  | U+21B3 corner down-right | `src/sections/gantt/ChartView.tsx` | 469 | sub-task indent indicator |

**Additional `→` occurrences (data display, not interactive icon buttons):**
- `src/sections/reminders/RemindersCardSection.tsx`:226 — linked-todo label text ("→ {title}")
- `src/sections/reminders/RemindersCardSection.tsx`:338 — card-mode linked-todo label

**Note on scope:** The brief targets `✎`, `✕`, `→`, `▾`, `▸` explicitly. The full list above adds: `✓` (check), `↺` (reset-layout), `▶` (video play), `↳` (gantt sub-task indent). Each is assessed in §5.

---

## 2. Inline SVG icon inventory

### `src/newtab/App.tsx`

| Function | Lines | Lucide equivalent | Recommendation |
|----------|-------|-------------------|----------------|
| `GearIcon()` | 288–305 | `Settings` | **Replace** — standard gear/cog; Lucide `Settings` is identical in intent |
| `ChatBubbleIcon()` | 307–323 | `MessageCircle` | **Replace** — standard speech-bubble; Lucide `MessageCircle` is a close match |

Callers:
- `GearIcon`: `App.tsx`:255 — settings button SVG
- `ChatBubbleIcon`: `App.tsx`:244 — chat open button SVG

### `src/components/chat/ChatPanel.tsx`

| Function | Lines | Lucide equivalent | Recommendation |
|----------|-------|-------------------|----------------|
| `CloseIcon()` | 135–151 | `X` | **Replace** — simple X cross; Lucide `X` matches exactly |

Caller: `ChatPanel.tsx`:87 — close-panel button

### `src/sections/Calendar.tsx`

| Function | Lines | Lucide equivalent | Recommendation |
|----------|-------|-------------------|----------------|
| `ChevronLeft()` | 163–179 | `ChevronLeft` | **Replace** — standard left chevron |
| `ChevronRight()` | 181–197 | `ChevronRight` | **Replace** — standard right chevron |

Callers: `Calendar.tsx`:80 and `Calendar.tsx`:94 — month nav buttons

---

## 3. Hex magic-number audit (s7 scope — icon-touched files only)

Files touched by s6 with hardcoded hex/rgba:

### `src/sections/gantt/gantt.css`
- Line 194: `background: rgba(255, 255, 255, 0.02)` — map to `color-mix(in srgb, var(--text) 2%, transparent)` or a new surface token
- Line 216: `background: rgba(255, 255, 255, 0.02)` — same as above
- Line 235: `color: #0b0e14` — map to `var(--bg)` (this is the dark background value exactly; used as text color on an accent background where `--accent-on` would be correct → use `var(--accent-on)`)
- Line 237: `box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3)` — use `color-mix(in srgb, var(--bg) 70%, transparent)` or shadow token
- Line 248: `background: rgba(0, 0, 0, 0.25)` — use `color-mix(in srgb, var(--bg) 25%, transparent)`
- Line 278: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5)` — use `color-mix(in srgb, var(--bg) 50%, transparent)`

### `src/sections/sprint/sprint.css`
- Line 28: `color: #fff` — map to `var(--accent-on)` (text on accent background)
- Line 329: `color: #fff` — same
- Line 439: `color: #fff` — same

### `src/components/settings/panes/GooglePhotosPane.tsx` (inline style, s6-touched via `▶`)
- Line 540: inline `background: "rgba(0, 0, 0, 0.6)"` — convert to CSS class with `color-mix(in srgb, var(--bg) 60%, transparent)`
- Line 541: inline `color: "white"` — convert to CSS class with `var(--accent-on)` or `var(--text)` against dark overlay

**Files in s6 scope with no hex magic numbers (clean):** `TodoItem.tsx`, `card/TaskCard.tsx`, `RemindersCardSection.tsx`, `TodoCardSection.tsx`, `ClosedScopeCounter.tsx`, `QuickPrompt.tsx`, `ClosedTodosView.tsx`, `gantt/TaskRow.tsx`, `sprint/SprintManager.tsx`, `LogViewer.tsx`, `Calendar.tsx`, `newtab/App.tsx`, `chat/ChatPanel.tsx`

---

## 4. Motion-site audit (s8)

The project uses a GLOBAL nuclear reset in `src/styles/theme.css` lines 135–153:
- `[data-reduced-motion="true"] *, *::before, *::after { animation-duration: 0.01ms !important; ... }` (line 135)
- `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { ... } }` (line 144)

This global reset catches all animations automatically. **However, the brief requires per-site explicit dual guards** at every CSS animation/transition site, not relying solely on the global blanket reset. The upstream critic flagged specific sites. Below is the per-file assessment.

### Sites that are UNGUARDED (no per-site dual-guard)

| File | Line | Property | Missing guard(s) |
|------|------|----------|-----------------|
| `src/sections/sprint/sprint.css` | 185 | `transition: width 0.3s ease` on `.sprint-progress-bar-fill` | BOTH: no `@media (prefers-reduced-motion: reduce)` block, no `[data-reduced-motion="true"]` selector |
| `src/sections/sprint/sprint.css` | 301 | `transition: transform 0.2s` on `.sprint-archived-caret` | BOTH: no guards in file at all |
| `src/components/chat/ChatPanel.css` | 203 | `animation: chat-dot-bounce 1.2s infinite` on `.chat-panel__thinking-dots span` | BOTH: no guards anywhere in this file |
| `src/components/chat/ChatPanel.css` | 28 | `transition: transform 0.25s ease` on `.chat-panel` slide-in | BOTH |
| `src/components/chat/ChatPanel.css` | 68 | `transition: color 0.15s, border-color 0.15s` | BOTH |
| `src/components/chat/ChatPanel.css` | 92 | `transition: color 0.15s, background 0.15s` | BOTH |
| `src/components/chat/ChatPanel.css` | 240 | `transition: border-color 0.15s` | BOTH |
| `src/components/chat/ChatPanel.css` | 269 | `transition: opacity 0.15s` | BOTH |
| `src/components/chat/ChatPanel.css` | 315 | `transition: opacity 0.6s ease, ...` | BOTH |
| `src/components/chat/ChatPanel.css` | 346,370 | `transition: transform 0.25s ease` | BOTH |
| `src/sections/photos.css` | 30 | `transition: opacity 800ms ease` on `.photos-slide` | `@media (prefers-reduced-motion: reduce)` missing (only `data-reduced-motion` guard at line 76 present) |
| `src/components/card/card.css` | 37 | `animation: card-grid-fade-in 150ms` on `.card-canvas.is-dragging::before` | `@media (prefers-reduced-motion: reduce)` missing (only `[data-reduced-motion]` guard at line 44 present) |
| `src/newtab/App.css` | 71 | `animation: settings-badge-pulse 2s infinite` | `@media (prefers-reduced-motion: reduce)` missing (only `[data-reduced-motion]` guard at line 77 present) |
| `src/components/MeshBackground.css` | 10 | `animation: mesh-fade-in 800ms` | `[data-reduced-motion="true"]` guard missing (only `@media` guard at line 18 present) |
| `src/components/QuickPrompt.css` | 77 | `animation: quick-prompt-banner-in 200ms` | `[data-reduced-motion="true"]` guard missing (only `@media` guard at line 150 present) |
| `src/sections/sections.css` | 67 | `transition: opacity 120ms ease` on `.todo-edit` | BOTH missing for this specific rule |
| `src/sections/sections.css` | 146 | `transition: background/color 120ms ease` on scope-option | BOTH missing for this specific rule |
| `src/sections/sections.css` | 200 | `transition: color/bg 120ms ease` | BOTH missing for this specific rule |
| `src/sections/sections.css` | 220 | `transition: transform 120ms ease` on `.closed-scope-counter-arrow` | `@media` PRESENT (line 228) but `[data-reduced-motion]` MISSING |
| `src/components/closed/ClosedTodosView.css` | 67,170,276,306 | multiple transitions | `@media (prefers-reduced-motion: reduce)` missing (only `[data-reduced-motion]` guards present at line 332) |

### Sites with DUAL guards (compliant — listed for completeness)

| File | Animation/keyframe | Both guards present |
|------|-------------------|---------------------|
| `src/components/Modal.css` | `modal-fade-in`, `modal-slide-in` | YES (lines 100–108) |
| `src/components/settings/SettingsModal.css` | `dirty-dot-pulse` | YES (lines 151–158) |
| `src/sections/calendar/calendar.css` | transitions | YES (lines 514–526) |

**Critical observation:** `src/styles/theme.css` applies a blanket `* { animation-duration: 0.01ms }` reset for BOTH guard types globally. This means every unguarded site is functionally covered at runtime via the cascade. The brief's s8 story asks for the dual-guard convention to be added **explicitly per-site** for auditing clarity and resilience if the global rule is ever refactored. The implementer should treat the global reset as belt, the per-site guards as suspenders.

---

## 5. Lucide icon-name map

`lucide-react` is NOT yet installed (not in `package.json`). It must be added as a dependency. Current bundle: ~400 kB soft ceiling, 500 kB hard. `lucide-react` with 12 named imports adds ≤6 KB gz (per brief estimate — each icon is ~300–500 bytes tree-shaken).

| Unicode/SVG | Lucide import name | Notes |
|-------------|-------------------|-------|
| `✎` (U+270E pencil) | `Pencil` | Direct 1:1 |
| `✕` (U+2715 close/X) | `X` | Direct 1:1 |
| `→` (U+2192 arrow-right) | `ArrowRight` | Direct 1:1 |
| `▾` (U+25BE chevron-down) | `ChevronDown` | Direct 1:1 |
| `▸` (U+25B8 chevron-right) | `ChevronRight` | Direct 1:1 |
| `▶` (U+25B6 play) | `Play` | Direct 1:1 (GooglePhotosPane video overlay) |
| `↺` (U+21BA rotate/reset) | `RotateCcw` | Best available match; brief says "reset layout" |
| `✓` (U+2713 check) | `Check` | Direct 1:1 |
| `↳` (U+21B3 corner-right) | `CornerDownRight` | Acceptable; used for gantt sub-task indent |
| `GearIcon` (inline SVG) | `Settings` | Direct 1:1 with Lucide gear icon |
| `ChatBubbleIcon` (inline SVG) | `MessageCircle` | Close enough; Lucide has `MessageSquare` and `MessageCircle` — `MessageCircle` is conventional for chat |
| `CloseIcon` (ChatPanel inline SVG) | `X` | Direct 1:1 |
| `ChevronLeft` (Calendar inline SVG) | `ChevronLeft` | Direct 1:1 |
| `ChevronRight` (Calendar inline SVG) | `ChevronRight` | Direct 1:1 |

**No icons with missing Lucide equivalents.** All 14 distinct icon uses have an obvious 1:1 Lucide match.

---

## 6. File count estimate (s6 + s7 + s8)

### s6 — Unicode/SVG replacement (icon-touched files)

| File | Changes |
|------|---------|
| `src/components/TodoItem.tsx` | ✎ → Pencil, ✕ → X |
| `src/components/card/TaskCard.tsx` | ✎ → Pencil, ✕ → X |
| `src/sections/reminders/RemindersCardSection.tsx` | ✎ → Pencil, ↺ → RotateCcw |
| `src/sections/TodoCardSection.tsx` | ↺ → RotateCcw |
| `src/components/ClosedScopeCounter.tsx` | → → ArrowRight, ✓ → Check |
| `src/components/QuickPrompt.tsx` | ✓ → Check, ✕ × 3 → X |
| `src/components/closed/ClosedTodosView.tsx` | ✕ → X |
| `src/sections/gantt/TaskRow.tsx` | ▸/▾ → ChevronRight/ChevronDown, ✕ → X |
| `src/sections/sprint/SprintManager.tsx` | ▾ → ChevronDown |
| `src/components/settings/LogViewer.tsx` | ▾/▸ → ChevronDown/ChevronRight |
| `src/components/settings/panes/GooglePhotosPane.tsx` | ▶ → Play |
| `src/sections/gantt/ChartView.tsx` | ↳ → CornerDownRight |
| `src/newtab/App.tsx` | GearIcon → Settings, ChatBubbleIcon → MessageCircle (inline SVGs removed) |
| `src/components/chat/ChatPanel.tsx` | CloseIcon → X (inline SVG removed) |
| `src/sections/Calendar.tsx` | ChevronLeft/ChevronRight inline SVGs → Lucide imports |

**s6 file count: 15 files**

### s7 — Hex token replacement (scoped to icon-touched files only)

| File | Changes |
|------|---------|
| `src/sections/gantt/gantt.css` | 6 hex/rgba → CSS tokens |
| `src/sections/sprint/sprint.css` | 3 `#fff` → `var(--accent-on)` |
| `src/components/settings/panes/GooglePhotosPane.tsx` | 2 inline styles → CSS class |

**s7 file count: 3 files** (2 already in s6 scope, 1 new: `gantt.css`)

### s8 — Dual-guard motion additions

| File | Missing guard(s) |
|------|-----------------|
| `src/sections/sprint/sprint.css` | Add BOTH guards for progress-fill transition + caret transition |
| `src/components/chat/ChatPanel.css` | Add BOTH guards (single block covers all transitions + keyframe) |
| `src/sections/photos.css` | Add `@media (prefers-reduced-motion: reduce)` guard |
| `src/components/card/card.css` | Add `@media (prefers-reduced-motion: reduce)` guard for `card-grid-fade-in` |
| `src/newtab/App.css` | Add `@media (prefers-reduced-motion: reduce)` guard for `settings-badge-pulse` |
| `src/components/MeshBackground.css` | Add `[data-reduced-motion="true"]` guard |
| `src/components/QuickPrompt.css` | Add `[data-reduced-motion="true"]` guard |
| `src/sections/sections.css` | Add BOTH guards for transition rules not yet covered |
| `src/components/closed/ClosedTodosView.css` | Add `@media (prefers-reduced-motion: reduce)` guard |

**s8 file count: 9 CSS files**

### Total unique files across all three stories

s6: 15 tsx/ts files + (overlaps with s7/s8)
s7: gantt.css (1 net new file beyond s6)
s8: 9 CSS files (sprint.css and sections.css already in s7 scope)

**Total unique files: ~22 files** (15 TSX + ~7 CSS net new from s7/s8)

This is **well above the ≤5 inline threshold** — the orchestrator should dispatch to the milestone-implementer agent.

---

## 2. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

---

## 3. Riskiest assumption + alternative

**Riskiest assumption:** The brief assumes `[data-reduced-motion="true"]` attribute guards are insufficient on their own because the s8 story asks for per-site dual guards. However, `src/styles/theme.css` already contains a global nuclear reset that covers BOTH `[data-reduced-motion="true"]` (lines 135–142) and `@media (prefers-reduced-motion: reduce)` (lines 144–152) with `!important` overrides on `*`. Adding per-site guards to every file is therefore strictly redundant from a functional standpoint — the risk is that the implementer adds cosmetically-correct but functionally-no-op guards and the milestone is marked complete when the underlying philosophy question ("global reset vs. per-site") has not been settled. If the global reset is the intended mechanism, spending implementation effort on per-site guards in 9 CSS files is waste.

**Concrete alternative:** Rather than adding per-site guards to each of the 9 CSS files, the implementer should document the global reset as the canonical guard mechanism (add a comment to `theme.css` citing it), and only add per-site guards to the three files that currently have asymmetric coverage (one guard type but not both): `photos.css`, `card.css`, `App.css`, `MeshBackground.css`, `QuickPrompt.css`. Files like `ChatPanel.css` and `sprint.css` that have zero explicit guards are fully covered by the global reset and need no per-site additions for functional correctness.

---

## 4. Acceptance criteria the implementer must meet

1. `lucide-react` added as a production dependency; all named imports use the `import { IconName } from "lucide-react"` pattern (no barrel `* as Lucide`).
2. Every Unicode icon in the inventory (§1) is replaced by the corresponding Lucide component from the map in §5; no raw Unicode icon characters remain in JSX render paths.
3. All four inline SVG component definitions (`GearIcon`, `ChatBubbleIcon`, `CloseIcon`, `ChevronLeft`, `ChevronRight`) are removed from source; callers use Lucide imports instead.
4. Hex magic numbers in `gantt.css`, `sprint.css`, and `GooglePhotosPane.tsx` (inline styles) are replaced with the CSS custom-property tokens mapped in §3.
5. All motion sites listed in §4 as "UNGUARDED" have both `@media (prefers-reduced-motion: reduce)` and `[data-reduced-motion="true"]` guards present (or the implementer explicitly chooses the alternative documented in §3 and comments the rationale).
6. `npm run build` passes cleanly; initial chunk remains ≤400 kB (lucide-react named imports are tree-shaken to ≤6 KB gz, so this should be trivially satisfied).
7. No TypeScript strict-mode errors introduced; `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` remain clean.
