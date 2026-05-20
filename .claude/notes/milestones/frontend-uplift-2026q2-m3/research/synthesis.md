# Research synthesis — frontend-uplift-2026q2-m3

**Milestone:** Icon-system adoption (UPL-8 + UPL-21 partial + UPL-22)
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore, codebase-context — 21 Unicode sites + 5 inline SVGs + 16 hex mag-numbers + 9 motion guard gaps), brief-2.md (general — lucide-react v1.16.0 verified)

---

## 1. TL;DR for the implementer

Three concurrent migrations in one milestone — bigger surface than m1/m2 but mechanical work:

1. **s6 (icons)** — install `lucide-react@^1.16.0` (ISC, React 18 compatible, ~0.5 kB gz per icon when tree-shaken, MV3 CSP safe per brief-2). Replace 21 Unicode icons + 5 inline SVGs across **15 files** with named Lucide imports. Smoke-build with a single icon first to verify tree-shaking; the docs claim `sideEffects: false` but verify by build.

2. **s7 (token cleanup)** — replace 11 hex magic-numbers (`#0b0e14`, `#fff`, etc.) with semantic tokens (`var(--accent-on)`, `var(--bg)`, etc.) in **3 files** (gantt.css, sprint.css, GooglePhotosPane). Scoped narrowly to icon-touched files; broader UPL-21 sweep is a separate future milestone.

3. **s8 (reduced-motion dual-guard)** — **NARROW the scope** per the brief-1 architecture flag (see §3 below). Only 5 partially-guarded files actually need the missing guard added; the 4 fully-uncovered files are already protected by the global reset in `theme.css` and adding per-site guards there would be cosmetic-only.

**Path decision:** `delegated` (22 files >> 5 file inline threshold). Dispatch ONE `milestone-implementer` Agent with `isolation: worktree`.

**Expected scope:** ~17 unique files, ~250-400 LOC (mostly icon imports + JSX edits + CSS guard blocks). Within delegated-path comfort zone (300-800 LOC), no `--allow-large-diff` needed.

---

## 2. Affected files

### s6 — Icon replacement (15 files)

Per brief-1 §6 enumeration:

- **Unicode chars → Lucide named imports:**
  - `src/components/TodoItem.tsx` — `✎ → Pencil`, `✕ → X`
  - `src/components/card/TaskCard.tsx` — `✎ → Pencil`, `✕ → X`
  - `src/sections/reminders/RemindersCardSection.tsx` — `✎ → Pencil`, `↺ → RotateCcw`
  - `src/sections/TodoCardSection.tsx` — `↺ → RotateCcw`
  - `src/components/ClosedScopeCounter.tsx` — `→ → ArrowRight`, `✓ → Check`
  - `src/components/QuickPrompt.tsx` — `✓ → Check`, `✕ × 3 → X`
  - `src/components/closed/ClosedTodosView.tsx` — `✕ → X`
  - `src/sections/gantt/TaskRow.tsx` — `▸ → ChevronRight`, `▾ → ChevronDown`, `✕ → X`
  - `src/sections/sprint/SprintManager.tsx` — `▾ → ChevronDown`
  - `src/components/settings/LogViewer.tsx` — `▾ → ChevronDown`, `▸ → ChevronRight`
  - `src/components/settings/panes/GooglePhotosPane.tsx` — `▶ → Play`
  - `src/sections/gantt/ChartView.tsx` — `↳ → CornerDownRight`

- **Inline-SVG → Lucide named imports:**
  - `src/newtab/App.tsx` — `GearIcon → Settings`, `ChatBubbleIcon → MessageCircle` (delete the inline `function NameIcon()` definitions)
  - `src/components/chat/ChatPanel.tsx` — `CloseIcon → X` (delete inline SVG)
  - `src/sections/Calendar.tsx` — inline ChevronLeft / ChevronRight SVGs → Lucide imports

### s7 — Hex token replacement (3 files, 1 net-new from s6)

