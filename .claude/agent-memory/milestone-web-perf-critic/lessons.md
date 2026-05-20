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
