# Implement synthesis — frontend-uplift-2026q2-m9

## Built

- **AC1** — `src/components/illustrations/GanttEmpty.tsx` created: inline SVG (`viewBox="0 0 240 160"`, `aria-hidden="true"`, `focusable="false"`) with horizontal axis, accent today-line, 3 staggered rounded-rect bars. All strokes use `var(--text-dim)` / `var(--accent)`. Props: `{ onAddTask: () => void }`.
- **AC2** — `src/components/illustrations/LongTermEmpty.tsx` created: inline SVG with 3 bullet+line rows; rows 1–2 in `var(--text-dim)`, row 3 in `var(--accent)` + chevron arrow at end. Props: `{ onAddTask: () => void }`.
- **AC3** — `.btn-primary` defined in `src/sections/sections.css` with `background: var(--accent); border: 1px solid var(--accent); color: var(--accent-on); font-weight: 500; padding: 8px 14px; border-radius: var(--radius); cursor: pointer;`.
- **AC4** — `.section-empty-inner` (flex column, `gap: 12px`) and `.section-empty-illustration` (`max-width: 200px; width: 100%; height: auto`) added to `sections.css`.
- **AC5** — `src/sections/gantt/ChartView.tsx`: `addInputRef = useRef<HTMLInputElement>(null)` added inside `ChartView()`, attached to the `<input placeholder="New task…">`. Empty-state at line ~489 replaced: `<div className="section-empty"><GanttEmpty onAddTask={() => addInputRef.current?.focus()} /></div>`.
- **AC6** — `src/sections/TodoList.tsx`: `useCallback` + `ReactNode` imported; `emptyIllustration?: (focusInput: () => void) => ReactNode` added to `Props`; `addInputRef` declared + attached to main `<input>`; `focusInput = useCallback(() => addInputRef.current?.focus(), [])` added; plain-empty branch renders `emptyIllustration(focusInput)` when prop present, `emptyHint` otherwise. Tag-filter branch unchanged.
- **AC7** — `src/sections/LongTerm.tsx`: imports `LongTermEmpty`; passes `emptyIllustration={(focusInput) => <LongTermEmpty onAddTask={focusInput} />}` to `<TodoList>`.
- **AC8** — Today.tsx, Sprint.tsx, TodoCardSection.tsx, Gantt.tsx left untouched. `emptyHint: string` prop on `TodoList` and `TodoCardSection` unchanged.

## Branching note

Committed to `main` directly per CLAUDE.md § Branching ("All work — including Claude-assisted work — runs directly on `main`."). The main worktree already had `main` checked out; the worktree-agent branch (`worktree-agent-ad0b667a3cf7c3cc0`) was left at base SHA `8cbea01c4a3721497a5cecb91744bee26ea591e3` as expected.

## Architecture decisions

- **`.btn-primary` in `sections.css`** — chose `sections.css` over `index.css` (brief-2 §4.1 recommended `sections.css`; the synthesis confirmed this). Uses `var(--accent-on)` not the literal `#0b0e14` that `modal-btn-primary` uses, for theme parity.
- **Function-prop pattern** (`emptyIllustration?: (focusInput: () => void) => ReactNode`) per synthesis §3.3 Option B — TodoList owns the ref, caller builds the illustration JSX. Minimal coupling, single-direction data flow.
- **`section-empty-inner` wrapper** — inner wrapper avoids layout impact on the 8+ other `.section-empty` usages (which have no flex layout today). SVG constrained via `.section-empty-illustration` CSS class.
- **No `id` attributes on inputs** — `useRef` per instance, per brief-2 §3.4. Multi-chart safety guaranteed.

## Files touched

- `src/components/illustrations/GanttEmpty.tsx` — NEW: Gantt empty-state illustration + CTA (32 lines)
- `src/components/illustrations/LongTermEmpty.tsx` — NEW: LongTerm empty-state illustration + CTA (32 lines)
- `src/sections/sections.css` — MODIFIED: add `.btn-primary`, `.section-empty-inner`, `.section-empty-illustration` (+47 lines)
- `src/sections/gantt/ChartView.tsx` — MODIFIED: import GanttEmpty, add `addInputRef`, attach ref, replace empty-state body (+5 lines, -1 line)
- `src/sections/TodoList.tsx` — MODIFIED: import `useCallback`+`ReactNode`, add `emptyIllustration` prop, add `addInputRef`+`focusInput`, attach ref, update empty-state branch (+13 lines, -3 lines)
- `src/sections/LongTerm.tsx` — MODIFIED: import LongTermEmpty, pass `emptyIllustration` prop (+4 lines)

Total: 6 files changed, 129 insertions(+), 4 deletions(−)

## Deferred

- Card mode illustration for LongTerm — explicitly out of scope per synthesis §3.12. `TodoCardSection.tsx` keeps its string `emptyHint` rendering.
- Gantt.tsx "no charts" state (`Gantt.tsx:94`) — different semantic; already has a CTA; out of scope per synthesis §3.4.
- Reduced-motion fade-in animation on empty-state container — static illustrations, no animation; synthesis §3.11 deferred this.
- Sprint / Today illustrations — not in m9 scope.

## external_writes_required

- git push origin main

## Test deltas

No test files added or changed. m9 carries forward the m1 L5 pattern (no dedicated test suite for new UI components in this project). Smoke testing is manual (dev server + extension load).

## Check matrix results

- build (`npm run build`): PASS — zero TypeScript errors; initial chunk 303.89 kB raw / 96.76 kB gz (within 400/500 kB ceiling; ~2 kB delta from baseline)
- workflows: SKIP (no `.github/workflows/**` touched)
- lfs: SKIP (no `.gitattributes` touched)
- git status: clean (only unrelated Phase-1 researcher memory + milestone notes directory untracked)
