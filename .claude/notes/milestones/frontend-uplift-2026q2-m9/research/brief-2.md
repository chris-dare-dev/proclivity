---
milestone_id: "frontend-uplift-2026q2-m9"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://www.w3.org/WAI/standards-guidelines/act/rules/e88epe/proposed/"
    sha256: "987ac4be59740db6778581de82f017af964da705ff2352659da194c1cb8d9ba6"
    takeaway: "Decorative images not in the accessibility tree must use role=none or aria-hidden=true; when adjacent text already provides context, aria-hidden=true on the SVG is the conforming pattern."
  - url: "https://www.eleken.co/blog-posts/empty-state-ux"
    sha256: "b8c6ccefada0e9ecafb155fc50174e9fa15a4429021703093f9fd74b9c9d59f2"
    takeaway: "Single prominent CTA with action-specific label, 2-3 sentences max, illustration restraint over elaboration; Linear/Notion use monochrome illustrations that blend into the interface."
  - url: "https://carbondesignsystem.com/patterns/empty-states-pattern/"
    sha256: "26388b28a886a7e8cd892f1496e2bfdbae23879b120cf1e14aa95611cc458daa"
    takeaway: "IBM Carbon formalizes the empty-state pattern as: illustration + heading + body text + CTA; illustrations use single-color, icon-scale vector art with no fills beyond the brand accent."
  - url: "https://www.saasui.design/pattern/empty-state/linear"
    sha256: "97c7d8c423112dedb2262f556dd88f43d1be8359cd2532384c68f654b373eb57"
    takeaway: "Linear's empty states use minimalist line-art or icon-scale illustrations with generous spacing; monochrome with a single accent color is the dominant 2025 SaaS empty-state aesthetic."
  - url: "https://css-tricks.com/accessible-svgs/"
    sha256: "069047a4bd84fc8bdd3288a0b854aa1d38e3ba173187e28747ce8aec15a6ab05"
    takeaway: "For decorative SVGs alongside descriptive text, aria-hidden=true is the correct pattern; no title/desc needed; prevents screen reader from announcing the graphic redundantly."
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m9

## 1. TL;DR

Two inline-SVG illustration components (`GanttEmpty` + `LongTermEmpty`) placed above the existing `section-empty` div in `ChartView.tsx` and `TodoList.tsx` (LongTerm scope). Both use `stroke="currentColor"` on a wrapper with `color: var(--text-dim)` and a single accent path using `stroke="var(--accent)"`. The illustrations are decorative (`aria-hidden="true" focusable="false"`); the CTA button uses the existing `modal-btn-primary` class (the brief says `btn-primary` but that class does not exist — only `modal-btn-primary` does). The Gantt CTA focuses the first `<input>` inside `.gantt-add-row` via a `useRef` forwarded from `ChartView`; the LongTerm CTA focuses the TodoList `<input>` via a `useRef` on the same component. No new npm dependencies. Initial chunk delta ≤ 2 KB gzipped.

## 2. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

## 3. Best-practice findings

### 3.1 Empty-state design pattern — 2026 SOTA

The dominant pattern across Linear, Notion, Asana, and IBM Carbon in 2025–2026 is:

1. **Illustration** — monochrome line-art, icon-scale (160–240 px wide), single accent highlight.
2. **Heading** — "No tasks yet" (short, factual).
3. **Body text** — one sentence of context / encouragement (already present in proclivity as `emptyHint`).
4. **Single CTA** — action-specific label ("Add your first task"), accent-colored primary button.

The guidance from Eleken (sha256 `b8c6cc...`) is explicit: "a single, prominent CTA rather than multiple competing actions." IBM Carbon (sha256 `26388b...`) formalizes the same four-element hierarchy. Linear uses icon-scale, monochrome-with-accent illustrations that blend with the UI — never playful cartoon fills.

**Illustration style verdict:** line-art monochrome with `var(--text-dim)` strokes + single `var(--accent)` highlight path. No fills. No animations on the SVG (reduced-motion nuclear guard in `theme.css` already covers it, but adding a gentle fade-in on the container is safe as belt-and-suspenders).