- `src/sections/gantt/gantt.css` — 6 hex/rgba values → CSS tokens (NET NEW file vs s6)
- `src/sections/sprint/sprint.css` — 3 `#fff` → `var(--accent-on)` (also s8-touched)
- `src/components/settings/panes/GooglePhotosPane.tsx` — 2 inline styles → CSS class refs (overlaps with s6)

### s8 — Dual-guard motion additions (PARTIAL — narrow scope; see §3)

**Add the missing guard to ONLY these 5 asymmetrically-guarded files:**
- `src/sections/photos.css` — has `[data-reduced-motion="true"]`, missing `@media (prefers-reduced-motion: reduce)`
- `src/components/card/card.css` — same asymmetry as photos.css
- `src/newtab/App.css` — has `[data-reduced-motion="true"]` on settings-badge-pulse, missing `@media`
- `src/components/MeshBackground.css` — has `@media` only, missing `[data-reduced-motion="true"]`
- `src/components/QuickPrompt.css` — same asymmetry as MeshBackground.css

**Do NOT touch these 4 already-globally-covered files** (skip per §3 architecture decision):
- `src/sections/sprint/sprint.css` — no per-site guards, but `theme.css:135-152` global reset covers it
- `src/components/chat/ChatPanel.css` — same
- `src/sections/sections.css` — same
- `src/components/closed/ClosedTodosView.css` — same

### Total unique file count

s6 (15) + s7 net-new (1: gantt.css) + s8 partial (5, of which 0 overlap with s6+s7) = **~21 unique files**

---

## 3. Architecture decision (resolves brief-1 §3 risk)

Brief-1 flagged a load-bearing concern: `src/styles/theme.css` lines 135–152 already contain a global nuclear reset that covers BOTH `[data-reduced-motion="true"]` AND `@media (prefers-reduced-motion: reduce)` with `* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; ... }`. This means **every motion site is functionally covered at runtime regardless of per-site guards**.

The original s8 wording ("every motion declaration in the codebase carries both guards") would generate ~22 lines of busywork across 9 CSS files — all redundant given the global reset.

**Resolution chosen:** narrow s8 to **only the asymmetrically-guarded sites** (those that already have ONE of the two guards — adding the second is self-documentation, not redundancy). For the 4 fully-uncovered files, add a one-line CSS COMMENT in each pointing to the global reset (`/* Reduced-motion coverage: see theme.css §reduced-motion global reset */`) rather than duplicate the guard logic.

