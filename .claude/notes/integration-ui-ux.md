# SettingsModal UI/UX Integration Plan

> Author: Claude Sonnet 4.6 (UI/UX agent)
> Date: 2026-05-11
> Scope: Layout, controls, interaction model, accessibility for the redesigned SettingsModal.
> Sibling agent owns: data schema, CSS variable tokens, storage migration, `Intl` formatters,
>   service-worker plumbing for quiet hours. This plan references those fields generically.
> Source files read: `SettingsModal.tsx`, `SettingsModal.css`, `Modal.tsx`, `Modal.css`,
>   `App.css`, `index.css`, `types/index.ts`, `newtab/App.tsx`, `storage/useStore.ts`,
>   both research reports.

---

## 1. Information Architecture

### Decision: Sectioned scrollable modal (single page, no tabs)

The current modal has 1 field. The redesign grows it to ~23 controls. The research recommendation
is a "sectioned single-page scrollable modal" and that verdict holds here. The reasons:

- **Tab overhead is unjustified at this scale.** Tabs require each panel to be independently
  navigable and discoverable. With ~23 controls across 5 logical areas, a user opening Settings
  for the first time would still need to guess which tab to look in. Tabs save vertical space
  but cost discoverability.
- **Sidebar nav (VS Code model) is massively overbuilt** for a personal extension. The only
  time sidebar nav pays off is when there are 8+ top-level categories, each with 10+ options.
- **Scroll is universally understood** and works inside a fixed-height dialog with a sticky
  footer, which the existing `Modal.tsx` pattern supports with minor CSS additions.
- **Growth headroom:** if settings ever exceed ~35 controls (unlikely for a local extension),
  a tab layer can be added surgically over the section headings without restructuring
  the content.

### Sections, order, and fields

Section order follows "things users change most often, first." Destructive actions always last.

```
Section 1: Appearance         (5 controls)
Section 2: Background         (2 controls)
Section 3: Date & Time        (3 controls)
Section 4: Display            (3 controls)
Section 5: Notifications      (4 controls)
Section 6: Dashboard          (1 control — 5 sub-toggles)
Section 7: Account            (1 control — name field)
Section 8: Data               (3 controls — export, import, clear)
```

**Section 1 — Appearance**
- `state.settings.theme` — radio group: System / Light / Dark
- `state.settings.accentColor` — 8-swatch grid + `<input type="color">`
- `state.settings.fontSize` — 3-button segmented control: S / M / L
- `state.settings.density` — 3-button segmented control: Compact / Default / Spacious
- `state.settings.reducedMotion` — toggle switch (on/off)

**Section 2 — Background**
- `state.settings.meshEnabled` — toggle switch (on/off)
- `state.settings.meshIntensity` — range slider 0–100% (disabled/hidden when meshEnabled is false)

**Section 3 — Date & Time**
- `state.settings.timeFormat` — segmented control: System / 12h / 24h
- `state.settings.relativeDates` — toggle switch (on/off)
- `state.settings.weekStart` — segmented control: Sun / Mon / Sat

**Section 4 — Display**
- `state.settings.greetingStyle` — segmented control: Off / With time of day
- (reserved slot for future display options — space left intentional)

**Section 5 — Notifications**
- `state.settings.defaultReminderLeadMinutes` — segmented control: None / 5m / 10m / 15m / 30m / 1hr
- `state.settings.snoozeMinutes` — segmented control: 10m / 30m / 1hr
- `state.settings.quietHours` — toggle switch (enables the two time fields below)
- `state.settings.quietHours.from` + `.to` — two `<input type="time">` fields (shown only when quiet hours enabled)

**Section 6 — Dashboard**
- `state.settings.sectionVisibility` — five labeled checkboxes stacked vertically:
  Today, Sprint, Long-term, Gantt, Reminders

**Section 7 — Account**
- `state.settings.name` — existing text input (same as today)

**Section 8 — Data** (destructive zone, visually separated)
- Export — button → triggers download
- Import — file picker → confirm dialog
- Clear all data — button → two-step inline confirmation

### ASCII wireframe

```
┌─────────────────────────────────────────────────────┐
│  Settings                                    [×]    │ ← sticky header (modal-panel-header)
├─────────────────────────────────────────────────────┤
│                                                     │ ↑
│  APPEARANCE                                         │ │
│  ─────────────────────────────────────────────────  │ │
│  Theme                                              │ │
│  ○ System  ○ Light  ○ Dark                          │ │
│  Follows your OS setting when set to System.        │ │
│                                                     │ │
│  Accent color                                       │ │
│  [●] [●] [●] [●] [●] [●] [●] [●]  [color-input]   │ │
│  Choose a highlight color for buttons and links.    │ │
│                                                     │ │
│  Font size                                          │ │  scrollable
│  [  S  ] [  M  ] [  L  ]                           │  body
│  Adjusts text size across the entire page.          │ │
│                                                     │ │
│  Density                                            │ │
│  [ Compact ] [ Default ] [ Spacious ]               │ │
│  Controls spacing between rows and sections.        │ │
│                                                     │ │
│  Reduce motion                                      │ │
│  Pause mesh animation and UI transitions    [○──]   │ │
│                                                     │ │
│  BACKGROUND                                         │ │
│  ─────────────────────────────────────────────────  │ │
│  Mesh background                                    │ │
│  Show animated 3D wireframe background     [──○]    │ │
│                                                     │ │
│  Intensity                                          │ │
│  ──────●───────────────────────────   72%           │ │
│  Opacity of the mesh wires.                         │ │
│                                                     │ │
│  DATE & TIME                                        │ │
│  ─────────────────────────────────────────────────  │ │
│  Time format                                        │ │
│  [ System ] [  12h  ] [  24h  ]                     │ │
│  System: 12-hour (from your browser locale)         │ │
│                                                     │ │
│  Relative dates                                     │ │
│  Show "2 days ago" instead of exact dates  [──○]    │ │
│                                                     │ │
│  Week starts on                                     │ │
│  [  Sun  ] [  Mon  ] [  Sat  ]                      │ │
│                                                     │ │
│  DISPLAY                                            │ │
│  ─────────────────────────────────────────────────  │ │
│  Greeting                                           │ │
│  [ Off ] [ With time of day ]                       │ │
│  "Good morning, [name]" at the top of the page.     │ │
│                                                     │ │
│  NOTIFICATIONS                                      │ │
│  ─────────────────────────────────────────────────  │ │
│  Default reminder lead time                         │ │
│  [None][5m][10m][15m][30m][1hr]                     │ │
│  Pre-populated when creating a new reminder.        │ │
│                                                     │ │
│  Snooze duration                                    │ │
│  [  10m  ] [  30m  ] [  1hr  ]                      │ │
│  Applied when you snooze a notification.            │ │
│                                                     │ │
│  Quiet hours                                        │ │
│  Silence notifications during set hours    [○──]    │ │
│                                                     │ │
│  From  [22:00]  to  [07:00]   (next day)            │ │
│  Notifications due during this window will fire     │ │
│  at the end of your quiet period instead.           │ │
│                                                     │ │
│  DASHBOARD                                          │ │
│  ─────────────────────────────────────────────────  │ │
│  Visible sections                                   │ │
│  ☑ Today                                            │ │
│  ☑ Sprint                                           │ │
│  ☑ Long-term                                        │ │
│  ☑ Gantt                                            │ │
│  ☑ Reminders                                        │ │
│                                                     │ │
│  ACCOUNT                                            │ │
│  ─────────────────────────────────────────────────  │ │
│  Your name                                          │ │
│  [________________________]                         │ │
│  Appears in the greeting. Leave blank to omit.      │ │
│                                                     │ │
│  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌ DATA ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌   │ │
│  Danger zone                                        │ │
│                                                     │ │
│  [  Export data  ]   [  Import data  ]              │ │
│                                                     │ │
│  [ Clear all data ]                                 │ │
│  — — — — — — — — — — — — — — — — — — — — — — —     │ ↓
├─────────────────────────────────────────────────────┤
│                           [Cancel]  [Done]          │ ← sticky footer
└─────────────────────────────────────────────────────┘
```