**Source:** [Eleken empty-state UX](https://www.eleken.co/blog-posts/empty-state-ux) · [IBM Carbon empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/) · [Linear SaaS UI pattern](https://www.saasui.design/pattern/empty-state/linear)

---

### 3.2 SVG accessibility

Since the illustration is purely decorative (the adjacent heading + emptyHint text + CTA already convey all meaning), use:

```jsx
<svg
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 240 160"
  ...
>
```

**`aria-hidden="true"`** removes the SVG from the accessibility tree entirely.  
**`focusable="false"`** prevents IE/Edge legacy behavior where SVGs can be tab-stopped even with `aria-hidden`.  
No `<title>` or `<desc>` required — those are for non-decorative informative SVGs.

WCAG ACT rule (sha256 `987ac4...`) confirms: decorative images whose surrounding text already provides context should be hidden from the accessibility tree via `aria-hidden="true"`. CSS-Tricks (sha256 `069047...`) shows the identical pattern for inline decorative icon SVGs.

---

### 3.3 `currentColor` vs direct `var(--text-dim)` token

Two equivalent patterns:

**Pattern A — `currentColor` inheritance:**
```jsx
<svg style={{ color: "var(--text-dim)" }} ...>
  <path stroke="currentColor" ... />
  <path stroke="var(--accent)" ... />   {/* accent path overrides */}
</svg>
```

**Pattern B — direct token:**
```jsx
<svg ...>
  <path stroke="var(--text-dim)" ... />
  <path stroke="var(--accent)" ... />
</svg>
```

**Recommendation: Pattern B (direct tokens).** `currentColor` is elegant but introduces a hidden coupling: if a parent component happens to set `color:` for unrelated reasons (e.g. a hover state), the SVG silently re-colors. Direct `var(--text-dim)` is explicit, testable, and matches how proclivity already wires tokens (all other border/text rules use `var(--border)`, `var(--text-dim)` directly, not `currentColor`). Pattern B is also more readable to future maintainers and survives being moved to a different DOM position without color drift.

---

### 3.4 CTA → add-input focus pattern

The brief suggests `document.getElementById('gantt-add-task-input')?.focus()`. This is problematic for two reasons:
1. The `ChartView` renders **per chart** (there can be multiple charts, each with its own add-input). An `id` must be unique per page.
2. The TodoList `<input>` has no `id` at all today — just a `placeholder`.

**Recommended approach: `useRef` + callback prop (ref forwarding).**

Proclivity already has two custom-event-based patterns:
- `NAV_CLOSED_EVENT` — cross-section navigation.
- `OPEN_SETTINGS_EVENT` — opens settings modal from palette command.

However, for a **within-section** focus operation, a custom event is over-engineered. The correct pattern is:

For **Gantt**: pass an `addInputRef` from `ChartView` down to `GanttEmpty` as a prop (`onAddTask: () => void`). Inside `ChartView`, create `const addInputRef = useRef<HTMLInputElement>(null)`, attach it to the `<input placeholder="New task…">`, and pass `() => addInputRef.current?.focus()` as the CTA handler.

For **LongTerm**: `TodoList` owns its own `<input>`. Add `const addInputRef = useRef<HTMLInputElement>(null)`, attach to the input, and render `<LongTermEmpty onAddTask={() => addInputRef.current?.focus()} />` inline when `filteredItems.length === 0 && effectiveActiveTagIds.length === 0`.

Neither requires a global `id` attribute, a custom event, or any cross-component coupling.

---

### 3.5 Bundle weight estimate

Two inline SVG components as TSX, each ~3 KB raw serialized. Raw total ~6 KB. TypeScript JSX compiles to minimal JS (no runtime overhead beyond React's standard element factory). Gzip ratio for SVG path data is typically 3:1 to 4:1 → ~1.5–2 KB gz total. The 400 KB initial chunk soft ceiling has ~50-100 KB headroom per CLAUDE.md; two 1-2 KB components are well inside.

**No new npm dependencies required.**

---

### 3.6 Illustration content proposals

**`GanttEmpty` — viewBox="0 0 240 160"**

Concept: simplified Gantt bar chart skeleton — 3 horizontal bars at different widths at vertical positions, with a vertical "today" line. Clean and directly thematic.

```
Path sketch (all stroke="var(--text-dim)", strokeWidth=1.5, fill="none"):
- Horizontal axis line: M 20 130 L 220 130
- Vertical today line: M 120 20 L 120 130  (stroke="var(--accent)")
- Bar 1 (row 1): M 30 50 L 150 50  (rounded rect: rx/ry 4)
- Bar 2 (row 2): M 30 75 L 100 75  (shorter, offset start)
- Bar 3 (row 3): M 60 100 L 190 100  (longer, later start)
- 3 small label boxes on left: rect(10,44,15,12) each
```

Concrete path data (keep short, ~15 commands):
```
Paths:
1. axis:  M20 130 L220 130
2. today: M120 20 L120 130  (var(--accent))
3. bar1:  M32 44 h118 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 H32 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4
4. bar2:  M50 69 h52 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 H50 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4
5. bar3:  M68 94 h122 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 H68 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4
```

**`LongTermEmpty` — viewBox="0 0 240 160"**

Concept: a list with three rows, each with a small circle (bullet) and a short line representing text. The third row has a longer line extending to the right with a small star/arrow mark suggesting "future horizon." Directly thematic for long-term goals.

```
Paths (stroke="var(--text-dim)", strokeWidth=1.5, fill="none"):
- Row 1 bullet: circle cx=36 cy=52 r=4
- Row 1 line:   M48 52 L160 52
- Row 2 bullet: circle cx=36 cy=80 r=4
- Row 2 line:   M48 80 L130 80
- Row 3 bullet: circle cx=36 cy=108 r=4  (stroke="var(--accent)")
- Row 3 line:   M48 108 L200 108  (stroke="var(--accent)")
- Horizon arrow:M196 104 L204 108 L196 112  (accent, suggests "→ future")
```

---

## 4. Critical codebase findings

### 4.1 `btn-primary` does NOT exist

The brief specifies `className="btn-primary"` but this class is not defined anywhere in the codebase. The existing primary button class is **`modal-btn-primary`** (defined in `src/components/Modal.css`):
```css
.modal-btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #0b0e14;
  font-weight: 500;
}
```
The implementer should either use `modal-btn-primary` or define a new standalone `btn-primary` class in `sections.css` that mirrors it. Given the empty-state is in section context (not a modal), defining a `btn-primary` in `sections.css` is cleaner.

### 4.2 LongTerm empty-state is controlled by `TodoList`, not `LongTerm.tsx`

`LongTerm.tsx` is 7 lines — it just delegates to `<TodoList scope="long" emptyHint="..." />`. The empty-state rendering is in `TodoList.tsx` at line 251: `<div className="section-empty">{emptyHint}</div>`. The illustration CTA must be wired into `TodoList.tsx`, not `LongTerm.tsx`. The `emptyHint` prop is a `string` — to render the illustration + CTA, the implementer either: (a) changes `emptyHint` to `React.ReactNode`, or (b) adds an `emptyIllustration?: React.ReactNode` prop, or (c) special-cases based on `scope === "long"` inside `TodoList`. Option (b) is cleanest.

### 4.3 Gantt empty-state: the add-input has no `id` attribute today

`ChartView.tsx` line 444: `<input placeholder="New task…" value={newTitle} ...>`. No `id` attribute. To support `addInputRef.current?.focus()`, a `useRef<HTMLInputElement>` must be added and attached to this input. No ID-based coupling needed.

### 4.4 Gantt section renders multiple ChartView instances

`Gantt.tsx` (not shown in full) presumably renders multiple `<ChartView chartId={...} />` instances. Each has its own add-input. The CTA in `GanttEmpty` must call a per-instance callback (not a global ID query) — the `useRef` approach handles this correctly.

### 4.5 LongTerm illustration only fires for the `scope==="long"` empty state, not the tag-filter empty state

`TodoList.tsx` line 250–267: when `filteredItems.length === 0`, the component checks `effectiveActiveTagIds.length > 0` (tag-filter case) vs the plain empty case. The illustration + CTA should ONLY render in the plain-empty case (no tags active, no items). The tag-filter empty state keeps its existing "No tasks match..." + "Clear the filter" inline button.

---

## 5. Riskiest assumption + alternative

**Riskiest assumption:** The brief assumes `btn-primary` is an existing class. It is not. The existing class is `modal-btn-primary`, which is scoped to modal dialogs (via context, not via class specificity — but semantically it implies modal context). Using `modal-btn-primary` outside a modal is technically functional today but creates a naming-semantics debt.

**Mitigation:** Define a new `.btn-primary` class in `src/sections/sections.css` (or `src/newtab/App.css`) that copies `modal-btn-primary`'s rules. This is 3 lines of CSS and makes the intent explicit. The implementer should not silently reuse `modal-btn-primary` for non-modal contexts — that will surprise the next developer.

**Alternative path:** Use the existing unstyled `<button>` as the CTA but add `style={{ background: "var(--accent)", ... }}` inline. This avoids naming the class but is even harder to maintain. Not recommended.

---

## 6. Alternative implementation paths

1. **Emoji/Unicode fallback instead of SVG** — `GanttEmpty` shows 📊 at large font size, `LongTermEmpty` shows 🎯. Pros: zero bundle weight, zero maintenance. Cons: not themeable, looks amateurish at the productivity-app tier, emoji rendering varies by OS. Rejected for this milestone.

2. **CSS-only skeleton illustration** — use `border` + `border-radius` CSS boxes to simulate Gantt bars. No SVG, no JSX overhead. Pros: fully responsive, themeable via CSS vars. Cons: more CSS to maintain, less expressive for the LongTerm "horizon" concept. Viable if SVG path complexity grows.

3. **Single shared `EmptyState` wrapper component** — rather than two discrete illustration components, create `<EmptyState illustration={<GanttSVG />} cta={...} />`. Pros: DRY layout (illustration + text + CTA vertical rhythm is identical for both). Cons: slightly more scaffolding for what is currently a 2-component milestone. Worth considering if a third illustration (Sprint, Calendar) is planned for a later milestone.

---

## 7. Open questions for the implementer

1. **`btn-primary` vs `modal-btn-primary`:** Will you define a new `btn-primary` class in `sections.css`, or repurpose `modal-btn-primary`? The brief says `btn-primary`; the codebase only has `modal-btn-primary`. A new class is recommended.

2. **`emptyHint` prop type change:** `TodoList`'s `emptyHint: string` prop needs to become `emptyHint: React.ReactNode` (or a new `emptyIllustration` prop) to render the illustration inside the section-empty div. Which approach? `emptyIllustration?: React.ReactNode` is lowest-diff and preserves the string `emptyHint` for Sprint/Today sections that don't get illustrations in m9.

3. **Scope guard in TodoList:** The illustration should only appear for `scope === "long"` (not `scope === "today"` or `scope === "sprint"`). Is the illustration component passed in via prop (caller decides) or guarded by scope check inside `TodoList`? Prop is cleaner.

4. **Multiple Gantt charts:** If the user has 3 charts and the second chart is empty, the CTA focuses the correct per-chart input via `useRef`. Confirm the `useRef` is created inside `ChartView` (per instance), not hoisted to `Gantt.tsx`.

5. **Fade-in animation on the empty-state container:** If a `0.3s ease` opacity fade is added to `.section-empty` for the illustration entry, confirm it uses the dual-guard pattern (`[data-reduced-motion="true"] .section-empty { animation: none }` + `@media (prefers-reduced-motion: reduce)`). The nuclear guard in `theme.css` already covers it at runtime, but per CLAUDE.md convention, per-site guards are added for audit clarity.

## 1. External sources consulted

- **URL:** https://www.w3.org/WAI/standards-guidelines/act/rules/e88epe/proposed/
  **SHA256:** 987ac4be59740db6778581de82f017af964da705ff2352659da194c1cb8d9ba6
  **Takeaway:** WCAG ACT rule confirms `aria-hidden="true"` on decorative SVGs adjacent to descriptive text is the conforming pattern; `role="none"` is an alternative but less universally supported.

- **URL:** https://www.eleken.co/blog-posts/empty-state-ux
  **SHA256:** b8c6ccefada0e9ecafb155fc50174e9fa15a4429021703093f9fd74b9c9d59f2
  **Takeaway:** Single prominent CTA, action-specific labels, 2-3 sentences max, illustration restraint; Linear/Notion use monochrome illustrations that blend into the interface.

- **URL:** https://carbondesignsystem.com/patterns/empty-states-pattern/
  **SHA256:** 26388b28a886a7e8cd892f1496e2bfdbae23879b120cf1e14aa95611cc458daa
  **Takeaway:** IBM Carbon formalizes illustration + heading + body + CTA hierarchy; single-color vector art, no fills beyond brand accent.

- **URL:** https://www.saasui.design/pattern/empty-state/linear
  **SHA256:** 97c7d8c423112dedb2262f556dd88f43d1be8359cd2532384c68f654b373eb57
  **Takeaway:** Linear's empty states use minimalist line-art with generous spacing; monochrome with single accent is dominant 2025 SaaS aesthetic.

- **URL:** https://css-tricks.com/accessible-svgs/
  **SHA256:** 069047a4bd84fc8bdd3288a0b854aa1d38e3ba173187e28747ce8aec15a6ab05
  **Takeaway:** `aria-hidden="true"` is the correct pattern for decorative inline SVGs; no title/desc needed when adjacent text conveys the meaning.

## 2. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

## 3. Riskiest assumption + alternative

The riskiest assumption is that `btn-primary` is an existing CSS class. It is not — the codebase only has `modal-btn-primary` in `src/components/Modal.css`. The implementer must either define a new `.btn-primary` class in `sections.css` (3 lines, matching `modal-btn-primary` rules) or use `modal-btn-primary` outside its semantic context. The former is correct. The alternative implementation — using inline `style={{ background: "var(--accent)" }}` — avoids the class-naming decision but is unmaintainable. The concrete alternative to the whole illustration approach is a CSS-only skeleton (border boxes in a Gantt-bar shape), which is fully themeable and ~0 KB, but less expressive for the LongTerm section.

## 4. Acceptance criteria the implementer must meet

1. `GanttEmpty.tsx` and `LongTermEmpty.tsx` exist under `src/components/illustrations/`, each a self-contained `<svg viewBox="0 0 240 160" aria-hidden="true" focusable="false">` with strokes using `var(--text-dim)` and one accent path using `var(--accent)`; no hex literals.
2. Toggling light/dark theme (via Settings) causes both illustrations to recolor correctly — strokes follow `var(--text-dim)` / `var(--accent)` which change between `:root` and `[data-theme="light"]`.
3. The Gantt section's CTA button focuses the `<input placeholder="New task…">` in the same `ChartView` instance; clicking CTA on chart 2 (if 3 charts exist) focuses chart 2's input, not chart 1's.
4. The LongTerm illustration + CTA renders only when `filteredItems.length === 0 && effectiveActiveTagIds.length === 0`; the tag-filter empty state ("No tasks match...") is unchanged.
5. A `.btn-primary` class (or `modal-btn-primary`) is used for the CTA button; if new, it is defined in `sections.css` mirroring `modal-btn-primary`'s rules.
6. `npm run build` passes cleanly with `strict: true`; initial chunk delta ≤ 2 KB gzipped.
7. At 390 px viewport width, the illustration does not overflow its container (use `max-width: 100%` on the `<svg>` or the wrapper, with `height: auto`).
