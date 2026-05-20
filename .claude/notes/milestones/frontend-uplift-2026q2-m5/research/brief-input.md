### `frontend-uplift-2026q2-m5` — UPL-3 stagger-reveal + UPL-16 mobile header fix

Promoted from Next lane on 2026-05-20 after e1 (m1+m2+m3) shipped. Both candidates are pure CSS with zero bundle cost. Sequenced ahead of m4 because UPL-16 is the only outright bug-class item on the roadmap (clock overflows and tabs clip at 390 px viewport) and UPL-3 is the lowest-risk motion win — pure `@keyframes` + `animation-delay`, no React state machine, no `motion` library dependency.

**Stories:**

**`frontend-uplift-2026q2-e2-s9` — UPL-3 CSS stagger-reveal on todo list cold loads** (S)

Given Today/Sprint/LongTerm tab activations render `<ul>` rows instantly with no entry animation, and the section root component already controls when a tab becomes active
When the developer adds a `@keyframes stagger-fade-up` rule, applies `animation: stagger-fade-up 220ms cubic-bezier(0.2, 0, 0, 1) both` with `animation-delay: calc(var(--stagger-idx, 0) * 55ms)` to `<li>` elements under a `[data-staggered="true"]` parent (limit `--stagger-idx` to 9 via CSS or React `Math.min(idx, 9)` so the cap-at-10 invariant holds), and toggles `data-staggered="true"` on the section root on tab activation (clearing it ~250 ms later so subsequent re-renders don't replay)
Then activating Today/Sprint/LongTerm visibly stagger-fade-ups items with a 55 ms inter-item delay; the animation fires once per activation, not per re-render; tab activations under `prefers-reduced-motion: reduce` render items instantly (no animation); `npm run build` passes with zero TypeScript strict errors; the dual-guard convention (`[data-reduced-motion="true"]` + `@media (prefers-reduced-motion: reduce)`) is honored on every new animation declaration

Specialist: A11y reviewer — verify with DevTools forced reduced-motion that items render instantly; the dual-guard must be paired on every new `animation` declaration; the `data-staggered` toggle must clear after the animation completes so a re-mount of the same panel doesn't re-trigger mid-interaction

**`frontend-uplift-2026q2-e2-s10` — UPL-16 mobile header layout fix** (XS)

Given at 390 px viewport the `.clock` element dominates and the `.tabs` row clips horizontally (visual-scout captured this in `today-mobile.png`)
When the developer changes `.clock`'s `font-size` to `clamp(28px, 6vw, 56px)` so it scales fluidly, and adds `overflow-x: auto; scrollbar-width: thin;` to the `.tabs` container (and `flex-shrink: 0` on each tab button so horizontal scroll actually engages instead of squeezing buttons)
Then at 390 px viewport the clock scales without overflow, the tab row scrolls horizontally without clipping, and no layout regression appears at desktop widths (≥1024 px); `npm run build` passes with zero TypeScript strict errors; no new motion sites are introduced (this story is layout-only)

Specialist: Visual reviewer — confirm at 390 px, 768 px, and 1280 px the layout holds; the scrollbar in the tab row should be thin (`scrollbar-width: thin`) and not draw the eye away from active content

---
