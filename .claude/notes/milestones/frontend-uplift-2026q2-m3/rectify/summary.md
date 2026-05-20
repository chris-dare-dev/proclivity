# Rectify summary — frontend-uplift-2026q2-m3

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=1 H=1 M=8 L=5)
**Build verified:** `npm run build` → 234.02 kB initial chunk (unchanged from
implement; rect was CSS + 1 aria-label + comment-only), zero TS errors, 1.37s.

---

## Fixed (11 of 15)

### CRITICAL

- **C1 — gantt-bar drop shadow invisible in light theme.** Swapped
  `box-shadow: 0 1px 0 color-mix(in srgb, var(--bg) 70%, transparent)` →
  `oklch(0 0 0 / 0.3)`. Shadows are conventionally darkening overlays in
  both themes — `--bg` (background-tone token) was the wrong abstraction
  for a shadow color.
  - File: `src/sections/gantt/gantt.css:240`

### HIGH

- **H1 — gantt-bar dragging shadow invisible in light theme.** Same root
  cause and same fix as C1; swapped to `oklch(0 0 0 / 0.5)`.
  - File: `src/sections/gantt/gantt.css:283`

### MEDIUM

- **M1 — gantt-bar-progress overlay polarity flip across themes.** Same
  root cause as C1/H1 — `var(--bg)` in `color-mix` lightens in light theme.
  Swapped to `oklch(0 0 0 / 0.25)` to preserve "filled portion is darker"
  semantic in both themes.
  - File: `src/sections/gantt/gantt.css:252`

- **M2 — theme.css canonical-guard comment lists files that already have
  per-site guards.** Rewrote the list. The genuinely guardless files are
  now `(sprint.css, ChatPanel.css)` only; replaced the static enumeration
  with a `git grep` recipe so future drift is detectable.
  - File: `src/styles/theme.css:141-145`

- **M3 — ClosedTodosView.css was asymmetrically guarded, not uncovered.**
  Added the missing `@media (prefers-reduced-motion: reduce)` block paired
  with the existing `[data-reduced-motion="true"]` selectors. Corrected
  the misleading top-of-file comment.
  - File: `src/components/closed/ClosedTodosView.css:14, 334-348`

- **M4 — sections.css pointer comment mislabeled a file with local guards.**
  Added the missing `[data-reduced-motion="true"]` selectors paired with
  the existing `@media` block. Corrected the misleading top-of-file comment.
  - File: `src/sections/sections.css:1, 230-246`

- **M5 — ChartView ↳ retained without an inline carve-out comment.** Added
  a 2-line comment above the `<option>` map call explaining the SVG-cannot-
  render-in-`<option>` reason and cross-referencing this milestone.
  - File: `src/sections/gantt/ChartView.tsx:467-470`

- **M6 — `color-mix(--bg)` overlay pattern invisible in light mode.** Closed
  by the same edits that fixed C1/H1/M1 above (all three sites in gantt.css
  shared this root cause).

- **M7 — GooglePhotosPane video-overlay badge loses dark backdrop in light
  mode.** Same root cause as M6; swapped to theme-invariant
  `oklch(0 0 0 / 0.55)` so the Play icon stays legible over bright
  thumbnails in both themes.
  - File: `src/components/settings/panes/GooglePhotosPane.tsx:541-543`

- **M8 — gantt collapse-button loses accessible name after icon migration.**
  Added `aria-label={task.collapsed ? "Expand" : "Collapse"}` so the
  accessible name is robust regardless of `title`-attribute SR support.
  - File: `src/sections/gantt/TaskRow.tsx:130`

### LOW

- **L1 — ClosedScopeCounter nested aria-hidden + dead font-size.** Removed
  redundant `aria-hidden="true"` on the inner Lucide SVGs (outer span
  already declares it). Replaced dead `font-size: 12px` CSS with
  `display: inline-flex; align-items: center;` since icon size is now
  prop-driven via Lucide's `size={13}`.
  - Files: `src/components/ClosedScopeCounter.tsx:30,36`,
    `src/sections/sections.css:214-225`

---

## Deferred (4 of 15)

- **L2 — `deps`, `icons`, `theme` not in CLAUDE.md scopes list.** Edit
  blocked by `protect-ops-files.mjs` hook (CLAUDE.md is the project
  contract; mid-task edits require explicit `CLAUDE_ALLOW_OPS_EDITS=1`).
  Defer to a user-initiated CLAUDE.md update. The scopes have precedent
  in git history, so no immediate functional impact.
- **L3 — Lucide named-import inlined into JSX without newline grouping
  (QuickPrompt).** Edge-case visual nit — long banner text + narrow viewport
  could wrap the icon. Probably never observed. Defer.
- **L4 — `^1.16.0` caret pin allows minor auto-upgrades.** OSS critic
  explicitly recommended "No action required" — caret is the canonical
  pin pattern for this lib. Defer.
- **L5 — Implement synthesis testing-gap note.** Testing infrastructure
  is out-of-scope for this milestone (proclivity has no test suite); the
  light-theme visual-regression observation is captured as a deferred
  follow-on for future testing work. Defer.

---

## Invalidated

None.

---

## Re-verification status

Each CRITICAL+HIGH+MEDIUM finding was independently re-read against the
diff before fixing:

- **C1/H1/M1/M6** — confirmed via `git show 88dac12`; root cause shared.
- **M2** — confirmed via `grep prefers-reduced-motion -- '*.css'` and
  `grep data-reduced-motion -- '*.css'`.
- **M3/M4** — confirmed by reading the actual reduced-motion blocks in
  ClosedTodosView.css and sections.css.
- **M5** — confirmed via `sed -n '460,475p' ChartView.tsx`.
- **M7** — confirmed via `sed -n '530,560p' GooglePhotosPane.tsx`.
- **M8** — confirmed via `sed -n '115,140p' TaskRow.tsx`.
- **L1** — confirmed by reading ClosedScopeCounter.tsx and `grep` of
  `closed-scope-counter-check/-arrow` in sections.css.

Invalidation rate: 0/11 fixed (0%). Far below the 40% threshold that
would trigger re-critique.

---

## Build gate

```
✓ 2277 modules transformed.
dist/assets/index.html-DDwt3WOC.js   234.02 kB │ gzip: 75.04 kB
✓ built in 1.37s
```

Chunk size unchanged at 234.02 kB (rectifications were CSS + 1 attribute +
comments — no JS payload change). Well under 400 kB soft warn.
