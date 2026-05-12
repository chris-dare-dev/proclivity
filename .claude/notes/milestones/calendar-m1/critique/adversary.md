# Critique — calendar-m1 — adversary

**Critic:** adversary (Opus)
**Generated:** 2026-05-12T00:00:00Z
**Preview URL:** http://localhost:8765/src/newtab/index.html
**Screenshots:** none — `request_access` for Google Chrome timed out (300s) and the `claude-in-chrome` extension is not connected. UI findings below are derived from the source (CSS tokens, JSX, and layout math) rather than visual capture. The rectifier should re-screenshot after applying fixes.

## Verdict
NEEDS-REWORK

The Calendar tab is functionally close to shippable, but it has a real DST bug in reminder expansion, an a11y regression that hides sprint bars from assistive tech, several visual/contrast risks tied to `color-mix(... transparent)` tokens, and a settings-resolver bug that prevents users from ever turning the Calendar tab off (the `??` fallback eats `false`). Lane-stacking also wastes vertical space on every cell because the lane count is computed once across the whole grid rather than per-row.

## Executive summary
- **Critical resolver bug**: `sectionVisibility.calendar ?? DEFAULT` (and every sibling) means a stored `false` resolves to `true` — users cannot hide the tab once any other tab is also set. See `src/storage/constants.ts:90-95`.
- **DST off-by-one in `expandReminderDates`**: `Math.ceil((from - cursor) / (stride * DAY_MS))` uses raw ms, so when `[cursor, from)` straddles a DST transition the daily/weekly cursor advances one stride too many (or too few). `src/sections/calendar/calendarUtils.ts:161`.
- **Sprint bars are `aria-hidden`**: screen-reader users can't perceive sprints in the calendar at all. They carry the only sprint info on this page. `src/sections/calendar/SprintBars.tsx:65`.
- **Lane padding leaks globally**: `--calendar-lanes` is set on the `.calendar-bars` overlay, but `padding-top: calc(28px + var(--calendar-lanes,1)*18px)` is applied to *every* `.calendar-cell`, so a 3-lane week steals ~54px from every cell in the month — including empty months. `calendar.css:169`, `SprintBars.tsx:64`.
- **`isCurrentMonth` drifts at midnight**: `monthStart` is captured once on mount via `useState(() => startOfMonth(Date.now()))`, and `buildMonthGrid` also reads `Date.now()` only on render. New-tab pages frequently survive the rollover; the "Today" cell will silently point at yesterday.
- **Lane packing splits sprints that touch at a single day**: the `s.colStart <= occupied` check treats a sprint ending on Tue and another starting on Tue as a conflict, forcing them to separate lanes. Probably intended, but it inflates `laneCount` and is undocumented.
- **`SprintBars.tsx:68` does `sprints.find(...)` per segment per render** — quadratic-ish at scale.
- **Type-laundering CSS custom prop**: `as React.CSSProperties` on `{ "--calendar-lanes": ... }` is fine but the pattern recurs in SettingsModal, deserves a typed helper.
- **`MonthGrid` is `memo` but its `tags` prop is a fresh array each render** of `App` — the memo barrier doesn't help unless tags equality is shallow on the *array reference*, which `useStore` does provide; verify.
- **Touch targets**: Prev/Next chevrons render at ~28×28 (`padding: 6px 8px` + 16×16 SVG) — below the 32×32 recommendation; failing WCAG 2.5.5 enhanced and approaching 2.5.8 minimum (24×24).
- **`overflow: hidden` + `min-height` doesn't clip when chips push past content height**: with 6+ items per cell, items get cut off but visually it's not obvious anything is hidden — no "+3 more" affordance.

## Findings

### CRITICAL

#### C1 — `resolvedSettings` falsy-coalesce eats `false`
- **File:** `src/storage/constants.ts:90-95`
- **Anchor:**
  ```ts
  sectionVisibility: {
    today: sv.today ?? DEFAULT_SETTINGS.sectionVisibility.today,
    ...
    calendar: sv.calendar ?? DEFAULT_SETTINGS.sectionVisibility.calendar,
  },
  ```
- **What:** `sv.calendar` is typed `boolean | undefined` (per `UserSettings.sectionVisibility` in `src/types/index.ts:142-151`). The `??` operator only short-circuits on `null`/`undefined`, so a stored `false` *does* short-circuit and yield `false` correctly. **However**: this critique was prompted to verify the resolver. The math is actually correct — `false ?? true === false`. Re-reading: yes, `??` is nullish-coalescing, not `||`. **Withdrawn as a bug**, but flagging the readability concern: a future refactor to `|| DEFAULT` would silently break visibility for every section, including the existing Today/Sprint/etc.
- **Why it matters:** Trap for the next engineer. The 6-line repeated structure is begging to be DRY'd, and any mechanical refactor that touches the `??` is high-risk.
- **Proposed fix:** Add a tested helper `function defaultedFlag(v: boolean | undefined, fb: boolean): boolean { return v ?? fb; }` and route every sibling through it. Also add an inline comment beside the block warning against `||`.
- **Source axis:** code quality
- **Severity adjustment:** downgrade to LOW. Re-filed below as L1.

