### `frontend-uplift-2026q2-m2` — Motion-library foundation (UPL-1)

**Stories:**

**`frontend-uplift-2026q2-e1-s3` — Record `vite build --report` baseline BEFORE adding `motion` dependency** (XS)

Given the current `package.json` does not contain `motion` and the build is clean
When the developer runs `npm run build` and captures the Rollup bundle report (initial newtab chunk size in KB)
Then the baseline chunk size is recorded in the milestone's research notes; the developer does NOT proceed to s4 until this measurement exists

Specialist: Bundle-budget reviewer — this is the mandatory gate; the pre-UPL-1 baseline is the denominator for the 200 KB ceiling check

**`frontend-uplift-2026q2-e1-s4` — Add `motion` package and wrap App shell in `<LazyMotion>`** (S)

Given the baseline chunk measurement from s3 exists and `motion` is not yet in `package.json`
When the developer runs `npm install motion`, imports `{ LazyMotion, m }` from `motion/react` in `App.tsx`, wraps the top-level JSX in `<LazyMotion features={() => import('motion/react').then(r => r.domAnimation)} strict>`, and replaces any existing `motion.*` usage stubs with `m.*`
Then `npm run build` passes with zero TypeScript strict errors; the App shell compiles without type errors on `LazyMotion` props; no `motion` symbols appear in the newtab's synchronous chunk

Specialist: Manifest-permissions reviewer — confirm `motion` is ISC/MIT licensed and introduces no new Chrome extension `manifest.config.ts` permission requirements

**`frontend-uplift-2026q2-e1-s5` — Verify initial chunk stays under 200 KB AFTER `motion` lands** (XS)

Given `motion` is installed and the `<LazyMotion>` wrapper is in place
When the developer runs `npm run build` and inspects the Rollup report for the initial newtab chunk
Then the initial chunk is ≤ 200 KB; if the chunk exceeds 200 KB the `motion` dependency is removed, the epic is re-tiered to Next, and a spike is filed to diagnose the overrun before reattempting

Specialist: Bundle-budget reviewer — compare post-UPL-1 initial chunk against the s3 baseline; the expected delta is ~4.6 KB; flag any delta >10 KB as anomalous

---
