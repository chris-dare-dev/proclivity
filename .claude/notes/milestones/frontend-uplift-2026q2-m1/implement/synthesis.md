# Implement synthesis — frontend-uplift-2026q2-m1

**Milestone:** Warm-palette token shift (UPL-6)
**Path:** inline (5–10 LOC, 1 file, no novel architecture)
**Base SHA:** `f004e98` (pre-implementation)
**Implement commit:** `7c69967` (style(theme): warm-palette token shift (m1))

---

## Files changed

| File | +/− | Summary |
|---|---|---|
| `src/styles/theme.css` | +19 / −9 | Halved chroma on 5 dark-theme neutrals + 3 light-theme neutrals. Added inline rationale comments tying back to milestone + CSS Color 4 spec. |

Net diff: 28 lines touched, single file. Well inside the inline-path scope ceiling (300 LOC / 5 files).

---

## What changed (token-by-token)

### Dark theme `:root` (lines 22–29)

| Token | Before | After | Notes |
|---|---|---|---|
| `--bg` | `oklch(0.10 0.012 252)` | `oklch(0.10 0.006 252)` | chroma halved |
| `--panel` | `oklch(0.14 0.014 252)` | `oklch(0.14 0.007 252)` | chroma halved |
| `--panel-2` | `oklch(0.17 0.016 252)` | `oklch(0.17 0.008 252)` | chroma halved |
| `--border` | `oklch(0.22 0.018 252)` | `oklch(0.22 0.009 252)` | chroma halved |
| `--text-dim` | `oklch(0.68 0.018 252)` | `oklch(0.68 0.009 252)` | chroma halved |
| `--text` | `oklch(0.93 0.008 252)` | UNCHANGED | per s1 AC explicit |

### Light theme `[data-theme="light"]` (lines 73–80)

| Token | Before | After | Notes |
|---|---|---|---|
| `--bg` | `oklch(0.97 0.004 252)` | UNCHANGED | C=0.004 already effectively neutral |
| `--panel` | `oklch(1.00 0 0)` | UNCHANGED | pure white, nothing to halve |
| `--panel-2` | `oklch(0.95 0.005 252)` | `oklch(0.95 0.003 252)` | mild halve (not exactly 50% due to OKLCH minimum) |
| `--border` | `oklch(0.88 0.008 252)` | `oklch(0.88 0.004 252)` | chroma halved |
| `--text` | `oklch(0.18 0.012 252)` | UNCHANGED | dark text retains slight tonal grounding |
| `--text-dim` | `oklch(0.45 0.018 252)` | `oklch(0.45 0.009 252)` | chroma halved |

Symmetry decision (open question #1 from research synthesis): **light theme included.** Rationale: avoids the dark-theme-only "warmer" perception, keeps both themes coherent under the same chroma-discipline rule.

---

## Deviations from the research synthesis

**None** — the synthesis recommended exactly this approach (chroma-halve, hue 252 preserved). The roadmap brief's proposed `oklch(0.10 0.006 237)` value was directionally wrong (237 is cooler, not warmer, per the OKLCH math); the implementation followed the corrected synthesis recommendation, not the original brief.

---

## Build + check matrix

| Gate | Result |
|---|---|
| `npm run build` (tsc -b + vite build) | ✓ pass — zero TypeScript errors |
| Initial newtab chunk size | **203.65 kB** (identical to baseline; CSS-only change) |
| `git status --porcelain` post-commit | ✓ clean |
| `git diff package.json package-lock.json` | ✓ untouched (no `npm ci` re-run needed) |
| `.github/workflows/*.y*ml` touched | ✗ no — workflow lint skipped |

---

## Pre-computed s2 contrast (carried from research brief-1)

WCAG AA gate already mathematically satisfied at the new values. The four story-s2 pairs:

| Pair | Lightness Δ | Computed ratio | AA threshold | Margin |
|---|---|---|---|---|
| `--text` on `--bg` | 0.83 | 17.4:1 | 4.5:1 | 287% |
| `--text` on `--panel` | 0.79 | 13.8:1 | 4.5:1 | 207% |
| `--text-dim` on `--panel` | 0.54 | 7.1:1 | 4.5:1 | 58% |
| `--text-dim` on `--panel-2` | 0.51 | **6.65:1** | 4.5:1 | 48% |

All four pass with substantial margin. The Phase 3 critics may re-verify against the rendered build, but the proposed values are mathematically pre-validated.

---

## external_writes_required (verbatim from state.json)

```yaml
external_writes_required:
  - "git push origin main"
```

This is the only remaining external write — no Chrome Web Store publish, no IaC, no docker.

---

## Open questions resolved

1. **Light-theme symmetry** — resolved: applied (per implementer judgement; documented above).
2. **Bundle measurement** — resolved: zero delta confirmed (203.65 kB before AND after).
3. **Screenshot comparison** — deferred to the rect summary if the user requests it.
4. **axe-core vs manual DevTools** — deferred to the Phase 3 web-perf-critic if it wants to verify.
5. **Visual-scout re-run** — deferred to post-m3 program-level review.