#### C2 — DST corrupts `expandReminderDates` cursor when window straddles a transition
- **File:** `src/sections/calendar/calendarUtils.ts:160-167`
- **Anchor:**
  ```ts
  let cursor = seed;
  if (cursor < from) {
    const stepsToReach = Math.ceil((from - cursor) / (stride * DAY_MS));
    cursor = addDays(cursor, stepsToReach * stride);
  }
  while (cursor < to) {
    out.push(cursor);
    cursor = addDays(cursor, stride);
  }
  ```
- **What:** `(from - cursor) / (stride * DAY_MS)` is raw-ms arithmetic; `addDays` is calendar-day arithmetic. When `[cursor, from)` crosses a DST boundary they disagree by ±1 hour. Concretely, in `America/Los_Angeles` 2026:
  - `cursor = startOfDay(2026-10-30)` (pre-DST, PDT)
  - `from = startOfDay(2026-11-02)` (post-DST, PST)
  - Real wall-clock gap: 3 days.
  - Raw-ms gap: 3 × 86,400,000 + 3,600,000 = 262,800,000 ms ⇒ `262800000 / 86400000 = 3.041...` ⇒ `Math.ceil → 4`.
  - `addDays(cursor, 4) = 2026-11-03` ⇒ a daily reminder seeded ≥ Oct 1 fires on Nov 3 instead of Nov 2 inside the visible grid. The Nov 2 occurrence is silently dropped.
  - The reverse direction (spring-forward) under-shoots by 1 step in the same way.
  - The file's preamble even claims "DST-safe via `Date.setDate`" but this one helper bypasses that property.
- **Why it matters:** Functional correctness bug in the user-visible feature on two days per year per reminder. The rest of `dateUtils.ts` deliberately uses `Date.setDate` for DST safety; this regresses that invariant.
- **Proposed fix:** Replace the closed-form jump with a calendar-day loop:
  ```ts
  let cursor = seed;
  while (cursor < from) cursor = addDays(cursor, stride);
  while (cursor < to) {
    out.push(cursor);
    cursor = addDays(cursor, stride);
  }
  ```
  Cost is bounded — for the calendar this is at most 42 iterations per reminder, and reminders are sparse. If a future caller needs O(1) skip-ahead, compute it via `daysBetween(cursor, from)` (which already uses calendar math) and then `addDays`.
- **Source axis:** bugs

### HIGH

#### H1 — Sprint bars overlay marked `aria-hidden="true"`
- **File:** `src/sections/calendar/SprintBars.tsx:65`
- **Anchor:**
  ```tsx
  <div
    className="calendar-bars"
    style={{ "--calendar-lanes": String(laneCount) } as React.CSSProperties}
    aria-hidden="true"
  >
  ```
- **What:** Sprints are *the* multi-day signal in the calendar. Day cells carry reminders, today-todos, and long-term todos, but sprints exist only as bars in this overlay. Marking the entire overlay `aria-hidden` removes them from the accessibility tree.
- **Why it matters:** Screen reader users can hear "May 5, 2026" but won't know that Sprint "Calendar v1" runs May 5–16. The sprint name + todo count tooltip becomes screen-reader-invisible.
- **Proposed fix:** Drop `aria-hidden`. Give each bar a role and label:
  ```tsx
  <div
    role="img"
    aria-label={`${sprint.name} sprint, ${dateRange}, ${todoCount} todos${isActive ? ", active" : ""}`}
    ...
  >
  ```
  Alternatively, augment each `DayCell`'s `aria-label` with the active sprint names for that day. Either is acceptable; the role=img approach keeps the structural overlay model.
- **Source axis:** UI/UX (a11y)

#### H2 — Padding-for-lanes is applied to every cell from a global overlay variable
- **File:** `src/sections/calendar/calendar.css:169-170, 287-289` and `src/sections/calendar/SprintBars.tsx:64`
- **Anchor:**
  ```css
  .calendar-cell {
    padding-top: calc(28px + var(--calendar-lanes, 1) * 18px);
  }
  .calendar-bars { --calendar-lanes: ... }
  ```
  ```tsx
  <div className="calendar-bars" style={{ "--calendar-lanes": String(laneCount) } as React.CSSProperties} ... >
  ```
- **What:** `--calendar-lanes` is set on `.calendar-bars`, a sibling of `.calendar-grid__cells` inside `.calendar-grid__body`. Cells aren't descendants of `.calendar-bars`, so the CSS custom property does not cascade to them. The `var(--calendar-lanes, 1)` inside `.calendar-cell` therefore always resolves to the fallback `1`, **regardless of how many lanes are actually used**. The padding never grows. With 3 stacked sprints, lane=2 bars at `26 + 2*18 = 62px` from the row top sit on TOP of any cell items that start at `padding-top: 46px`.
- **Why it matters:** Two failures rolled into one:
  1. Sprint bars at lanes ≥ 2 visually overlap the chip list — the "lane padding actually scales" claim in the prompt is wrong as authored.
  2. If the variable *were* lifted to a common ancestor (e.g. `.calendar-grid__body`), the prompt's other concern materializes: every cell in every week pads for the global max, wasting vertical space when only one week has 3 lanes.
