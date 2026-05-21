---
milestone_id: "frontend-uplift-2026q2-m9"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources: []
injection_attempts: 0
---

# Codebase Research Brief — frontend-uplift-2026q2-m9

## 1. TL;DR

Two Gantt empty-state sites exist, not one: `Gantt.tsx:94` (no charts at all) and `ChartView.tsx:489` (chart exists but has no tasks). The brief's illustration target is `ChartView.tsx:489`. The `.btn-primary` class cited in the brief does NOT exist anywhere in the codebase — the equivalent is `.modal-btn-primary` (defined in `Modal.css`) or a new class must be added to `index.css` alongside the existing `.btn-danger`. Neither the Gantt add-task input nor the TodoList main input has an `id` or a ref for CTA focus — both need one added. The `src/components/illustrations/` directory does not yet exist; m9 creates it.

---

## 2. File Inventory

| File | Nature of change |
|---|---|
| `src/components/illustrations/GanttEmpty.tsx` | **CREATE** — new inline SVG illustration component |
| `src/components/illustrations/LongTermEmpty.tsx` | **CREATE** — new inline SVG illustration component |
| `src/sections/gantt/ChartView.tsx` | **MODIFY** — replace `section-empty` plain text with illustration + text + CTA; add `id` to `<input placeholder="New task…">` so CTA can focus it |
| `src/sections/LongTerm.tsx` | **MODIFY** — pass a JSX element (not string) as `emptyHint` prop to `TodoList`, OR pass CTA trigger down via a new prop |
| `src/sections/TodoList.tsx` | **MODIFY** — `emptyHint` prop must accept `React.ReactNode` (currently typed as `string`); add `id` or `ref` to the main `<input>` for CTA focus; render illustration block when `emptyHint` is a node |
| `src/newtab/index.css` | **MODIFY** — add `.btn-primary` class (parallel to `.btn-danger`); `.modal-btn-primary` is modal-scoped only |

---

## 3. Implementation Notes / Gotchas

1. **Two Gantt empty-state sites, different semantics.** `Gantt.tsx:94` fires when `state.ganttCharts.length === 0` — no charts exist at all. `ChartView.tsx:489` fires when `rows.length === 0` — a chart exists but has no tasks. The illustration + CTA belongs on `ChartView.tsx:489` (the "populate your first chart" moment). `Gantt.tsx:94` is a different state (no chart yet) and already has a CTA button (`Create your first chart`); the brief does not mention illustrating it, so leave it as-is.

2. **`.btn-primary` does not exist — only `.modal-btn-primary`.** `Modal.css` defines `.modal-btn-primary` (`background: var(--accent); color: #0b0e14; font-weight: 500`). This class is scoped to modal context by convention. For the in-section CTA button, the implementer should either (a) add a global `.btn-primary` to `index.css` with equivalent styling, or (b) reuse `.modal-btn-primary` accepting that the naming is modal-scoped. Option (a) is cleaner and parallel to `.btn-danger` in `index.css`.

3. **ChartView add-task input has no `id`.** The input at `ChartView.tsx:443` (`<input placeholder="New task…" value={newTitle} …>`) has no `id` attribute. The CTA `document.getElementById('gantt-add-task-input')?.focus()` pattern requires adding `id="gantt-add-task-input"` to this input. Alternatively, a `useRef<HTMLInputElement>` can be declared in `ChartView` and passed down or used directly, but the `id` approach is simpler since the CTA is co-located.

4. **TodoList main input has no `id` or accessible ref.** The input at `TodoList.tsx:195` has no `id`. For the LongTerm CTA focus, either add `id="long-term-add-input"` (stable and simple), or pass a `useRef` from `LongTerm.tsx` down through a new prop. Since `TodoList` is shared across Today, Sprint, and LongTerm scopes, the cleanest approach is to add an optional `inputId?: string` prop to `TodoList` and thread it to the `<input>`. Then `LongTerm.tsx` passes `inputId="long-term-add-input"` and the CTA references it.

5. **`emptyHint` prop is typed as `string` in `TodoList.tsx`.** The `Props` interface at `TodoList.tsx:45` defines `emptyHint: string`. The illustration+CTA upgrade requires either (a) changing the type to `React.ReactNode` and letting callers pass JSX, or (b) keeping it as string and adding a separate `emptyIllustration?: React.ReactNode` prop. Option (b) avoids breaking the plain-string usage from Today.tsx (which also uses `TodoList` with a string `emptyHint`). Today.tsx and Sprint both pass plain strings — these must remain unchanged. The cleanest minimal change: add `emptyIllustration?: React.ReactNode` alongside the existing `emptyHint: string`, rendered above the text when provided.

6. **TodoList empty state has two branches.** `TodoList.tsx:250-266` renders `section-empty` when `filteredItems.length === 0`, but this includes two sub-cases: (a) tag filter active → shows "No tasks match the selected tags. [Clear the filter]", (b) no filter → shows `emptyHint`. The illustration should only appear in sub-case (b) (no tasks, no filter active). Do NOT show the illustration when tags are active and filtering is the reason for zero items.

