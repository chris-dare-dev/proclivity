### `frontend-uplift-2026q2-m9` — UPL-14 empty-state illustrations + CTA

Design-heavier than the other e3 milestones. Adds inline SVG illustrations + a contextual CTA to the empty states of the highest-leverage sections (Gantt, LongTerm). Lower-leverage sections (Sprint when no active sprint, Calendar when no events) get a lightweight text-only treatment now; the illustrations are deferred for a later design pass. Pure SVG — no new dependency, no library; illustrations live as inline `<svg>` components in `src/components/illustrations/`.

**Stories:**

**`frontend-uplift-2026q2-e3-s16` — UPL-14: empty-state illustrations + CTA for Gantt and LongTerm** (S)

Given the Gantt section renders `<div className="section-empty">No tasks yet. Click "+ Task" to begin.</div>` when no tasks exist (`src/sections/gantt/ChartView.tsx` or equivalent), and the LongTerm section renders a similar bare-text empty state, and both feel uninviting on cold accounts
When the developer creates two new inline-SVG illustration components (`src/components/illustrations/GanttEmpty.tsx` and `src/components/illustrations/LongTermEmpty.tsx`) — each a self-contained `<svg viewBox="0 0 240 160">` ~3 KB serialized, drawn with stroke + fill tokens from theme.css (`var(--accent)`, `var(--text-dim)`, `var(--border)`) so they adapt to light/dark; updates each empty-state container to render the illustration above the existing text, plus a primary CTA `<button>` styled with `.btn-primary` (existing class) that focuses the section's add-task input on click (`document.getElementById('gantt-add-task-input')?.focus()` or equivalent); paired with the dual-guard reduced-motion convention if any subtle SVG animations are introduced (e.g. a slow fade-in on mount)
Then opening the Gantt section with zero tasks shows a soft illustration + "Add your first task" CTA above the existing instructional text; same for LongTerm; clicking the CTA focuses the section's add-task input; illustrations re-color correctly when the user toggles light/dark theme (because they use `var(--accent)` / `var(--text-dim)` tokens, not hex literals); `npm run build` passes with the two new files; the initial chunk delta is ≤ 2 KB (SVGs ship as JSX, gzipped well)

Specialist: Visual reviewer — confirm illustrations work in both light and dark themes; confirm the CTA button styling matches existing primary buttons; confirm the illustrations don't dominate the section header layout at narrow viewports (390 px); confirm the illustration → text → CTA vertical rhythm reads as a coherent layout group

---
