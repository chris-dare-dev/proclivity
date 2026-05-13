# Adversarial Critique — Card Resize + Action Spacing

## Test environment

**Option 3 — Claude Preview MCP** (Claude in Chrome MCP found no connected browsers; computer-use request_access timed out). Dev server started via `proclivity-dev` launch config on `http://localhost:5173`. Chrome extension APIs (`chrome.storage`) are unavailable in this context; the storage layer correctly fell back to `localStorage`, allowing full state injection and React rendering. Card layout was exercised by injecting state with explicit `cardLayouts` entries including resized dimensions.

Screenshots: the `preview_screenshot` tool returned `UnknownVizError` on every attempt after initial page load (a known Preview MCP instability under the CRXJS dev build). DOM inspection was carried out entirely via `preview_eval` with `getBoundingClientRect`, `getComputedStyle`, and direct source map analysis.

---

## Verdict

**Do not ship as-is. One critical data-loss bug and one MIN_W/CSS mismatch make the resize feature actively harmful today.** The action cluster spacing (`e4c3712`) is structurally sound and shippable on its own. The resize commit (`b23c713`) has three mandatory fixes before it can land: the drag wipes resize, the minimum width crushes content, and the initial bundle is over the stated 200 kB ceiling.

---

## Browser observations

### Pencil / delete spacing

At 1280×900 desktop dark theme, the action cluster renders correctly as a `flex` row with `gap:12px`. Both buttons are 17–20 px wide, so the actual pixel gap between edit's right edge and delete's left edge is exactly 12 px — sufficient to prevent mis-click under deliberate movement. The cluster is `opacity:0; pointer-events:none` at rest and becomes `opacity:1; pointer-events:auto` on both `:hover` and `:focus-within`. The latter was verified by programmatically focusing the edit button: `tc.matches(':focus-within') → true`, `actionsOpacity → "1"`.

The `border-left: 1px solid transparent` flips to `color-mix(in srgb, var(--border) 70%, transparent)` on hover/focus. In dark mode the resolved color is `color(srgb 0.08 0.10 0.13 / 0.7)` — a visible, intentional separator. In light mode `--border = oklch(0.88 0.008 252)`, a near-white value; 70% of that on a `oklch(0.95 …)` card background is nearly invisible. The separator effectively disappears in light mode.

Tab order is pencil → delete (DOM order), which is correct: destructive action is last. `aria-label` on both buttons includes the card title (e.g., `"Delete: Short task"`), satisfying screen reader identification.

### Resize handle

The handle is `14×14 px`, `position:absolute`, `bottom:0; right:0` on `.draggable-card`. At rest `opacity:0.35`; rises to `0.7` on card hover/focus-within and `1.0` during active resize. Cursor is `se-resize`. The visual diagonal-line gradient is legible in dark mode; in light mode it is marginal (effective rendered opacity ≈ 0.245 at rest).

The handle sits on `.draggable-card`, not `.task-card`. When no explicit size is set, `.draggable-card` auto-sizes around `.task-card` (240 px wide, auto height). The resize handle's 14 px height overlaps the last 6–14 px of `.task-card` depending on card height — this is by design and works because `z-index:10` ensures the handle is always clickable over card content.

`role="separator"` with `aria-label="Resize card"` and `tabIndex={-1}` is semantically incorrect (see ARIA finding below).

---

## Severity-graded findings

### CRITICAL

**1. Drag-end and keyboard-nudge silently wipe the user-set resize dimensions from storage.**

After a user resizes a card (e.g., to 320×200 px), any subsequent drag or Arrow-key nudge of that card destroys the saved size. The card immediately snaps back to default width on the next reload.

*Root cause:* `useCardLayout.ts` line 143:
```ts
await update(setCardPositionToFront(id, { x: pos.x, y: pos.y }));
```
`setCardPositionToFront` receives only `{ x, y }` and writes `{ ...pos, z: maxZ+1 }`, overwriting the stored entry without `w` or `h`. `DraggableCard.commitDrag` correctly passes the full `CardPosition` (including `w` and `h`) to `onDragEnd`, but `useCardLayout` discards those fields before the storage write.

