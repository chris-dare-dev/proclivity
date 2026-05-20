---
milestone_id: "frontend-uplift-2026q2-m1"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://linear.app/now/behind-the-latest-design-refresh"
    sha256: "1d621ffd3a889f43bcadc0a2c185a4bfd4a854f70764ceaaebd90f6b82e87259"
    takeaway: "Linear's March 2026 refresh confirms the warm-gray direction (away from cool blue-tinted neutrals) but publishes no exact oklch numbers — the team used an embedded dev-toolbar color picker and exported JSON."
  - url: "https://oklch.com/"
    sha256: "7394029c04671cb4e091eae2be9f1226127a8773c576a92cde410b420204a31c"
    takeaway: "Created by Evil Martians (Andrey Sitnik); interactive OKLCH picker confirming chroma is the saturation axis and lower values (e.g. 0.006 vs 0.012) produce visibly more neutral/gray output."
  - url: "https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl"
    sha256: "a98d210eac4cc6bea29ab55bd89af255d6edb07b34db8a2cc20889fe424180b8"
    takeaway: "Canonical hue reference: blue is ~220 deg, purple is ~270-320 deg; hue 237 is closer to pure blue than hue 252 — CRITICAL: 237 is cooler, not warmer, than 252."
  - url: "https://www.w3.org/TR/css-color-4/#css-oklch"
    sha256: "6740ff6a5dcb88cee4b53fd3181ba7e8bf671d03e19a80f68bd8e7ba76ff668b"
    takeaway: "CSS Color 4 spec: hue is powerless when chroma approaches zero, so the primary lever for neutralising cool blue tension on dark surfaces is chroma reduction, not hue shift."
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m1

## 1. External sources consulted

- **URL:** https://linear.app/now/behind-the-latest-design-refresh
  **SHA256:** `1d621ffd3a889f43bcadc0a2c185a4bfd4a854f70764ceaaebd90f6b82e87259`
  **Takeaway:** Linear's 2026 design refresh explicitly targets the same "cool blue-ish neutral → warmer gray" shift this milestone implements. No exact oklch numbers were published; the team iterated via a dev-toolbar color picker. This confirms the design direction is credible but provides no numerical anchors to validate the proposed target values.

- **URL:** https://oklch.com/
  **SHA256:** `7394029c04671cb4e091eae2be9f1226127a8773c576a92cde410b420204a31c`
  **Takeaway:** The Evil Martians OKLCH picker confirms that chroma is the primary saturation axis; halving chroma from 0.012 to 0.006 on a dark surface (L=0.10) will produce a visibly more neutral result. At such low L values the visual difference is subtle but measurable.

- **URL:** https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
  **SHA256:** `a98d210eac4cc6bea29ab55bd89af255d6edb07b34db8a2cc20889fe424180b8`
  **Takeaway:** Canonical OKLCH hue reference. Blue peaks around 220 deg; purple/violet starts around 270-320 deg. Hue 252 sits between pure blue and purple — it carries mild red undertones from the purple end that hue 237 does NOT. Therefore hue 237 is actually MORE blue (cooler) than hue 252, not warmer. This directly contradicts the brief's directional framing.

- **URL:** https://www.w3.org/TR/css-color-4/#css-oklch
  **SHA256:** `6740ff6a5dcb88cee4b53fd3181ba7e8bf671d03e19a80f68bd8e7ba76ff668b`
  **Takeaway:** CSS Color 4 spec confirms hue is "powerless" when chroma is near zero. For very dark, low-chroma neutrals (L=0.10, C=0.006), the hue has negligible perceptual effect. The chroma reduction from 0.012 → 0.006 is the dominant lever for reducing blue tension; the hue shift from 252 → 237 contributes very little at this chroma level and is directionally suspect.

## 2. external_writes_required

This milestone is a CSS-only change to `src/styles/theme.css`. No new npm packages, no service worker changes, no manifest changes, no Chrome Web Store publish.

```yaml
external_writes_required:
  - "git push origin main"
```

## 3. Riskiest assumption + alternative

**Riskiest assumption:** The brief asserts that shifting hue from 252 to 237 makes the neutrals "warmer." This is incorrect in OKLCH space. The hue wheel places pure blue at ~220 deg and purple/violet beyond ~270 deg; hue 252 already sits between blue and purple and carries faint red-violet undertones (which perceptually register as slightly warm). Hue 237 is closer to pure blue and therefore cooler, not warmer. At the extremely low chroma values involved (0.006–0.012 on L=0.10 surfaces), this hue difference is nearly imperceptible — the dominant visual improvement comes entirely from chroma halving, not from the hue change. The implementer should NOT frame the hue 237 target as "warmer" and should be aware that if chroma is raised above ~0.010 in a follow-on milestone, the 237 hue will read cooler/bluer than 252, not warmer.

**Concrete alternative:** Implement only the chroma halving (keep hue at 252 across all five tokens), changing `C` from `0.012/0.014/0.016/0.018/0.018` to `0.006/0.007/0.008/0.009/0.009` while leaving hue at 252. This achieves the "reduced blue tension" effect through desaturation alone — which is exactly the perceptually dominant mechanism anyway — and avoids introducing a directional error in the hue that could cause problems if chroma is raised later. If a genuine warm shift is desired (toward amber/tan neutrals rather than cool gray), hue should move upward toward 60-90 deg (yellow range), not downward toward 237.

## 4. Acceptance criteria the implementer must meet

1. In `src/styles/theme.css` `:root` block, change exactly these five token declarations and no others: `--bg`, `--panel`, `--panel-2`, `--border`, `--text-dim`; `--accent`, `--text`, and all other tokens are untouched.
2. The proposed target values are: `--bg: oklch(0.10 0.006 237)`, with the remaining four tokens having chroma halved and hue shifted to 237 in the same proportional pattern as specified in the brief.
3. `npm run build` passes with zero TypeScript errors after the change (this is CSS-only; TypeScript compilation must not regress).
4. `vite build --report` before and after shows 0-byte delta in all JS/CSS bundle output sizes (CSS custom property declarations are inlined into the stylesheet chunk; no new code paths are introduced).
5. WCAG AA contrast check: all four text-on-background pairs (`--text` on `--bg`, `--text` on `--panel`, `--text-dim` on `--panel`, `--text-dim` on `--panel-2`) must meet ≥4.5:1 for normal text. If any pair fails, its chroma is restored to the pre-shift value and the story is re-opened.
6. The light-theme tokens in `[data-theme="light"]` are NOT modified by this milestone — only the `:root` dark-theme block is in scope.
7. Commit is on `main` (not a feature branch), follows conventional-commit format `style(a11y): warm-gray token shift for dark theme`, and passes pre-commit hooks.
