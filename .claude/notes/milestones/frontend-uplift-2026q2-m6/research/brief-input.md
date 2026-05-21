### `frontend-uplift-2026q2-m6` — UPL-9 todo-row lift-on-hover

Promoted from Later lane on 2026-05-20 after e2 (m4 + m5) shipped. First milestone in epic e3 (UX Polish). Pure CSS — no library, no React state changes. Fast XS win.

**Stories:**

**`frontend-uplift-2026q2-e3-s12` — UPL-9: CSS lift-on-hover for `.todo-item`** (XS)

Given todo rows today render flat in `.todo-list` with no hover affordance, and the codebase already has `.todo-item` styled in `src/sections/sections.css` with `display: flex; padding: 10px 12px; border: 1px solid var(--border)`
When the developer adds `transition: transform 120ms ease-out, box-shadow 120ms ease-out;` to `.todo-item` and a `:hover` block (gated by `@media (hover: hover) and (pointer: fine)` so touch devices don't get a sticky hover state) that applies `transform: translateY(-2px)` and a subtle `box-shadow: 0 4px 12px oklch(0 0 0 / 0.18)` to create the lift, paired with the canonical dual-guard reduced-motion block (`[data-reduced-motion="true"]` AND `@media (prefers-reduced-motion: reduce)`) that collapses both the transform and shadow to `none`
Then hovering a todo row on desktop produces a visible ~2 px lift + soft shadow within 120 ms; on touch devices (no hover support) the hover state never engages and the row stays flat; under reduced-motion the transform and shadow are suppressed entirely; `npm run build` passes with zero TypeScript strict errors and no measurable initial-chunk delta (pure CSS additions)

Specialist: Visual reviewer — confirm the lift reads as a clear affordance without feeling jittery or competing with the m5-s9 stagger on tab activation (the stagger sets opacity, this sets transform — they shouldn't interfere); confirm the shadow color works in both light and dark themes (use `oklch(0 0 0 / N%)` per the m3 rect convention to stay theme-invariant)

---
