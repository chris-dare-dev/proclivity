# Research synthesis — frontend-uplift-2026q2-m9

**Milestone:** UPL-14 empty-state illustrations + CTA for Gantt + LongTerm
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore — codebase-context, 10 gotchas), brief-2.md (general — 2026 SOTA + 5 external sources)

Final Now-lane milestone. Closes epic e3 + entire frontend-uplift-2026q2 roadmap.

---

## 1. TL;DR for the implementer

Two new inline-SVG illustration components + two empty-state rendering upgrades. No new npm deps. Both briefs converge on three load-bearing corrections to the roadmap brief:

1. **`.btn-primary` does NOT exist in the codebase** — only `.modal-btn-primary` (scoped to Modal context). Define a new `.btn-primary` class in `src/sections/sections.css` mirroring `modal-btn-primary`'s rules. 3 lines of CSS.

2. **Two Gantt empty states, not one** — `Gantt.tsx:94` (no charts exist) and `ChartView.tsx:489` (chart exists with zero tasks). The spec targets ChartView's "no tasks" state. The chart-creation state already has a CTA — leave it untouched.

3. **CTA focus via `useRef`, not `document.getElementById`** — multiple Gantt charts can exist concurrently; an ID-based focus would collide. Use a ref attached to each ChartView's add-input. Same pattern for TodoList: add a `useRef` to the main input.

4. **TodoList `emptyHint: string` stays** — add an OPTIONAL `emptyIllustration?: React.ReactNode` prop alongside. Today.tsx and Sprint.tsx pass plain strings and stay untouched. Only LongTerm.tsx passes the illustration prop.

5. **LongTerm illustration only fires on plain-empty state** — NOT the tag-filter empty state ("No tasks match..."). Conditional inside TodoList: `filteredItems.length === 0 && effectiveActiveTagIds.length === 0`.

**Path decision:** `delegated` — 6 unique paths (2 new + 4 modified). Just over the ≤5-file inline threshold.

**Expected bundle delta:** +~1.5-2 KB gz to the initial chunk (two inline SVGs + small TSX). Initial chunk ~303 kB raw / ~98 kB gz after m9 (vs 301.65 / 96.06 baseline).

---

## 2. Affected files (6 unique paths)

| File | Status | Change |
|---|---|---|
| `src/components/illustrations/GanttEmpty.tsx` | NEW | Default-exported function component. `<svg viewBox="0 0 240 160" aria-hidden="true" focusable="false">` with 5 paths using `var(--text-dim)` for the chart grid + bars and `var(--accent)` for the today-line. Props: `{ onAddTask: () => void }`. Renders SVG + descriptive `<h3>` + body text + CTA `<button className="btn-primary" onClick={onAddTask}>`. |
| `src/components/illustrations/LongTermEmpty.tsx` | NEW | Same shape. SVG: three bullet+line rows representing a list with an accent row + horizon arrow. Props: `{ onAddTask: () => void }`. |
| `src/sections/gantt/ChartView.tsx` | MODIFY | Add `useRef<HTMLInputElement>` (`addInputRef`) at the top of `ChartView()`. Attach to the `<input placeholder="New task…">` at line ~443. Replace the line-489 empty-state body with `<GanttEmpty onAddTask={() => addInputRef.current?.focus()} />`. |
| `src/sections/TodoList.tsx` | MODIFY | Add optional `emptyIllustration?: ReactNode` to `Props`. Add `addInputRef = useRef<HTMLInputElement>(null)` near the existing useRefs. Attach to the main `<input>` (line ~195). In the empty-state branch, render `emptyIllustration` ONLY when both `filteredItems.length === 0` AND `effectiveActiveTagIds.length === 0` (i.e. no filter active). |
| `src/sections/LongTerm.tsx` | MODIFY | Pass `<LongTermEmpty onAddTask={...} />` as the new `emptyIllustration` prop. Since the focus callback needs the TodoList's input ref, the simplest approach is to make the prop a function `emptyIllustration?: (focusInput: () => void) => ReactNode` — TodoList calls it with its internal `focusInput` callback. (See §3.3 for the alternative.) |
| `src/sections/sections.css` | MODIFY | Add `.btn-primary` class (mirroring modal-btn-primary): `background: var(--accent); border: 1px solid var(--accent); color: var(--accent-on); font-weight: 500; padding: 8px 14px; border-radius: var(--radius); cursor: pointer;`. Also add `.section-empty-inner` wrapper: `display: flex; flex-direction: column; align-items: center; gap: 12px;`. Optional: `.section-empty-illustration { max-width: 200px; width: 100%; height: auto; }` for responsive sizing. |

