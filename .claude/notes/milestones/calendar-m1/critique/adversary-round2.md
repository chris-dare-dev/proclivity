# Calendar — Adversary Round 2

**Critic:** adversary (claude-sonnet-4-6)
**Generated:** 2026-05-12T17:07:00Z
**Screenshots:** Captured inline via Claude Preview MCP during session (dark desktop, light desktop, dark 720px, empty state). Claude-in-Chrome extension was not connected — fell back to `mcp__Claude_Preview__*` which served `dist/` via the existing Python server on port 8765. Screenshots are embedded in the session transcript rather than saved to separate files.
**Tooling:** Claude Preview MCP (fallback from claude-in-chrome). Verified via `preview_eval` / `preview_inspect` / `preview_screenshot`. All DOM measurements confirmed with JavaScript evaluation.

---

## Fix verification

### Bug fixed? YES

**Evidence:**
- Measured all 7 column widths programmatically: each returned exactly `147.7px` on a 1034px grid (`1034 / 7 = 147.71`). All columns equal.
- Confirmed the two changed CSS rules are present in the served bundle:
  - `.calendar-grid__header { grid-template-columns: repeat(7, minmax(0, 1fr)); }`
  - `.calendar-grid__cells  { grid-template-columns: repeat(7, minmax(0, 1fr)); }`
- Long today-todo chips in May 12 cell: `scrollWidth` 713 and 523px, displayed `width` 105.7px — correctly truncated with `text-overflow: ellipsis` on `.calendar-chip__label` (not the flex container).
- Today cell (May 12): `background-color` = `color(srgb 0.087 0.118 0.190)` (14% accent mix), `box-shadow: inset 2px 0 0 rgb(124,156,255)` — highlight intact.
- Sprint bars: 3 bars rendered (2 active "Calendar v1" segments spanning two weeks, 1 inactive "Bug bash"). Bar geometry aligns with grid columns via percentage positioning.
- Dark desktop: all 7 day headers (SUN–SAT) visible, equal width, dates present in every cell.
- Light desktop: same result under `data-theme="light"`. Sprint bars, today highlight, and chip truncation all correct.
- Dark 720px: all 7 columns present (`grid-template-rows: repeat(6, minmax(72px, 1fr))` applies), smaller row heights, chip font-size drops to 11px.

### New regressions? None detected

No layout breakage, no z-index issues between sprint bars and cell content, no overflow escaping the grid border-radius. Empty state renders cleanly. Light theme renders without regression.

---

## Verdict on overall UI/UX

**SHIP-WITH-FIXES**

The fix is solid and the calendar is functionally correct. However several polish gaps — no chip hover expand, legend misrepresents active sprint color, mobile chip cap dead code, cells feel cramped at 720px with no expand affordance, and the empty state message is text-only with no actionable link — keep this from being production-ready without a short round of fixes.

---

## Findings

### HIGH

#### H1 — No chip hover/expand affordance; full title unreachable on mobile

**File:** `src/sections/calendar/DayCell.tsx`, `src/sections/calendar/calendar.css`

**What:** Chips have a native `title` attribute with the full text (e.g. `"Today: Add ability to shape reminder cards and task cards..."`), but `cursor: auto` on the chip means nothing signals that hovering reveals more. On mobile there is no hover at all — the full title is completely inaccessible. The chip also has `pointer-events: auto` only on bars; chips have no click handler.

**Why it matters:** The entire point of the ellipsis UX is to communicate truncation and give the user a path to the full content. Without a visible tooltip trigger or tap-to-expand, truncated chips are dead ends. The two today-todos in the seed data have titles 100+ characters long — the user can never read them in the calendar view.

