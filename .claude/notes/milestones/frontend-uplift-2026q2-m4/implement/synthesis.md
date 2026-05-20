# Implement synthesis — frontend-uplift-2026q2-m4

**Date:** 2026-05-20
**Path:** inline (main session)
**Base SHA:** d22031e
**Commit landed:** `64fb75b feat(motion): section-fade cross-dissolve on tab switches (m4-s11)`

**Build status:** PASS (235.47 kB initial chunk, +0.93 kB from 234.54 m5
baseline; well under 400 kB soft warn).

---

## 1. What shipped

Single-story milestone (s11), 4 files (3 production + 1 type
augmentation), +168/-7 LOC.

### App.tsx state machine (additions, no edits)

- `leavingTab: Tab | null` state (initial `null`).
- `leavingTimeoutRef: useRef<number | undefined>` for cancellable 250 ms timeout.
- `prevTabRef: useRef<Tab>(tab)` to capture the previous tab between renders.
- Second `useLayoutEffect([tab])` block (sits below the m5-s9 stagger block).
  On each `tab` change: reads `prev = prevTabRef.current`, sets
  `leavingTab=prev` if `prev !== tab`, cancels any pending timeout, and
  schedules a new 250 ms clear via functional-updater so a more-recent
  set is never raced. Cleanup cancels the timeout on unmount.
- For each of the 7 tabpanel `<div>`s:
  - `hidden` predicate widened: `tab !== id && leavingTab !== id`.
  - Added `data-leaving={leavingTab === id ? "true" : undefined}`.
  - Added `inert={leavingTab === id ? true : undefined}`.

### App.css additions

- `.content` rule: kept `min-height: 400px`, added `position: relative`
  so absolutely-positioned `[data-leaving]` children size against
  `.content` (not `.app`).
- `.content > [data-leaving="true"]`: `position: absolute; inset: 0;
  opacity: 0; transition: opacity 220ms ease-out; pointer-events: none`.
  Opacity transitions from currently-rendered 1 to rule target 0.
- `@keyframes tabpanel-fade-in { from { opacity: 0 } to { opacity: 1 } }`.
- Incoming-panel rule: `.content > div:not([hidden]):not([data-leaving]):not([data-staggered])
  { animation: tabpanel-fade-in 220ms ease-out both; }`. The
  `:not([data-staggered])` carve-out is intentional — Today/Sprint/LongTerm
  already get m5-s9 stagger and stacking would compete visually.
  `animation-fill-mode: both` is the LOAD-BEARING flash-of-content
  defense.
- Dual-guard reduced-motion (`[data-reduced-motion="true"]` + `@media`
  blocks) collapses both the transition and animation to `none`.

### `src/types/react-augment.d.ts` (NEW)

22-line module augmentation extending `HTMLAttributes<T>` with
`inert?: boolean | "" | undefined`. React 18.3's `@types/react` doesn't
declare it natively; React 19 ships it. Forward-compat shim with a clear
delete-on-upgrade comment.

---

## 2. Architecture decisions made during implementation

1. **`prevTabRef` + `useLayoutEffect` (synthesis Option A)** — one
  declarative state machine that mirrors m5-s9 exactly. Captures the
  OLD tab between renders without rewriting any existing `setTab` call
  sites (there are 4).

2. **`inert` as JSX prop via module augmentation** — cleaner than 7
  refs + `el.toggleAttribute`. Forward-compat with React 19.

3. **Stagger carve-out via `:not([data-staggered])`** — keeps the
  panel-level fade-in and the stagger from competing on Today/Sprint/
  LongTerm. Gantt, Reminders, Calendar, Closed get the panel fade-in;
  Today/Sprint/LongTerm get the stagger only.

4. **250 ms timeout (not 220 ms)** — matches the stagger precedent +
  small safety buffer past the CSS 220 ms transition.

5. **`inert` set to `true | undefined`, not `true | false`** — React
  serializes `inert={false}` to `inert="false"` (truthy string parsed
  as "inert is set"). `undefined` omits the attribute, the correct
  "not inert" state.

---

## 3. Deviations from synthesis

None. All AC from §6 are met. The `inert` TS friction was anticipated
(brief-1 G8); module augmentation was the prescribed approach.

---

## 4. Build verification

```
✓ 2278 modules transformed.
dist/assets/index.html-xOoQ3gTG.js   235.47 kB │ gzip: 75.34 kB
✓ built in 1.47s
```

Chunk delta from m5 baseline (234.54): +0.93 kB. Well under the
synthesis target of 240 kB. Strict TS: zero errors.

---

## 5. Embedded-spike outputs

The roadmap §9 spike "CSS `[data-leaving]` section-fade — a11y and
flash-of-content validation" prescribed three checks. The implementation
addresses them as follows:

- **(a) Flash-of-content visible during 220 ms?** Defended by
  `animation-fill-mode: both` on the incoming-panel keyframe. Manual
  smoke in dev is the proper verification.
- **(b) Tab key reaches inactive panel descendants?** Defended by
  `inert` on the leaving panel — removes from focus order AND a11y tree
  atomically.
- **(c) axe-core violations?** Module augmentation only adds a type
  declaration; no new ARIA usage. Phase 3 adversary review is the
  proper gate.

Phase 3 critique fan-out runs the spike outputs effectively. Fallback
documented in synthesis §7: if a critic flags HIGH-severity FOUC or
Tab-escape regression, fall back to reveal-only (no fade-out; instant
hide outgoing, fade-in incoming).

---

## 6. Test deltas

None (m1 L5 carry-over).

---

## 7. Files changed

```
 src/newtab/App.tsx                                | +71/-5
 src/newtab/App.css                                | +60/-1
 src/types/react-augment.d.ts (NEW)                | +22
 .claude/agent-memory/milestone-researcher/lessons.md | +12
```

(The roadmap promotion commit `d22031e` is separate from the s11
implementation commit `64fb75b`.)