Total: 6 unique paths. ~150-200 LOC across the diff.

---

## 3. Architecture decisions made during synthesis

### 3.1 Add `.btn-primary` class to `sections.css`, do NOT reuse `.modal-btn-primary`

Brief-1 §1 + brief-2 §4.1: the `.btn-primary` class the roadmap brief cited does NOT exist. Reusing `.modal-btn-primary` outside modal context creates a naming-semantics debt. 3 lines of CSS to mirror it cleanly. Brief-2 used `--accent-on` instead of the literal `#0b0e14` hex that `modal-btn-primary` uses — adopt `--accent-on` for theme parity (m1 token).

### 3.2 Add NEW `emptyIllustration?: ReactNode` prop, do NOT change `emptyHint`

Brief-1 §3.5 + brief-2 §4.2: `emptyHint: string` is used by Today, Sprint, AND LongTerm. Changing its type to `ReactNode` would force all three callers to migrate. The cleaner path is an OPTIONAL parallel `emptyIllustration?: ReactNode` prop. Only LongTerm passes it; Today/Sprint never see it. Default behavior unchanged for those sections.

### 3.3 `emptyIllustration` is a function callback, NOT a static node

To wire the CTA's focus callback, the LongTerm caller needs access to TodoList's internal `addInputRef`. Two options:

**Option A — Static node + ref hoist:** Lift `addInputRef` from TodoList to LongTerm, pass the ref down via prop. But this clutters TodoList's API since Today/Sprint don't need the ref.

**Option B — Function-prop pattern:** `emptyIllustration?: (focusInput: () => void) => ReactNode`. TodoList exposes its `focusInput` closure to the caller, who builds the JSX with the focus wired. Clean separation: TodoList owns the ref; LongTerm owns the illustration.

**Decision: Option B.** Lower-coupling, single-direction data flow.

```tsx
// In LongTerm.tsx:
<TodoList
  scope="long"
  emptyHint="No long-term goals yet."
  emptyIllustration={(focusInput) => (
    <LongTermEmpty onAddTask={focusInput} />
  )}
  ...
/>

// In TodoList.tsx:
const focusInput = useCallback(() => addInputRef.current?.focus(), []);
// Render in plain-empty branch:
{emptyIllustration?.(focusInput) ?? <p>{emptyHint}</p>}
```

### 3.4 Gantt CTA targets ChartView.tsx:489 ONLY, not Gantt.tsx:94

Brief-1 §3.1: `Gantt.tsx:94` is the "no charts exist yet" state — already has a "Create your first chart" CTA. `ChartView.tsx:489` is the "no tasks in this chart" state — that's where the illustration belongs. The spec is about populating an existing chart, not about creating the first one.

### 3.5 Each ChartView instance owns its own `addInputRef` (multi-chart safety)

Brief-2 §4.4: Gantt can render N ChartViews. Each must focus its own input. `useRef` declared inside `ChartView()` is per-instance — correct. Do not hoist to Gantt.tsx.

### 3.6 SVG accessibility — `aria-hidden="true" focusable="false"`

Brief-2 §3.2: illustrations are decorative (the heading + text + CTA convey all meaning). Add both attributes:
- `aria-hidden="true"` — removes from accessibility tree.
- `focusable="false"` — prevents legacy IE/Edge tab-stop behavior.

No `<title>` / `<desc>` needed.

### 3.7 Direct `var(--text-dim)` / `var(--accent)` token references, not `currentColor`

Brief-2 §3.3: both patterns work for inline SVGs, but direct tokens are more explicit and match proclivity's existing pattern (all other border/text rules use direct tokens, not `currentColor`). Use:
```jsx
<path stroke="var(--text-dim)" strokeWidth="1.5" fill="none" />
<path stroke="var(--accent)" strokeWidth="1.5" fill="none" />
```

### 3.8 Illustration content sketches (brief-2 §3.6)

**GanttEmpty (viewBox="0 0 240 160"):**
- Horizontal axis line at y=130 (text-dim)
- Vertical "today" line at x=120 (accent)
- 3 rounded-rect bars at staggered widths + y-positions (text-dim)

**LongTermEmpty (viewBox="0 0 240 160"):**
- 3 list rows: bullet circle + horizontal line
- Row 1+2: text-dim
- Row 3: accent + small chevron arrow at end (`→` representing "future horizon")