Also: add a comment to `theme.css` ABOVE the global reset block explaining its role as the canonical guard mechanism (so future implementers don't repeat this confusion).

This narrows the s8 scope from "9 CSS files, 18 new guard blocks" to "5 CSS files, 5 new guard blocks + 5 CSS comment lines". The functional safety is unchanged (global reset still wins via `!important`).

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "npm install lucide-react"
  - "git push origin main"
```

(`npm install` is a local-only write; the only Phase-4 user-authorized external write is the push.)

---

## 5. Implementation strategy (delegated path)

Step-by-step sequence the implementer should follow:

1. **Smoke-build first** — `npm install lucide-react`, add a single test import in App.tsx (e.g. `import { Settings } from 'lucide-react'`), build, verify the chunk grew by ≤1 kB. If tree-shaking is broken (chunk grew by >10 kB), abort and use deep-path imports (`lucide-react/dist/esm/icons/settings`).

2. **s6 in batches** — replace icons in groups of 3-4 files at a time, rebuild after each batch. Verify the chunk stays under the new 400 kB soft warn the whole way.

3. **s7 inline with s6** — when touching a file for icon replacement that also has hex magic-numbers in scope, do the token swap in the same edit (avoid touching the file twice).

4. **s8 last** — pure CSS edits to 5 files + 1 comment edit in theme.css. No JS touched. Build once at the end.

5. **Final build verification** — full `npm run build` against the new 232.09 kB baseline (post-m2). Expected delta: +3–6 kB. Target: ≤ 250 kB total.

---

## 6. Implementation acceptance criteria

1. **`lucide-react@^1.16.0`** added to `package.json` dependencies. License confirmed ISC by brief-2.
2. **All 21 Unicode icons + 5 inline SVGs replaced** per the file inventory in §2 s6. Named imports only (no `import * as Icons`).
3. **All 3 s7 files** have hex magic-numbers replaced with semantic tokens (`var(--accent-on)` or `var(--bg)`).
4. **5 s8 files** have the missing guard added; theme.css has a clarifying comment block; the 4 fully-uncovered files have a one-line comment pointing to the global reset.
5. **`npm run build` passes** with zero TypeScript strict errors.
6. **Post-build initial chunk** ≤ 250 kB (well under the new 400 kB soft warn).
7. **No barrel imports** of lucide (`import * from 'lucide-react'` is forbidden — would defeat tree-shaking).
8. **No `aria-hidden` regressions** — every icon button should retain its `aria-label`; decorative icons get `aria-hidden="true"` on the SVG.

---

## 7. Riskiest assumption + alternative

**Risk:** lucide-react's tree-shaking may not produce the expected ~0.5 kB per icon under Vite. The library's `package.json` declares `sideEffects: false` (brief-2 verified), but the deep-import path differs across versions and some patterns (e.g. `import { Icon } from 'lucide-react'` vs `import Icon from 'lucide-react/Icon'`) tree-shake differently.

**Mitigation:** the s6 step-1 smoke-build catches this early. If chunk grows >10 kB from a single icon test import, switch to deep-path imports.

**Alternative library if lucide fails:** `@tabler/icons-react` (MIT, similar API, smaller per-icon bundle in some configs). Adds a Phase 3 oss-scout flag if invoked.

---

## 8. Open questions for the implementer (≤5)

1. **`MessageCircle` vs `MessageSquare` for the chat icon** — Lucide has both. `MessageCircle` matches the current `ChatBubbleIcon` in App.tsx better visually. Recommend `MessageCircle`. (Implementer's call.)
2. **`Calendar.tsx` chevrons** — the inline SVGs there may already exactly match Lucide's `ChevronLeft`/`ChevronRight` paths. Verify visual parity before replacing; if identical, the swap is risk-free.
3. **`GooglePhotosPane.tsx` `▶` Play icon** — should it be `Play` (filled triangle) or `PlayCircle` (circle outline)? `Play` is the canonical 2026 SOTA for a video/slideshow control. Recommend `Play`.
4. **`gantt.css` 6 hex sites in s7** — verify each replacement preserves dark + light theme contrast. The current values were chosen for dark; the token equivalents must work in both. Run a quick contrast check via DevTools.
5. **s8 commit grouping** — bundle s7+s8 into ONE commit per file (atomic) OR separate s6 / s7 / s8 commits? Recommend ONE commit per file for clarity at code-review time, but the implementer can choose. Mid-flight scope check still applies (≥350 LOC OR ≥6 files in a single commit triggers abort — given ~21 files total, batch into 3-4 commits).

---

## 9. Scope assessment

- **Path:** delegated (>5 files, ~21 files unique)
- **Estimated LOC:** 250-400 (icon import lines + JSX swaps + CSS guard blocks + token substitutions)
- **Worktree:** YES (per the delegated-path convention)
- **`--allow-large-diff` needed:** NO (estimated under 800 LOC; well under hard cap)
- **Novel architecture:** NO (mechanical icon migration + cleanup)

---

## 10. Roadmap drift note (for rectify summary)

The original s8 wording in `plans/frontend-uplift-2026q2-roadmap.md` is "every motion declaration in the codebase carries both guards" — this synthesis softens that to "every asymmetrically-guarded motion site carries both guards; fully-uncovered sites point to the global reset comment" per the brief-1 architecture flag. Track this as a deferred low-tier finding for the next roadmap re-run.