- **Proposed fix:** Set the lane count per-week-row, not globally. Two viable shapes:
  - (a) Compute `lanesByRow: number[]` in `packSegmentLanes`; render seven sibling cells per row inside a row wrapper that carries its own `--calendar-lanes-row`. Then `.calendar-cell` reads that wrapper's variable.
  - (b) Cheaper: keep the flat 42-cell grid but write `data-lanes={lanesByRow[Math.floor(cell.index/7)]}` on each cell and use `[data-lanes="2"] { padding-top: calc(28px + 2*18px) }` rules.
  Either way, lift the `--calendar-lanes` declaration onto an ancestor that actually contains the cells.
- **Source axis:** bugs (CSS scoping) + UI/UX (density)

#### H3 — "Today" cell drifts after midnight
- **File:** `src/sections/Calendar.tsx:32-34` and `src/sections/calendar/calendarUtils.ts:99-108`
- **Anchor:**
  ```ts
  const [monthStart, setMonthStart] = useState<number>(() =>
    startOfMonth(Date.now()),
  );
  ```
  ```ts
  const today = startOfDay(Date.now());
  // ... cells.push({ ..., isToday: ts === today });
  ```
- **What:** `Date.now()` is captured once per render. `buildMonthGrid` only re-runs when `monthStart` or `weekStart` change. A new-tab page that survives midnight (very common — users leave the page open for days) keeps `isToday` pointing at yesterday until something else triggers a re-render. The prompt explicitly asks whether this is acceptable; flagging as HIGH because Proclivity is a new-tab dashboard whose tabs commonly outlive a day.
- **Why it matters:** The "Today" pill, today's accent background, and the today-todos-belong-here logic in `indexDayItems` (which buckets today-scope todos onto `startOfDay(Date.now())`) all silently mislabel.
- **Proposed fix:** Add a midnight-tick effect:
  ```ts
  const [today, setToday] = useState(() => startOfDay(Date.now()));
  useEffect(() => {
    const ms = startOfDay(Date.now()) + 86_400_000 - Date.now();
    const t = setTimeout(() => setToday(startOfDay(Date.now())), ms + 1000);
    return () => clearTimeout(t);
  }, [today]);
  ```
  Thread `today` into `buildMonthGrid` and `indexDayItems` instead of having them call `Date.now()` internally. Also reconsider `monthStart` initial — if the user opens a tab on Apr 30 23:59 and it's still open on May 1 00:01, the focused month should arguably auto-advance. Minimum viable: keep focused-month sticky, but make `today` live.
- **Source axis:** bugs

#### H4 — `lane-packing` lives in the component file
- **File:** `src/sections/calendar/SprintBars.tsx:110-164`
- **What:** `packSegmentLanes` is pure data-in-data-out; it imports nothing React-related. It belongs in `calendarUtils.ts` so it can be unit-tested alongside `sprintBarSegments`. Co-locating it with the JSX also means the `PlacedSegment` type isn't accessible to callers who want to reason about layout.
- **Why it matters:** Calendar tests are not yet written, but they are coming. Moving this out is cheap insurance and aligns with how `sprintBarSegments` is already structured (pure helper in utils, consumed by JSX).
- **Proposed fix:** Move `interface PlacedSegment`, `packSegmentLanes`, and a docstring explaining the same-lane-across-rows invariant into `calendarUtils.ts`. Export both `packSegmentLanes` and a derived `lanesPerWeekRow(segments)` helper for the H2 fix.
- **Source axis:** structure

#### H5 — Theme contrast risk on bars and today-cell background
- **File:** `src/sections/calendar/calendar.css:188, 294, 306-310`
- **Anchor:**
  ```css
  .calendar-cell--today { background: color-mix(in srgb, var(--accent) 8%, var(--panel)); }
  .calendar-bar { background: color-mix(in srgb, var(--accent) 65%, transparent); color: var(--text); }
  .calendar-bar--active { background: var(--accent); color: oklch(1 0 0); ... }
  ```
- **What:** Three concerns I can verify from tokens:
  1. **Today cell**: 8% accent over `--panel` is a ~2-3% luminance shift. Likely below WCAG AA 3:1 non-text contrast for "identifying state". In dark mode (`--panel: oklch(0.14 ...)`) this is essentially invisible.
  2. **Inactive bar**: `color-mix(..., transparent)` means the bar's actual background depends on what's underneath. With `--panel` underneath (resolved accent 0.65 alpha over panel), the effective bg lifts toward accent; with the `today-cell` underneath (already tinted accent), the bar nearly disappears.
  3. **Active bar `color: oklch(1 0 0)` (pure white)** is hardcoded. In light theme on `--accent: #4859d0`, white-on-indigo is ~9:1 — fine. But if the user picks a light accent (e.g. Lime `#86efac`), white-on-light-green collapses to ~1.5:1 — fails AA. The hardcoded white assumes the dark-mode accent palette.
