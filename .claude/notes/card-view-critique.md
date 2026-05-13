# Adversarial Critique: Card View Feature

## Verdict

**Do not declare done.** The build passes, the visual scaffold is largely in
place, and the bundle accounting holds (the lazy `TodoCardSection` /
`RemindersCardSection` chunks are ~1.7 kB and 2.4 kB gzipped — well under
budget). But there are two CRITICAL correctness bugs (orphan cleanup gap;
stale-closure z-bump race), four HIGH-severity behavior failures (initial
render snaps every card to 0,0 on first paint due to a race between
`ensureInitialLayout` and the first `renderCard`; the "Reset layout" button
nukes positions for *all* sections, not just the current one; archived sprint
cleanup is missing entirely; live preview during settings cancel does not
revert the canvas's live positions), plus three concerning UX/architecture
findings flagged by the user (no shared card primitive; cascade `+150 px`
new-item math is a guess, not derived from real card height; the dev plan's
hint that grid size should be configurable was discarded silently). About
6–10 hours of focused fix-up work, then it can ship.

## Browser preview observations

**Could not run a live browser preview.** No Chrome browser is connected to
`mcp__Claude_in_Chrome` (`list_connected_browsers` returned `[]`), and
creating a `.claude/launch.json` to spin up the Vite dev server through
`mcp__Claude_Preview__preview_start` was denied by the harness as
out-of-scope for a critique task. The build itself passes
(`npm run build` → `dist/assets/index.html-CPXXJyUe.js 198.51 kB │ gzip:
62.58 kB`), and the three lazy card chunks split out cleanly:
`TodoCardSection 3.86 kB`, `RemindersCardSection 7.04 kB`,
`cardLayouts.css 5.09 kB`. All other findings are from a code read against
the two planning docs.

## Severity-graded findings

### CRITICAL

**C1. Orphan `cardLayouts` entries leak forever from `SprintManager.deleteTodo`.**
`src/sections/sprint/SprintManager.tsx:538-541` deletes the todo but
explicitly skips the cleanup:
```
const deleteTodo = async (id: string) => {
  // NOTE: orphan cardLayouts entry is cleaned up lazily (see technical plan §11).
  await update((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
};
```
The technical plan §11 says "*lazily* is fine and avoids an expensive O(n)
operation on every page load," but that comment is about
`storage.get()`-time GC for *pre-existing* state — it is NOT a license to
skip cleanup on a known-id deletion. Compare against
`TodoList.remove()` (`src/sections/TodoList.tsx:110-123`) and
`RemindersManager.deleteReminder()`
(`src/sections/reminders/RemindersManager.tsx:369-382`), which both clean
the entry. SprintManager is the divergent path. Worse: the same
`deleteTodo` is reused for archived sprint task deletion
(`SprintManager.tsx:704`), so deleting an old archived task that was once
seen in card mode also leaks. **Fix:** lift a shared helper
`removeWithCardLayout(id)` out of the three sites (see Code Structure
audit below) and use it everywhere.

**C2. z-order bump on `onDragStart` is dropped by the snap commit in
`handleDragEnd`.** In both `TodoCardSection.tsx:132-147` and
`RemindersCardSection.tsx:341-356`:
- `handleDragStart` sets `localPositions[id] = { ...current, z: maxZ + 1 }`
- `DraggableCard.commitDrag` calls `onDragEnd(id, snapped)` with
  `snapped.z = position.z` (the *prop* value — i.e. the value at the time
  the move started, not the bumped value)
- `handleDragEnd` then does
  `{ ...pos, z: (localPositions[id]?.z ?? pos.z) }` — this looks like it
  recovers the bumped z, BUT only because `setLocalPositions` happens to
  still hold it. However `handlePositionChange` is called by
  `DraggableCard.commitDrag` *before* `onDragEnd`, and it OVERWRITES
  `localPositions[id]` with `snapped` (z = original). React batches state
  updates, so by the time `handleDragEnd` reads `localPositions[id]?.z`
  inside its `useCallback`, it captures the *stale* `localPositions` from
  the closure (the one before the drag-start z-bump). Bottom line: every
  written `cardLayouts[id].z` equals the *previous* z — the bring-to-front
  effect is lost the moment the user lets go of the mouse.

  Verify by reading the flow:
  - `DraggableCard.handlePointerDown` → `onDragStart?.(itemId)` → parent
    sets `localPositions[id].z = maxZ+1` (async).
  - `DraggableCard.commitDrag` → `onPositionChange(id, snapped)` (snapped.z
    = `position.z` = original z, NOT the bumped one) → parent
    `setLocalPositions(prev => ({ ...prev, [id]: snapped }))` (overwrites z!).
  - `DraggableCard.commitDrag` → `onDragEnd?.(itemId, snapped)` → parent
    `handleDragEnd` reads `localPositions[id]?.z` from a stale closure that
    predates both the drag-start z bump and the just-committed snap.

  **Fix:** have `DraggableCard` accept the parent's current z and emit
  `{ ...snapped, z: dragRef.current.bumpedZ }` from `commitDrag`, OR have
  the parent compute z server-side in the `setCardPosition` updater:
  ```
  await update(s => {
    const prev = s.cardLayouts?.[id]?.z ?? 0;
    const maxZ = Math.max(...Object.values(s.cardLayouts ?? {}).map(p => p.z), 0);
    return setCardPosition(id, { ...pos, z: maxZ + 1 })(s);
  });
  ```

### HIGH

**H1. Initial-render race: the first paint shows every unsaved card at
`(0, 0)`, stacked on top of each other.** `TodoCardSection.tsx:253-262`:
```
<div ref={(el) => {
  canvasElRef.current = el?.parentElement as HTMLDivElement | null;
  if (el && scopedItems.some((t) => !cardLayouts?.[t.id])) {
    void ensureInitialLayout();
  }
}} />
```
- The ref callback fires during the first render. `ensureInitialLayout()`
  is async (`await update(...)`).
- `scopedItems.map(renderCard)` runs in the *same* synchronous render and
  calls `getPosition(t.id)` → `localPositions[t.id] ?? cardLayouts?.[t.id]
  ?? { x: 0, y: 0, z: 0 }`. All un-positioned cards collapse to (0, 0, 0).
- Once `ensureInitialLayout` resolves and `update()` flushes, the next
  render shows the cascade. Net effect: a visible flash where the cards
  all stack on the top-left, then jump into a waterfall.
- The plan (`card-view-technical.md` §3 "Initial position when switching
  list → card mode") says: "This is computed once, *lazily*, the first
  time `layoutMode === "card"` and `cardLayouts` has no entry for the
  items in that section. The result is *immediately written to storage*."
  The "immediately" is correct in intent but the implementation has a
  one-frame race.

  **Fix:** compute the cascade synchronously into `localPositions` on the
  first render (no `await update`), then debounce the persistence into the
  next microtask. Or use `useLayoutEffect` to compute + apply before paint.

**H2. "Reset layout" wipes positions for items in OTHER sections too,
when those items share ids... wait, items don't, but it still wipes too
much.** `TodoCardSection.handleResetLayout` (line 149-153) calls
`resetCardPositions(scopedItems.map(t => t.id))`. `scopedItems` is the
list filtered by `scope === "today"` (or "long" or "sprint"). That's
correct *for that scope*. But because the same `TodoCardSection` is
mounted in two places simultaneously (Today and LongTerm — and a sprint
instance via `SprintCardSection`), each one's "Reset layout" button only
resets *its own* items — which is the right behavior. **However**, the
real H2 bug: `RemindersCardSection.handleResetLayout` (line 358-362)
resets `allReminders.map(r => r.id)` — which is fine, but the cascade
re-layout on next render dumps fired and upcoming reminders into a single
flow with no separator (matches the design plan, fine), AND it doesn't
guard against the in-flight `ensureInitialLayout` ref firing again right
after the reset. Watch the sequence: user clicks Reset → state has no
positions for any reminder → next render → ref callback fires →
`ensureInitialLayout` runs → cascade re-written. So Reset works, but the
flash from H1 reappears on every Reset. Demote to MEDIUM if you don't
care about flash.

**H3. Archived sprint task deletion never cleans card layouts and there's
no card mode for archived tasks anyway — but a stale card layout entry
left from when the task was in the active sprint persists.** The plan
explicitly says archived sprints stay list-only (`card-view-design.md` §4
"Archived sprints always render in list mode"). The implementation
correctly avoids rendering them in card mode. But the *position* the
task acquired while it was in the active sprint sticks around in
`state.cardLayouts` forever, since (a) deleteTodo doesn't clean it (C1),
and (b) sprint archival is just a date passage with no explicit migration.
At the scale of the user's personal use this is benign; at 1,000 sprints
over years, it's a slow growth. Recommend a periodic GC pass on
`storage.get()` (the plan flagged this as a follow-up and it was punted).

**H4. Live preview cancel doesn't revert the canvas's per-section
`localPositions`.** The settings modal uses the snapshot-restore pattern
for `live("layoutMode", v)` — Cancel restores the previous `layoutMode`.
But once the user has dragged cards while the modal was open (mode flipped
to "card", they dragged a card, then hit Cancel), the card-mode chunk has
already loaded, `cardLayouts` got an entry written via `handleDragEnd`,
and the user's snapshot restore reverts `layoutMode` to "list" but the
`cardLayouts` entry persists. On re-enter the new positions are silently
"saved" with no user intent. Surprising? Probably yes. **Fix:** Cancel
should restore `cardLayouts` too — or, more pragmatically, accept this
asymmetry but document it. The settings modal already saves a snapshot of
the *full* `state.settings`; extending the snapshot to include
`cardLayouts` is the cleanest fix.

**H5. The `useMemo`-with-setState in `RemindersManager.tsx:188-197` is an
anti-pattern.** The user specifically flagged it. `useMemo` here is being
used as a side-effect runner for "reset on open" — it's not a pure
derivation. The eslint-disable is a tell. **Fix:** convert to
`useEffect(() => { if (open) { /* resets */ } }, [open, reminder.id]);` —
same code path, correct semantics, no lint suppression needed. This
predates the card-view feature but adjacent to it.

**H6. The cascade layout's "offset below already-placed cards" math is
arbitrary and breaks when cards are dragged anywhere above their default
row.** `TodoCardSection.tsx:96-104` and identical in
`RemindersCardSection.tsx:311-321`:
```
let offsetY = 0;
for (const t of scopedItems) {
  const pos = cardLayouts?.[t.id];
  if (pos) offsetY = Math.max(offsetY, pos.y + 150);
}
```
The `+150` is a magic number (the technical plan suggested `CARD_H = 120
px` and `GAP = 16px` → 136 px). Worse: if the user has dragged any card
to a large `y` (say y=2000 because they like a vertical stack), the next
newly-added item lands at y=2150 — far off-screen. **Fix:** use the
*minimum* free row, not max + 150. Or accept the off-screen placement but
auto-scroll the canvas to the new card.

### MEDIUM

**M1. Lazy fallback during chunk load is `<div className="section-empty">Loading cards…</div>` in TodoList**
(`TodoList.tsx:165`) but `<Suspense fallback={null}>` in SprintManager
(`SprintManager.tsx:671`) and RemindersManager (`RemindersManager.tsx:418`).
Inconsistency. Pick one — recommend the visible "Loading cards…" for
discoverability, or `null` (the chunk is tiny enough that the flash is
imperceptible) for cleanliness — and apply uniformly.

**M2. `noUncheckedIndexedAccess` strictness leak in
`computeCascadeLayout`.** `cardLayouts.ts:80-89` writes
`result[id] = { x, y, z: 0 }` then immediately reads back via
`cascade[id]` in the section files. Under strict indexing this is
`CardPosition | undefined`; the code guards with `if (entry) entry.y +=
offsetY` (`TodoCardSection.tsx:103`). Fine at the call site, but it
should be the helper's job to expose a non-undefined accessor (return a
`Map<string, CardPosition>` instead of `Record<string, CardPosition>`).
Minor.

**M3. Drag-then-keyboard-nudge regresses state.** `DraggableCard`:
- Pointer drag: live updates via `applyPosition` (direct DOM mutation).
- Keyboard nudge: updates `position` prop via `onPositionChange` and ALSO
  calls `applyPosition(newX, newY)`. But the keyboard handler also calls
  `onDragEnd(itemId, newPos)` (line 203), which writes to storage on
  *every keystroke*. The plan §8 accepted this ("individual storage
  writes are cheap, ~40 kB JSON serialization is sub-ms"). Acceptable, but
  the user holding an arrow key triggers 30 storage writes/sec — each one
  triggers the `chrome.storage.onChanged` listener which broadcasts to
  every open new tab. **Fix:** debounce keyboard nudges by 200 ms or only
  call `onDragEnd` on `keyup`.

**M4. `DraggableCard` `is-dragging` class added via direct `classList`
manipulation, not via React state.** `DraggableCard.tsx:99-104` reaches
through `elRef.current.classList.add("is-dragging")` AND walks the DOM
tree via `el.closest(".card-canvas")` to toggle a class on the canvas.
This works but breaks if React reconciles the canvas (e.g. moving it in
the tree). The technical plan called this approach the "imperative DOM
updates" alternative and recommended only as an optimization. The chosen
approach mixes both — React state for position, imperative classList for
visual. **Fix:** track `isDragging` as React state in the parent
`CardCanvas` (or via context) and pass it down.

**M5. Pointer capture not released on unmount mid-drag.** If a card is
unmounted while being dragged (e.g. user deletes the very card they're
dragging via keyboard, or `scope` change moves it to another section
that's currently in list mode), `dragRef.current` and the pointer capture
both leak. No `useEffect(() => () => releasePointerCapture(...))` cleanup
exists. Edge case but real.

**M6. Two cards at the same id (e.g., import a backup with cardLayouts
keyed by ids that no longer exist).** `exportImport.ts` round-trips
`cardLayouts` via `{ ...EMPTY_STATE, ...raw }` (line 100). But unlike
`tags`, there's no validation pass that drops orphan position entries.
Importing a backup from a different device yields a `cardLayouts` map
with positions for items that may or may not exist now. Layout still
works (orphans are simply ignored) but the map grows without bound.
Recommend filtering `cardLayouts` against current `todos`/`reminders` ids
in `importData`.

**M7. `localPositions` is never garbage-collected when a todo is deleted.**
`TodoCardSection.handlePositionChange` adds entries on every drag-end.
Deleting a todo removes it from `scopedItems` but the `localPositions[id]`
entry persists for the lifetime of the section mount. A long-lived new
tab page with many drags accumulates dead keys. Trivial leak but worth
noting.

**M8. The arrow-key nudge in `DraggableCard.handleKeyDown` does not
respect `e.repeat`.** Holding the key fires native repeat ~30/s, and each
press triggers a storage write. Combine with M3. **Fix:** ignore
`e.repeat ? null : nudge` OR debounce.

**M9. Empty-state copy mismatch.** The design plan §11 "Copy Deck"
specifies per-section empty copy (`"Nothing due today. Add a task above
to get started."` etc.). The implementation uses the generic `emptyHint`
prop passed in — and `TodoCardSection.tsx:266-278` renders it in absolute
center. But the prop is the *list-mode* hint string supplied by
`TodoList`. Reminder card section uses a hardcoded `"No reminders yet.
Add one above."`. Spot-check that `Today.tsx` / `LongTerm.tsx` pass copy
that reads sensibly in card mode (centered, no surrounding text).

**M10. Drag past viewport edge: vertical scroll is fine (canvas
auto-expands via `canvasMinHeight`) but **horizontal drag past right edge
clips the card off the canvas**. There is no horizontal scroll on the
canvas (the technical plan §5 said "Recommend: initially clip, add
horizontal scroll as an enhancement"). The card stays alive in state at
e.g. x=2000 but is visually unreachable except by re-clicking via tab.
Fine for v1 but mention it.

**M11. The `card-fallback-list` at narrow viewport renders the *list*
items in DOM alongside the card canvas (just hidden via CSS).** Means
React still constructs every TodoItem React tree, just behind
`display: none`. At 500 cards this double-mounts. Acceptable cost
(virtualization is overkill here) but worth noting.

### LOW

**L1.** `<CardCanvas>` uses `aria-description` (line 30). That attribute
is *experimental and not widely supported*. Most screen readers ignore
it. The plan said to use it; the practical fix is `aria-describedby`
pointing to a visually hidden span — or accept the design plan's wording
and live with patchy SR support.

**L2.** `card-onboarding-hint` is shown "once per mount (session)" but
state lives on `useState`, not `chrome.storage.local`. Switching list→
card→list→card within the same tab will *not* show it again (good); but
opening a new tab WILL show it again every time. The design plan was
ambiguous ("once per session"). Decide: per-tab (current) or per-extension
(persist `cardHintDismissed` flag in settings). Recommend per-extension.

**L3.** `task-card-fireat` uses an `<p>` with embedded `<span>` badges.
Valid HTML but the `<p>` semantic is weird here ("paragraph" of a single
time string + badges). Use `<div>`.

**L4.** No `:focus-visible` styling on the `.draggable-card` wrapper —
the focus ring lives on `.task-card`. If the wrapper gets focus (it has
`tabIndex={0}`) the ring is invisible. Inner `.task-card` doesn't have
`tabIndex`, but `:focus-within` on `.task-card` triggers from the wrapper
focus → does this actually paint the outline? Untested; verify in
browser.

**L5.** `e.preventDefault()` in `handlePointerDown` may break click on
`<input type="checkbox">` if the checkbox is the pointer target. Mitigated
by the early-return for "clicked on button/input" (line 81-82), but
verify that `e.target.closest("button, input, ...")` includes nested
custom controls.

**L6.** `forced-colors` media query in card.css (line 346-350) sets
`border: 1px solid ButtonText` but the design plan §8 also asked for
`forced-color-adjust: auto` (provided) — but the `.task-card-edit`,
`.task-card-delete` buttons aren't styled for forced-colors at all. They
will likely become invisible (transparent background + ButtonText color
might be OK, but the opacity-0 → opacity-1 hover trick won't render in
high-contrast mode).

**L7.** `setCardPosition` writes the whole `cardLayouts` object on every
drag-end. At 500 cards × 30 bytes = 15 kB serialization + full state ~40
kB = 55 kB write per drag-end. The plan judged this acceptable; agreed.
Just don't store thousands of cards.

**L8.** `applyPosition` mutates DOM during render via the ref callback
`canvasElRef.current = el?.parentElement as HTMLDivElement | null`. This
is mostly fine but the cast `as HTMLDivElement` could be wrong if the
parent isn't a div (which it is — `CardCanvas` is). Brittle.

## Code structure / abstractions audit

The user specifically asked: **"hierarchy, inheritance, factories,
abstractions."** Findings:

**A1. No shared `<TaskCard>` / `<ReminderCard>` primitive.** Three
files render visually-identical card shells:
- `TodoCardSection.renderCard` (todo cards, lines 160-227)
- `RemindersCardSection.renderCard` (reminder cards, lines 364-426)
- `RemindersCardSection.ReminderListItem` (list-mode reminders) — not
  card-mode but mirrors the layout.

Each one has its own copy of:
- `.task-card-header` + checkbox + title + edit button
- Notes section
- `task-card-tags` with `.slice(0, 3)` and `+N more` chip
- `task-card-delete` button absolute-positioned

This is the duplication the user warned about. **Recommend:** extract
`<TaskCard>` to `src/components/card/TaskCard.tsx`:
```tsx
interface TaskCardProps {
  done?: boolean;
  title: string;
  notes?: string;
  tags: Tag[];
  onToggleDone?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Slot for type-specific content (fire-at row for reminders, etc.). */
  extra?: ReactNode;
}
```
Both card sections then just compose `<TaskCard ... extra={<FireAtRow />} />`.

**A2. No shared `useDraggableSection` / `useCardLayout` hook.** Both
`TodoCardSection` and `RemindersCardSection` duplicate ~90 lines:
- `localPositions` state
- `maxZ` `useMemo`
- `getPosition` `useCallback`
- `ensureInitialLayout` `useCallback`
- `canvasMinHeight` `useMemo`
- `handlePositionChange`, `handleDragStart`, `handleDragEnd`,
  `handleResetLayout` — identical signatures

**Recommend:** extract `useCardLayout(items, cardLayouts, update)` →
returns `{ getPosition, canvasMinHeight, handlers, ensureInitialLayout }`.
Cuts ~80 lines of duplicated code per section.

**A3. `DraggableCard` prop surface leaks implementation.** It exposes
`onPositionChange` (live preview) AND `onDragStart` (z-bump) AND
`onDragEnd` (storage commit) — three callbacks where one combined
"position lifecycle" callback would do. Worse, both parents pass
`handlePositionChange` and `handleDragEnd` that *both* write into
`localPositions` (the first directly via setState, the second indirectly
via the parent's update flow). A cleaner contract: `DraggableCard`
manages its own live position internally and emits one `onCommit(id, pos)`
on release. The parent passes only the persisted position and z; the
live drag never crosses the React boundary.

**A4. `SprintCardSection` is a 115-line dispatcher with no special
sprint logic** (`SprintCardSection.tsx`). It just chooses between
`<TodoCardSection scope="sprint" .../>` and a list render. The list
render duplicates `TodoList`'s list path. **Recommend:** delete
`SprintCardSection` and call `<TodoList scope="sprint" .../>` from
`SprintManager` — except `TodoList` filters todos by scope (`t.scope ===
scope`), which doesn't compose with sprint's "only `sprintId === active`"
filter. The cleanest pattern: `TodoList` accepts a `filter` prop already
(line 36: `filter?: (t: Todo) => boolean`), and the sprint version is
`<TodoList scope="sprint" filter={t => t.sprintId === activeSprintId}
/>`. This is in fact already used elsewhere — check Today's filter for
"only today's overdue" pattern. **Net: `SprintCardSection` can be deleted
entirely.**

**A5. `cardLayouts.ts` helpers are pure functions returning state
updaters — clean.** This part follows the existing project pattern
(`src/storage/tags.ts` has the same shape). Good.

**A6. `CARD_GRID_SIZE` is a single magic constant in
`storage/constants.ts`** — fine. But it's also hardcoded into `card.css`
as `--grid-size: 8px`. If the constant changes, the CSS doesn't. Either
generate the CSS variable from JS at runtime (`document.documentElement.
style.setProperty('--grid-size', CARD_GRID_SIZE + 'px')`), or accept the
drift and document the coupling.

**A7. Snap math (`Math.round(value / grid) * grid`) lives inline in
`DraggableCard.snapTo`.** Pure two-liner — fine to inline. If it ever
sees a third call site, extract to `src/storage/cardLayouts.ts`.

**A8. Z-order math (`maxZ + 1`) is duplicated in both card sections.**
Fold into `useCardLayout` (A2) or into `setCardPosition` itself by
computing maxZ inside the updater (see C2 fix).

**A9. The cascade-layout `+offsetY for new items` logic is duplicated.**
(See H6.) Pure function — pull into `cardLayouts.ts`:
`computeCascadeLayoutFor(unsavedIds, existingLayouts, canvasWidth)`.

## Documentation gaps

- **`DraggableCard.tsx`** has a good top docblock. ✓
- **`CardCanvas.tsx`** has a docblock. ✓
- **`card.css`** has section comments. ✓
- **`cardLayouts.ts`** has good docs on the three helpers. ✓
- **`TodoCardSection.tsx`** has a top docblock. ✓
- **`SprintCardSection.tsx`** has a docblock. ✓
- **`RemindersCardSection.tsx`** has a docblock. ✓
- **Missing:** no document anywhere explains the *contract* between
  `DraggableCard` and its parent — the precise sequence of
  `onDragStart` → `onPositionChange` (many) → `onPositionChange` (final
  snap) → `onDragEnd`. The order matters (see C2). Add a "Lifecycle"
  section to `DraggableCard`'s docblock.
- **Missing:** no comment explains why `canvasElRef.current =
  el?.parentElement` instead of just refing the canvas directly. It's
  because `<CardCanvas>` doesn't forward refs, so the ref trick uses an
  absolutely-positioned dummy child. Document or fix (CardCanvas should
  `forwardRef`).
- **Missing:** the dot-grid CSS comment doesn't note that the grid
  refers to `--grid-size: 8px` from `.card-canvas` which must match
  `CARD_GRID_SIZE`. Coupling alert (A6).
- **Missing:** the cascade-layout `+150` magic number has no rationale
  comment. (H6.)

## Divergence from plans

Numbered list of differences between shipped code and the two planning docs.

**D1.** Plan promised `cardGridSize` as a user-configurable setting
(`card-view-technical.md` §3 "Grid size: global setting, configurable",
options 4/8/16 px) and `cardShowGrid` boolean. **Shipped:** hardcoded to
8 px, dot grid always on during drag (no toggle). The simplification is
arguably better, but it's an undisclosed punt.

**D2.** Plan promised the dot grid as `default off, toggled by showGrid`
(`card-view-design.md` §6 says "visible while dragging only (fade-in
dots)"). The two plans disagreed; shipped follows the design plan (fade
in during drag, no setting). Fine.

**D3.** Plan §10 (UI design plan) called for `aria-description` on
`<CardCanvas>` — present (line 30). But the plan also called for
`<article>` elements per card with `aria-label`. **Shipped:** cards are
plain `<div className="task-card">` — no `<article>` role, no
`aria-label` per card. Screen reader story is degraded vs. the plan.

**D4.** Plan called for the onboarding hint to fade out smoothly. Shipped
has no fade-out transition — clicking "Got it" snaps the hint away. Minor.

**D5.** Plan §5 (design) said `sectionId: "todo-today" | "todo-sprint" |
"todo-long" | "reminders"` would be a prop on `<DraggableCard>`. **Shipped:**
`DraggableCard` has no `sectionId` prop. The plan's intent was that
position storage be partitionable per section; the implementation chose a
flat global map (positions keyed by item id directly). This is fine
because item ids are globally unique, but it does mean the `sectionId`
abstraction never landed.

**D6.** Plan §10 specified `resetPositions(sectionId)`. **Shipped:**
`resetCardPositions(itemIds: string[])` instead. Different signature.
Functional equivalence, but the plan's contract is no longer matched if
some other agent reads the plan.

**D7.** Plan called for: "*A faint 'drag me' hint appears only on
first-ever use in card mode*." **Shipped:** hint appears every mount
(L2 above). Persistent dismissal is missing.

**D8.** Plan §11 (design) gave per-section empty copy. **Shipped:** uses
generic `emptyHint` from caller (M9).

**D9.** Plan §10 said `resolvedSettings(state.settings).layoutMode`
should be the canonical read. **Shipped:** mixed — `TodoList` uses
`resolvedSettings()` (correct), `SprintManager` and `RemindersManager`
read `state.settings.layoutMode ?? "list"` directly (raw). Functionally
identical but inconsistent. The raw read was justified in a comment in
SprintManager: "avoids importing resolvedSettings into this chunk." Bundle
analysis disagrees — `resolvedSettings` is already in `constants.ts`
which is already imported by `TodoList`.

**D10.** Plan §13 (design) "R3 — State drift: layoutMode live preview in
Settings." Plan flagged this as a risk; shipped does not handle it (see
H4).

**D11.** Plan §4 (technical) §3 said "Initial position when switching
list → card mode... The result is immediately written to storage." H1
shows this is not synchronously achieved.

**D12.** Plan said `<DraggableCard>` should add the `is-dragging` class
to itself; design plan §2 said the visual elevation lives on `.task-card`
inside. **Shipped:** matches — `.draggable-card.is-dragging .task-card`
selector handles elevation. ✓

## Things plans didn't cover (and ship doesn't either)

- **Scope change via edit modal.** User changes a todo's `scope` from
  "today" → "sprint". Its `cardLayouts[id]` entry persists. Next render
  in the sprint canvas, the card teleports to the today-canvas-saved
  coordinates. Surprising if x=850 (which would be off-screen in a
  narrower sprint canvas). **Recommend:** on `scope` change, clear the
  position entry to force a fresh cascade slot in the new section.
- **Fired reminders staying in place** is shipped behavior (they get
  `is-done` styling but their position is unchanged). The design plan §4
  said "Reminders section specifics: The card canvas wraps each
  sub-section independently *or* the two groups share one canvas with a
  visual divider." Shipped: one shared canvas, no divider. Plausible but
  the user might expect fired items to migrate to a "discarded" zone.
  Document and confirm with user.
- **Two tabs of the same extension:** drag in tab A → `chrome.storage.
  onChanged` fires in tab B → `useStore` updates `cardLayouts` → tab B
  re-renders the card to the new position. *During* tab A's drag, however,
  only `cardLayouts` updates (after pointer-up). The intermediate
  positions are local to tab A. Tab B doesn't see the live preview — it
  just sees the final snapped position appear. Probably fine but worth
  testing.
- **Browser resize during drag.** No handler — the canvas width changes,
  the cascade is computed once at first render, the dragging card is
  unaffected. Acceptable.
- **Two cards at the exact same grid position** (overlap) → z-order
  determines visibility. Shipped allows overlap (plan §3 "Overlap:
  allowed, not prevented"). ✓
- **Importing JSON with `cardLayouts` keyed by items that no longer
  exist** (M6 above) — orphans accumulate silently. The tag-import path
  drops unknown tag references with a `console.warn`; the card-layouts
  import path doesn't. Worth a one-liner filter pass in `exportImport.ts`.

## Recommended fixer agenda

Priority order. The first four are mandatory for "done."

1. **Fix C2 — z-order bring-to-front bug.** Either (a) thread the
   bumped-z through `DraggableCard.commitDrag` so `onDragEnd` receives the
   correct z, or (b) compute `maxZ + 1` inside the `setCardPosition`
   updater so it's race-free. Option (b) is cleaner.
2. **Fix C1 — SprintManager.deleteTodo cleanup.** Make `deleteTodo` clean
   the orphan entry. Same shape as `TodoList.remove` and
   `RemindersManager.deleteReminder`. While you're there, extract a
   shared helper `removeCardLayoutEntry(s, id)` in `cardLayouts.ts` and
   use it from all three sites.
3. **Fix H1 — initial cascade race.** Compute and apply the cascade
   *synchronously* into `localPositions` on first render via
   `useLayoutEffect`, then persist via `update` in a microtask. Eliminates
   the one-frame stack-at-origin flash.
4. **Fix H4 — Settings Cancel doesn't restore cardLayouts.** Extend the
   settings snapshot to include `cardLayouts` (or guard live drag writes
   while the settings modal is open).
5. **A1 + A2 — extract `<TaskCard>` and `useCardLayout`.** This addresses
   the user's explicit "factories / abstractions / inheritance" concern.
   Cuts ~160 lines of duplication.
6. **A4 — delete `SprintCardSection`.** Use `<TodoList scope="sprint"
   filter={...}>` directly from `SprintManager`. Same behavior, less code.
7. **H5 — replace `useMemo`+setState anti-pattern with `useEffect`** in
   `RemindersManager.tsx:188-197`.
8. **D7 + L2 — persist hint dismissal** to `state.settings.cardHintSeen`.
9. **M6 — filter `cardLayouts` in `importData`** against known item ids,
   with a `console.warn` per dropped key (mirror the tag-import path).
10. **H6 — fix cascade `+150` magic number** by either computing from
    real measured heights, or by placing new items at the next-empty grid
    slot (lowest x where y-rows have headroom).
11. **A3 — clean up `DraggableCard` prop surface.** Collapse the three
    callbacks into one. Internal live position; emit one `onCommit`.
12. **D9 — unify settings read.** All three section managers use
    `resolvedSettings(state.settings).layoutMode`.
13. **M3 + M8 — debounce keyboard nudges** so holding an arrow key
    doesn't generate 30 storage writes/sec.
14. **L1 + D3 — accessibility pass.** Add `role="article"` and
    `aria-label` to cards. Replace `aria-description` (experimental) with
    a visually-hidden label referenced by `aria-describedby`. Verify
    `forced-colors` rendering of the hover-revealed buttons (L6).
15. **D5 + D6 — reconcile plan/code naming.** Either update the plans to
    match shipped code or rename `resetCardPositions` →
    `resetCardPositionsFor(itemIds)` and document why `sectionId` was
    dropped.

After this list, ship.
