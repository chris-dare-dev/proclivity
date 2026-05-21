# milestone-web-perf-critic lessons

This file is an **append-only log**. Each entry records what was learned during a single
Phase 3 web performance critique. Never delete or rewrite previous entries. To correct a
prior entry, append a new one that references the old timestamp.

Entry format (defined in `.claude/agents/milestone-web-perf-critic.md` § Memory protocol):

```
## <ISO-8601 UTC timestamp> · milestone:<id> · status:<status>
- **Bottleneck observed:** ...
- **What worked:** ...
- **What didn't:** ...
- **Reusable lesson:** ...
```

---

<!-- Entries will be appended below this line by the milestone-web-perf-critic agent. -->

## 2026-05-20T23:00:00Z · milestone:frontend-uplift-2026q2-m6 · status:complete
- **Bottleneck observed:** Pure-CSS hover-lift milestone (single file, +44 LOC). No bundle, storage, SW, or CSP issues — the entire critique focused on CSS paint/compositing hygiene and reduced-motion correctness. The only substantive findings were a MEDIUM latent-animation footgun (unconditional `transition` on `.todo-item` arms 120ms easing on ALL `transform`/`box-shadow` changes, including future touch-path features) and a MEDIUM stacking-context hazard (hover `transform` traps future `position:fixed` descendants — undocumented).
- **What worked:** Reading `theme.css` to verify the global nuclear reduced-motion reset (transition-duration: 0.01ms !important on `*`) confirmed the dual-guard in sections.css is belt-and-suspenders, not the primary load-bearing mechanism. This saved time by correctly downgrading several potential MEDIUM findings to LOW or CLEAN.
- **What didn't:** No production issues. The implementation was prescriptively derived from the research synthesis and had zero deviations.
- **Reusable lesson:** When a CSS hover transition is declared unconditionally on a base element rule (not inside `:hover`) for hover-leave smoothness — the "canonical pattern" — always audit whether OTHER rules or future features could set the same transitioned properties on non-hover paths (e.g. touch gestures, JS-driven animation). The unconditional declaration is correct for hover-leave, but it creates a latent timing footgun for any future property changes on the same element outside the hover context.

## 2026-05-20T22:09:32Z · milestone:frontend-uplift-2026q2-m4 · status:complete
- **Bottleneck observed:** The m5 `useLayoutEffect` lesson was directly validated — the implementer applied it from the start. The single remaining CLS issue (height jump when leaving panel goes `position: absolute`) is a CSS structural limitation: `position: absolute; inset: 0` removes the leaving panel from normal flow, so `.content` immediately collapses to the incoming panel's height. The `min-height` floor mitigates but does not eliminate this.
- **What worked:** [CONFIRMED from m5 lesson] Checking `useLayoutEffect` vs `useEffect` first saved significant analysis time — the implementer correctly used `useLayoutEffect` for both effects. The FOUC analysis was straightforward once the effect-timing chain was traced.
- **What didn't:** The height-jump CLS at t=0 is architectural (position:absolute exits flow) and requires a CSS model change (grid stacking trick) to fully fix. The `min-height` floor is a partial mitigation only. This pattern will recur in any cross-dissolve implementation that uses `position:absolute` overlap.
- **Reusable lesson:** CSS cross-dissolves using `position:absolute` overlap ALWAYS cause an instant height collapse when the leaving panel exits normal flow (t=0, before the first CSS transition frame). The correct fix is the grid-stacking trick: `display:grid` on the container + `grid-area: 1/1` on both panels so both occupy the same cell and the container height = max(leaving_height, incoming_height). If `min-height` is used as a floor instead, document the viewport-height cases where the floor is insufficient (typically: a tall panel → a short panel when both exceed the floor).

## 2026-05-20T18:49:45Z · milestone:frontend-uplift-2026q2-m3 · status:complete
- **Bottleneck observed:** `s7` semantic-token replacement in gantt.css used `color-mix(in srgb, var(--bg) N%, transparent)` as a drop-in for `rgba(0,0,0,N%)`. In dark mode `--bg` is near-black so it looks correct; in light mode `--bg` is near-white, making overlays/shadows/progress bars vanish. The same pattern also broke `.gantt-bar.child` text contrast (1.60:1 in dark mode after white text inherited on teal `--accent-2` background).
- **What worked:** Running `npm run build` to get exact chunk sizes, then using `python3` to compute WCAG contrast ratios from oklch values — caught H1 and M1/M2 before they reached production.
- **What didn't:** The implementer classified `s7` as "no behavioral change" which caused no test delta. CSS token substitutions ARE behavioral changes in the rendering sense — contrast failures are not caught by TypeScript or build-time checks.
- **Reusable lesson:** When auditing semantic-token replacement in CSS, always check whether the substituted token is a FOREGROUND token (`--text` = always dark/light relative to reading surface) or a BACKGROUND token (`--bg` = near-black in dark, near-white in light). Using `--bg` to create dark overlays only works in dark mode — the correct general-purpose overlay token is `--text` or a theme-invariant `rgba(0,0,0,N%)`.

## 2026-05-20T21:40:33Z · milestone:frontend-uplift-2026q2-m5 · status:complete
- **Bottleneck observed:** CSS stagger-reveal triggered by `data-staggered` attribute was implemented with `useEffect` to set the attribute, but `useEffect` fires asynchronously AFTER the browser paints. This means items render at full opacity for one frame (~16 ms), then drop to `opacity: 0` (via `animation-fill-mode: both`) before animating in — a 1-frame FOUC on every tab switch.
- **What worked:** Tracing the React 18 render/paint/effect lifecycle (setState → commit → paint → useEffect) to identify the precise frame where the FOUC occurs. The fix is a single-word swap: `useEffect` → `useLayoutEffect` (which fires after commit but before paint).
- **What didn't:** The implementer and synthesis both correctly described the timing intent (stagger fires on tab switch) but neither caught that `useEffect` fires post-paint — the FOUC is invisible in code review without explicitly thinking through the effect-timing lifecycle.
- **Reusable lesson:** Any CSS animation triggered by a data attribute that uses `animation-fill-mode: both` (or `forwards`) MUST be toggled via `useLayoutEffect`, not `useEffect`. The `fill-mode: both` rule holds items at the `from` state (often `opacity: 0`) the moment the attribute is applied — if that application happens post-paint, users see a flash of the `to` state before it disappears. Pattern to check: `data-*` attribute toggle driving a CSS animation with fill-mode → ask "is this set in useEffect or useLayoutEffect?"