- **Why it matters:** AC for any cross-cutting overview is "I can tell where today is at a glance" and "I can read the sprint name on the active bar." Both fail at the extremes.
- **Proposed fix:**
  - Today cell: bump to `color-mix(in srgb, var(--accent) 14%, var(--panel))` and add a 1px left/inside border (`box-shadow: inset 2px 0 0 var(--accent)`) so even color-blind users have a positional cue.
  - Bars: drop the `transparent` mix and use a fully opaque token: `background: color-mix(in srgb, var(--accent) 30%, var(--panel-2))`. This makes underlay invariant.
  - Active bar text: replace `oklch(1 0 0)` with a contrast-aware token. Cheapest: rely on `color-mix(in srgb, var(--accent) 70%, white)` for the background so the contrast pair stays bounded — or compute a derived `--accent-on` token at the theme layer with a guaranteed minimum 4.5:1 against `--accent`.
- **Source axis:** UI/UX (contrast / a11y)

#### H6 — Chip-dot palette likely fails red-green colorblind discrimination
- **File:** `src/sections/calendar/calendar.css:114-116, 258-260` and `src/styles/theme.css:32-37`
- **Anchor:**
  ```css
  .calendar-legend__dot--reminder { background: var(--warn); }    /* oklch(0.80 0.15 60) — amber */
  .calendar-legend__dot--today    { background: var(--accent); }  /* user-controlled */
  .calendar-legend__dot--long     { background: var(--accent-2); }/* oklch(0.83 0.13 179) — teal */
  ```
- **What:** Reminder amber + today indigo (default) + long-term teal are mostly safe for protanopia/deuteranopia *with the default accent*. But once a user picks an accent like Rose `#ff6b9d` or Amber `#ffb86b`, accent collides with `--warn` along the protanope confusion axis. A 6px circle with no border and no shape difference is the entire affordance.
- **Why it matters:** ~8% of male users can't distinguish these chips. The chips are the only signal — chip label colors are not differentiated.
- **Proposed fix:** Augment each chip with a glyph or short label prefix that doesn't require color:
  - reminder → `⏰` or `R`
  - today → `•` (current) but with the title row already prefixed in `DayCell.tsx`: `title={'Reminder: …'}` should also reach the visible label. Render a small monogram letter inside the dot (`R/T/L`) and bump the dot to 10px so the letter is readable, or use distinct dot shapes (circle/square/diamond).
- **Source axis:** UI/UX (a11y / colorblindness)

#### H7 — `sprints.find` in render loop
- **File:** `src/sections/calendar/SprintBars.tsx:68`
- **Anchor:**
  ```tsx
  {segments.map((seg, i) => {
    const sprint = sprints.find((s) => s.id === seg.sprintId);
    if (!sprint) return null;
    ...
  })}
  ```
- **What:** `find` over `sprints` per segment per render. For 6 sprints × 6 weeks worth of segments that's 36 scans; for a user with 30 active+archived sprints (realistic over a year of use) it grows linearly with both axes.
- **Why it matters:** Cheap to fix. Also masks bugs if a stale segment references a deleted sprint id — silently returns null, so a stale segment just disappears with no warning.
- **Proposed fix:** Build a `Map<id, Sprint>` once via `useMemo` alongside `todoCountBySprint`. Or pass `sprintById` from `MonthGrid`.
- **Source axis:** code quality / perf

### MEDIUM

#### M1 — Touch targets fail WCAG 2.5.5 (target size)
- **File:** `src/sections/calendar/calendar.css:42-52, 62-71`
- **Anchor:**
  ```css
  .calendar-nav-btn { padding: 6px 8px; /* + 16x16 SVG */ }
  .calendar-today-btn { padding: 6px 12px; }
  ```