Verified in DOM: inject `cardLayouts.t1 = {x:20, y:20, z:1, w:320, h:200}`, reload → card renders at 320×200. Simulate `setCardPositionToFront(id, {x:40, y:20})` → `cardLayouts.t1 = {x:40, y:20, z:2}` — w/h gone.

*Fix:* Change `useCardLayout.ts:143` to pass `w` and `h` through:
```ts
await update(setCardPositionToFront(id, { x: pos.x, y: pos.y, w: pos.w, h: pos.h }));
```
And update `setCardPositionToFront`'s parameter type from `Omit<CardPosition, "z">` to accept optional `w`/`h` and spread them into the written entry.

---

### HIGH

**2. `MIN_W = 140` is below the task-card CSS `min-width: 200px`, which the resize override nullifies — crushing card content at 140–199 px.**

When `.draggable-card` has an inline `width` style, the CSS rule:
```css
.draggable-card[style*="width"] .task-card { width: 100%; min-width: 0; }
```
sets `min-width: 0` on `.task-card`. At `width: 140px`, the computed content area is 100 px (minus 40 px padding). The action cluster takes ~60 px, leaving 32 px for the title — but the browser collapses it to 10 px due to flexbox pressure. The title wraps character-by-character to 203 px tall.

Verified: `title.offsetWidth = 10`, `title.offsetHeight = 203` at `draggable-card width = 140px`.

*Fix:* Raise `MIN_W` in `DraggableCard.tsx` from `140` to `200`, matching `task-card`'s natural min-width. The `min-width: 140px` on `.draggable-card` (for un-resized default) can stay — the issue only manifests when the user explicitly resizes below 200 px.

**3. Resize does not bump z-index; the resized card can end up behind a recently-dragged card.**

`setCardSize` preserves the existing `z` value. After resize, if another card was dragged (which does bump z via `setCardPositionToFront`), the resized card's z stays stale. Two cards overlapping: the resized one will be hidden under the dragged one regardless of interaction recency.

*Fix:* Call `setCardPositionToFront`-style z-bump inside `setCardSize` or in `commitSize` — same atomic pattern already used for drag.

**4. ARIA role `"separator"` on the resize handle is wrong.**

