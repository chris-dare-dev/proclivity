# Card View — Technical Foundation

**Status:** Research & planning  
**Author:** Technical agent (card-view-tech)  
**Sibling agent:** UI/UX agent (card-view-ui) — coordinate on integration points flagged in §9  
**Date:** 2026-05-12

---

## 1. Library landscape

### Summary table

| Library | Min size | Min+gz | Last release | Free-form? | Grid snap? | Notes |
|---|---|---|---|---|---|---|
| `@dnd-kit/core` v6.3.1 | ~21 kB | ~10 kB | Apr 2026 | Yes (manual delta tracking) | DIY | Modular, no deps; free-form requires state management pattern |
| `react-dnd` v16 | ~51 kB | ~17 kB | ~2023 | Yes | DIY | Not tree-shakeable (GitHub #1365); HTML5 backend adds more |
| `react-draggable` v4.4.6 | ~6 kB | ~2.5 kB | 2022 (stale) | Yes | DIY | Simplest API; last commit 2022, unmaintained |
| `react-rnd` v10.5.2 | ~25 kB | ~8 kB | 2024 | Yes (+ resize) | No built-in | Wraps react-draggable; adds resize handles |
| `interact.js` v1.10.27 | ~60 kB | ~22 kB | 2024 (stale) | Yes | Yes (built-in snappers.grid) | Framework-agnostic; large; not React-native |
| `swapy` v1.0.5 | ~22 kB | ~8 kB | Jan 2025 | **No** — swap-slots only | N/A | "Drag to swap layouts" — wrong primitive |
| `framer-motion` (domMax) | ~85 kB | ~25 kB | Active | Yes (drag constraint prop) | DIY | `domMax` required for drag; snap = manual; huge |
| `react-grid-layout` v2.x | ~90 kB | ~30 kB | 2024 | Grid-constrained only | Yes (grid cells) | Column-grid model, not pixel-free; overkill |
| `react-mosaic` | ~120 kB | ~40 kB | 2023 | Tiling/panels only | N/A | Panel manager, wrong abstraction |
| HTML5 DnD API | 0 kB | 0 kB | N/A | No (no position control) | No | No live preview; broken on mobile; cursor artifacts |
| Plain pointer events | 0 kB | 0 kB | N/A | **Yes** | **Yes (trivial)** | Already in this codebase (Gantt) |

### Detailed notes per library

**`@dnd-kit/core`**  
The most popular modern choice. Architecture is correct (sensor abstraction, collision detection, accessibility). However, free-form absolute positioning is not a first-class citizen — Discussion #1180 confirms you must track x/y delta yourself in `onDragEnd` and apply it to stored coordinates. For card-mode, this means you'd use dnd-kit as a thin wrapper around… essentially the same state machine you'd write anyway. The abstraction cost (~10 kB gzipped on a 1.36 kB budget) is not justified when the abstraction doesn't help with the hard part. Grid snap is also DIY.

**`react-draggable`**  
The most API-minimal option for free-form drag. Provides controlled `position` prop + `onStop` callback — exactly the shape needed. But: last published 2022, issues repo shows no maintainer activity, one security advisory open. Not a safe long-term dependency.

**`react-rnd`**  
Extends react-draggable with resize handles. Useful if cards need resizing, but the feature brief says nothing about resizing — and it inherits react-draggable's maintenance problem.

**`interact.js`**  
The only library with **built-in** grid snapping (`interact.snappers.grid()`). Large (~22 kB gzipped) and framework-agnostic (imperative DOM manipulation doesn't compose naturally with React state). Last commit 2024 but release cadence has slowed. Not worth the integration complexity.

**`swapy`**  
Explicitly designed for "drag to swap slots" — items move into each other's positions. This is the opposite of what the user wants ("move cards wherever"). Hard no.

**`framer-motion`**  
`motion.div` with `drag` prop does handle free-form positioning. But the `domMax` feature package (needed for drag + layout) costs +25 kB gzipped minimum, and `LazyMotion` only helps if the *rest* of the app isn't already importing framer-motion — it isn't (zero current dependency). Snap points require custom code (`dragSnapToOrigin` exists but isn't a grid snapper). Not worth it.

**`react-grid-layout`**  
Column-grid model. Items are sized in grid-column units, not pixels. It is explicitly a dashboard layout tool, not a free-form canvas. The "wherever" user request is incompatible with this model. At ~30 kB gzipped it's also a budget killer.

**HTML5 Drag-and-Drop API**  
No live drag preview in the standard implementation, broken on iOS, no pointer-capture semantics, no coordinate access during drag. Excluded.

**Plain pointer events**  
Zero bundle cost. Already proven in `ChartView.tsx` with `setPointerCapture`, `onPointerDown/Move/Up`, `useRef` for drag state, `useState` for live preview, commit on pointer-up. Grid snap is four lines of math. Touch is handled transparently by the Pointer Events spec. This is the correct choice.

---

## 2. Recommendation: Custom pointer-drag (same pattern as Gantt)

**Decision: no new library.** Implement a `<DraggableCard>` component using the pointer events pattern from `ChartView.tsx`.

Justification against each criterion:

- **Bundle cost:** 0 kB added. The budget is 1.36 kB. Every listed library except the null-cost approaches exceeds this. Even @dnd-kit/core at ~10 kB gzipped is 7× over budget.
- **Free-form positioning:** Pointer events give raw `clientX/Y` — the exact input needed for pixel-precise absolute positioning. Library abstractions that compute a "delta" and make you manage position yourself are equivalent in code complexity.
- **Grid snap:** `Math.round(x / gridSize) * gridSize` — four characters per axis. No library needed.
- **Keyboard accessibility:** `onKeyDown` with arrow key handling is trivial and already patterned (Gantt's Escape handler). Arrow-key nudging by `gridSize` pixels is more precise than any library default.
- **Existing pattern:** `ChartView.tsx` is a 630-line, battle-tested reference. The `dragRef`, `dragPreview` state, `setPointerCapture`, pointer-up commit, and Escape revert pattern are already understood and working. Copying the shape (not the code) means the implementor has a concrete, in-project example to follow.

### Code skeleton — `DraggableCard` (~100 lines)

```tsx
// src/components/card/DraggableCard.tsx

import { useRef, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";

export interface CardPosition {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
}

interface Props {
  itemId: string;
  position: CardPosition;
  gridSize: number;
  onPositionChange: (id: string, pos: CardPosition) => void;
  /** Called when drag starts (optional — for z-order promotion). */
  onDragStart?: ((id: string) => void) | undefined;
  /** Called when drag ends (optional — for z-order demotion or analytics). */
  onDragEnd?: ((id: string, pos: CardPosition) => void) | undefined;
  children: ReactNode;
  className?: string | undefined;
}

function snapTo(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function DraggableCard({
  itemId,
  position,
  gridSize,
  onPositionChange,
  onDragStart,
  onDragEnd,
  children,
  className,
}: Props) {
  const dragRef = useRef<DragState | null>(null);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;             // left-button only
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();                      // prevent text selection

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    onDragStart?.(itemId);
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    // Live preview: raw pixel delta — no snap during move (feels responsive).
    // Snap only on commit so the card doesn't jitter while dragging.
    const rawX = drag.origX + (e.clientX - drag.startClientX);
    const rawY = drag.origY + (e.clientY - drag.startClientY);

    // Clamp to canvas bounds (canvas parent must have position:relative).
    // Bounds clamping is handled in the parent canvas — see §5.
    // Here we emit the raw pre-snap position for the live preview.
    onPositionChange(itemId, { x: rawX, y: rawY });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    document.body.style.userSelect = "";

    // Commit with snap on release.
    const rawX = drag.origX + (e.clientX - drag.startClientX);
    const rawY = drag.origY + (e.clientY - drag.startClientY);
    const snapped: CardPosition = {
      x: Math.max(0, snapTo(rawX, gridSize)),
      y: Math.max(0, snapTo(rawY, gridSize)),
    };

    onPositionChange(itemId, snapped);
    onDragEnd?.(itemId, snapped);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      if (e.key === "Escape") {
        const drag = dragRef.current;
        dragRef.current = null;
        document.body.style.userSelect = "";
        // Revert to original position
        onPositionChange(itemId, { x: drag.origX, y: drag.origY });
        try {
          e.currentTarget.releasePointerCapture(drag.pointerId);
        } catch { /* already released */ }
      }
      return;
    }

    // Keyboard nudge — move by one grid unit per key press
    const nudge = gridSize;
    if (e.key === "ArrowLeft")  { e.preventDefault(); onPositionChange(itemId, { x: Math.max(0, position.x - nudge), y: position.y }); }
    if (e.key === "ArrowRight") { e.preventDefault(); onPositionChange(itemId, { x: position.x + nudge, y: position.y }); }
    if (e.key === "ArrowUp")    { e.preventDefault(); onPositionChange(itemId, { x: position.x, y: Math.max(0, position.y - nudge) }); }
    if (e.key === "ArrowDown")  { e.preventDefault(); onPositionChange(itemId, { x: position.x, y: position.y + nudge }); }
  };

  return (
    <div
      className={`draggable-card${className ? ` ${className}` : ""}`}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        cursor: dragRef.current ? "grabbing" : "grab",
        touchAction: "none",    // required for pointer capture on touch
      }}
      tabIndex={0}
      role="button"
      aria-label="Drag to reposition"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}  // treat cancel like up (device sleep, etc.)
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
```

**Two design notes:**

1. The live preview emits raw (un-snapped) position during move. This is intentional — snapping during move feels laggy on fine grids. The snap fires on commit (pointer-up). This matches how professional canvas tools work (Figma, Miro).

2. `onPositionChange` is called for both live preview and final commit. The parent decides whether to write to storage. During drag, the parent should only update local React state (no `chrome.storage.local` call). On commit (triggered by `onDragEnd` or by the parent detecting the final call), it writes. See §6.

---

## 3. Position data model

### Shape choice: separate `cardLayouts` map, not per-item fields

**Decision:** Add a separate map to `ProclivityState`, not fields on `Todo` / `Reminder`.

```ts
// In ProclivityState (src/types/index.ts):
export interface CardPosition {
  x: number;
  y: number;
  /** z-order: higher = on top. Increment on focus. See §3.z-order */
  z: number;
}

export type CardLayoutMap = Record<string, CardPosition>;

// ProclivityState gains one new field:
cardLayouts?: CardLayoutMap | undefined;
```

**Why a separate map over per-item fields:**

- `exactOptionalPropertyTypes` means adding `cardPosition?: CardPosition | undefined` to `Todo` forces every `Todo` construction site to either include the field or use a type assertion. There are ~15 construction sites across `TodoList.tsx`, `SprintManager.tsx`, and `RemindersManager.tsx`. A separate map in state has zero impact on existing item construction — items simply have no entry in the map until they're first positioned.
- The map is optional on `ProclivityState` itself (`cardLayouts?`). This is safe: `undefined` means "no card layout ever saved" = list mode. The `storage.get()` backfill pattern (already used for `tags`) handles the migration automatically.
- The map key is `itemId` (string) — same for both `Todo.id` and `Reminder.id`. Since IDs are random UIDs, collisions between todos and reminders are astronomically unlikely. If a future design requires namespacing, prefix with `t:` / `r:` — but don't do this now.
- Serialization: `Record<string, CardPosition>` is compact JSON. 500 items × ~30 bytes/entry ≈ 15 kB. Well within the 10 MB cap.

### Grid size: global setting, configurable

**Decision:** Single global `cardGridSize` setting. Default: **8 px**.

The user said "very fine grid." 8 px is the standard fine-precision grid in Figma and most canvas tools. It's half the typical 16 px spacing grid, giving sub-component-level precision while still snapping neatly. Do not make it per-section — there is no use case for different grid granularity per section, and it adds settings complexity.

Add to `UserSettings` and `ResolvedUserSettings`:
```ts
// UserSettings (optional):
cardGridSize?: 4 | 8 | 16 | undefined;

// ResolvedUserSettings (required):
cardGridSize: 4 | 8 | 16;

// Default in DEFAULT_SETTINGS:
cardGridSize: 8,
```

Expose 3 choices in settings: 4 px (ultra-fine), 8 px (default), 16 px (coarse). This is more useful than a free numeric input.

### Z-order: integer per card, incremented on touch

**Decision:** Track explicit `z` integer per card. Increment the touched card's `z` to `max(all z values) + 1` on `onDragStart`.

Why not DOM order: DOM order requires reordering the array in React state, which causes all card keys to remount or forces complex reconciliation. An explicit `z` field applied as `zIndex` in the card's inline style is O(1) per interaction.

The `z` field lives in `CardPosition` (already shown above). Initialize all cards at `z: 0` during auto-layout. Each drag bumps the card to `z: currentMax + 1`. This is the "last touched comes front" behavior, which matches user expectations.

Storage implication: `z` is written to `cardLayouts` on every drag-end, same as `x`/`y`. No extra writes.

### Initial position when switching list → card mode

**Decision:** Cascade layout — row × column grid starting at top-left, ordered by the list's existing sort order (done items last, newest first).

Algorithm:
```
CARD_W = 200 px  (default card width — UI agent decides final size)
CARD_H = 120 px  (estimated; auto-calculated from content in practice)
GAP = 16 px
COLS = Math.max(1, Math.floor(canvasWidth / (CARD_W + GAP)))

items.forEach((item, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  cardLayouts[item.id] = {
    x: col * (CARD_W + GAP),
    y: row * (CARD_H + GAP),
    z: 0,
  };
});
```

This is computed once, lazily, the first time `layoutMode === "card"` and `cardLayouts` has no entry for the items in that section. The result is immediately written to storage. If `canvasWidth` isn't known at write time (SSR-like concern), default to a fixed canvas width (e.g., 800 px) and let the user rearrange.

**Alternative rejected:** Random-with-no-overlap is expensive to compute for 200+ items and produces visually chaotic initial states. Center-of-canvas stacks all cards on top of each other (worst possible default).

### Overlap: allowed, not prevented

**Decision:** Allow cards to overlap. Do not prevent it.

Prevention at 200+ items requires O(n²) collision detection on every pointer-move. The alternative (push-away physics) requires a layout engine. Both are disproportionate complexity for a personal extension. Users who want a clean layout will arrange manually. The z-order handling (last-touched comes front) makes overlap usable.

---

## 4. The Card primitive

See the code skeleton in §2 above for the full `DraggableCard` component.

**Props summary:**

```ts
interface DraggableCardProps {
  itemId: string;
  position: CardPosition;      // { x, y, z } — z applied as zIndex
  gridSize: number;            // from resolvedSettings.cardGridSize
  onPositionChange: (id: string, pos: CardPosition) => void;
  onDragStart?: ((id: string) => void) | undefined;
  onDragEnd?: ((id: string, pos: CardPosition) => void) | undefined;
  children: ReactNode;
  className?: string | undefined;
}
```

**Additional implementation notes not in the skeleton:**

- Apply `zIndex: position.z` in the inline style. This is the only way to control stacking order without DOM reordering.
- `touchAction: "none"` is mandatory on the draggable element. Without it, touch browsers intercept the pointer stream for scrolling before the drag can capture it.
- `onPointerCancel` must call the same cleanup as `onPointerUp`. A device screen lock or incoming call can cancel the pointer stream — without this handler, the card sticks to the cursor.
- The card's content (title, notes, tags, checkbox, buttons) is rendered as `children`. The `DraggableCard` wrapper knows nothing about what it contains — it is purely a position primitive.

---

## 5. The Card canvas / container

### Where the canvas lives

Each section that supports card view (`Today`, `Sprint`/active sprint tasks, `LongTerm`, `Reminders`) renders its own `<CardCanvas>` when `layoutMode === "card"`. The canvas is **not** shared across sections — sections already render independently and there is no cross-section drag use case.

`CardCanvas` is a new primitive in `src/components/card/CardCanvas.tsx`.

### Canvas sizing

```tsx
// Conceptual shape:
interface CardCanvasProps {
  items: Array<{ id: string; position: CardPosition }>;
  gridSize: number;
  showGrid: boolean;
  onPositionChange: (id: string, pos: CardPosition) => void;
  onDragStart: (id: string) => void;
  children: (itemId: string) => ReactNode;  // render-prop per item
}
```

The canvas uses `position: relative` with `min-height: 400px`. Its actual height auto-expands to `max(item.y + estimated_item_height) + padding` so the new-tab page scroll absorbs overflow naturally — the existing page scroll is reused, not a new nested scroll container.

**Width:** 100% of the section container. Cards placed beyond this width are reachable by horizontal scroll on the section container (overflow-x: auto), or the canvas clips at `min-width: 100%`. Recommend: initially clip, add horizontal scroll as an enhancement if user feedback requires it.

### Scroll behavior

The new tab page already scrolls vertically. The canvas should not introduce a second scroll context. Cards that extend below the viewport cause the page to scroll — this is correct and expected.

### Grid visualization

**Decision:** Faint dot grid, default **off**, toggled by a `showGrid` prop in settings.

A dot grid (CSS background-image with radial-gradient) at the grid pitch is the least intrusive visual aid. It doesn't create the "lined paper" density of a line grid. At 8 px pitch it's dense enough to feel precise.

CSS implementation:
```css
.card-canvas[data-show-grid="true"] {
  background-image: radial-gradient(circle, var(--card-grid-dot-color) 1px, transparent 1px);
  background-size: var(--card-grid-size) var(--card-grid-size);
}
```

Default off because most users will not need visual confirmation of the grid — the snap behavior is self-evident after the first drag.

### Recommended grid size

**8 px** (see §3). Justification: the user said "very fine," which means the precision should be at the sub-row level. 8 px is half a standard spacing unit, giving precise alignment without making it impossible to position cards by eye. 4 px is available for power users who want pixel-hunt precision.

---

## 6. Position persistence and write batching

### Pattern

Follow the Gantt pattern exactly:

1. **During drag:** call `onPositionChange` which updates a `localPositions` state map in the parent section component (or in `CardCanvas`). This is pure React state — **no `storage.update()` call**.
2. **On drag end (`onDragEnd`):** call `storage.update()` once with the final snapped position. Single write per drag gesture.

```ts
// In the section component or CardCanvas:
const [localPositions, setLocalPositions] = useState<Record<string, CardPosition>>({});

const handlePositionChange = useCallback((id: string, pos: CardPosition) => {
  // Pure local state update during drag — no I/O
  setLocalPositions(prev => ({ ...prev, [id]: pos }));
}, []);

const handleDragEnd = useCallback(async (id: string, pos: CardPosition) => {
  // Single storage write on release
  await update(s => ({
    ...s,
    cardLayouts: { ...(s.cardLayouts ?? {}), [id]: pos },
  }));
}, [update]);
```

The display position shown to the user is: `localPositions[item.id] ?? cardLayouts?.[item.id] ?? computedInitialPosition(item)`.

### The write-chain concern

`storage.update()` serializes writes through `writeChain` (a `Promise` chain in `storage.ts`). If the user drags a card and quickly drags another before the first write resolves, both writes queue correctly — each reads the latest committed state before writing. This is already the design. No change needed.

### Full-state write at 200 cards

When the user drags one card, the entire `ProclivityState` (including all todos, sprints, reminders, etc.) is serialized and written. At 200 cards with positions, estimated payload:

- 200 todos × ~120 bytes average = 24 kB
- 200 `CardPosition` entries × ~30 bytes = 6 kB
- Other state (sprints, reminders, gantt, settings) = ~10 kB
- **Total estimate: ~40 kB JSON**

This is 0.4% of the 10 MB `chrome.storage.local` cap. Well within limits. Serialization of 40 kB is sub-millisecond on any hardware that runs a Chrome extension. **Acceptable. No change to the storage layer needed.**

At 500 cards the estimate is ~95 kB — still trivially small. The concern threshold for `chrome.storage.local` is in the megabyte range.

---

## 7. Performance

### The problem

With 100–500 cards on a canvas, naively re-rendering all cards on every pointer-move event would be expensive. `onPointerMove` fires at ~60fps. 500 cards × 60 renders/sec = 30,000 renders/sec if not controlled.

### Strategy: imperative position during drag, React state on release

Mirror the Gantt's pattern: the dragging card updates its own position via a `useRef`-stored drag state — **not via React state during `onPointerMove`**. The card reads its displayed position from `localPositions[id] ?? persisted position`. During drag, only the single dragging card needs to update its DOM position. All other cards are untouched.

Implementation: use `React.memo` on `DraggableCard` with a custom comparison that ignores unrelated position changes:

```tsx
export const DraggableCard = React.memo(function DraggableCard(props: Props) {
  // ...
}, (prev, next) => {
  // Re-render only if this card's position, content, or grid changed
  return (
    prev.position.x === next.position.x &&
    prev.position.y === next.position.y &&
    prev.position.z === next.position.z &&
    prev.gridSize === next.gridSize &&
    prev.itemId === next.itemId &&
    prev.children === next.children
  );
});
```

The `children` comparison works here because each parent renders a stable JSX subtree per card (title, notes string, etc.). If children use object literals, the parent should `useMemo` them.

During drag, `handlePositionChange` is called on every `onPointerMove`. The `setLocalPositions` state update triggers a re-render of `CardCanvas` — but because `DraggableCard` is memoized and only the dragging card's entry in `localPositions` changed, only that one card re-renders.

**For 500 cards:** Only 1 card re-renders per pointer-move event. The other 499 are stable. This is O(1) per drag tick, not O(n).

### Alternative: imperative DOM updates

For extreme performance (unlikely needed here), the dragging card's position can be updated via direct `element.style.left/top` manipulation in `handlePointerMove` without going through React state at all (same pattern as Gantt's `dragRef` — pure ref, no setState during move). Position commits to React state only on pointer-up, which causes a single re-render of the moved card.

**Recommendation:** Start with the memoized React state approach. It is simpler and measurably fast enough. Only reach for direct DOM manipulation if profiling reveals jank.

---

## 8. Touch and keyboard

### Touch via Pointer Events

The Gantt's `ChartView.tsx` already uses `setPointerCapture` with pointer events. The Pointer Events Level 2 spec unifies mouse and touch:

- `onPointerDown` fires for both mouse button-down and touchstart
- `setPointerCapture` routes all subsequent pointer events to the element even if the pointer leaves it
- `onPointerUp` / `onPointerCancel` are the correct cleanup points

The skeleton in §2 includes `touchAction: "none"` on the card element — this is the critical flag. Without it, the browser's native scroll gesture intercepts `onPointerMove` before the element can capture it. The new tab page scroll will still work via the canvas background (which has no `touchAction: none`).

No additional touch-specific code is needed. The Pointer Events implementation is already device-agnostic.

### Keyboard specification

| Key | Behavior |
|---|---|
| `Tab` | Focus cycles through cards in DOM order (z-order of render, which tracks creation order) |
| `ArrowLeft` | Move focused card left by `gridSize` px |
| `ArrowRight` | Move focused card right by `gridSize` px |
| `ArrowUp` | Move focused card up by `gridSize` px |
| `ArrowDown` | Move focused card down by `gridSize` px |
| `Escape` | If dragging: cancel drag, revert to original position |
| `Enter` / `Space` | Reserved — should activate the card's primary action (toggle done), not initiate drag |

Arrow key nudges write to `localPositions` immediately (live preview) and call `storage.update()` on each keystroke. Keystroke debouncing is optional — individual storage writes are cheap and the write chain serializes them. If the user holds an arrow key, the OS key-repeat fires at ~30 fps maximum; this generates at most 30 storage writes/sec, each ~40 kB — acceptable.

**ARIA:** `role="button"` and `aria-label` on the card element are in the skeleton. The label should describe the card's content, not just "Drag to reposition." The implementor should compose: `aria-label={`${item.title} — card, drag to reposition, current position x ${position.x} y ${position.y}`}`. The x/y values help screen reader users understand the spatial layout.

---

## 9. Integration contract with the sibling UI agent

The sibling UI agent owns: the card's visual appearance, the Settings toggle UI, the per-section integration (`Today.tsx`, `Sprint.tsx`, etc.), copy, and accessibility of the card content.

### New types / fields the sibling must read from state

```ts
// Read from: state.cardLayouts?.[item.id]
// Type: CardPosition | undefined  (undefined = not yet positioned)
type CardPosition = { x: number; y: number; z: number };
```

The sibling should call `resolvedSettings(state.settings).layoutMode` to determine whether to render list mode or card mode. See layoutMode field below.

### The `layoutMode` field

**Field name:** `layoutMode` (type: `"list" | "card"`)  
**Lives in:** `UserSettings` and `ResolvedUserSettings`

```ts
// UserSettings (add):
layoutMode?: "list" | "card" | undefined;

// ResolvedUserSettings (add):
layoutMode: "list" | "card";

// DEFAULT_SETTINGS (add):
layoutMode: "list",
```

The sibling agent adds this field to `UserSettings`, `ResolvedUserSettings`, `DEFAULT_SETTINGS`, and `resolvedSettings()`. This agent is naming it `layoutMode` — the sibling must use exactly this name.

### `<DraggableCard>` props the sibling consumes

```ts
// What the sibling passes to DraggableCard:
<DraggableCard
  itemId={item.id}
  position={localPositions[item.id] ?? cardLayouts?.[item.id] ?? computedDefault(item, index)}
  gridSize={resolvedSettings(settings).cardGridSize}
  onPositionChange={handlePositionChange}   // local state only
  onDragEnd={handleDragEnd}                 // storage write
  onDragStart={handleDragStart}             // z-order promotion
>
  {/* Card content — sibling's territory */}
  <CardContent item={item} />
</DraggableCard>
```

### `<CardCanvas>` props

```ts
interface CardCanvasProps {
  showGrid: boolean;   // from resolvedSettings(settings).cardShowGrid
  gridSize: number;    // from resolvedSettings(settings).cardGridSize
  children: ReactNode; // rendered DraggableCards
}
```

The sibling renders `<CardCanvas>` as the section wrapper when `layoutMode === "card"`.

### New helper functions (in a new `src/storage/cardLayouts.ts`)

```ts
// Update one card's position — called on drag-end
export function setCardPosition(
  itemId: string,
  pos: CardPosition,
): (s: ProclivityState) => ProclivityState {
  return (s) => ({
    ...s,
    cardLayouts: { ...(s.cardLayouts ?? {}), [itemId]: pos },
  });
}

// Clear all card positions in a section — called when user resets layout
export function resetCardPositions(
  itemIds: string[],
): (s: ProclivityState) => ProclivityState {
  return (s) => {
    const next = { ...(s.cardLayouts ?? {}) };
    for (const id of itemIds) delete next[id];
    return { ...s, cardLayouts: Object.keys(next).length > 0 ? next : undefined };
  };
}
```

Usage in the section:
```ts
await update(setCardPosition(itemId, snappedPos));
await update(resetCardPositions(sectionItems.map(t => t.id)));
```

### New settings fields (both agents must agree)

| Field | Type | Default | Notes |
|---|---|---|---|
| `layoutMode` | `"list" \| "card"` | `"list"` | Sibling adds to UserSettings; this agent names it |
| `cardGridSize` | `4 \| 8 \| 16` | `8` | This agent adds to UserSettings |
| `cardShowGrid` | `boolean` | `false` | This agent recommends; sibling adds toggle in Settings UI |

---

## 10. Bundle-size accounting

| Change | kB delta (min+gz) |
|---|---|
| `src/components/card/DraggableCard.tsx` (~100 lines TS/JSX) | ~0.8 kB |
| `src/components/card/CardCanvas.tsx` (~60 lines) | ~0.5 kB |
| `src/storage/cardLayouts.ts` (~30 lines) | ~0.2 kB |
| New types in `src/types/index.ts` (`CardPosition`, `CardLayoutMap`) | ~0.1 kB |
| CSS for `.draggable-card`, `.card-canvas` | ~0.3 kB |
| **Total estimated delta** | **~1.9 kB minified, ~0.8 kB gzipped** |

**Current gzipped budget:** 62.46 kB (newtab index, from build output).  
**Estimated new total:** ~63.26 kB gzipped.  
**Minified budget:** 198.64 kB / 200 kB.  
**Estimated new minified total:** ~200.5 kB.

**Warning:** The minified total is ~0.5 kB over the 200 kB threshold. The entire card implementation must be lazy-loaded.

### Lazy-loading strategy

Wrap the card-mode rendering path in `React.lazy` + `Suspense`:

```tsx
// In Today.tsx / TodoList.tsx etc.:
const CardCanvas = React.lazy(() =>
  import("@/components/card/CardCanvas").then(m => ({ default: m.CardCanvas }))
);
const DraggableCard = React.lazy(() =>
  import("@/components/card/DraggableCard").then(m => ({ default: m.DraggableCard }))
);

// Render:
{layoutMode === "card" ? (
  <Suspense fallback={<div className="section-empty">Loading card view…</div>}>
    <CardCanvas ...>
      {items.map(item => (
        <DraggableCard key={item.id} ...>
          <CardContent item={item} />
        </DraggableCard>
      ))}
    </CardCanvas>
  </Suspense>
) : (
  <ul className="todo-list">...</ul>
)}
```

The default `layoutMode` is `"list"`, so the card module is **never loaded** unless the user has explicitly switched to card mode. The lazy chunk adds ~1.9 kB to the overall dist but 0 kB to the initial newtab load. This is the same pattern used for `MeshBackground` (which is 823 kB lazy-loaded).

The SettingsModal (already a split chunk at 24.26 kB) is never in the initial chunk — the settings toggle is already paid for.

---

## 11. Risks and open questions

- **Snap-on-move vs snap-on-release:** The skeleton snaps on release (pointer-up). If user testing reveals the feel is wrong ("why doesn't it snap while I drag?"), change `handlePointerMove` to also apply `snapTo`. The change is one line but will affect perceived precision. Commit this behavior decision early.

- **Canvas height auto-grow:** The canvas must expand as cards are moved to large y values. If the canvas has a fixed height, cards placed below it are invisible. The implementation agent must measure the content extent and either set min-height reactively or use an absolutely-positioned canvas that always matches its tallest card.

- **Section scroll vs canvas scroll:** The new tab page scrolls. If a section is 80% down the page and the user drags a card upward by a large distance, the page might scroll while dragging. Test this interaction. The Gantt has a similar issue (horizontal scroll inside the timeline). The fix is to call `e.preventDefault()` in `onPointerMove` when a drag is active — already in the skeleton.

- **`onPointerCancel` cleanup:** The skeleton handles it, but test explicitly on iOS Safari and Chrome Android where touch cancellation is more aggressive.

- **Card position on `Todo` scope change:** If a user edits a todo and changes its scope (e.g., from "today" to "sprint"), the card position persists in `cardLayouts` under the same `itemId`. This is fine — the card will appear in the new section at its old position. If the user switches back, the position is where they left it. Only an explicit "Reset layout" clears positions.

- **Deleted item positions:** When a `Todo` or `Reminder` is deleted, its `cardLayouts` entry is orphaned. This is a slow memory leak. The `deleteTodo` / `deleteReminder` `update()` calls should also remove the item's entry from `cardLayouts`. This is a one-liner addition to each deletion handler.

- **Storage backfill:** Items created before card mode existed have no `cardLayouts` entry. The auto-layout algorithm (§3) handles this lazily on first card-mode render. Do not add a migration to `storage.get()` — lazy is fine and avoids a potentially expensive O(n) operation on every page load.

- **Multiple sections open simultaneously:** Today, Sprint, LongTerm, and Reminders all render at once on the new tab page. Each section has its own `CardCanvas` with its own `localPositions` state. There is no cross-section drag (items cannot be dragged from the Today canvas into the Sprint canvas). This is intentional and correct.

- **Sprint archived rows:** Card view should only apply to the active sprint's task list. Archived sprints remain in their collapsed list view — card mode for archived content would be confusing.

- **Reminders section specifics:** Reminders have a `fired` boolean. In card mode, fired reminders and upcoming reminders are currently shown in separate sub-sections. The card canvas wraps each sub-section independently (two canvases inside `RemindersManager`), or the two groups share one canvas with a visual divider. Decide with the UI agent.

- **The `cardLayouts` map grows without bound.** If a user creates and deletes 1,000 todos over time, 1,000 orphan positions accumulate. Add a periodic GC pass (on `storage.get()`) that removes entries whose key doesn't match any current `todo.id` or `reminder.id`. Low priority but should be filed as a follow-up.

---

## 12. Recommended commit sequence

**Commit 1: `feat(storage): add CardPosition type and cardLayouts to ProclivityState`**  
- Add `CardPosition` and `CardLayoutMap` to `src/types/index.ts`
- Add `cardLayouts?: CardLayoutMap | undefined` to `ProclivityState`
- Add `cardGridSize` and `cardShowGrid` to `UserSettings`, `ResolvedUserSettings`, `DEFAULT_SETTINGS`, and `resolvedSettings()`
- Add `src/storage/cardLayouts.ts` with `setCardPosition` and `resetCardPositions`
- **Verification:** `npm run build` passes; no existing behavior changed.

**Commit 2: `feat(card): DraggableCard and CardCanvas primitives`**  
- Add `src/components/card/DraggableCard.tsx`
- Add `src/components/card/CardCanvas.tsx`
- Add `src/components/card/card.css` (minimal — `.draggable-card`, `.card-canvas`)
- **Verification:** `npm run build` passes; components exist but are not imported anywhere yet.

**Commit 3: `feat(card): lazy-load card module, wire layoutMode to TodoList`**  
- Add `layoutMode` to `UserSettings` / `ResolvedUserSettings` (if the UI agent hasn't landed it first; coordinate)
- In `TodoList.tsx`: add `layoutMode === "card"` branch with `React.lazy` + `Suspense` wrapping `CardCanvas` + `DraggableCard`
- Implement `localPositions` state, `handlePositionChange`, `handleDragEnd`, `handleDragStart` in `TodoList`
- **Verification:** Switching `DEFAULT_SETTINGS.layoutMode` to `"card"` shows cards. Build passes under 200 kB initial chunk.

**Commit 4: `feat(card): wire card mode to Sprint and Reminders sections`**  
- Apply the same `CardCanvas` wiring to `SprintManager.tsx` (active sprint tasks only)
- Apply to `RemindersManager.tsx` (upcoming and fired as separate canvases or combined)
- Add orphan-position cleanup to deletion handlers in `TodoList.tsx`, `SprintManager.tsx`, `RemindersManager.tsx`
- **Verification:** All sections switch correctly. Build passes.

**Commit 5: `feat(card): keyboard nudge, z-order, grid visualization`**  
- Implement arrow-key nudge in `DraggableCard` (already in skeleton)
- Implement z-order bump on `onDragStart`
- Add dot-grid CSS to `CardCanvas` controlled by `showGrid` prop
- **Verification:** Keyboard navigation works. Z-order updates correctly. Grid shows/hides. Build passes.