7. **SVG CSS custom property inheritance.** Inline `<svg>` elements are DOM nodes and inherit the document's CSS cascade. Using `stroke="var(--accent)"` and `fill="var(--text-dim)"` directly in SVG attributes works for inline SVGs because CSS custom properties are inherited through the shadow-less DOM. No special setup needed.

8. **Card mode also has a LongTerm empty state.** `TodoCardSection.tsx:147-158` renders its own `section-empty` that receives `emptyHint` (as a prop) — it shows a positioned empty state over the canvas. This is a separate render path from the list-mode empty state. `emptyHint` flows into `TodoCardSection` as a plain `string` prop from `TodoList`. If `emptyHint` type changes to `React.ReactNode`, the `TodoCardSection` prop signature also needs updating. Preferred approach: keep `emptyHint: string` in both `TodoList` and `TodoCardSection`; add `emptyIllustration?: React.ReactNode` only to `TodoList`.

9. **ChartView CTA focus and prop threading.** `ChartView.tsx` already has `newTitle` state and the `addTask` function. Adding `id="gantt-add-task-input"` to the title input (line 443) and referencing it from a CTA button inside the `rows.length === 0` branch is straightforward — no prop changes needed because the CTA is rendered inside the same component that owns the input.

10. **`section-empty` in `.section-empty` currently has no flex layout.** `App.css:201-208` defines `.section-empty` with `text-align: center; padding: 32px`. The illustration + text + CTA vertical stack will need `display: flex; flex-direction: column; align-items: center; gap: X` either inside `.section-empty` itself (side-effect: affects all existing empty states) or via an inner wrapper div. Prefer an inner wrapper (e.g. `<div className="section-empty-inner">`) to avoid layout impact on the other 8+ existing `.section-empty` usages across the codebase.

---

## 4. Open Questions for the implementer

1. **Which button style for the CTA?** The brief says `.btn-primary` but this class does not exist. Should it be added to `index.css` mirroring `.btn-danger`, or should `.modal-btn-primary` from `Modal.css` be reused? Recommendation: add `.btn-primary` to `index.css` for semantic correctness and reusability.

2. **`emptyIllustration` prop vs. `React.ReactNode` for `emptyHint`?** The brief implies passing the illustration+CTA as the whole empty state. The safer approach is a new optional `emptyIllustration?: React.ReactNode` prop alongside `emptyHint: string` — this avoids touching Today.tsx and other callers. Confirm this is the intended upgrade path.

3. **Should `Gantt.tsx:94` (no-charts state) also receive an illustration?** The brief only mentions `ChartView.tsx:489` (no tasks within a chart), but `Gantt.tsx` has a prior empty state when no chart exists. Leave it as-is per the brief or extend it?

4. **Illustration SVG path design.** The brief says ~3 KB each with `viewBox="0 0 240 160"` using `var(--accent)`, `var(--text-dim)`, `var(--border)`. The implementer needs to author the SVG paths. A Gantt illustration could show horizontal bars on a grid; LongTerm could show stacked chevrons or a horizon line. The research phase cannot author these — they are design artifacts.

5. **Mobile viewport (390 px) sizing.** At narrow viewports the SVG can be capped with `max-width: 160px` or similar CSS. The `viewBox` preserves aspect ratio on its own; max-width prevents it from expanding beyond 240 px at wider viewports. No CSS class for responsive SVG sizing currently exists — the implementer must add it (e.g., `width: 100%; max-width: 200px; height: auto` on the `<svg>` element or its wrapper).

---

## 5. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

---

## 6. Acceptance criteria the implementer must meet

1. `src/components/illustrations/GanttEmpty.tsx` and `LongTermEmpty.tsx` exist; each is a self-contained `<svg viewBox="0 0 240 160">` using only `var(--accent)`, `var(--text-dim)`, `var(--border)` tokens (no hex literals in stroke/fill attributes).
2. `ChartView.tsx:489` empty-state renders: illustration above → existing text → `.btn-primary` CTA button; clicking the CTA focuses the add-task title input (`id="gantt-add-task-input"` added to the input).
3. `TodoList.tsx` empty state (no filter active, no items) renders: illustration above → existing `emptyHint` text → `.btn-primary` CTA button; CTA focuses the main input (via `id` or ref); tag-filter-active branch is unaffected.
4. `.btn-primary` class defined in `index.css` with `background: var(--accent); color: #0b0e14; font-weight: 500` (or equivalent accent styling).
5. Today.tsx, Sprint, and other existing `TodoList` callers are unaffected (they do not pass `emptyIllustration`, so the branch is never rendered for them).
6. Illustrations re-color correctly when the user toggles light/dark theme (because they use CSS custom properties, not hex).
7. `npm run build` passes with zero TypeScript errors.