**How the user finds "the thing they came to change":**
- Section headings are visually prominent (12px uppercase, `var(--text-dim)`, letter-spaced — matching existing `.settings-label` style but used as dividers).
- The modal is short enough at average viewport height (900px screen) to see the first two sections without scrolling, instantly orienting the user.
- Sections are visually separated by a full-width rule, not just whitespace — the eye groups them at a glance.
- The destructive zone uses a dashed divider and a "Danger zone" label (GitHub convention) to create a psychological boundary, making it both findable and clearly distinct.
- No search needed for ~23 controls.

---

## 2. Modal Sizing and Overflow

### Target dimensions

```
Width:      480px (unchanged from current max-width: 480px in .modal-panel)
Max-height: min(80vh, 720px)
Min-height: 400px (so short viewports don't crush content)
```

The 80vh cap means: on a 900px-tall screen (common for 15" laptops), the modal is 720px tall,
leaving 180px of visible page behind — enough to signal it's a layer, not a full-screen takeover.

### Structural changes to Modal.tsx

**No structural changes to Modal.tsx are needed.** The base `Modal` component is already:
- Portal-rendered (avoids stacking context issues with the mesh canvas)
- Focus-trapped (Tab/Shift+Tab loop within `panelRef`)
- Escape-key aware (`handleKeyDown` dispatches `onClose`)
- Backdrop-click aware (`onMouseDown` on `.modal-backdrop`)

The only required change is a CSS addition in `SettingsModal.css` (not Modal.css), keeping the
base modal generic and reusable for `TextInputModal` and `ConfirmDialog`.

### New CSS structure for SettingsModal

The `SettingsModal` will render a three-part layout inside the `Modal` shell:

```
<Modal open title="Settings" onClose={...}>
  <!-- replaces current: children rendered directly in .modal-panel -->
  <div class="settings-layout">
    <div class="settings-body">       ← scrollable, flex-grows
      ...sections...
    </div>
    <div class="settings-footer">    ← sticky at bottom of .modal-panel
      <button>Cancel</button>
      <button class="modal-btn-primary">Done</button>
    </div>
  </div>
</Modal>
```

The `.modal-panel` already has `padding: 24px`. The settings layout needs to break out of that
padding at the footer so the sticky footer has its own edge-to-edge background. Strategy: give
`.modal-panel` `padding: 0` when used for settings (via a CSS class on the panel, or by having
SettingsModal render its own panel wrapper). The cleanest approach without modifying `Modal.tsx`
is to apply negative margins on `.settings-footer`:

```css
/* SettingsModal.css additions */

.settings-modal-panel {
  /* Tells Modal.tsx to remove default padding when settings layout is active.
     Applied via a `className` prop passed to Modal — requires a one-line Modal.tsx change:
     add optional `panelClassName?: string` to ModalProps, spread it onto .modal-panel. */
  padding: 0 !important;
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
}

.settings-panel-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-body {
  overflow-y: auto;
  flex: 1 1 auto;
  padding: 20px 24px;
  overscroll-behavior: contain; /* prevent scroll bleed to page behind */
}

/* Custom scrollbar to match dark theme */
.settings-body::-webkit-scrollbar { width: 6px; }
.settings-body::-webkit-scrollbar-track { background: transparent; }
.settings-body::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--panel); /* matches modal background */
}
```

**Required Modal.tsx change (one line):** Add an optional `panelClassName?: string` prop to
`ModalProps` and spread it: `className={\`modal-panel \${panelClassName ?? ""}\`}`. This is the
minimal, backward-compatible touch to Modal.tsx. All existing usages pass no `panelClassName`
and are unaffected.

### Focus trap considerations

The existing focus trap in `Modal.tsx` uses `getFocusable(panelRef.current)` which queries the
entire panel. With ~23 controls, the trap still works correctly — Tab cycles through all
focusable elements, wrapping at the boundary. No changes needed. The sticky footer's buttons
(Cancel, Done) are focusable and will be included in the trap.

One addition: scroll the focused element into view when Tab moves focus to an off-screen field:

```css
/* SettingsModal.css */
.settings-body :focus-visible {
  scroll-margin-top: 8px;
  scroll-margin-bottom: 8px;
}
```

This is purely CSS — no JS change. The browser handles `scroll-margin` automatically when focus
moves.

---

## 3. Per-Control Design Spec

All controls use native HTML elements. No UI library.

### 3.1 Theme

```
Control type:   Radio group (three `<input type="radio">` in a row)
Field:          state.settings.theme
Options:        "system" | "light" | "dark"
Default hint:   None needed — first-time users have "System" pre-selected.
Labels:         System · Light · Dark
Helper text:    "Follows your OS appearance when set to System."
HTML:           <fieldset> + <legend class="settings-label"> + three
                <label><input type="radio" name="settings-theme" value="...">...</label>
Edge cases:     "System" selected — live preview applies immediately via matchMedia.
                Switching Light/Dark — apply instantly to <html data-theme="...">.
Validation:     None — always has a valid value (defaults to "system").
```

Visually render as a segmented control (three bordered boxes side by side) rather than
traditional radio buttons to match the segmented controls used elsewhere. But use actual
`<input type="radio">` elements with `position: absolute; opacity: 0` and style the
`<label>` elements. This preserves keyboard semantics (arrow keys within the group) and
screen reader semantics (announced as "radio group, 3 items").

### 3.2 Accent Color

See Section 5 (dedicated spec) for full detail.

```
Control type:   8-button swatch grid + <input type="color"> (positioned at end of grid)
Field:          state.settings.accentColor
Default hint:   The third swatch (indigo #7c9cff, matching current --accent) is pre-selected.
Helper text:    "Sets the highlight color for buttons, focus rings, and active elements."
Edge cases:     Custom color via <input type="color"> — see Section 5.
```

### 3.3 Font Size

```
Control type:   3-button segmented control
Field:          state.settings.fontSize
Options:        "sm" | "md" | "lg"
Labels:         S · M · L
Default hint:   "M" pre-selected (medium, 15px).
Helper text:    "Adjusts text size across the entire page."
HTML:           <fieldset> + <legend> + three radio-as-segment buttons.
                Same pattern as Theme — radio inputs, styled labels.
Edge cases:     Changing font size applies instantly (data-font-size on <html>).
                The modal's own text changes size — this is intentional and expected.
```

### 3.4 Density

```
Control type:   3-button segmented control
Field:          state.settings.density
Options:        "compact" | "default" | "spacious"
Labels:         Compact · Default · Spacious
Default hint:   "Default" pre-selected.
Helper text:    "Controls row heights and spacing between elements."
HTML:           Same fieldset/radio pattern.
Edge cases:     Compact density in the modal itself — ensure the modal's form remains
                comfortable. Add a min-height on .settings-field to prevent
                controls from collapsing under compact density: min-height: 32px.
                Apply density changes to <html data-density="..."> live.
```

### 3.5 Reduce Motion

```
Control type:   Toggle switch (checkbox, styled)
Field:          state.settings.reducedMotion
Label:          "Reduce motion"
Helper text:    "Pauses the mesh animation and disables UI transitions."
Default hint:   Shows "(on — your OS prefers reduced motion)" if
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
                is true and the field is undefined.
HTML:           <label class="settings-toggle-row">
                  <span class="settings-label-text">Reduce motion</span>
                  <input type="checkbox" class="settings-toggle" ...>
                  <span class="settings-toggle-track" aria-hidden="true"></span>
                </label>
                The checkbox is screen-reader-visible but visually hidden.
                The track/thumb are aria-hidden decorative spans.
Edge cases:     When enabled, transitions in the modal itself must also be suppressed
                (CSS [data-reduced-motion="true"] * rule handles this globally).
                When undefined (not set), the effective value is the OS preference —
                the toggle's checked state is `state.settings.reducedMotion ?? osReduced`.
```

### 3.6 Mesh Background Toggle

```
Control type:   Toggle switch
Field:          state.settings.meshEnabled
Label:          "Mesh background"
Helper text:    "Animates the 3D wireframe behind the page. Disable on older hardware."
Default hint:   Toggle is ON (true) by default.
HTML:           Same toggle pattern as Reduce Motion.
Edge cases:     When toggled off, the intensity slider below becomes
                disabled (aria-disabled="true") and visually dimmed.
                The live preview means toggling off unloads the mesh lazily.
```

### 3.7 Mesh Intensity

```
Control type:   <input type="range"> with adjacent percentage readout
Field:          state.settings.meshIntensity (0–1 float; slider maps 0–100 integers)
Label:          "Intensity"
Helper text:    "Opacity of the mesh wires."
Default hint:   Slider at 90% (matching current uAlpha: 0.9).
HTML:           <label>
                  <span class="settings-label">Intensity</span>
                  <div class="settings-range-row">
                    <input type="range" min="0" max="100" step="1"
                           value={Math.round((state.settings.meshIntensity ?? 0.9) * 100)}
                           disabled={!(state.settings.meshEnabled ?? true)} />
                    <output class="settings-range-value">72%</output>
                  </div>
                  <span class="settings-hint">...</span>
                </label>
Edge cases:     Disabled state when meshEnabled is false — gray out with opacity: 0.4,
                cursor: not-allowed.
                Debounce slider onChange at 100ms (faster than color picker's 300ms
                because the mesh repaint is GPU-side and smooth).
                Value is stored as float: value / 100.
```

### 3.8 Time Format

```
Control type:   3-button segmented control
Field:          state.settings.timeFormat
Options:        "auto" | "12h" | "24h"
Labels:         System · 12h · 24h
Default hint:   "System" pre-selected. Below the control, show:
                "System: 12-hour (from your browser locale)" — resolved at render time
                via Intl.DateTimeFormat(navigator.language).resolvedOptions().hourCycle.
                If hourCycle is h23, the hint reads "System: 24-hour".
Helper text:    See above — dynamic hint. No separate static helper text needed.
HTML:           Same fieldset/radio pattern.
Edge cases:     Auto-detecting system format: do not cache this — re-read on each open.
```

### 3.9 Relative Dates

```
Control type:   Toggle switch
Field:          state.settings.relativeDates
Label:          "Relative dates"
Helper text:    "Shows \"2 days ago\" for recent dates. Older dates always show the full date."
Default hint:   Toggle is ON (true is the default).
HTML:           Toggle pattern.
Edge cases:     No live preview possible here — date formatting only affects section content
                outside the modal. Apply on Done/Cancel as part of the settings snapshot mechanism.
                Note: this is the one visual setting where live preview has low value —
                the user must close the modal to see the effect. Still write immediately
                (snapshot mechanism still applies).
```

### 3.10 Week Start

```
Control type:   3-button segmented control
Field:          state.settings.weekStart
Options:        "sun" | "mon" | "sat"
Labels:         Sun · Mon · Sat
Default hint:   Whichever matches the locale-derived default is pre-selected.
Helper text:    "Sets the first day of the week in the Gantt view."
HTML:           Same fieldset/radio pattern.
Edge cases:     Locale-aware default (from Intl.Locale.getWeekInfo() with fallback to "mon")
                should be computed once when the modal opens and stored in local state,
                not re-computed on each render.
```

### 3.11 Greeting Style

```
Control type:   2-button segmented control
Field:          state.settings.greetingStyle
Options:        "none" | "time-of-day"
Labels:         Off · With time of day
Default hint:   "With time of day" is pre-selected.
Helper text:    "Shows \"Good morning, [name]\" at the top of each new tab."
HTML:           Same fieldset/radio pattern (2-option variant).
Edge cases:     "Off" still respects the name field — it just omits the time-of-day prefix.
                Note: the greeting is outside the modal — the live preview applies
                immediately to the page behind the modal backdrop.
```

### 3.12 Your Name

```
Control type:   <input type="text">
Field:          state.settings.name
Label:          "Your name"
Helper text:    "Appears in the greeting at the top of the page. Leave blank to omit."
Default hint:   Placeholder: "What should we call you?"
maxLength:      48 (existing)
HTML:           Same as current implementation.
Edge cases:     Trimming: trim() on save (Done), not on every keystroke.
                Empty input: name becomes undefined (omitted from greeting).
                Live preview: update on Done, not live — typing your own name while
                watching the greeting flicker would be jarring. This field uses
                apply-on-save instead of live preview. See Section 4 for the exception rule.
```

### 3.13 Default Reminder Lead Time

```
Control type:   6-button segmented control
Field:          state.settings.defaultReminderLeadMinutes
Options:        0 | 5 | 10 | 15 | 30 | 60
Labels:         None · 5m · 10m · 15m · 30m · 1hr
Default hint:   "10m" pre-selected.
Helper text:    "Pre-filled when you create a new reminder."
HTML:           Same fieldset/radio pattern.
                Note: 6 options — the segmented control will be wider than 3-option ones.
                Use font-size: 11px for labels in this control, or allow wrap to 2 rows.
                Recommended: allow it to be 2 rows × 3 options (None/5m/10m on top,
                15m/30m/1hr on bottom) if the modal width is tight.
Edge cases:     "None" means 0 minutes (fire at exact time). Store as 0, not null.
```

### 3.14 Snooze Duration

```
Control type:   3-button segmented control
Field:          state.settings.snoozeMinutes
Options:        10 | 30 | 60
Labels:         10m · 30m · 1hr
Default hint:   "10m" pre-selected.
Helper text:    "Duration when you snooze a notification."
HTML:           Same fieldset/radio pattern.
Edge cases:     Only affects future snooze actions — no retroactive effect on existing alarms.
```

### 3.15 Quiet Hours Enable

```
Control type:   Toggle switch
Field:          state.settings.quietHours (presence/absence)
Label:          "Quiet hours"
Helper text:    "Silence notifications during set hours. Deferred notifications fire
                at the end of the quiet period."
Default hint:   Toggle is OFF (quietHours is undefined by default).
HTML:           Toggle switch. When toggled on, reveals the two time fields below
                (they are DOM-present but hidden via display:none / aria-hidden="true"
                when the toggle is off, for clean ARIA state).
Edge cases:     See Section 6 for detailed quiet hours UI spec.
```

### 3.16 Quiet Hours Time Range

See Section 6 for full spec.

### 3.17 Section Visibility (5 sub-controls)

```
Control type:   5 stacked <input type="checkbox"> controls
Field:          state.settings.sectionVisibility.{today, sprint, longTerm, gantt, reminders}
Labels:         Today · Sprint · Long-term · Gantt · Reminders
Helper text:    (single, at group level) "Choose which sections appear on your dashboard."
Default hint:   All checkboxes are checked by default.
HTML:           <fieldset>
                  <legend class="settings-label">Visible sections</legend>
                  <span class="settings-hint">...</span>
                  <div class="settings-check-list">
                    <label class="settings-check-row">
                      <input type="checkbox" checked={...} onChange={...} />
                      <span>Today</span>
                    </label>
                    ... (×5)
                  </div>
                </fieldset>
Edge cases:     Allow all 5 to be unchecked — the dashboard renders empty (the tab bar
                still shows). Do not prevent unchecking the last one; the user can
                re-enable via Settings. Show a warning hint when all are unchecked:
                "All sections are hidden. Your dashboard will appear empty."
                (This hint appears below the checklist, conditionally.)
```

### 3.18 Export Data

```
Control type:   <button> (non-destructive, secondary styling)
Label:          "Export data"
Helper text:    "Downloads all your todos, sprints, Gantt charts, and reminders as a JSON file."
HTML:           <button type="button" class="settings-action-btn" onClick={handleExport}>
                  Export data
                </button>
Edge cases:     Export should not close the modal. It triggers a download and shows an
                inline confirmation: a small success message "Exported successfully" appears
                next to the button for 2.5s, then disappears.
```

### 3.19 Import Data

```
Control type:   <button> that programmatically triggers <input type="file">
Label:          "Import data"
Helper text:    "Restores from a previously exported Proclivity backup. Current data is replaced."
HTML:           <button type="button" class="settings-action-btn" onClick={() => fileInputRef.current?.click()}>
                  Import data
                </button>
                <input type="file" ref={fileInputRef} accept=".json,application/json"
                       style={{display:"none"}} onChange={handleFileSelect} />
Edge cases:     See Section 8.
```

### 3.20 Clear All Data

```
Control type:   <button> (destructive styling)
Label:          "Clear all data"
Helper text:    none at rest state (the section context provides enough signal)
HTML:           <button type="button" class="btn-danger settings-action-btn" onClick={handleClearRequest}>
                  Clear all data
                </button>
Edge cases:     See Section 7.
```

---

## 4. Live Preview vs Apply-on-Save

### The mechanism

**Most settings use live preview with a snapshot/revert on Cancel.** The exception list is
narrow and deliberate.

**Snapshot taken:** In the `SettingsModal` component, a `useEffect` with `[open]` dependency
takes a deep clone of `state.settings` when the modal opens:

```tsx
const snapshotRef = useRef<UserSettings | null>(null);

useEffect(() => {
  if (open) {
    snapshotRef.current = structuredClone(state.settings);
  }
}, [open]); // intentionally omit state.settings — we only snapshot at open-time
```

`structuredClone` is available in Chrome 98+ (all MV3-capable Chrome versions). No utility
needed.

**Live preview on change:** For visual settings (theme, accent, fontSize, density, reducedMotion,
meshEnabled, meshIntensity, greetingStyle), call `update()` immediately on each input change.
For sliders and color pickers, debounce at 150ms to avoid thrashing storage.

```tsx
const debouncedUpdate = useMemo(
  () => debounce((fn: (s: ProclivityState) => ProclivityState) => update(fn), 150),
  [update]
);
```

Use a minimal inline `debounce` (3 lines) — do not import lodash or any utility.

```ts
function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: T) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
```

**Non-live-preview exceptions (apply on Done only):**
- `state.settings.name` — typing your own name into the input while watching the greeting
  change in real time would be visually noisy. Apply on Done.
- `state.settings.weekStart` — the Gantt chart re-renders on change; the effect is visible
  only outside the modal. Apply on Done to avoid startling the user.
- `state.settings.relativeDates` — same reasoning as weekStart. No visible in-modal effect.
- `state.settings.defaultReminderLeadMinutes` — only affects future reminder creation, invisible.
- `state.settings.snoozeMinutes` — only affects future snooze actions.
- `state.settings.sectionVisibility` — tabs would vanish mid-session; apply on Done.
- `state.settings.quietHours` — service-worker side effect; apply on Done.

These "apply-on-Done" fields are held in local `useState` inside the modal and written to
storage only when `handleDone()` fires.

**"Done" button:** Commits all pending local state (non-live-preview fields) to storage, then
calls `onClose()`. Does NOT revert.

**"Cancel" button:** For live-preview fields, restores `snapshotRef.current` to storage. For
local-state fields, simply discards local state. Then calls `onClose()`.

```tsx
const handleCancel = async () => {
  if (snapshotRef.current) {
    await update((s) => ({ ...s, settings: snapshotRef.current! }));
  }
  onClose();
};
```

**Escape key / backdrop click:** The `Modal.tsx` `onClose` handler fires, which the `SettingsModal`
passes as `handleCancel` — not a bare `onClose`. This means Escape and backdrop click both revert,
exactly like the Cancel button. This is the correct UX: the user made no explicit commitment.

```tsx
<Modal open={open} onClose={handleCancel} title="Settings" panelClassName="settings-modal-panel">
```

**Edge case: destructive actions bypass the snapshot mechanism.**
- **Export:** not destructive; no bypass needed.
- **Import:** replaces all data. The snapshot cannot meaningfully revert an import because
  the snapshot is only of `settings`, not the full `ProclivityState`. Import triggers its
  own confirm dialog (a `ConfirmDialog` from `Modal.tsx`) and after confirmation, closes the
  settings modal entirely (no Cancel available at that point).
- **Clear all data:** Same. The two-step confirm within the settings modal completes the action
  immediately upon second confirmation. After clear, the modal closes.

In both import and clear cases: call `onClose()` directly after the action completes, bypassing
the revert step. The snapshot is stale anyway.

---

## 5. Accent Color Picker UI

### Structure

```tsx
<fieldset className="settings-field">
  <legend className="settings-label">Accent color</legend>
  <div className="accent-swatch-grid" role="radiogroup" aria-label="Accent color presets">
    {ACCENT_PRESETS.map((color) => (
      <label key={color.value} className="accent-swatch-label">
        <input
          type="radio"
          name="accent-color"
          value={color.value}
          checked={currentAccent === color.value}
          onChange={() => handleAccentChange(color.value)}
          className="sr-only"  /* visually hidden, screen-reader accessible */
          aria-label={color.name}
        />
        <span
          className={`accent-swatch ${currentAccent === color.value ? "accent-swatch--active" : ""}`}
          style={{ "--swatch-color": color.value } as React.CSSProperties}
          aria-hidden="true"
        />
      </label>
    ))}
    {/* Custom color swatch — last in the grid */}
    <label className="accent-swatch-label accent-swatch-label--custom" title="Custom color">
      <input
        type="color"
        value={isCustomAccent ? currentAccent : "#7c9cff"}
        onChange={(e) => handleAccentChange(e.target.value)}
        className="accent-color-input"
        aria-label="Custom accent color"
      />
      <span className="accent-swatch accent-swatch--custom" aria-hidden="true">
        {/* Rendered as a "..." or a paint-brush icon using CSS */}
      </span>
    </label>
  </div>
  <span className="settings-hint" id="accent-hint">
    Sets the highlight color for buttons, focus rings, and active elements.
  </span>
</fieldset>
```

### Preset colors

```ts
const ACCENT_PRESETS = [
  { name: "Indigo",    value: "#7c9cff" }, // current default
  { name: "Teal",      value: "#5be3c3" },
  { name: "Rose",      value: "#ff6b9d" },
  { name: "Amber",     value: "#ffb86b" },
  { name: "Violet",    value: "#a78bfa" },
  { name: "Sky",       value: "#38bdf8" },
  { name: "Lime",      value: "#86efac" },
  { name: "Orange",    value: "#fb923c" },
] as const;
```

### CSS for the swatch grid

```css
/* SettingsModal.css */

.accent-swatch-grid {
  display: grid;
  grid-template-columns: repeat(9, 28px); /* 8 presets + 1 custom */
  gap: 6px;
  margin: 4px 0 8px;
}

.accent-swatch-label {
  display: contents; /* let the span be the grid item */
}

.accent-swatch {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--swatch-color);
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 80ms ease, border-color 80ms ease;
}

.accent-swatch:hover {
  transform: scale(1.15);
}

/* Active/selected state: white ring offset */
.accent-swatch--active {
  border-color: var(--text); /* high contrast against the dark background */
  box-shadow: 0 0 0 2px var(--swatch-color);
  /* Renders as: swatch color → gap → white ring — classic selection indicator */
}

/* Focus ring on the hidden radio input — forwarded to the swatch via :has() */
.accent-swatch-label:has(input:focus-visible) .accent-swatch {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* Custom color swatch */
.accent-swatch-label--custom {
  position: relative;
}
.accent-color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  border: none;
  padding: 0;
  border-radius: 50%;
}
.accent-swatch--custom {
  background: conic-gradient(
    #ff6b9d, #ffb86b, #86efac, #38bdf8, #7c9cff, #a78bfa, #ff6b9d
  );
}
/* When a custom color is active, show it instead of the rainbow */
.accent-swatch--custom.accent-swatch--active {
  background: var(--swatch-color, conic-gradient(...));
}
```

### Keyboard navigation

`<input type="radio">` elements within a `radiogroup` already support arrow key navigation
natively (left/right arrows move focus and selection between radios). No JavaScript needed.
The visually-hidden radio inputs are in a natural reading order (left to right), so Tab enters
the group, arrows navigate within it, and Tab exits to the next control.

The custom `<input type="color">` at the end of the grid is a separate focusable element —
Tab reaches it after the last radio.

### Focus ring vs. the mesh background

The selected swatch uses `border: 2px solid var(--text)` + `box-shadow: 0 0 0 2px var(--swatch-color)`.
`var(--text)` is `#e7ecf3` (near-white) in dark mode, which has ≥4.5:1 contrast against every
swatch color in the preset list. The ring is also double-layered (the outer ring is the swatch
color, giving a halo effect), so even against a cluttered mesh background it reads clearly.

When a focus ring from keyboard navigation appears (`outline: 2px solid var(--accent)`), the
accent is the current chosen color — which may be low-contrast against itself. To handle this,
use `outline-color: var(--text)` on `:focus-visible` states within the swatch grid, not `var(--accent)`.

### Screen reader announcements for live accent changes

When a preset is selected, the radio button's selection change is announced by the screen reader
automatically ("Indigo, selected"). No additional `aria-live` region is needed here.

---

## 6. Quiet Hours Control

### Decision: Two `<input type="time">` fields

**Chosen: two `<input type="time">` fields.** Not a dual-handle slider.

**Justification:**
- A dual-handle slider gives no signal about which "side" of midnight a given time is on — the
  slider is a 0–24 axis and the across-midnight case (22:00–06:00) would require the right handle
  to be visually left of the left handle. This is confusing and requires custom rendering logic.
- `<input type="time">` provides a native OS-integrated time picker with keyboard entry, AM/PM
  toggling in 12h locales, and direct digit entry — all for free with a single HTML attribute.
- The user already understands "from X to Y" language. Two fields with a label between them is
  the most literal representation.

### Handling across-midnight

The across-midnight case (22:00 to 06:00) must be made obvious because users may expect a
"from > to" pair to be an error.

Implementation:
- After both fields are set, compute whether `from > to` (midnight-crossing) and show a
  conditional label:

```tsx
const crossesMidnight = from > to;
// Example: "22:00" > "06:00" → true (string comparison works for HH:MM)

{crossesMidnight && (
  <span className="settings-hint settings-hint--info">
    Quiet period spans midnight — ends at {to} the following day.
  </span>
)}
```

- The hint replaces the generic helper text when midnight-crossing is detected.
- Use `color: var(--accent)` or a distinct `var(--warn)` tint (not `var(--danger)` — this is
  not an error) to make the midnight note stand out without implying a problem.

### HTML structure

```tsx
<div
  className={`settings-quiet-hours ${quietHoursEnabled ? "" : "settings-quiet-hours--hidden"}`}
  aria-hidden={!quietHoursEnabled}
>
  <div className="settings-quiet-hours-row">
    <label htmlFor="quiet-from" className="settings-quiet-label">From</label>
    <input
      id="quiet-from"
      type="time"
      value={quietFrom}
      onChange={(e) => setQuietFrom(e.target.value)}
      disabled={!quietHoursEnabled}
    />
    <label htmlFor="quiet-to" className="settings-quiet-label">to</label>
    <input
      id="quiet-to"
      type="time"
      value={quietTo}
      onChange={(e) => setQuietTo(e.target.value)}
      disabled={!quietHoursEnabled}
    />
  </div>
  {crossesMidnight && (
    <span className="settings-hint settings-hint--info">
      Quiet period spans midnight — ends at {quietTo} the following day.
    </span>
  )}
  {!crossesMidnight && (
    <span className="settings-hint">
      Notifications due in this window are deferred to {quietTo}.
    </span>
  )}
</div>
```

CSS:
```css
.settings-quiet-hours--hidden {
  display: none;
}
.settings-quiet-hours-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 4px;
}
.settings-quiet-label {
  font-size: 13px;
  color: var(--text-dim);
  white-space: nowrap;
}
.settings-quiet-hours-row input[type="time"] {
  width: 90px;
}
.settings-hint--info {
  color: var(--accent);
  opacity: 1; /* override the 0.85 on base .settings-hint */
}
```

---

## 7. Destructive Zone

### Location and visual treatment

The Data section is the last section in the modal, below "Account." It is preceded by a
visually distinct divider:

```tsx
<div className="settings-danger-zone">
  <div className="settings-danger-zone-header">
    <span className="settings-danger-zone-label">Data</span>
  </div>
  {/* Export / Import / Clear */}
</div>
```

CSS:
```css
.settings-danger-zone {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
}
.settings-danger-zone-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.settings-danger-zone-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  white-space: nowrap;
}
```

### Clear All Data — confirmation flow

**Mechanism: inline two-step (second button click, no typing required).**

Rationale: "type DELETE" is patronizing for a solo personal extension (per the research report).
A second button click within the modal is sufficient — there are no other users, no support
tickets, and the user can recover from Import.

**State machine:**

```
[rest state]
  "Clear all data" button (btn-danger) visible.
  Helper text: none.

[pending confirmation — after first click]
  "Clear all data" button is replaced by:
    ┌──────────────────────────────────────────────────────┐
    │ This will permanently delete all your todos, sprints,│
    │ Gantt charts, and reminders. This cannot be undone.  │
    │                                                      │
    │  [Cancel]  [Delete everything]                       │
    └──────────────────────────────────────────────────────┘
  Both buttons are rendered inline in the section (not a modal-on-modal).
  "Cancel" returns to rest state.
  "Delete everything" is a red btn-danger button.

[post-action]
  After "Delete everything" click:
  1. Call update(() => EMPTY_STATE).
  2. Call onClose() — modal closes.
  3. The page behind re-renders to empty state immediately.
```

**Why inline (not a nested ConfirmDialog modal):** Nesting a `Modal` inside a `Modal` creates
two backdrop layers, two focus traps, and a jarring visual. The inline expand pattern within
the existing scrollable body is cleaner and has only one focus context.

**Copy:**
```
First button:   "Clear all data"
Confirmation heading: none (the message is inline text, not a heading)
Confirmation body: "This will permanently delete all your todos, sprints, Gantt charts,
                    and reminders. This action cannot be undone."
Cancel button: "Cancel"
Confirm button: "Delete everything"
```

---

## 8. Export / Import Flow

### Export

1. User clicks "Export data" button.
2. SettingsModal calls a `handleExport()` function that:
   a. Reads `state` from `useStore()`.
   b. Constructs the envelope: `{ schemaVersion: 1, appVersion: BUILD_VERSION, exportedAt: new Date().toISOString(), data: state }`.
   c. Creates a `Blob` with `type: "application/json"`.
   d. Creates an object URL and clicks a hidden `<a download="proclivity-backup-YYYY-MM-DD.json">`.
   e. Revokes the object URL.
3. No modal closes. A success text "Exported" appears next to the button for 2.5s
   (via a short `useState` flag with `setTimeout` cleanup).

### Import — full flow

1. User clicks "Import data" button.
2. Hidden `<input type="file" accept=".json">` is triggered.
3. User selects a file.
4. `FileReader.readAsText()` parses the file.
5. **Parse validation:**
   - If `JSON.parse` throws → inline error: "File could not be read. Make sure it's a valid Proclivity backup."
   - If parsed object lacks `schemaVersion` or `data` → inline error: "This doesn't look like a Proclivity backup file."
6. **Schema version check:**
   - `schemaVersion === CURRENT_SCHEMA_VERSION` → show confirm dialog (step 7).
   - `schemaVersion < CURRENT_SCHEMA_VERSION` → show warning in confirm dialog:
     "This backup was made with an older version of Proclivity (schema v{N}). It will be
     upgraded automatically. Some data may appear differently."
     Proceed to step 7 with a migration pass over `envelope.data`.
   - `schemaVersion > CURRENT_SCHEMA_VERSION` → show blocking error (no import):
     "This backup was made with a newer version of Proclivity and cannot be imported.
     Update the extension to restore this backup." No proceed.
7. **Confirm dialog (using existing `ConfirmDialog` from `Modal.tsx`):**
   - Title: "Replace all data?"
   - Message: "Importing will replace all your current todos, sprints, Gantt charts, and
     reminders with the contents of this backup. Your current data will be lost."
   - Confirm label: "Import backup"
   - Cancel: dismisses dialog, file input resets.
8. After confirm: call `update(() => migratedData)`. Close the settings modal.

**Inline error placement:** errors appear as a `<span className="settings-hint settings-hint--error">` directly below the Import button. Error color: `var(--danger)`.

```css
.settings-hint--error {
  color: var(--danger);
  opacity: 1;
}
```

---

## 9. Accessibility Audit

### Focus order

The natural DOM order through the modal is the correct focus order. No `tabindex` reordering
needed. The order will be:
1. Close button (×) in sticky header (if present — see component decomposition for this decision)
2. Theme radio group (arrow keys within)
3. Accent color radio group (arrow keys within) → color input
4. Font size radio group
5. Density radio group
6. Reduce motion checkbox
7. Mesh background checkbox
8. Intensity slider (skipped if disabled)
9. Time format radio group
10. Relative dates checkbox
11. Week start radio group
12. Greeting radio group
13. Lead time radio group
14. Snooze radio group
15. Quiet hours checkbox
16. Quiet hours From time input (if visible)
17. Quiet hours To time input (if visible)
18. Section visibility checkboxes × 5
19. Name text input
20. Export button
21. Import button
22. Clear data button (or Cancel/Delete in confirmation state)
23. Cancel button (footer)
24. Done button (footer)

Total focusable elements: ~27 at most. Manageable with Tab. Arrow keys handle radio groups
internally, reducing the number of Tab stops.

### Labels

All controls use one of two patterns — both are correct:

- **Wrapping label:** `<label>...<input>...</label>` — used for toggles, checkboxes, and
  standalone text inputs. No `htmlFor`/`id` pair needed.
- **`<legend>` + `<fieldset>`:** used for radio groups (theme, font size, density, etc.).
  The `<legend>` provides the group's accessible name. Each `<label>` inside wraps its
  `<input type="radio">`.

The only control that uses `htmlFor`/`id` explicitly is quiet hours (`From`/`to` labels
point to `input[type="time"]` elements with `id`s).

### `aria-describedby` for helper text

Each helper text `<span>` gets an `id`. The associated input (or `<fieldset>`) gets
`aria-describedby={id}`. Example:

```tsx
<fieldset aria-describedby="hint-theme">
  <legend className="settings-label">Theme</legend>
  {/* radio inputs */}
  <span className="settings-hint" id="hint-theme">
    Follows your OS appearance when set to System.
  </span>
</fieldset>
```

For toggle switches, `aria-describedby` is on the `<input type="checkbox">`:
```tsx
<input type="checkbox" aria-describedby="hint-reduced-motion" />
<span className="settings-hint" id="hint-reduced-motion">...</span>
```

### Color contrast for swatches

The accent swatches are decorative color choices, not text — WCAG 2.1 SC 1.4.3 (contrast)
applies to text and UI components, not pure decorative color swatches. However:
- The **selected state ring** (`border: 2px solid var(--text)`) must be visible against all
  backgrounds. `var(--text)` = `#e7ecf3`, which is ≥ 4.5:1 against the dark modal background
  (`var(--panel)` = `#161a22`). Passes.
- The **focus ring** (`outline: 2px solid var(--text)`) on keyboard focus — same analysis. Passes.
- The swatch labels are announced by screen readers via `aria-label` on the radio inputs —
  color name text contrast is not a concern.

For the mesh-background visibility concern: the modal panel has `background: var(--panel)`
(`#161a22`) which is fully opaque (not `rgba`). The swatches render inside the panel,
not against the mesh. No bleed-through concern.

### Screen reader announcements for live-preview changes

Live visual changes (theme, accent, density) happen outside the modal but do not require
`aria-live` announcements. The settings are non-critical preference changes; announcing
every slider movement would be disruptive. Screen reader users will observe the effect
when they close the modal and navigate the page.

Exception: the midnight-crossing hint in quiet hours — this is conditional information that
may appear mid-session. Use `role="status"` on the hint span so it is announced without
being intrusive:
```tsx
<span role="status" className="settings-hint settings-hint--info">
  Quiet period spans midnight — ends at {quietTo} the following day.
</span>
```

### Reduced motion: modal's own transitions

`Modal.css` currently has:
```css
animation: modal-fade-in 120ms ease;
animation: modal-slide-in 150ms ease;
```

These must respect reduced motion. Add to `Modal.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .modal-backdrop { animation: none; }
  .modal-panel    { animation: none; }
}
```

Additionally, when `state.settings.reducedMotion === true`, the `data-reduced-motion="true"`
attribute on `<html>` should trigger the same suppression:
```css
[data-reduced-motion="true"] .modal-backdrop,
[data-reduced-motion="true"] .modal-panel {
  animation: none;
}
```

The toggle switch animation (thumb sliding) and slider transitions should also be gated:
```css
.settings-toggle-track,
.settings-range-row input[type="range"] {
  transition: background 120ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .settings-toggle-track { transition: none; }
}
[data-reduced-motion="true"] .settings-toggle-track { transition: none; }
```

### Keyboard-only operation end-to-end

Complete keyboard path to change the theme from System to Dark:
1. `Tab` to the gear icon in the header → `Enter` to open Settings.
2. Modal opens. Focus moves to... the first focusable element in the panel (the close button or
   Theme radio group, per component decision — see Section 11).
3. `Tab` to reach the Theme radio group (or arrow directly if already there).
4. `Right arrow` twice to reach "Dark" radio.
5. `Space` or `Right arrow` selects "Dark" — live preview applies.
6. `Tab` through remaining controls as needed.
7. `Tab` to the "Done" button in the sticky footer → `Enter` to commit.

Or: `Escape` at any point reverts and closes. This is fully keyboard-accessible with zero
JavaScript workarounds required, because the underlying elements are correct HTML.

---

## 10. Settings Discoverability

### Decision: One-time pulsing dot badge on the gear icon

**Chosen: a subtle animated dot ("new" badge) on the gear icon that dismisses on first open.**

Rationale:
- A **toast notification** ("Settings just got bigger!") is intrusive — it fires on every new
  tab until dismissed, and toasts in a productivity context compete with the work being done.
- An **onboarding panel** (full screen overlay) is far too heavy for a settings expansion.
  The user knows this is a settings icon; they just don't know how much is there now.
- A **"New" text badge** (like the App Store model) is clear but visually heavy for a small
  icon-only button.
- A **pulsing dot** (like notification badges on mobile apps) is immediately recognizable as
  "something new here," is dismissed by the single expected action (opening Settings), and
  adds ≤ 50 CSS lines.

**Implementation:**
- Store a boolean `state.settings._settingsV2Seen` (or a schema version counter) in settings.
  When the field is absent/false, render the badge dot on the gear button.
- On first open of `SettingsModal`, set `_settingsV2Seen: true` in storage.
- The badge is a `::after` pseudo-element on `.settings-button`:

```css
.settings-button[data-new="true"]::after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
  animation: badge-pulse 2s ease-in-out infinite;
}
@keyframes badge-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}
@media (prefers-reduced-motion: reduce) {
  .settings-button[data-new="true"]::after { animation: none; }
}
[data-reduced-motion="true"] .settings-button[data-new="true"]::after {
  animation: none;
}
```

In `App.tsx`:
```tsx
<button
  data-new={!state.settings._settingsV2Seen ? "true" : undefined}
  ...
>
```

The `_settingsV2Seen` field should be considered sibling-agent scope (data model) but the
field name and semantics are called out here for the implementor. The UI agent will read it
to conditionally render the badge.

---

## 11. Component Decomposition

### Decision: Split into sub-components per section

`SettingsModal.tsx` will grow from 74 lines to ~400+ lines if kept monolithic. Split it.

### Proposed component tree

```
src/components/settings/
├── SettingsModal.tsx              ← orchestrator: snapshot, done/cancel, modal shell
│   imports all section components
├── SettingsAppearanceSection.tsx  ← theme, accent, font size, density, reduced motion
├── SettingsBackgroundSection.tsx  ← mesh toggle, intensity slider
├── SettingsDateTimeSection.tsx    ← time format, relative dates, week start
├── SettingsDisplaySection.tsx     ← greeting style
├── SettingsNotificationsSection.tsx ← lead time, snooze, quiet hours
├── SettingsDashboardSection.tsx   ← section visibility checkboxes
├── SettingsAccountSection.tsx     ← name input
├── SettingsDataSection.tsx        ← export, import, clear-all-data
└── SettingsControls.tsx           ← shared primitives: SegmentedControl, ToggleSwitch
```

### Filenames rationale

- `SettingsModal.tsx` keeps its existing name so no import sites break.
- Sub-components are co-located under `src/components/settings/` to distinguish them from
  the generic `src/components/` components (Modal, TodoItem).
- `SettingsControls.tsx` exports `<SegmentedControl>` and `<ToggleSwitch>` — the two
  patterns used across multiple sections. Keeping them here avoids a bloated
  `src/components/` directory.

### Where shared form-control styling lives

All settings-specific CSS stays in `SettingsModal.css` (renamed path:
`src/components/settings/SettingsModal.css`). This single file is imported by `SettingsModal.tsx`
and covers:
- `.settings-body`, `.settings-footer`, `.settings-panel-header`
- `.settings-section`, `.settings-section-heading`
- `.settings-field`, `.settings-label`, `.settings-hint`
- `.settings-toggle-row`, `.settings-toggle`, `.settings-toggle-track`
- `.settings-range-row`, `.settings-range-value`
- `.settings-check-list`, `.settings-check-row`
- `.settings-quiet-hours`, `.settings-quiet-hours-row`
- `.accent-swatch-grid`, `.accent-swatch`, `.accent-swatch--active`, `.accent-swatch--custom`
- `.settings-action-btn`
- `.settings-danger-zone`, `.settings-danger-zone-label`
- `.settings-hint--info`, `.settings-hint--error`

Sub-components do **not** import their own CSS files. They use class names defined in the
parent `SettingsModal.css`. This is intentional: it keeps all settings styling in one
auditable file, mirrors how App.css covers the entire app header.

### `SettingsControls.tsx` API sketches

```tsx
// Segmented control (radio group styled as buttons)
interface SegmentedControlProps<T extends string | number> {
  name: string;              // unique radio group name
  legend: string;            // accessible group label (visually rendered as settings-label)
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  hint?: string;
  hintId?: string;
}

// Toggle switch (checkbox styled as iOS toggle)
interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  hintId?: string;
  disabled?: boolean;
  systemDefault?: boolean;  // adds "(on — system preference)" suffix to label
}
```

### SettingsModal.tsx responsibilities

- Owns `snapshotRef` and `handleCancel` / `handleDone`.
- Owns the local state for apply-on-Done fields (name, weekStart, relativeDates, etc.).
- Passes both the live-preview `update` function and the local state setters down to sections
  as props.
- Renders the scrollable modal shell, sticky header, and sticky footer.
- No section-specific logic lives here.

---

## ASCII Wireframe (full modal)

The wireframe is already rendered in Section 1 above. Refer to that diagram for the
complete visual layout.

---

## Copy Deck Appendix

All user-facing text in one place for tone/consistency review.

### Section headings (12px uppercase)

```
APPEARANCE
BACKGROUND
DATE & TIME
DISPLAY
NOTIFICATIONS
DASHBOARD
ACCOUNT
DATA
```

### Field labels (12px uppercase, var(--text-dim))

```
Theme
Accent color
Font size
Density
Reduce motion
Mesh background
Intensity
Time format
Relative dates
Week starts on
Greeting
Default reminder lead time
Snooze duration
Quiet hours
Visible sections
Your name
```

### Helper text (12px, var(--text-dim), opacity 0.85)

```
Theme (System selected):  "Follows your OS appearance when set to System."
Theme (Light/Dark selected): "Your chosen theme is always applied, regardless of OS."

Accent color:   "Sets the highlight color for buttons, focus rings, and active elements."

Font size:      "Adjusts text size across the entire page."

Density:        "Controls row heights and spacing between elements."

Reduce motion (default — no OS preference):
                "Pauses the mesh animation and disables UI transitions."
Reduce motion (when OS prefers reduced, not overridden):
                "Pauses the mesh animation and disables UI transitions.
                 (On — your OS prefers reduced motion.)"

Mesh background: "Animated 3D wireframe behind the page. Disable on older hardware."

Intensity:       "Opacity of the mesh wires."

Time format (System, 12h locale):  "System: 12-hour (from your browser locale)"
Time format (System, 24h locale):  "System: 24-hour (from your browser locale)"
Time format (12h selected):        "Forces 12-hour display: 5:30 PM"
Time format (24h selected):        "Forces 24-hour display: 17:30"

Relative dates:  "Shows \"2 days ago\" for recent dates. Dates older than a week show the full date."

Week starts on:  "Sets the first day of the week in the Gantt view."

Greeting:        "Shows \"Good morning, [name]\" at the top of each new tab."

Lead time:       "Pre-filled when you create a new reminder."

Snooze:          "Duration when you snooze a notification."

Quiet hours (off): "Silence notifications during set hours."
Quiet hours (on, no midnight cross):
                   "Notifications due in this window are deferred to [to-time]."
Quiet hours (on, crosses midnight):
                   "Quiet period spans midnight — ends at [to-time] the following day."

Visible sections: "Choose which sections appear on your dashboard."
Visible sections (all unchecked warning):
                   "All sections are hidden. Your dashboard will appear empty."

Your name:       "Appears in the greeting at the top of the page. Leave blank to omit."
                 Placeholder: "What should we call you?"

Export data:     "Downloads all your todos, sprints, Gantt charts, and reminders as a JSON file."

Import data:     "Restores from a previously exported Proclivity backup. Current data is replaced."

```

### Button labels

```
Done                     ← settings footer, primary
Cancel                   ← settings footer, secondary
Export data              ← action button (non-destructive)
Import data              ← action button (non-destructive)
Clear all data           ← danger button (first click)
Delete everything        ← danger button (second click, confirmation)
Cancel                   ← inline cancel in clear-all confirmation
Import backup            ← ConfirmDialog confirm label for import
Replace my data          ← alternative for import confirm (pick one)
```

### Error and status messages

```
Import — JSON parse error:
  "File could not be read. Make sure it's a valid Proclivity backup (.json)."

Import — missing schemaVersion/data:
  "This doesn't look like a Proclivity backup file."

Import — schemaVersion too new:
  "This backup was made with a newer version of Proclivity and cannot be imported.
   Update the extension to restore this backup."

Import — schemaVersion older (warning, not error):
  "This backup was made with an older version of Proclivity (schema v{N}).
   It will be upgraded automatically. Some data may look different."

Export — success:
  "Exported"   (appears briefly next to the Export button)

Clear all data — confirmation body:
  "This will permanently delete all your todos, sprints, Gantt charts, and reminders.
   This action cannot be undone."
```

### Aria labels (not visible, screen reader only)

```
Settings modal title:    "Settings"
Accent color group:      "Accent color presets"
Each swatch:             "[Color name]" e.g. "Indigo", "Teal", "Rose"
Custom color swatch:     "Custom accent color"
Mesh intensity slider:   "Mesh intensity, [N]%"
Settings close button:   "Close settings"   (if a close button exists in header)
```

---

## Risks & Open Questions

1. **Snapshot depth.** `structuredClone(state.settings)` is shallow enough that it works
   for `UserSettings` (no nested class instances or circular refs). But if the sibling agent
   adds a field with a non-cloneable value (e.g., a `Blob` or `File`), `structuredClone` will
   throw. Risk is low (settings are plain JSON-serializable objects), but worth documenting.

2. **`panelClassName` prop on Modal.tsx.** The integration plan calls for a one-line change to
   `Modal.tsx` to support a `panelClassName` prop. If the sibling agent or another agent has
   modified `Modal.tsx` before this change lands, a merge conflict is possible. Coordinate the
   order: Modal.tsx change in Commit 1, SettingsModal content in Commit 2+.

3. **Live preview + multi-tab behavior.** `useStore` subscribes to `chrome.storage.onChanged`,
   so live-preview updates in one tab immediately propagate to all open tabs. This is generally
   good (consistent appearance), but if the user has Settings open in Tab A and is working in
   Tab B, visual changes during a Cancel-then-revert sequence will flash briefly in Tab B. No
   fix is proposed for v1 — the use case is acceptable for a solo extension.

4. **Segmented control at 480px with 6 options (lead time).** "None / 5m / 10m / 15m / 30m / 1hr"
   is 6 options. At the modal's 480px width (432px inner content), each segment is ~72px wide.
   That's tight but feasible with `font-size: 11px`. If it wraps or looks crowded on testing,
   switch to a `<select>` dropdown for this specific control — no design philosophy is violated.

5. **`_settingsV2Seen` field naming.** Using a private-convention underscore prefix on a
   persisted storage field is unusual. An alternative: store it as a `seenWhatsnew: number`
   (schema version number the user has seen), which generalizes to future "new settings" badges
   without adding more fields. The sibling agent should make this call.

6. **Quiet hours and the service worker.** The service worker must be updated to read
   `quietHours` from storage and suppress or defer notifications. The UI plan assumes deferred
   (fire at end of quiet period), but the sibling agent may choose to suppress (skip entirely).
   The copy reads "deferred" — coordinate so the copy matches the behavior.

7. **`<input type="color">` value format.** The native color picker always returns a lowercase
   hex string (e.g., `#7c9cff`). The research report recommends storing accent color as OKLCH.
   If the sibling agent stores OKLCH strings, the color picker needs a hex→OKLCH conversion
   on write and an OKLCH→hex conversion when populating the picker. This is ~20 lines of math.
   The UI plan treats this as sibling scope but flags it as an integration point: the
   `handleAccentChange()` function in `SettingsModal` must be format-aware.

8. **`data-font-size` live preview in the modal.** Changing font size immediately resizes the
   modal's own text. This is intentional (you see what you're getting), but it may cause the
   modal to grow or shrink in height. At `max-height: min(80vh, 720px)`, the content area
   simply scrolls more or less. No clip or overflow issue expected, but test on compact-density
   + large-font combination.

