# Responsive workspace design direction

Status: chosen for implementation
Scope: program
Surface: Chrome new-tab override
Date: 2026-07-13

## Product thesis

Proclivity is a private field desk you meet on every new tab: the user's current inclination —
investigate, plan, remember, or review money — receives the full working canvas while every other
instrument waits quietly at the edge, rendered in ink and paper with one user-owned accent.

The thesis makes a direct promise: opening OSINT on a 1920 px display should feel like entering an
investigation surface, not viewing a website inside a centered blog column. Opening Today should remain
calm and legible rather than stretching every line to the horizon. Width is allocated by the active tool,
not withheld globally.

## Evidence and current score

Live inspection at 1920×1080 measured a 1100 px app shell and 1036 px usable panel, leaving 46% of the
window unused. At 375×812 the usable panel was 296 px while the destination strip had 568 px of content;
48% of the strip was offscreen. The embed height is `78vh` without accounting for the header or
navigation, so page scroll and iframe scroll are structurally nested.

Current anti-pattern score: **3/13**.

- BAN-4: browser-default typography is carrying too much of the visual identity.
- BAN-10: the oversized generic greeting acts as the opener instead of the user's current work.
- BAN-14: one global density and width model is imposed on unlike tools.

Current directed quality estimate: **1.75/4** (clarity 2, hierarchy 2, integrity 2, composition 1,
typography 2, depth 1, interaction 2, signature 2). The score is based on live geometry plus the current
desktop/mobile baseline captures; it is not a claim about extension-only OAuth behavior.

## Three divergent directions

### A — Focus Deck

- Axes: low surface count, high focus, moderate user arrangement, strong tool identity.
- Composition: a narrow grouped text switchboard, one uninterrupted stage, and one optional companion.
- Material: flat ink/paper planes, hairlines, tabular metadata, no elevated card wall.
- Interaction: select a destination, pin one companion, swap the two, or enter focus mode.
- Signature move: the selected inclination becomes a named full-height workspace; the rest become a calm
  index at the edge.
- Explicit bans: no stock icon-only sidebar, no equal panel matrix, no more than two live panels, no media
  banner above the stage.
- Risk: a companion could become too narrow; it must collapse before the primary falls below a useful
  inline size.

### B — Tiled Studio

- Axes: high surface count, medium focus, high arrangement, high operational density.
- Composition: saved asymmetric twelve-column canvas with two or three resizable panels.
- Material: ruled workbench with persistent panel headers and drag handles.
- Interaction: drag, resize, reorder, save layouts, and maximize a tile.
- Signature move: a remembered spatial arrangement for morning review.
- Explicit bans: no equal 2×2 grid, no KPI cards, no hidden resize affordances, never more than three
  panels.
- Risk: highest implementation and accessibility cost; container-query work, iframe lifecycle, card-mode
  geometry, keyboard rearrangement, and persistence all become coupled.

### C — Daily Ledger

- Axes: medium surface count, editorial focus, low arrangement, high overview.
- Composition: a continuous vertical ledger with compact previews that expand into full workspaces.
- Material: typographic rules, dates, marginal labels, and dense line items.
- Interaction: scan the day, expand a chapter, return to the ledger.
- Signature move: time horizons read as one daily narrative.
- Explicit bans: no feed cards, no motivational copy, no auto-playing photo chapter, no endless dashboard
  scroll.
- Risk: elegant for planning but actively weak for OSINT- and finance-first deep work.

## Chosen direction

**A — Focus Deck** is selected. It best satisfies the user's full-width and dynamic-resize problem while
preserving Proclivity's calm repeat-use thesis. It provides meaningful rearrangement without prematurely
building a window manager. Direction B is retained as a future branch only if real usage proves that more
than one companion is necessary. Direction C is rejected for this program because iframe work should not
be forced through an overview page.

## Design-language contract

### Information architecture