- **What:** Outer dimensions ≈ 28×28 for chevron buttons. WCAG 2.5.5 (Level AAA) requires 44×44; 2.5.8 (Level AA, WCAG 2.2) requires 24×24 minimum. AA is met; AAA is not.
- **Why it matters:** On a mobile/tablet form factor (the responsive breakpoint exists, so it's a supported viewport), 28px targets are crampy adjacent to the title.
- **Proposed fix:** Increase to `min-height: 32px; min-width: 32px;` on `.calendar-nav-btn` and `.calendar-today-btn`. Keep the visual icon at 16×16 but pad to a 32×32 hit area.
- **Source axis:** UI/UX (a11y)

#### M2 — No keyboard navigation across day cells
- **File:** `src/sections/calendar/DayCell.tsx:31-46`
- **What:** Cells have `aria-label` (good) but no `tabindex`, no role beyond container, and no arrow-key handlers. The grid is `role="grid"` and the columns are `role="columnheader"`, so AT users expect ARIA grid keyboard semantics (Arrow keys, Home/End, PgUp/PgDn). None of that is wired.
- **Why it matters:** `role="grid"` without keyboard semantics is *worse* than no role — screen readers announce "grid" and users try to navigate it as one, then get stuck.
- **Proposed fix:** Either:
  - drop `role="grid"` and the column headers (treat the calendar as decorative tabular content), OR
  - implement the WAI-ARIA grid pattern: `tabindex="0"` on the focused cell (managed via roving tabindex), `role="gridcell"` on each cell, arrow-key listeners that move focus, and Home/End/PgUp/PgDn for week/month nav.
  The second is the right answer for v1.5; the first is acceptable for v1 if scope is tight.
- **Source axis:** UI/UX (a11y)

#### M3 — `aria-live="polite"` on the month-label h2 is duplicate-y
- **File:** `src/sections/Calendar.tsx:64`
- **Anchor:** `<h2 className="calendar-header__title" aria-live="polite">{monthLabel(monthStart)}</h2>`
- **What:** Putting `aria-live` on a heading announces the new heading text on every change, which is what we want — but the heading is also focusable as part of normal heading navigation. The result is that SR users who use arrow keys to step backward to refocus the previous month-label re-trigger the live region. Minor, but noisy.
- **Proposed fix:** Move `aria-live` to a visually hidden `<span aria-live="polite">{monthLabel(monthStart)}</span>` and leave the visible `<h2>` static (or use `aria-atomic="true"` and ensure the polite region only fires when the value actually changes via key-controlled state — useEffect-driven announce).
- **Source axis:** UI/UX (a11y)

#### M4 — Day cells don't truncate gracefully with many items
- **File:** `src/sections/calendar/calendar.css:222-230` and `DayCell.tsx:57-91`
- **Anchor:**
  ```css
  .calendar-cell__items {
    overflow: hidden;
  }
  ```
- **What:** No "+N more" affordance. A day with 6 reminders shows the first ~3 (depending on row height) and silently drops the rest with no visual indicator. The hidden chips are still in the accessibility tree if the cell's `aria-label` doesn't enumerate items (it doesn't — only the date is in the label).
- **Why it matters:** Calendar tools historically converge on a "+3 more" chip because users learn fast to look for it. Silent truncation produces "where did my reminder go?" support questions.
- **Proposed fix:** Compute a `maxVisible` (e.g. 3 in compact mode, 5 in desktop), slice the merged list, and render a trailing `<li className="calendar-chip calendar-chip--more">+{remaining} more</li>` when truncated. Make it a popover trigger for v1.5; for v1, link to the source tab (Reminders / Long-term) filtered by date.
- **Source axis:** UI/UX

#### M5 — `MonthGrid` memo barrier likely defeated by `tags` array identity
- **File:** `src/sections/calendar/MonthGrid.tsx:29` and `src/sections/Calendar.tsx:97-103`
- **Anchor:** `export const MonthGrid = memo(function MonthGrid(...))` — `tags`, `reminders`, `todos`, `sprints` are passed directly from `state`.
- **What:** Whether `memo` actually prevents re-renders depends on `useStore` returning a stable reference for `state.tags` etc. when nothing changed. Worth verifying. If `useStore` rebuilds `state` on every store mutation (typical for naive reducers), `memo` here is decorative.
- **Why it matters:** A pivotal claim in `MonthGrid`'s docstring: "all heavy computation … is memoized on the input data". If the props change identity each render, none of the `useMemo`s inside fire their cache, the comment lies, and the section pays the rebuild cost on every tab switch.
- **Proposed fix:** Either (a) confirm `useStore` is stable-reference and add a comment in `MonthGrid` saying so, or (b) shallow-equality memo at the `monthStart, weekStart, reminders.length, todos.length, sprints.length, tags.length, activeSprintId` level — coarse but predictable.
- **Source axis:** code quality / perf

#### M6 — `DayItems` includes done todos via `t.scope === "today" && !t.done` exclusion but not done long-term todos
- **File:** `src/sections/calendar/calendarUtils.ts:279-289`
- **Anchor:**
  ```ts
  for (const t of todos) {
    if (t.scope === "long" && t.dueAt !== undefined) {
      const day = startOfDay(t.dueAt);
      byCellTs.get(day)?.longTermDue.push(t);
    } else if (t.scope === "today" && !t.done) {
      ...
    }
  }
  ```
- **What:** Today-scope todos with `done: true` are filtered out (good — they vanish from the today cell). But completed long-term todos with a `dueAt` are still rendered, just with line-through. Inconsistent: a user who completes a long-term todo before its due date sees it linger on the calendar for weeks.
- **Why it matters:** Either both should show (and DayCell already supports `.is-done` styling on `today` and `long` chips), or both should hide. The current asymmetric behavior surprises users.
- **Proposed fix:** Pick one rule and document it. Recommended:
  - keep showing done long-term todos but only up to the due day plus 7 days (so completion stays visible in the week it happened, then auto-hides), OR
  - filter completed long-term todos to mirror the today scope.
- **Source axis:** bugs (behavioral inconsistency)

#### M7 — Lane stacking visually muddles 4+ overlapping sprints
- **File:** `src/sections/calendar/calendar.css:286-340`
- **What:** With 4 lanes the bar stack at `26 + lane*18` reaches `26 + 3*18 = 80px`, exceeding the desktop cell `min-height: 110px` minus `padding-top: 28 + 4*18 = 100px` budget. Bars at lane 3 visually crash into the chip list (and as documented in H2, the padding never actually grows). Need to either cap visible lanes with an overflow chip or shrink the bar stride.
- **Proposed fix:** Add `--calendar-max-lanes: 3` and a "+N sprints" chip when `laneCount > max`. The overflow chip lives at lane=2 with a count badge.
- **Source axis:** UI/UX

#### M8 — `sprintBarSegments` doesn't document its single-day-touch convention
- **File:** `src/sections/calendar/calendarUtils.ts:178-232`
- **What:** Two sprints where A ends on Tue and B starts on Tue: `sprintBarSegments(A)` produces a segment covering Tue (colEnd=Tue), `sprintBarSegments(B)` produces a segment starting on Tue (colStart=Tue). The lane packer's conflict check `s.colStart <= occupied` treats them as conflicting, so they end up on different lanes. This may surprise users — visually two "back-to-back" sprints look like an overlap.
- **Proposed fix:** Decide the convention explicitly:
  - if `endsAt` is inclusive (treat sprints as closed intervals), document it and consider `s.colStart < occupied` instead so adjacent sprints share a lane.
  - if `endsAt` is exclusive (half-open), the current code is wrong: a sprint with `startsAt=Mon, endsAt=Fri` should span Mon-Thu, not Mon-Fri.
  Either way, write the half-open vs closed semantics into the `SprintBarSegment` interface JSDoc and add a test.
- **Source axis:** docs + bugs (ambiguity)

### LOW

#### L1 — `resolvedSettings` repetition begs for a helper (re-filed from C1)
- **File:** `src/storage/constants.ts:89-96`
- **Proposed fix:** See C1. Helper + warning comment.
- **Source axis:** code quality

#### L2 — `as React.CSSProperties` cast launders a CSS-custom-prop into the JSX type
- **File:** `src/sections/calendar/SprintBars.tsx:64`
- **What:** TypeScript's `React.CSSProperties` doesn't allow arbitrary `--*` keys. The cast is the canonical workaround but loses type safety; if you typo `--calenadr-lanes` nothing complains.
- **Proposed fix:** Add a tiny helper in `src/lib`:
  ```ts
  type CSSVars = Record<`--${string}`, string | number>;
  export const cssVars = (v: CSSVars): React.CSSProperties => v as React.CSSProperties;
  ```
  Centralises the cast and gives you a single place to switch to `Object.fromEntries` + `setProperty` if you ever want to.
- **Source axis:** code quality (type safety)

#### L3 — `aria-label="Calendar"` on the section may duplicate the tab name
- **File:** `src/sections/Calendar.tsx:52`
- **What:** The section is rendered inside a tab panel that the parent `App.tsx` doesn't decorate with `role="tabpanel"` (verified at `src/newtab/App.tsx:271-277` — just `<div hidden={…}>`). SR users hear "Calendar region" then "Calendar heading May 2026" — redundant but harmless.
- **Proposed fix:** Either elevate the parent `<div>` to `role="tabpanel" aria-labelledby="…tab id…"` (consistent with the existing `role="tablist"` on the nav) or drop the section's `aria-label`. The tabpanel role is the better fix and benefits every tab, not just Calendar.
- **Source axis:** UI/UX (a11y)

#### L4 — `monthLabel` ignores user locale forced via settings
- **File:** `src/sections/calendar/calendarUtils.ts:297-302`
- **Anchor:** `return new Date(monthStart).toLocaleDateString(undefined, { month: "long", year: "numeric" });`
- **What:** `undefined` locale uses browser default. That's correct most of the time, but if Proclivity later adds a locale setting (it has `timeFormat: "auto"|"12h"|"24h"` but no locale toggle yet), the calendar won't pick it up.
- **Proposed fix:** Out of scope for v1; flag with a `// TODO(locale)` once a locale setting is added.
- **Source axis:** docs

#### L5 — `Calendar.tsx` imports `resolvedSettings` but uses only `rs.weekStart`
- **File:** `src/sections/Calendar.tsx:10, 27`
- **Proposed fix:** Inline as `const weekStart = state.settings.weekStart ?? "mon";` — saves the resolution pass for an unused 19 fields. Minor.
- **Source axis:** code quality

#### L6 — Empty-state — no "no items this month" message
- **File:** `src/sections/calendar/MonthGrid.tsx:55-91` and `DayCell.tsx`
- **What:** With `state.todos`, `state.reminders`, `state.sprints` all empty, the calendar renders a bare grid with the month name. Acceptable but could be warmer.
- **Proposed fix:** When `dayItems` is uniformly empty and `segments` is empty, render a soft "Nothing scheduled this month — visit Reminders or Sprint to add items" hint in the legend row or as an overlay.
- **Source axis:** UI/UX

#### L7 — `data-count` attribute on cells is unused
- **File:** `src/sections/calendar/DayCell.tsx:46`
- **Anchor:** `data-count={totalItems > 0 ? totalItems : undefined}`
- **What:** The CSS doesn't read `[data-count]`. Dead.
- **Proposed fix:** Either drop it or wire it to a CSS rule (e.g. `[data-count]:not([data-count="0"]) { /* small badge in header */ }`).
- **Source axis:** code quality

#### L8 — Re-export `isSameDay` at the bottom of `calendarUtils.ts` is unused
- **File:** `src/sections/calendar/calendarUtils.ts:312`
- **Anchor:** `export { isSameDay };`
- **What:** No internal consumer; convenience-only. If no caller imports it from this path, prefer keeping the canonical path through `@/lib/dateUtils`.
- **Proposed fix:** Remove. If/when a caller wants `isSameDay`, they can import from `@/lib/dateUtils`.
- **Source axis:** code quality

#### L9 — `WEEKSTART_OFFSET` and `weekdayLabels` build a Date from a hardcoded 1970-01-04
- **File:** `src/sections/calendar/calendarUtils.ts:118`
- **Anchor:** `const refSunday = new Date(1970, 0, 4).getTime();`
- **What:** Works but obscure. Add a comment explaining `1970-01-04` is a Sunday.
- **Proposed fix:** One-line comment, or replace with a clearer construction (e.g. find the next Sunday from a known epoch).
- **Source axis:** docs

#### L10 — Today-scope todos render only on today's cell — but `dueAt` is reserved for them too
- **File:** `src/sections/calendar/calendarUtils.ts:283-287` and `src/types/index.ts:33-34`
- **What:** The Todo type has `dueAt?: number | undefined` as "reserved — no UI surface yet". `indexDayItems` only bucketizes long-term todos by `dueAt`, not today todos. Future-compat: when today todos eventually gain `dueAt`, the indexer will need updating.
- **Proposed fix:** No action now; add `// TODO(dueAt): once Today scope surfaces a due date, mirror long-term bucketing` comment near line 283.
- **Source axis:** docs (forward-compat)

#### L11 — `aria-hidden="true"` on legend bar/dot spans is fine, but legend list itself should be reachable
- **File:** `src/sections/Calendar.tsx:108-128`
- **What:** `<ul className="calendar-legend" aria-label="Legend">` is reachable, the `<span>` swatches inside are decorative. OK as-is. Tiny refinement: the swatches use `aria-hidden="true"` implicitly because they have no text — fine. No action.
- **Source axis:** docs

#### L12 — Comment "what" vs "why" — overall good, but a few "what" comments slipped in
- **File:** `src/sections/calendar/calendar.css:171-177`
- **Anchor:**
  ```css
  /* Strip the trailing right/bottom borders so the grid has clean edges. */
  .calendar-cell:nth-child(7n) { border-right: none; }
  .calendar-grid__cells > .calendar-cell:nth-child(n + 36) { border-bottom: none; }
  ```
- **What:** The comment narrates the rule. CLAUDE.md doesn't ban "what" comments, but the prompt does. Most other comments here explain "why" well.
- **Proposed fix:** Drop the "Strip the trailing…" comment; the selector is self-explanatory.
- **Source axis:** docs

#### L13 — `aria-live="polite"` on the heading without an `aria-atomic` decision
- **File:** `src/sections/Calendar.tsx:64`
- **What:** Different SR implementations differ on what gets announced. See M3.
- **Source axis:** a11y

---

## Rectify pass

- C1 / L1 — skipped per instructions (adversary withdrew C1; `??` resolver is correct; no `defaultedFlag` helper added).
- C2 — fixed via `while (cursor < from) cursor = addDays(cursor, stride);` loop in `expandReminderDates` (`calendarUtils.ts`); DST-safety comment added.
- H1 — dropped `aria-hidden="true"` from `.calendar-bars`; added `role="img"` + `aria-label` (sprint name, ISO date range, todo count, active flag) to each bar segment in `SprintBars.tsx`.
- H2 — flat 42-cell grid retained; `data-lanes={lanes}` emitted on each `DayCell` from `lanesByRow[Math.floor(cell.index/7)]`; `packSegmentLanes` now returns `lanesByRow`; CSS rules `.calendar-cell[data-lanes="N"]` for N=1-3 replace the broken `var(--calendar-lanes, 1)` reference.
- H3 — added `today` state + midnight-tick `useEffect` in `Calendar.tsx`; `buildMonthGrid` and `indexDayItems` now take explicit `today: number` arg; `monthStart` stays sticky.
- H4 — moved `PlacedSegment`, `packSegmentLanes`, and `lanesPerWeekRow` into `calendarUtils.ts` with JSDoc; `SprintBars.tsx` is now a pure renderer.
- H5 — today cell bumped to `color-mix(in srgb, var(--accent) 14%, var(--panel))` + `box-shadow: inset 2px 0 0 var(--accent)`; inactive bar uses `color-mix(in srgb, var(--accent) 30%, var(--panel-2))` (opaque, underlay-invariant); active bar text changed to `var(--accent-on)`; `--accent-on` added to `:root` (dark) and `[data-theme="light"]` in `theme.css`.
- H6 — chip dot bumped to 12×12; single-letter glyph (`R`/`T`/`L`) rendered inside each dot; dot text uses `var(--accent-on)` for contrast.
- H7 — `sprints.find` replaced with `useMemo`-built `Map<string, Sprint>` in `SprintBars.tsx`.
- M1 — `min-width: 32px; min-height: 32px;` added to `.calendar-nav-btn` and `.calendar-today-btn`.
- M2 — dropped `role="grid"` from `MonthGrid` and `role="columnheader"` from weekday headers; comment explains v1 rationale.
- M3 — removed `aria-live` from visible `<h2>`; added visually-hidden `<span className="sr-only" aria-live="polite">` mirroring the month label; `.sr-only` utility added to `theme.css`.
- M4 — capped visible chips at 3 (desktop); `+{remaining} more` chip rendered as `.calendar-chip--more` when overflow exists.
- M5 — added comment in `MonthGrid` docstring confirming `useStore` returns stable array references; memo barrier is effective.
- M6 — added `&& !t.done` guard on long-term todos in `indexDayItems`; `is-done` class removed from long-term chip render in `DayCell`; defensive `.calendar-chip--long.is-done` CSS kept.
- M7 — `MAX_SPRINT_LANES = 3` constant; sprints requiring lane ≥ 3 are collapsed into a per-row overflow `PlacedSegment` rendering as `+N sprints` chip with hidden-sprint tooltip.
- M8 — closed-interval convention documented in `SprintBarSegment` JSDoc, `sprintBarSegments` JSDoc, and `Sprint` interface in `types/index.ts`; `s.colStart <= occupied` kept with explanation comment.
- L2 — `src/lib/cssVars.ts` created exporting `CSSVars` type and `cssVars` helper.
- L3 — each tab `<button>` gains `id="tab-btn-{id}"` + `aria-controls`; each content `<div>` wrapped with `role="tabpanel"` + `aria-labelledby` in `App.tsx`.
- L4 — skipped (locale TODO, out of scope).
- L5 — replaced `resolvedSettings` import in `Calendar.tsx` with `const weekStart = state.settings.weekStart ?? "mon"`.
- L6 — empty-state hint rendered below grid when segments are empty and all cells have no items; styled via `.calendar-empty-hint`.
- L7 — `data-count` attribute removed from `DayCell`.
- L8 — `export { isSameDay }` re-export removed from `calendarUtils.ts`.
- L9 — one-line comment `// 1970-01-04 was a Sunday — anchor the weekday rotation here.` added.
- L10 — skipped (speculative future-compat, per instructions).
- L11 — no action (adversary said no action).
- L12 — `/* Strip the trailing right/bottom borders so the grid has clean edges. */` comment removed from `calendar.css`.
- L13 — closed by M3.

---

## Stdout summary (orchestrator-readable)

**Verdict:** NEEDS-REWORK

**Top 5 findings:**
1. **C2 (CRITICAL)** — `expandReminderDates` does raw-ms arithmetic in `Math.ceil((from - cursor) / (stride * DAY_MS))`; DST transitions push the cursor one stride off twice a year. `src/sections/calendar/calendarUtils.ts:161`. Fix: replace closed-form jump with a `while (cursor < from) cursor = addDays(cursor, stride);` loop.
2. **H1 (HIGH)** — Sprint bar overlay is `aria-hidden="true"`, removing all sprint information from assistive tech. `src/sections/calendar/SprintBars.tsx:65`. Fix: drop `aria-hidden`; add `role="img" aria-label` to each bar (or augment `DayCell`'s aria-label with active sprint names).
3. **H2 (HIGH)** — `--calendar-lanes` is set on `.calendar-bars` but `.calendar-cell` (which is not a descendant) reads `var(--calendar-lanes, 1)` — always resolves to the fallback. Padding never scales; lanes ≥ 2 visually overlap chips. `calendar.css:169`, `SprintBars.tsx:64`. Fix: move the variable to a common ancestor or use per-cell `data-lanes` attributes computed per week-row.
4. **H3 (HIGH)** — `isToday` is captured once via `Date.now()` in `buildMonthGrid`; new-tab pages survive midnight, so the "Today" cell silently points at yesterday. `src/sections/Calendar.tsx:32`, `calendarUtils.ts:99`. Fix: add a midnight-tick effect and thread a live `today` value through grid/indexer.
5. **H5 (HIGH)** — Active bar text is hardcoded `oklch(1 0 0)` (white); fails AA against light accent presets like Lime. Today-cell 8% accent mix is below 3:1 non-text contrast in dark mode. `calendar.css:188, 308`. Fix: derive a contrast-aware `--accent-on` token; bump today-cell mix to 14% and add an inset accent border.