9. **Import ConfirmDialog nesting.** Import confirmation uses the existing `ConfirmDialog`
   component from `Modal.tsx`. This renders a second portal at `z-index: 9000`. If both
   `SettingsModal` and the import `ConfirmDialog` are open simultaneously, their backdrop
   layers stack. The import dialog should use `z-index: 9100` to sit above the settings modal.
   This requires a `zIndex?: number` prop on `Modal.tsx`, or the confirm dialog is shown only
   after the settings modal slides aside (not recommended — jarring). Simplest fix: apply
   `z-index: 9100` to the import confirm dialog's backdrop via a className prop.

10. **Section visibility and the active tab.** If the user hides the "Gantt" section but has
    the Gantt tab active, and then clicks Done, the dashboard will show the Gantt content with
    no visible tab to switch away from. Apply-on-Done means this switch happens with modal close.
    The app should guard against this: if the active tab becomes hidden, switch to the first
    visible tab automatically on Done. The SettingsModal `handleDone` function should check and
    call a `setTab()` prop if needed. This is a data-model/App.tsx concern but the UI agent
    flags it here.

---

## Recommended PR Sequence

Break the UI work into 4 commits so each is independently testable.

### Commit 1 — Modal shell upgrade
**Scope:** `Modal.tsx` + `Modal.css`
- Add optional `panelClassName?: string` to `ModalProps` (one line).
- Add `[data-reduced-motion="true"] .modal-backdrop, [data-reduced-motion="true"] .modal-panel { animation: none; }` to `Modal.css`.
- Add `@media (prefers-reduced-motion: reduce) { .modal-backdrop, .modal-panel { animation: none; } }` to `Modal.css`.
**Testable:** existing `TextInputModal` and `ConfirmDialog` are unaffected (no `panelClassName` passed). Open any rename flow and verify it still works.