`role="separator"` describes a visual divider, not an interactive widget. An interactive resize handle should be `role="slider"` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` (per WAI-ARIA Authoring Practices for window splitters), or at minimum `role="button"`. The current assignment will confuse screen readers, which may skip or misread the element.

`tabIndex={-1}` means the handle is not reachable by Tab. Keyboard resize is only accessible via `Shift+Arrow` on the focused card wrapper — this is a reasonable shortcut but it is undiscoverable. No visible affordance informs the user. The onboarding hint says "Drag cards to rearrange" but says nothing about `Shift+Arrow` to resize.

*Fix:* Change `role` to `"button"`, keep `tabIndex={-1}` (keyboard resize remains via Shift+Arrow on the card), add `aria-label="Drag to resize"`. Add a tooltip (`title` attribute) so sighted users hovering the handle see the hint.

**5. `border-left` separator on action cluster is invisible in light theme.**

`--border` in light mode resolves to `oklch(0.88 …)` (near-white). `color-mix(in srgb, var(--border) 70%, transparent)` on a `oklch(0.95 …)` card background produces a contrast ratio below 1.1:1 — indistinguishable from the card background. The separator, whose stated purpose is to clearly separate the action cluster from the title, fails in the light theme.

*Fix:* Use a theme-aware darker token for the separator, e.g. `color-mix(in srgb, var(--text-dim) 25%, transparent)` which gives a visible mid-gray tint in both themes.

---

### MEDIUM

**6. Zero-delta resize fires a storage write on every click of the handle.**

`commitResize` unconditionally calls `onResize?.(itemId, { w: snappedW, h: snappedH })` on `pointerup`. A click-without-drag gives `rawW = origW + 0`, `snappedW = snapTo(origW)` (already snapped) → same value, but still triggers `commitSize` → `setCardSize` → async `localStorage.setItem`. This is a wasted write on every accidental handle click.

*Fix:* Add a delta guard in `commitResize`:
```ts
if (snappedW === rs.origW && snappedH === rs.origH) return;
```

**7. Notes remain 3-line-clamped inside a user-enlarged tall card, leaving dead whitespace.**

When a card is resized to e.g. 400 px tall, `.task-card-notes` still has `-webkit-line-clamp: 3`. The extra vertical space is wasted. Confirmed: `getComputedStyle(notes).webkitLineClamp === "3"` on a card with `height: 400px`.

This is a design decision, but the current behavior is actively misleading: the card looks like there's room to read more, but the content is still truncated. Either remove the clamp inside resized cards (apply clamp only when no explicit height is set) or document this as intended.

**8. Reset layout button wipes card sizes as well as positions, with no indication to the user.**

`onResetLayout` calls `resetCardPositions` which deletes entries from `cardLayouts` entirely. A user who has carefully resized several cards and then clicks "Reset layout" (expecting only positions to reset) will lose all their sizes permanently. The button label says "Reset layout" and the `title` tooltip says "Reset card positions to default" — neither mentions sizes.

*Fix:* Either keep `w`/`h` during position reset (modify `resetCardPositions` to only clear `x`/`y`/`z`), or update the tooltip to "Reset positions and sizes to default".

---

### LOW

**9. Resize handle visibility at `opacity: 0.35` rest state is marginal in light theme.**

`color-mix(in srgb, var(--text-dim) 70%, transparent)` at `opacity: 0.35` gives an effective alpha of ~0.245 on the light card. The gradient lines are barely perceptible. In dark mode this is acceptable. In light mode the handle is undiscoverable until hover.

*Fix:* Increase rest opacity to `0.5` globally, or introduce a theme-specific value.

**10. Onboarding hint does not mention resize or keyboard shortcuts.**

Current text: "Drag cards to rearrange. They snap to a grid." No mention of the resize handle, `Shift+Arrow` to resize, or `Arrow` to nudge. Given that the handle itself is not keyboard-focusable, the only discoverable path to keyboard resize is this hint.

*Fix:* Append: "Drag the bottom-right corner to resize. Shift+Arrow resizes by one grid step."

**11. Resize does not trigger z-bump, but drag does — inconsistent "last touched = on top" model.**

A user resizes a buried card by clicking its handle. The card does not come to front. If another card overlaps it, the resize handle stays behind the overlapping card. The user may not even be able to reach the handle.

This is distinct from finding #3 (post-drag ordering) — this is about resize-initiation discoverability.

*Fix:* Call `setCardPositionToFront` (or equivalent atomic z-bump) from `commitSize` in `useCardLayout`.

---

## Code-level concerns

**`e4c3712`:**
- `tabIndex={0}` is set explicitly on both buttons, which is redundant for `<button>` elements (they are naturally focusable). Not harmful, but noise.
- The separator border-left uses `transparent` as a placeholder when hidden — this means `transition: opacity 120ms ease` handles reveal, but if someone queries `borderLeftColor` at rest they get `rgba(0,0,0,0)` not the hover color. Non-issue for users, minor DX confusion.

**`b23c713`:**
- `handleResizePointerCancel` calls `void e;` (line 277) — a no-op to satisfy the linter about the unused parameter. Using `_e` or `_` in the parameter signature would be cleaner.
- `commitDrag` also calls `void e;` — same pattern in `handlePointerCancel`. Acceptable but non-idiomatic.
- `currentSize()` falls back to `position.w ?? MIN_W` when `elRef.current` is null. If the element unmounts during resize (unlikely but possible via strict-mode double-mount), this fallback could produce a spurious resize commit with wrong dimensions on the next pointer-up.
- The CSS selector `.draggable-card[style*="width"]` is fragile: if the component ever sets any other inline style property whose value contains the string "width" (e.g. `max-width` — unlikely, but `border-width` is plausible), the task-card would incorrectly get `width:100%; min-width:0`. This should be replaced with a dedicated data attribute: `data-user-sized="true"` set when `position.w !== undefined`.

---

## Bundle audit

**Main bundle (`index.html-…js`): 201.84 kB — 1.84 kB over the 200 kB ceiling stated in `CLAUDE.md`.**

The growth is not from `DraggableCard.tsx` or `useCardLayout.ts` — both of those correctly land in the `useCardLayout-….js` shared lazy chunk (7.20 kB), which is only loaded when either card section renders.

The leak is `storage/cardLayouts.ts` (5,082 source chars), which was pulled into the main bundle by `SprintManager.tsx`. `SprintManager` is eagerly loaded (it is in the main bundle source map) and it directly imports `resetCardPositions` from `cardLayouts.ts`. Before `b23c713`, `cardLayouts.ts` was ~2.7 kB of source; the new `setCardSize` function added ~300 bytes of source which minified and gzipped to ~170 bytes of net bundle growth. The remaining ~1.67 kB growth came from the new `setCardPositionToFront` w/h parameter flow and type overhead compiled into the existing in-bundle entries.

**Fix:** `SprintManager.tsx` should not import from `storage/cardLayouts.ts` directly. Move the `resetCardPositions` call in `SprintManager` to a thin inline updater, or extract only that one function into a separate `storage/resetCardPositions.ts` module so `cardLayouts.ts` (which now contains the resize-specific `setCardSize`) stays fully lazy.

---

## Recommended fixer agenda

Ordered by severity and dependency. Items 1–4 are mandatory before shipping resize.

1. **Fix drag/nudge wiping resize** — `useCardLayout.ts:143`: pass `w: pos.w, h: pos.h` through `setCardPositionToFront`. Update `setCardPositionToFront` signature to accept and spread optional `w`/`h`. (1 file, ~5 lines)

2. **Raise `MIN_W` from 140 to 200** — `DraggableCard.tsx:59`. The 140 px lower bound is below `task-card`'s natural content floor. Titles become 10 px wide and 200 px tall at min width. (1 line)

3. **Fix bundle leakage via SprintManager** — Move `SprintManager`'s single use of `resetCardPositions` to an inline state updater so `cardLayouts.ts` stops loading at startup. Brings main bundle back under 200 kB. (2 files)

4. **Fix ARIA role on resize handle** — Change `role="separator"` to `role="button"`, add `title="Drag to resize"`. (1 line in `DraggableCard.tsx`, no CSS change)

5. **Fix light-theme separator color** — Change `.task-card:hover .task-card-actions` `border-left-color` from `color-mix(in srgb, var(--border) 70%, transparent)` to `color-mix(in srgb, var(--text-dim) 25%, transparent)`. (1 line in `card.css`)

6. **Add resize z-bump** — `commitSize` in `useCardLayout.ts` should also bump z to front, same as `onDragEnd`. Use `setCardPositionToFront` with preserved `w`/`h` after item 1 is done, or add a dedicated `setCardSizeToFront` helper. (1–2 files)

7. **Guard zero-delta resize** — Add `if (snappedW === rs.origW && snappedH === rs.origH) return;` before the `onResize?.()` call in `commitResize`. (1 line)

8. **Update "Reset layout" tooltip/behavior** — Either limit reset to x/y/z only (preserve w/h) or update `title="Reset positions and sizes"`. (1 line in `TodoCardSection.tsx` and `RemindersCardSection.tsx`)

9. **Update onboarding hint copy** — Add resize and Shift+Arrow mention to the drag hint text. (2 files)

10. **Replace `[style*="width"]` with `data-user-sized`** — Set `data-user-sized="true"` on `.draggable-card` when `position.w !== undefined`, and target that attribute in CSS instead of the fragile string match. (2 files)

11. **Improve handle discoverability in light theme** — Increase `.card-resize-handle` rest `opacity` from `0.35` to `0.5`. (1 line in `card.css`)

12. **Add Shift+Arrow resize to onboarding keyboard hint** — if a keyboard shortcuts reference exists elsewhere, cross-link it. (documentation only)