- Intelligence: OSINT; Issues is reserved but absent until it has a source and auth model.
- Planning: Today, Gantt, Calendar, Reminders, with Sprint and Long-term when enabled.
- Money: Finances.
- Memory: Photos.
- Archive: Closed.

The grouped rail uses destination buttons with `aria-current="page"`. It is not an ARIA tablist because a
wide workspace can display two destinations at once. Command palette switching continues to target the
primary destination.

### Geometry and responsive behavior

- 1280 px and wider: 176 px switchboard + intrinsic primary stage; optional 280–720 px companion.
  The live maximum is also capped at half of the usable stage and preserves a 540 px primary floor.
  A focusable 24 px hit target in the 12 px gutter supports pointer dragging, 16 px arrow-key steps,
  Shift-modified 48 px steps, Home/End bounds, Escape cancellation, and Enter/double-click reset.
- 840–1279 px: one stage; navigation becomes a compact destination strip and companion state is retained
  but collapsed.
- Below 840 px: one stage, compact header, horizontally scrollable grouped destinations with a visible
  edge cue, no companion.
- Shell and embed surfaces use `100dvh`; scroll belongs to the stage or panel, not the document.
- Workspace panels establish `container-type: inline-size`; internal layouts respond to their slot.

### Type, spacing, and material

- Display and body: the existing system UI stack, with weight/spacing doing the work instead of a bundled
  font. Metadata and clock values use tabular numerals; technical identifiers may use `ui-monospace`.
- Scale: 12 metadata, 13 navigation, 15 body, 20 surface title, 28 compact greeting maximum.
- Spacing: existing 4/8/12/16/20 tokens plus 24 and 32 layout intervals where needed.
- Material: `--bg`, `--panel`, `--panel-2`, and `--border`; one user-owned `--accent`; semantic colors only
  for semantic state.
- Corners: restrained existing `--radius`; the shell itself is not a rounded floating island.
- Depth: borders and tonal planes; shadow only for transient overlays or drag elevation.

### Motion and voice

- Motion must name an orientation, feedback, or continuity job. Workspace changes use the existing short
  fade; focus mode and companion changes are immediate or under 220 ms. Reduced-motion remains nuclear.
- Photos pause their ticker and video when their surface is hidden; the user controls pause/play when it is
  visible.
- Voice is private, exact, and non-celebratory: “Open externally,” “Add a companion,” “Photos are not set
  up.” Avoid “Welcome back,” productivity scores, streak language, and invented insight.

## Projected gate

Projected anti-pattern score after implementation: **1/13** (system typography remains intentionally
familiar, but no longer carries the whole composition). Target directed quality: **at least 3.0/4**, with
clarity, hierarchy, integrity, and composition each at least 3. Final scores require live screenshots at
1440, 768, and 375 px plus a fresh independent review.

## Final gate

The implementation passed the persisted frontend-design gate with self scores of **1/13** anti-pattern
tells and **3.5/4** directed quality, plus fresh independent scores of **1/13** and **3.25/4**. Live DOM
geometry was verified at 1920×1080, 1440×900, 768×900, and 375×812; document width and height matched
each viewport. The scorecard and evidence live under
`.Codex/notes/frontend-designs/workspace-revamp/`.

## Decisions this program answers

1. Default arrangement: OSINT as primary; no companion until the user opts in.
2. Photos: first-class Memory destination, not a persistent banner.
3. Rearrangement: primary/companion selection plus Swap and Focus, not arbitrary freeform tiling.
4. Issues: named in the information architecture only; no empty fake panel ships.
5. Companion width: slot-based, dynamically resizable, and persisted as a preferred width. Temporary
   viewport clamping never overwrites that preference; companion selection itself remains transient.

## Deferred questions

- Whether primary/companion destination selection should persist after the interaction model has been
  used in practice. Width persistence is settled independently.
- Whether card-layout pixel geometry should migrate to proportional coordinates in a separate milestone.
- Whether the bounded two-iframe warm cache needs an eviction policy if more external workspaces are added.