### Commit 2 — SettingsModal layout skeleton
**Scope:** `SettingsModal.tsx` (refactor into scrollable layout) + `SettingsModal.css` (new layout CSS)
- Rename/move `SettingsModal.tsx` to `src/components/settings/SettingsModal.tsx`. Update imports.
- Move existing name field content into `SettingsAccountSection.tsx`.
- Create the scrollable layout (`.settings-body` + `.settings-footer`) with sticky footer.
- Create `.settings-section` + `.settings-section-heading` CSS, add a single "Account" section heading.
- Create `SettingsControls.tsx` with `<SegmentedControl>` and `<ToggleSwitch>` shells (props-typed, no logic yet).
**Testable:** Settings modal opens, shows the name field as before, now in a scrollable container with sticky Cancel/Done footer. No functional regression.

### Commit 3 — Appearance, Background, Date & Time sections
**Scope:** `SettingsAppearanceSection.tsx`, `SettingsBackgroundSection.tsx`, `SettingsDateTimeSection.tsx` + corresponding CSS additions
- Implement all controls in these three sections.
- Implement snapshot/revert mechanism in `SettingsModal.tsx`.
- Implement live preview for theme, accent, density, fontSize, reducedMotion, meshEnabled, meshIntensity.
- Implement discoverability badge (gear icon dot).
**Testable:** Open Settings → see three sections. Change theme → page changes behind the modal. Cancel → reverts. Verify Badge on gear icon clears on first open.

### Commit 4 — Notifications, Dashboard, Data sections
**Scope:** `SettingsNotificationsSection.tsx`, `SettingsDashboardSection.tsx`, `SettingsDataSection.tsx`
- Implement quiet hours toggle + time fields.
- Implement section visibility checkboxes (apply on Done).
- Implement export, import (with schema-version checks), clear-all-data (inline two-step confirm).
**Testable:** End-to-end settings round-trip: export a backup, clear all data, import the backup, verify state is restored. Quiet hours toggle shows/hides time fields. Section visibility hides the correct tabs on Done.
