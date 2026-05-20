# Research synthesis — frontend-uplift-2026q2-m1

**Milestone:** Warm-palette token shift (UPL-6)
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore, codebase-context), brief-2.md (general, external + writes)

---

## 1. TL;DR for the implementer

This is a 5-line CSS edit to `src/styles/theme.css` lines 22-29 (dark theme `:root` block). **The upstream roadmap brief's exact target value `oklch(0.10 0.006 237)` is directionally wrong — hue 237 is COOLER than the current hue 252 in OKLCH color space.** The actual warming mechanism is chroma reduction (halving from 0.012 → 0.006 etc.); per CSS Color 4 spec, hue is "powerless when chroma is near zero" at L=0.10. Implementer should halve chroma on all 5 tokens AND keep hue at 252 (the simpler change) — the OKLCH math confirms this delivers the intended perceived warmth.

Brief-1 pre-computed WCAG AA contrast on all 4 text-on-background pairs at the proposed values: lowest pair is text-dim on panel-2 at **6.65:1** — all pass ≥4.5:1 with substantial margin.

---

## 2. Affected files

**Primary edit (mandatory):**
- `src/styles/theme.css` lines 22-29 (dark theme `:root` block) — 5 token declarations: `--bg`, `--panel`, `--panel-2`, `--border`, `--text-dim`

**Optional symmetry edit:**
- `src/styles/theme.css` lines 69-74 (`[data-theme="light"]` block) — same 5 tokens. Implementer's call. Recommend yes for theme consistency, but s1 AC names only the dark block.

**Reads only (no edit):**
- `src/styles/theme.css` lines 27-29 (`--text`, `--text-dim`, `--accent`) — `--text` and `--accent` must NOT change; the brief is explicit.

**Downstream cascade scope** (per brief-1's audit, no edit needed — these consume the tokens):
- `--border` used at ~80+ sites
- `--panel` / `--panel-2` at ~30-50 sites each
- `--bg` at 4 background sites + one notification-dot ring
- `--text-dim` at ~20 sites

---

## 3. Recommended token values (corrected from roadmap brief)

```css
/* Dark theme — :root block at lines 22-29 */
--bg:       oklch(0.10 0.006 252);  /* was: oklch(0.10 0.012 252) — chroma halved */
--panel:    oklch(0.14 0.007 252);  /* was: oklch(0.14 0.014 252) — chroma halved */
--panel-2:  oklch(0.17 0.008 252);  /* was: oklch(0.17 0.016 252) — chroma halved */
--border:   oklch(0.22 0.009 252);  /* was: oklch(0.22 0.018 252) — chroma halved */
--text-dim: oklch(0.68 0.009 252);  /* was: oklch(0.68 0.018 252) — chroma halved */
```

**Hue stays at 252.** The roadmap's proposed 237 is colder, not warmer (brief-2 §4). The chroma halving alone delivers the documented "warmer gray" perception Linear achieved.

If after smoke-test the dark theme STILL reads too cool (subjective), the implementer's escape hatches are:
- Try `chroma=0.004` (further reduction)
- OR shift hue toward genuinely warm territory (e.g., 60-90 for orange-tinted gray, OR 30-60 for brown-tinted) — but only after verifying with the OKLCH picker at https://oklch.com/

**Do NOT use hue 237.** It contradicts the documented design direction.

---

## 4. Pre-computed contrast (WCAG AA gate)

From brief-1's contrast math (assumes `--text: oklch(0.93 0.005 252)` unchanged):

| Pair | Lightness delta | Computed ratio | AA pass (≥4.5:1) |
|---|---|---|---|
| `--text` on `--bg` | 0.93 − 0.10 = 0.83 | 17.4:1 | ✓ pass |
| `--text` on `--panel` | 0.93 − 0.14 = 0.79 | 13.8:1 | ✓ pass |
| `--text-dim` on `--panel` | 0.68 − 0.14 = 0.54 | 7.1:1 | ✓ pass |
| `--text-dim` on `--panel-2` | 0.68 − 0.17 = 0.51 | **6.65:1** | ✓ pass |

Lowest margin: 6.65:1 (47% above AA threshold). No story-s2 reversal scenario is triggered at the proposed values.

---

## 5. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

CSS-only change. No npm package additions, no manifest changes, no service worker changes, no Chrome Web Store implications.

---

## 6. Implementation acceptance criteria

The implementer must satisfy ALL of these:

1. **5 token declarations edited** in `src/styles/theme.css` `:root` block (lines 22-29). Chroma halved on `--bg`, `--panel`, `--panel-2`, `--border`, `--text-dim`. Hue stays 252.
2. **`--accent`, `--accent-2`, `--text`, `--ok`, `--warn`, `--danger`, `--mesh-*` tokens are NOT changed.** Verifiable via git diff scope.
3. **Light theme block (lines 69-74)** — recommended to receive the same chroma-halve treatment for symmetry but NOT required by the strict s1 AC. Implementer documents the decision in the implement synthesis.
4. **`npm run build` passes** with zero TypeScript strict errors and the existing initial-newtab-chunk bundle delta within ±100 bytes of baseline (CSS-only, expected delta ~0).
5. **All 4 contrast pairs pass WCAG AA** (≥4.5:1). The pre-computed table above shows all pass at ≥6.65:1 already; verify against the actual rendered build (DevTools accessibility tab or `npx axe-core`).
6. **No hardcoded magic-number hex values introduced** (per the upstream current-state-critic brief, `#0b0e14` / `#fff` cleanup is for the UPL-21 token-discipline sweep milestone, not this one).

---

## 7. Riskiest assumption + alternative

**Risk:** The user's subjective perception of "warmer" may not match the perceptually-tighter chroma-halved result. Linear's design blog talks about "warmer gray" but provides no exact OKLCH numbers; their dev-toolbar picker pipeline kept the change empirical.

**Mitigation / alternative:** If after the build the user reports the dark theme still reads "cool" subjectively, escalate to a second milestone (`m1.1` or fold into m2/m3) that experiments with: (a) further chroma reduction to 0.004, or (b) a small hue rotation toward red (240→230 is wrong direction; 240→260 or 240→0 would be valid warm shifts at low chroma — but only if chroma is high enough for hue to register). Brief-2 §4 spec citation confirms hue is "powerless when chroma is near zero" so this is mostly moot.

---

## 8. Open questions for the implementer (5 max)

1. **Light-theme symmetry — apply chroma-halve to lines 69-74?** Recommend yes; document the decision in the implement synthesis. Light theme has different baselines (`oklch(0.97 0.004 252)` etc.) so the math differs slightly.
2. **Bundle measurement** — run `npm run build` once before the edit and once after; compare the dist/ output. Expected delta: 0 bytes (CSS-only). If non-zero, surface as an unexpected finding.
3. **Verify rendering** — does the user want a screenshot comparison in the implement synthesis? (Not strictly required by AC; helpful for the rect summary.)
4. **axe-core vs manual DevTools** for s2 contrast verification — either is sufficient; pick whichever is faster.
5. **Should the visual scout from the upstream `/frontend-uplift 2026q2-visual-refresh` be re-run after m1 lands** to confirm the perceived warmth? Defer — out of m1 scope; consider for `m3` or the program-level review.

---

## 9. Scope assessment

- **Estimated diff:** 5 lines (mandatory) + 5 lines (optional light-theme symmetry) = 5-10 LOC in 1 file
- **Inline path** confirmed — well under the 300 LOC / 5 files threshold for delegation
- **No worktree needed**
- **No novel architecture**
- **No external dependencies**