Implementer can iterate on the exact paths; the briefs supply concrete starting path data.

### 3.9 Heading + body text structure (brief-2 §3.1 IBM Carbon pattern)

For each empty state:
- Illustration (decorative)
- `<h3>` heading — "No tasks yet" / "No long-term goals yet"
- `<p>` body text — one sentence (reuses existing `emptyHint` or a new variant)
- `<button className="btn-primary" onClick={onAddTask}>Add your first task</button>`

### 3.10 `.section-empty-inner` wrapper for vertical layout

Brief-1 §3.10: `.section-empty` currently has `text-align: center; padding: 32px` — no flex layout. Adding flex to `.section-empty` directly would affect all 8+ existing usages. Use an inner wrapper:

```css
.section-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.section-empty-illustration {
  max-width: 200px;
  width: 100%;
  height: auto;
}
```

The new empty state renders `<div className="section-empty"><div className="section-empty-inner">...</div></div>`.

### 3.11 No reduced-motion guard needed for v0

Brief-1 Q5 + brief-2 §7-5: the illustrations are static (no animations). The CTA button has no transition that needs guarding. theme.css's global reset would cover any future addition anyway. Skip the per-site dual-guard for m9.

### 3.12 Card mode untouched

Brief-1 §3.8: `TodoCardSection.tsx` has its own empty state. Synthesis decision: do NOT propagate the illustration into card mode (the card layout has different visual constraints). Keep `emptyHint: string` flowing through to TodoCardSection unchanged. Only list-mode LongTerm gets the illustration.

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

No new npm installs. No CWS publish. Pure additive CSS + JSX.

---

## 5. Implementation strategy (delegated path)

The implementer should follow this sequence:

1. **Create `src/components/illustrations/GanttEmpty.tsx`** (default export). Inline SVG per brief-2 §3.6 sketch. Props: `{ onAddTask: () => void }`. Renders SVG → `<h3>` → `<p>` → `<button>`.

2. **Create `src/components/illustrations/LongTermEmpty.tsx`** — same shape, different SVG content.

3. **Modify `src/sections/sections.css`**:
   - Add `.btn-primary` class (mirrors modal-btn-primary but uses `var(--accent-on)` instead of hex).
   - Add `.section-empty-inner` wrapper class.
   - Add `.section-empty-illustration` responsive sizing class.

4. **Modify `src/sections/gantt/ChartView.tsx`**:
   - Add `const addInputRef = useRef<HTMLInputElement>(null);` near other refs.
   - Attach `ref={addInputRef}` to the `<input placeholder="New task…">` at line ~443.
   - Replace the line-489 empty-state body (the section-empty `<div>` content) with `<GanttEmpty onAddTask={() => addInputRef.current?.focus()} />` wrapped in the `.section-empty` + `.section-empty-inner` divs.

5. **Modify `src/sections/TodoList.tsx`**:
   - Add `emptyIllustration?: (focusInput: () => void) => ReactNode` to `Props` interface.
   - Add `import type { ReactNode } from "react"` (if not already imported).
   - Add `const addInputRef = useRef<HTMLInputElement>(null);` near existing useRefs.
   - Attach `ref={addInputRef}` to the main `<input>` at line ~195.
   - Add `const focusInput = useCallback(() => addInputRef.current?.focus(), []);`.
   - In the empty-state branch at line ~250-266, gate the new render path: `if (effectiveActiveTagIds.length === 0 && emptyIllustration) { return ... emptyIllustration(focusInput) ... }`. Tag-filter empty state stays as-is.

6. **Modify `src/sections/LongTerm.tsx`**:
   - Import `LongTermEmpty` from `@/components/illustrations/LongTermEmpty`.
   - Pass `emptyIllustration={(focusInput) => <LongTermEmpty onAddTask={focusInput} />}` to the `<TodoList>` call.

7. **`npm run build`** — verify:
   - Initial chunk ≤ 305 kB raw / ≤ 98 kB gz (target ~303 / ~98 per brief-2 projection).
   - Zero TS strict errors.
   - Illustrations render correctly in both light and dark theme.

8. **Single commit** — `feat(style): empty-state illustrations + CTA (m9)` (sample subject, 38 chars after `feat(style): ` prefix).

---

## 6. Implementation acceptance criteria