**Proposed fix:**
```css
/* calendar.css */
.calendar-chip {
  cursor: default;         /* or pointer if click navigates */
  transition: background 120ms ease;
}
.calendar-chip:hover {
  background: color-mix(in srgb, var(--panel-2) 90%, var(--accent));
}
```
Additionally add a custom tooltip or use a popover on long chips. Short-term: add `title` in a visible custom tooltip on `:hover` via a `::after` pseudo-element or a lightweight `<Tooltip>` wrapper. For mobile, add an `onClick` handler that opens a detail sheet or expands the chip in place (within the cell's overflow area).

---

#### H2 — Mobile chip cap exported but never enforced

**File:** `src/sections/calendar/DayCell.tsx`

**What:** `MAX_CHIPS_MOBILE = 2` is exported as `MOBILE_CHIP_CAP` but `DayCell` always uses `MAX_CHIPS_DESKTOP = 3`. No CSS or JS switches to the mobile cap at `≤720px`. At 720px, each cell is only ~103px wide and ~72px tall; three 22px chips (66px) plus 28px sprint-bar padding = 94px leaves only 6px of breathing room, causing chips to be clipped silently.

**Why it matters:** The exported constant creates a false promise that the mobile cap is implemented. At 720px the three chips overflow the cell's usable space and the `overflow: hidden` on `.calendar-cell__items` silently clips the third chip without showing a "+N more" indicator — the user never knows content is hidden.

**Proposed fix (DayCell.tsx):**
```tsx
// Replace fixed cap with a responsive one
const [isMobile, setIsMobile] = useState(
  () => window.matchMedia('(max-width: 720px)').matches
);
useEffect(() => {
  const mq = window.matchMedia('(max-width: 720px)');
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);
const cap = isMobile ? MAX_CHIPS_MOBILE : MAX_CHIPS_DESKTOP;
```
Alternatively use a CSS-only approach: hide the third chip via `.calendar-cell__items li:nth-child(3)` at `max-width: 720px` and always render a "+N more" element (conditionally styled visible/hidden).

---

#### H3 — Legend misrepresents active sprint color

**File:** `src/sections/calendar/calendar.css`

**What:** The legend sprint swatch uses `.calendar-legend__bar` with `background: color-mix(in srgb, var(--accent) 30%, var(--panel-2))` — which matches the *inactive* bar color. The dominant sprint bar in the seed data is active (`Calendar v1`, displayed in solid `--accent` blue). A user scanning the legend to decode the bars will see a muted blue swatch, but the most prominent bar on screen is a bright solid blue.

**Why it matters:** The legend is the user's key to interpreting the visual. A mismatch between the legend swatch and the most-prominent bar type breaks the visual grammar immediately. The eye sees a bright bar and looks for its legend entry and finds only a muted one.

**Proposed fix:**
Show both states in the legend, or make the legend swatch match the active bar. Simplest fix — show the active bar color with a label and remove the inactive-only swatch:
```tsx
// Calendar.tsx legend section
<li>
  <span className="calendar-legend__bar calendar-legend__bar--active" aria-hidden="true" />
  Sprint (active)
</li>
<li>
  <span className="calendar-legend__bar" aria-hidden="true" />
  Sprint
</li>
```
```css
.calendar-legend__bar--active {
  background: var(--accent);
}
```

---

### MEDIUM

#### M1 — Nav button transition duration is 0s — hover state snaps with no animation

**File:** `src/sections/calendar/calendar.css`

**What:** `.calendar-nav-btn` has `transition: all` but `transitionDuration` evaluates to `0s` at runtime (confirmed via `getComputedStyle`). The border color change on hover is instant. The `transition` shorthand without a duration defaults to `0s`, and no override sets a duration.

**Why it matters:** Nav buttons and the Today button both lack micro-animation, making the UI feel static and unresponsive even though the `transition` declaration signals intent to animate.

**Proposed fix:**
```css
.calendar-nav-btn {
  transition: color 120ms ease, border-color 120ms ease;
}
.calendar-today-btn {
  transition: border-color 120ms ease, background 120ms ease;
}
```

---

#### M2 — Today cell highlight relies on background color alone at low accent-opacity

**File:** `src/sections/calendar/calendar.css`

**What:** Today's cell uses `color-mix(in srgb, var(--accent) 14%, var(--panel))`. At 14% mix the computed background is `color(srgb 0.087 0.118 0.190)` — only about 8% lighter than the surrounding `--panel` (`oklch(0.14 0.014 252)`). The 2px left inset border adds a colorblind-safe cue but it's visually subtle. On the light theme the cell is even harder to distinguish because both panel and highlight are near-white.

**Why it matters:** Today is the most time-critical cell — the user's eye should land there immediately. A 14% tint and a 2px inset border compete with the much-brighter accent used on sprint bars and chip dots for visual dominance. The today pill label "TODAY" helps but sits in the header area away from the content.

**Proposed fix:** Increase the accent mix to 20–22% on dark and use a 3px inset border:
```css
.calendar-cell--today {
  background: color-mix(in srgb, var(--accent) 20%, var(--panel));
  box-shadow: inset 3px 0 0 var(--accent);
}
```
On light theme specifically, the current 14% over `oklch(1 0 0)` is extremely faint — bump to 25% under `[data-theme="light"] .calendar-cell--today`.

---

#### M3 — Sprint bars have no hover state and no click-through to Sprint tab

**File:** `src/sections/calendar/SprintBars.tsx`, `src/sections/calendar/calendar.css`

**What:** Bars have `pointer-events: auto` and `role="img"` with an `aria-label` describing the sprint, but `cursor: auto` and no `:hover` rule. There is no `onClick` handler. The bars are inert decorations despite their visual prominence.

**Why it matters:** Users expect to interact with the most prominent visual elements. A sprint bar that spans a full week begs to be clicked to navigate to the sprint details. Without feedback (no cursor change, no hover tint) the affordance gap is conspicuous for any user who tries.

**Proposed fix:**
```css
.calendar-bar {
  cursor: pointer;
  transition: filter 120ms ease;
}
.calendar-bar:hover {
  filter: brightness(1.12);
}
.calendar-bar--active:hover {
  filter: brightness(1.08);
}
```
In `SprintBars.tsx`, add an `onClick` prop that calls a passed-in `onSprintClick(sprintId)` handler (or navigates to the Sprint tab directly via the store's tab setter).

---

#### M4 — Empty state message is italic text with no actionable path

**File:** `src/sections/calendar/MonthGrid.tsx`, `src/sections/calendar/calendar.css`

**What:** Empty state renders: `"Nothing scheduled this month — visit Reminders or Sprint to add items."` in italic `var(--text-dim)` centered below the (empty but fully-rendered) grid. The mention of "Reminders" and "Sprint" are plain text, not links. The user must close the modal, find the correct tab, and add items manually.

**Why it matters:** New users hitting the calendar first will see an empty grid with a dimly-lit italic hint — this reads as broken rather than intentional. The empty grid itself (6 rows × 7 columns of blank dark rectangles) competes visually and makes it look like a loading failure.

**Proposed fix:**
1. Make "Sprint" and "Reminders" inline tab-navigation buttons in the hint text.
2. Optionally hide the full 6×7 grid when no data exists and show only a compact single-row skeleton with the hint inside.

```tsx
// MonthGrid.tsx — replace the empty hint paragraph
{isEmpty && (
  <p className="calendar-empty-hint">
    Nothing scheduled this month.{" "}
    <button className="calendar-empty-link" onClick={() => onTabChange?.("sprint")}>
      Add a sprint
    </button>{" "}
    or{" "}
    <button className="calendar-empty-link" onClick={() => onTabChange?.("reminders")}>
      set a reminder
    </button>{" "}
    to populate the calendar.
  </p>
)}
```
```css
.calendar-empty-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
  padding: 0;
}
```

---

#### M5 — Out-of-month cells: subtle but opacity compound makes them near-invisible at low contrast

**File:** `src/sections/calendar/calendar.css`

**What:** `.calendar-cell--out` uses `background: color-mix(in srgb, var(--panel) 92%, transparent)` and `.calendar-cell--out .calendar-cell__date` gets `color: var(--text-dim); opacity: 0.55`. The double-dimming (dim text color + 0.55 opacity) drops the date number to roughly 37% luminance of the in-month text. In the light theme the out-of-month cells are almost invisible — the contrast between in-month and out-of-month is very low.

**Why it matters:** Leading/trailing cells still need to be scannable — "Is May 1 a Friday?" needs the April 26–30 cells to be readable. At 0.55 opacity on an already-dim color, they are not.

**Proposed fix:** Use a single mechanism — either dim color alone (no opacity) or opacity alone (no pre-dimmed color):
```css
.calendar-cell--out .calendar-cell__date {
  color: var(--text-dim);
  opacity: 0.65;   /* less aggressive — single dim layer */
}
```
Or remove the opacity entirely and rely only on `--text-dim` vs `--text`, which is already a 25pt luminance step.

---

#### M6 — Legend sprint bar swatch is 6px tall — too small to be scannable

**File:** `src/sections/calendar/calendar.css`

**What:** `.calendar-legend__bar` is `22px × 6px`. The actual sprint bars in the grid are `14px` tall. The legend swatch is shorter than the thing it represents and barely visible as a line at normal viewing distance.

**Why it matters:** A 6px-tall bar at 12px font-size is thinner than the x-height of the surrounding text, which makes it feel like a hairline divider rather than a legend key.

**Proposed fix:**
```css
.calendar-legend__bar {
  height: 10px;      /* was 6px — match closer to actual bar height */
  border-radius: 4px;
}
```

---

### LOW

#### L1 — Nav chevrons lack `transition-duration`; Today button hover only changes border

**File:** `src/sections/calendar/calendar.css`

**What:** `.calendar-today-btn:hover:not(:disabled)` only changes `border-color`. The background stays `--panel-2`, so the hover effect is a 1px border color change — barely perceptible and inconsistent with the nav buttons which change text color on hover.

**Why it matters:** Inconsistent hover behavior between adjacent interactive elements (prev/next/today) fragments the interaction model.

**Proposed fix:**
```css
.calendar-today-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--panel-2));
  color: var(--accent);
}
```

---

#### L2 — Chip dot glyph letters (R/T/L) are information not all users will decode

**File:** `src/sections/calendar/DayCell.tsx`

**What:** Chip dots contain `aria-hidden="true"` glyph letters "R", "T", "L" for Reminder/Today/Long-term. These duplicate the color coding but add no meaning for sighted users who don't know the key. The legend uses dots too but only shows color, not letters.

**Why it matters:** A user encountering the calendar fresh will see "R", "T", "L" glyphs inside colored dots and have no way to decode them without reading the legend, which itself doesn't use the letter keys. The letters are either redundant (for users who read the legend) or confusing (for users who don't).

**Proposed fix:** Either (a) remove the glyph letters from dots entirely since color + legend is sufficient, or (b) use icon SVGs (`🔔`, `✓`, `⏰`) instead of letters, or (c) update the legend dots to also contain the letter so the pairing is obvious. Option (a) is cleanest:
```tsx
// DayCell.tsx — remove letter from dot
<span className="calendar-chip__dot" aria-hidden="true" />
```

---

#### L3 — Chip font-size (12px) drops to 11px at 720px but weekday headers stay at 12px

**File:** `src/sections/calendar/calendar.css`

**What:** At `max-width: 720px`, `.calendar-chip__label` drops to `11px` but `.calendar-grid__weekday` stays at `12px`. This creates an inverted hierarchy where structural labels are larger than content. The weekday abbreviations (SUN, MON etc.) at 12px look more prominent than the todo/reminder content at 11px.

**Why it matters:** In a dense calendar, content should be as readable as labels. A 1px difference is imperceptible for most but it's worth correcting the inversion.

**Proposed fix:** At 720px, also reduce weekday header to `11px`:
```css
@media (max-width: 720px) {
  .calendar-grid__weekday {
    font-size: 11px;
    padding: 6px 4px;  /* also reduce padding for density */
  }
}
```

---

#### L4 — `calendar-bar__count` badge background uses `--bg` with 60% mix — invisible on active bars

**File:** `src/sections/calendar/calendar.css`

**What:** `.calendar-bar__count` background is `color-mix(in srgb, var(--bg) 60%, transparent)`. On an active bar (background = `var(--accent)`, i.e. `#7c9cff`), the count badge uses `--bg` which is dark navy — this creates a dark badge on a blue bar that is hard to read if the count text uses `var(--text)` (near-white). Additionally, the `Calendar v1` bar has no count badge rendered in the seed data (no todos have `sprintId` set in the seed).

**Why it matters:** When the count badge does appear, its contrast on an active bar needs verification. The `var(--text)` count text on a dark-navy-on-blue badge is readable in dark theme but may fail in light theme.

**Proposed fix:**
```css
.calendar-bar--active .calendar-bar__count {
  background: color-mix(in srgb, var(--accent-on) 15%, transparent);
  color: var(--accent-on);
}
```

---

#### L5 — `pointer-events: none` on `.calendar-cell__head` blocks the Today pill from being read by mouse-over

**File:** `src/sections/calendar/calendar.css`

**What:** `.calendar-cell__head` has `pointer-events: none` which cascades to the "TODAY" pill span. While this is intentional (the head doesn't need to intercept clicks), it means that if a user tries to hover over the today pill, no pointer events fire — there's no way to add a tooltip to the pill via CSS `:hover` or JS `mouseenter`.

**Why it matters:** Low impact currently since the pill has no tooltip, but it blocks any future interaction enhancement on the cell header area (e.g. clicking the date to add an event).

**Proposed fix:** Remove `pointer-events: none` from the container and add it selectively only if needed to prevent accidental cell blocking:
```css
.calendar-cell__head {
  /* remove pointer-events: none — let child elements be individually addressable */
}
```
Or keep it on the container but add `pointer-events: auto` back on interactive children when they're added.

---

## Summary table

| # | Severity | Area | One-line |
|---|----------|------|----------|
| H1 | HIGH | Chips | No hover/expand — truncated titles are dead ends on desktop; fully inaccessible on mobile |
| H2 | HIGH | Mobile | `MAX_CHIPS_MOBILE` exported but never enforced; third chip silently clipped at 720px |
| H3 | HIGH | Legend | Legend swatch shows inactive-bar color; active bar (the dominant visual) has no legend entry |
| M1 | MEDIUM | Animation | Nav/Today button `transition: all` with `duration: 0s` — hover snaps instantly |
| M2 | MEDIUM | Today cell | 14% accent tint is too subtle on dark; nearly invisible on light theme |
| M3 | MEDIUM | Sprint bars | No hover state, no cursor change, no click-through to Sprint tab |
| M4 | MEDIUM | Empty state | Italic hint text with no actionable link; blank grid looks broken |
| M5 | MEDIUM | Out-of-month | Double-dim (color + opacity 0.55) makes dates near-invisible in light theme |
| M6 | MEDIUM | Legend | Sprint bar swatch is 6px tall — thinner than the x-height of surrounding text |
| L1 | LOW | Buttons | Today-btn hover only changes border — inconsistent with nav-btn hover behavior |
| L2 | LOW | Chips | R/T/L glyph letters in dots not decodable without prior knowledge |
| L3 | LOW | Mobile typography | Chip labels drop to 11px at 720px but weekday headers stay at 12px — inverted hierarchy |
| L4 | LOW | Sprint bar count | Count badge bg on active bar may fail contrast in light theme |
| L5 | LOW | Cell head | `pointer-events: none` on cell head blocks future interactivity on date number/today pill |

---

## Rectify pass — round 2

**Rectifier:** claude-sonnet-4-6 | **Date:** 2026-05-12 | **Build:** clean (0 errors, 0 warnings)

| # | What was done |
|---|---------------|
| H1 | Added `cursor: default; transition: background 120ms ease` to `.calendar-chip` + `.calendar-chip:hover { background: color-mix(in srgb, var(--panel-2) 90%, var(--accent)) }`. Comment in `DayCell.tsx` notes mobile limitation. |
| H2 | Added `useState(matchMedia)` + `useEffect` listener in `DayCell`; `cap` now switches to `MAX_CHIPS_MOBILE` at ≤720px. |
| H3 | Legend now shows two sprint entries — `"Sprint (active)"` with `.calendar-legend__bar--active { background: var(--accent) }` first, then `"Sprint"` with the existing 30%-mix swatch. |
| M1 | Added `transition: color 120ms ease, border-color 120ms ease` to `.calendar-nav-btn` and `transition: border-color 120ms ease, background 120ms ease, color 120ms ease` to `.calendar-today-btn`. Confirmed `transitionDuration: "0.12s, 0.12s"` via `getComputedStyle`. |
| M2 | Dark-theme today cell bumped to `color-mix(in srgb, var(--accent) 20%, var(--panel))`; inset border widened to `3px`. Added `[data-theme="light"] .calendar-cell--today` rule at 25% mix. |
| M3 | `.calendar-bar` gets `cursor: pointer; transition: filter 120ms ease` + `:hover { filter: brightness(1.12) }` and `--active:hover { filter: brightness(1.08) }`. Added optional `onSprintClick` prop to `SprintBars`; `MonthGrid` wires it to `onTabChange("sprint")`; `Calendar` accepts `onTabChange` prop; `App.tsx` passes `setTab` (guarded to valid `Tab` union). Sprint bars now have `role="button"` + `tabIndex=0` when handler is present. |
| M4 | `MonthGrid` accepts `onTabChange` prop. Empty-state paragraph renders two `<button className="calendar-empty-link">` elements when prop is provided; plain-text fallback when undefined. Added `.calendar-empty-link` CSS (bg none, accent color, underline). |
| M5 | Removed `opacity: 0.55` from `.calendar-cell--out .calendar-cell__date`. Relies solely on `color: var(--text-dim)`. Confirmed `opacity: 1` via `getComputedStyle`. |
| M6 | `.calendar-legend__bar` height bumped from `6px` to `10px`, `border-radius` to `4px`. Confirmed `height: 10px` via `getComputedStyle`. |
| L1 | `.calendar-today-btn:hover:not(:disabled)` now also sets `background: color-mix(in srgb, var(--accent) 10%, var(--panel-2)); color: var(--accent)` — consistent with nav-btn hover model. |
| L2 | Legend dot `<span>`s now contain the matching letter (R / T / L). `.calendar-legend__dot` updated to `inline-flex` with same 8px/700/`var(--accent-on)` treatment as `.calendar-chip__dot`. |
| L3 | Added `@media (max-width: 720px) { .calendar-grid__weekday { font-size: 11px; padding: 6px 4px; } }` to fix inverted hierarchy. |
| L4 | Added `.calendar-bar--active .calendar-bar__count { background: color-mix(in srgb, var(--accent-on) 15%, transparent); color: var(--accent-on); }`. |
| L5 | Removed `pointer-events: none` from `.calendar-cell__head` — container has no `:hover` rules so removal has no side-effects; unblocks future date-click interactions. |

**Bundle sizes (post-rectify):** Calendar JS 12.00 kB gzip 3.96 kB · Calendar CSS 8.18 kB gzip 1.86 kB · Initial chunk 201.84 kB gzip 63.89 kB.

**Visual verification notes:** Confirmed via `getComputedStyle` queries against the served dist at localhost:8765. Screenshot shows legend with both Sprint (active)/Sprint entries visible, today cell with stronger tint and 3px border, and R/T/L letters in legend dots. One observation the adversary missed: the `Calendar v1` sprint bar at top of week row 2 is styled as `calendar-bar--active` (solid `var(--accent)`) which now correctly matches the legend "Sprint (active)" swatch — the visual grammar is now consistent end-to-end.
