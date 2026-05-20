### `frontend-uplift-2026q2-m1` — Warm-palette token shift (UPL-6)

**Stories:**

**`frontend-uplift-2026q2-e1-s1` — Apply warm-gray token values to neutral CSS custom properties** (S)

Given `src/styles/theme.css` contains `--bg: oklch(0.10 0.012 252)` and matching cool-blue values for `--panel`, `--panel-2`, `--border`, `--text-dim`
When the developer edits those 5 token declarations to reduce chroma and shift hue warm (`--bg: oklch(0.10 0.006 237)`, chroma-halved + hue-shifted for the remaining four)
Then the newtab dark theme renders with visibly reduced blue tension on all neutral surfaces; `--accent` is untouched; `npm run build` passes with zero TypeScript strict errors

Specialist: Bundle-budget reviewer — confirm zero bundle-size delta (`vite build --report` before/after; this change is CSS-only so the delta must be 0 bytes)

**`frontend-uplift-2026q2-e1-s2` — Verify WCAG AA contrast on all text-on-background token pairs after the shift** (XS)

Given the warm-gray token values are applied in `theme.css`
When the developer runs a contrast-ratio check (browser DevTools / axe-core) on every text-on-background pair: `--text` on `--bg`, `--text` on `--panel`, `--text-dim` on `--panel`, `--text-dim` on `--panel-2`
Then all pairs meet WCAG AA (≥4.5:1 for normal text, ≥3:1 for large text); any pair that fails has its chroma restored to the pre-shift value and the story is re-opened

Specialist: A11y reviewer — run axe-core or equivalent on the rendered newtab after token application; document each pair's contrast ratio in the milestone rectify summary

---