1. `src/components/illustrations/GanttEmpty.tsx` and `LongTermEmpty.tsx` exist; each a self-contained `<svg viewBox="0 0 240 160" aria-hidden="true" focusable="false">` using ONLY `var(--text-dim)` and `var(--accent)` token references (no hex literals in stroke/fill).
2. `.btn-primary` defined in `sections.css` with `background: var(--accent); color: var(--accent-on); font-weight: 500;`.
3. `.section-empty-inner` + `.section-empty-illustration` classes defined for layout.
4. `ChartView.tsx`:
   - `useRef<HTMLInputElement>` declared inside the component (per-instance).
   - Ref attached to the add-task `<input>`.
   - Empty-state renders `<GanttEmpty onAddTask={() => addInputRef.current?.focus()} />`.
5. `TodoList.tsx`:
   - New optional `emptyIllustration?: (focusInput: () => void) => ReactNode` prop.
   - `addInputRef` declared and attached.
   - Plain-empty branch renders `emptyIllustration(focusInput)` when provided.
   - Tag-filter empty state UNCHANGED.
6. `LongTerm.tsx` passes the `emptyIllustration` function prop with `<LongTermEmpty>`.
7. **No changes to**: Today.tsx, Sprint.tsx, TodoCardSection.tsx, Gantt.tsx (the multi-chart shell).
8. Build passes (`npm run build`): initial chunk ≤ 305 kB raw, zero TS errors.
9. **Manual smoke** in dev:
   - Open Gantt with a chart that has zero tasks → illustration + "Add your first task" CTA appears. Click CTA → focus moves to the add-task input field.
   - Same for LongTerm with zero items.
   - Toggle light/dark theme → illustrations recolor correctly via CSS custom properties.
   - Add a tag-filter that returns zero results in LongTerm → tag-filter empty state shows (no illustration). Clear the filter with zero items remaining → illustration appears.
   - At 390 px viewport, the illustration sizes responsively without overflowing.
   - Today.tsx, Sprint.tsx empty states unchanged (no illustration).

---

## 7. Riskiest assumption + alternative

**Risk (brief-2 §5):** the roadmap brief assumed `.btn-primary` is an existing class. It's not. If the implementer naively uses `className="btn-primary"` without defining the class, the CTA renders as an unstyled `<button>` (browser default — typically gray, no accent color). This is silent (no error) and subtle.

**Mitigation:** synthesis §3.1 + implementation step 3 explicitly require defining `.btn-primary` FIRST. The implementer prompt must reinforce this.

**Alternative (brief-2 §6):** skip the SVG illustrations entirely and ship just the "no tasks" `<h3>` + CTA button. The SVG is the visual polish; the focus-on-CTA-click behavior is the core a11y/UX win. Acceptable fallback if path-data authoring proves problematic.

---

## 8. Open questions for the implementer (≤5)

1. **`.btn-primary` color choice** — use `--accent-on` for the text color (m1 token, theme-aware: light text on dark accent / dark text on light accent) instead of `modal-btn-primary`'s literal `#0b0e14`. Cleaner theming.

2. **SVG path detail level** — brief-2 §3.6 provides starting paths. The implementer can iterate on the exact path data (a more elegant illustration is fine; the briefs prescribe the CONCEPT, not the pixels). Keep total per-SVG character count under ~1.5 KB raw (~3-4 paths each).

3. **`emptyIllustration` callback signature** — synthesis §3.3 prescribes `(focusInput: () => void) => ReactNode`. Confirm this is acceptable; alternative is a static `ReactNode` with the caller using a forwarded ref (more boilerplate).

4. **Heading + body text content** — synthesis suggests `<h3>No tasks yet</h3>` / `<h3>No long-term goals yet</h3>` + a one-sentence body. Final wording is the implementer's call but should be consistent with the existing `emptyHint` voice.

5. **Card-mode illustration** — explicitly OUT of scope (synthesis §3.12). Card mode keeps its existing `emptyHint: string` rendering. Future polish milestone if/when warranted.

---

## 9. Scope assessment

- **Path:** delegated (6 unique paths > 5-file inline threshold)
- **Estimated LOC:** ~150-200 (most additions are 1-3 lines per file; SVG path data is the bulk; sections.css gets ~15 lines of new classes)
- **Worktree:** YES (delegated convention)
- **`--allow-large-diff`:** NO
- **Novel architecture:** NO — additive components + new prop + new class. No new deps. No new event topology.
- **OSS scout:** NO (`--include-oss` NOT set) — no new dependencies.
