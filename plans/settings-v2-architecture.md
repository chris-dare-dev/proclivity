# Settings v2 — Architecture Map

**Generated:** 2026-05-12  
**Scope:** commits `3860902` through `6b2f01f` (six commits, all on `main`)  
**Purpose:** Reference for the sibling agent re-integrating the Gemini Nano section from milestone `gemini-nano-m1` (commits `b849eb0`, `b99a92b`) into the new Settings v2 modal.

---

## 1. TL;DR

- **Settings modal replaced wholesale.** `src/components/SettingsModal.tsx` (304 lines) was deleted and replaced with `src/components/settings/SettingsModal.tsx` (930 lines). The new modal is a sectioned, scrollable layout with eight named sections and a sticky Done/Cancel footer.
- **Split interaction model.** Visual settings (theme, accent, density, font size, mesh) preview live immediately via `live()`. Functional settings (name, week start, date format, reminders, visibility) are held in local pending state and written only when the user clicks Done; Cancel reverts all pending changes plus any live previews via a snapshot taken at open.
- **Full settings schema.** `UserSettings` grew from three fields to 20+. A companion `ResolvedUserSettings` type and `resolvedSettings()` function in `src/storage/constants.ts` supply fully-defaulted values so no consumer needs its own `?? fallback` guard.
- **Theme system extracted.** Color tokens moved from `src/newtab/index.css` into `src/styles/theme.css`. The new `useThemeSync()` hook applies `data-theme`, `data-density`, `data-font-size`, and `data-reduced-motion` to `<html>`, plus writes `--accent` inline. All consumers downstream of `<html>` attributes get the values automatically.
- **Section visibility is live.** `App.tsx` filters the tab list and hides section content against `rs.sectionVisibility`. Hiding all tabs shows an empty-state fallback; the active tab auto-advances to the first visible tab if it gets hidden.

---

## 2. File Inventory

| Path | Role | Lines | Key exports / responsibilities |
|------|------|-------|-------------------------------|
| `src/components/settings/SettingsModal.tsx` | v2 modal — main component + all section sub-components | 930 | `SettingsModal` (default export implied by named); eight `*Section` private components |
| `src/components/settings/SettingsModal.css` | Styles for v2 modal only | 429 | `.settings-modal-panel`, `.settings-section`, `.settings-segmented`, `.settings-toggle-*`, accent swatch grid |
| `src/components/settings/SettingsControls.tsx` | Reusable form primitives | 138 | `SegmentedControl<T>`, `ToggleSwitch` |
| `src/hooks/useThemeSync.ts` | Theme / density / reduced-motion side effects | 94 | `useThemeSync(settings: UserSettings): void` |
| `src/styles/theme.css` | OKLCH design-token stylesheet | 145 | CSS custom properties; `[data-theme]`, `[data-density]`, `[data-font-size]`, `[data-reduced-motion]` attribute rules |
| `src/storage/exportImport.ts` | JSON backup round-trip | 119 | `exportData()`, `importData(file)`, `ProclivityExport`, `ImportResult`, `CURRENT_SCHEMA_VERSION` |
| `src/types/index.ts` | All shared types | 180 | `UserSettings`, `ResolvedUserSettings`, `ProclivityState`, all auxiliary union types |
| `src/storage/constants.ts` | Storage key + defaults + resolver | 94 | `STORAGE_KEY`, `DEFAULT_SETTINGS`, `resolvedSettings()` |
| `src/components/Modal.tsx` | Base modal + `TextInputModal` + `ConfirmDialog` | 227 | `Modal` (gained `panelClassName?`), `TextInputModal`, `ConfirmDialog` |
| `src/components/Modal.css` | Base modal styles | 109 | `.modal-backdrop`, `.modal-panel`, `.modal-btn-primary`, `.modal-btn-danger` |
| `src/components/MeshBackground.tsx` | Three.js canvas background | 249 | `MeshBackground` (props: `intensity?`, `reducedMotion?`); `WarpMesh` (internal) |
| `src/components/MeshBackground.css` | Mesh container styles | 28 | `opacity: var(--mesh-intensity, 0.2)` — sole brightness control |
| `src/newtab/App.tsx` | Root UI — header, tabs, sections | 217 | `App` (default), `Header` (memo); wires `rs.sectionVisibility`, `rs.meshEnabled`, `rs.meshIntensity`, `rs.reducedMotion` |
| `src/newtab/App.css` | App shell styles | 123 | `.settings-button[data-new="true"]::after` — pulse badge |
| `src/background/service-worker.ts` | Chrome alarms + notifications | 333 | Quiet-hours deferral, snooze handler, alarm reconciliation |
| `src/storage/storage.ts` | Chrome/localStorage abstraction | 83 | `storage` object (`get`, `set`, `update`, `subscribe`), `uid()` |
| `src/storage/useStore.ts` | React hook wrapping `storage` | 33 | `useStore()` → `{ state, loading, update }` |

---

## 3. `UserSettings` and `ResolvedUserSettings`

### `UserSettings` (src/types/index.ts:79–125)

```ts
export interface UserSettings {
  name?: string | undefined;
  // Appearance
  theme?: ThemeMode | undefined;              // "light" | "dark" | "system"
  accentColor?: string | undefined;           // hex, e.g. "#7c9cff"
  density?: DensityLevel | undefined;         // "compact" | "default" | "spacious"
  fontSize?: FontSizeScale | undefined;       // "sm" | "md" | "lg"
  reducedMotion?: boolean | undefined;
  // Background
  meshEnabled?: boolean | undefined;
  meshIntensity?: number | undefined;         // 0–1 fraction
  meshColorMode?: MeshColorMode | undefined;  // "auto" | "manual" — no UI yet for "manual"
  meshColor?: string | undefined;             // used when meshColorMode === "manual"
  // Locale / formatting
  timeFormat?: TimeFormat | undefined;        // "auto" | "12h" | "24h"
  relativeDates?: boolean | undefined;
  weekStart?: WeekStart | undefined;          // "sun" | "mon" | "sat"
  // Greeting
  greetingStyle?: GreetingStyle | undefined;  // "none" | "time-of-day"
  // Section visibility (partially optional nested object)
  sectionVisibility?: {
    today?: boolean | undefined;
    sprint?: boolean | undefined;
    longTerm?: boolean | undefined;
    gantt?: boolean | undefined;
    reminders?: boolean | undefined;
  } | undefined;
  // Reminders / notifications
  defaultReminderLeadMinutes?: LeadMinutes | undefined;   // 0|5|10|15|30|60
  defaultRecurrence?: RecurrenceDefault | undefined;       // "none"|"daily"|"weekly"
  snoozeMinutes?: SnoozeMinutes | undefined;               // 10|30|60
  quietHours?: { from: string; to: string } | undefined;  // "HH:MM" strings
  // Internal / housekeeping
  lastKnownTzOffset?: number | undefined;    // not surfaced in UI (reserved)
  settingsV2Seen?: boolean | undefined;      // drives "new" badge on gear icon
}
```

### `ResolvedUserSettings` (src/types/index.ts:133–161)

Identical field set, but every field has a non-optional value except `quietHours` and `lastKnownTzOffset` (both `| undefined` by design — undefined means "feature disabled").

### Relationship and `resolvedSettings()`

`src/storage/constants.ts` exports `DEFAULT_SETTINGS: ResolvedUserSettings` (lines 15–48) and `resolvedSettings(s: UserSettings): ResolvedUserSettings` (lines 59–94).

The resolver applies `?? DEFAULT_SETTINGS.<field>` for every scalar field. `sectionVisibility` is merged one level deep (line 60–82) so a stored partial override (e.g. only `gantt: false`) does not wipe the other tabs' defaults. `quietHours` and `lastKnownTzOffset` pass through as-is (no default fallback; undefined stays undefined).

**Internal-only fields:**
- `settingsV2Seen` — toggled to `true` on first open of the v2 modal (line 139, 143, 192, 201 of SettingsModal.tsx). Drives `data-new="true"` on the gear button (App.tsx:86), which triggers the CSS pulse badge.
- `lastKnownTzOffset` — reserved; not written by any current code path.

---

## 4. The Settings Modal Structure

### Component shape (`src/components/settings/SettingsModal.tsx`)

**Props:** `{ open: boolean; onClose: () => void }` (line 27–30).

**State:** The component manages two classes of state simultaneously:
1. *Live-preview state* — stored immediately in `chrome.storage.local` via `live(key, value)` (line 149–157). Visual controls write here: `theme`, `accentColor`, `fontSize`, `density`, `reducedMotion`, `meshEnabled`, `meshIntensity`, `greetingStyle`, `timeFormat`.
2. *Pending state* — held in React local state and committed only on Done: `pendingName`, `pendingWeekStart`, `pendingRelativeDates`, `pendingLead`, `pendingRecurrence`, `pendingSnooze`, `pendingQuietEnabled`, `pendingQuietFrom`, `pendingQuietTo`, `pendingVisibility`.

A snapshot of `state.settings` is taken at open via `structuredClone` (line 124) into `snapshotRef`. Cancel (line 196–205) writes the snapshot back, preserving `settingsV2Seen: true`.

**Layout:** sticky-header + scrollable-body + sticky-footer. `Modal` receives `panelClassName="settings-modal-panel"` (line 255) which overrides the default `.modal-panel` padding. The footer (lines 315–327) contains Cancel and Done buttons; no save-on-blur, no auto-save for pending state.

### Section / tab list

| Section component | Category | Lines | Live or Pending |
|-------------------|----------|-------|-----------------|
| `AppearanceSection` | Theme, accent color (presets + custom), font size, density, reduce motion | 343–485 | All live |
| `BackgroundSection` | Mesh enable toggle, intensity slider | 487–537 | All live |
| `DateTimeSection` | Time format (live), relative dates (pending), week start (pending) | 539–597 | Mixed |
| `DisplaySection` | Greeting style | 600–625 | Live |
| `NotificationsSection` | Lead time, snooze, quiet hours (all pending) | 627–731 | All pending |
| `DashboardSection` | Section visibility checkboxes (5 tabs) | 734–801 | Pending |
| `AccountSection` | Display name | 803–829 | Pending |
| `DataSection` | Export / Import / Clear all (destructive zone) | 832–930 | Side-effects only |

### Interaction model

- **Visual controls auto-save immediately** (live preview). If the user cancels, the snapshot is restored.
- **Functional controls (name, schedule, visibility) commit only on Done.**
- `timeFormat` is a notable exception: it's in `DateTimeSection` but calls `live()` directly (line 568), so it previews immediately while its neighbors (`relativeDates`, `weekStart`) are pending.
- The `DataSection` has no pending state — Export downloads a file immediately, Import replaces all state and closes the modal, Clear requires a two-step confirmation inside the section.

### Reusable primitives (`src/components/settings/SettingsControls.tsx`)

#### `SegmentedControl<T extends string | number>`
```ts
interface SegmentedControlProps<T> {
  name: string;           // radio group name attribute
  legend: string;         // visible label
  options: ReadonlyArray<SegmentOption<T>>;  // { value: T; label: string }
  value: T;
  onChange: (value: T) => void;
  hint?: ReactNode | undefined;
  legendSuffix?: string | undefined;  // parenthetical appended to legend
}
```
Renders as a `<fieldset>` with a pill-button row. Native radio inputs are visually hidden; arrow-key navigation works within the group. `aria-describedby` wired to the hint span.

#### `ToggleSwitch`
```ts
interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode | undefined;
  disabled?: boolean | undefined;
  systemForced?: string | undefined;  // e.g. "(on — your OS prefers reduced motion)"
}
```
Renders as a styled checkbox. When `systemForced` is provided the toggle is forced to the on position and disabled, and the suffix appears next to the label.

No `Slider` or generic `Input` primitive exists — the mesh-intensity slider and name input are inline in their respective section components.

### "New" indicator behavior

`App.tsx` line 86: `data-new={rs.settingsV2Seen ? undefined : "true"}`. When the attribute is present, `App.css` lines 61–79 render a pulsing `::after` dot in `var(--accent)`. On first open, `SettingsModal.tsx` line 138–143 sets `settingsV2Seen: true`, removing the attribute on the next render.

---

## 5. Persistence Model

**Single storage key.** All state lives under `"proclivity:state:v1"` (`STORAGE_KEY`, `src/storage/constants.ts:7`) in `chrome.storage.local`. There is no second key for settings, no `IndexedDB`, and no separate settings migration path.

**Read path:** `storage.get()` → `{ ...EMPTY_STATE, ...raw }` (spreads to add any new top-level fields that were absent in old stored data). `useStore()` calls this on mount, then subscribes to `chrome.storage.onChanged` for live updates.

**Write path:** `storage.update(fn)` serializes through a module-level `writeChain` promise so concurrent calls never clobber each other (`src/storage/storage.ts:42–55`).

**Settings read from the UI:** Components always call `resolvedSettings(state.settings)` rather than reading `state.settings` fields directly. This is the canonical pattern — see `App.tsx:49`, `SettingsModal.tsx:76–79`, `useThemeSync.ts:15`.

**No schema migrations.** `importData()` notes "for schemaVersion === 1 the shape matches ProclivityState directly" (exportImport.ts:97). Future breaking changes should bump `CURRENT_SCHEMA_VERSION` (currently 1) and add migration logic in `importData`.

---

## 6. Theme System

### `src/styles/theme.css` — token catalog

`:root` (dark baseline, always active):
- Surface: `--bg`, `--panel`, `--panel-2`, `--border`
- Text: `--text`, `--text-dim`
- Accent: `--accent` (#7c9cff; overridden inline by `useThemeSync`), `--accent-2`
- Semantic: `--danger`, `--warn`, `--ok`
- Shape: `--radius` (10px)
- Spacing: `--space-1` through `--space-5`, `--row-height`, `--section-gap`, `--panel-pad-y`, `--panel-pad-x`, `--form-gap`
- Typography: `--font-size-base` (15px), `--line-height-base` (1.5)

`[data-theme="light"]` — overrides all surface, text, accent, and semantic tokens for the light palette (OKLCH values).

`[data-density="compact"]` and `[data-density="spacious"]` — override spacing scale tokens (not applied for "default").

`[data-font-size="sm"]` (13px) and `[data-font-size="lg"]` (17px) — "md" removes the attribute entirely.

`[data-reduced-motion="true"]` — forces all `animation-duration` and `transition-duration` to 0.01ms. The OS media query `@media (prefers-reduced-motion: reduce)` provides an unconditional belt-and-suspenders fallback.

### `src/hooks/useThemeSync.ts` — how attributes are applied

Called once inside the memoized `Header` component (`App.tsx:44`). Receives `state.settings: UserSettings` and calls `resolvedSettings()` internally.

**First effect** (deps: theme, density, fontSize, reducedMotion, accentColor):
- Writes `data-theme` = `"light"` or `"dark"` (resolves "system" against `prefers-color-scheme: dark`).
- Writes or removes `data-density` (removes for "default").
- Writes or removes `data-font-size` (removes for "md").
- Sets or removes `data-reduced-motion="true"` (ORs user setting with OS preference; user cannot disable OS preference).
- `html.style.setProperty("--accent", rs.accentColor)` — inline style overrides the `:root` default.

**Second effect** (dep: theme): adds/removes a `MediaQueryList` change listener on `prefers-color-scheme: dark` while `theme === "system"`.

**Third effect** (dep: reducedMotion): adds/removes a `MediaQueryList` change listener on `prefers-reduced-motion: reduce` to keep `data-reduced-motion` in sync with OS changes when the user has not set the flag.

---

## 7. Mesh Background Integration

**Props** (`src/components/MeshBackground.tsx:197–206`):
```ts
interface MeshBackgroundProps {
  intensity?: number | undefined;       // 0–1, default 0.2
  reducedMotion?: boolean | undefined;  // default false
}
```

**Where values come from:** `App.tsx:151–158` conditionally renders `MeshBackground` only when `rs.meshEnabled === true`. Props are passed directly from resolved settings:
```tsx
<MeshBackground
  intensity={rs.meshIntensity}   // from UserSettings.meshIntensity ?? 0.2
  reducedMotion={rs.reducedMotion}
/>
```

**How intensity reaches CSS:** `MeshBackground` writes an inline style on the `.mesh-background` div:
```tsx
style={{ "--mesh-intensity": intensity } as React.CSSProperties}
```
`MeshBackground.css:8` reads it: `opacity: var(--mesh-intensity, 0.2)`. The shader's `uAlpha` uniform is fixed at `1.0` — the CSS opacity is the sole brightness control. This is the fix from commit `6b2f01f` (the `fix(mesh)` commit); previously uAlpha and CSS opacity were multiplied, causing confusing non-linear behavior.

**Animation freeze:** `MeshBackground` also checks the OS preference: `effectiveReduced = reducedMotion || osReducedMotion` (line 220). The `<Canvas>` `frameloop` prop is set to `"demand"` when either is true or when the tab is hidden (`!active`), which stops the WebGL frame loop entirely.

**Color mode:** `meshColorMode` and `meshColor` fields exist in `UserSettings` but are not yet wired into `MeshBackground`. The `WarpMesh` component currently auto-cycles color by time-of-day through `COLOR_KEYS_RAW` (line 111–120); there is no UI control for `meshColorMode` or `meshColor` in the v2 modal.

---

## 8. Reduced-Motion Propagation

Three layers, non-overridable in the tightening direction:

1. **OS preference** — `@media (prefers-reduced-motion: reduce)` in `src/styles/theme.css:130–139` applies unconditionally regardless of any in-app setting.
2. **User in-app toggle** — `useThemeSync` ORs `rs.reducedMotion` with the OS query (line 47) and writes `data-reduced-motion="true"`. The attribute selector in `theme.css:121–128` kills animations.
3. **MeshBackground direct** — `effectiveReduced` ORs `reducedMotion` prop with `osReducedMotion` independently (MeshBackground.tsx:214–220), stopping the WebGL frame loop.

Result: the user setting can only add reduced motion; it cannot suppress an OS-level preference. The CSS pulse badge on the gear also respects the attribute: `App.css:77` has `[data-reduced-motion="true"] .settings-button[data-new="true"]::after { animation: none; }`.

---

## 9. Section Visibility

`UserSettings.sectionVisibility` maps to five boolean keys: `today`, `sprint`, `longTerm`, `gantt`, `reminders`. All default to `true`.

**In the UI (`App.tsx:122–148`, 162–213):**
```ts
const TAB_KEY: Record<Tab, keyof ResolvedUserSettings["sectionVisibility"]> = {
  today: "today", sprint: "sprint", long: "longTerm", gantt: "gantt", reminders: "reminders",
};
const visibleTabs = useMemo(
  () => TABS.filter((t) => rs.sectionVisibility[TAB_KEY[t.id]]),
  [rs.sectionVisibility],
);
```
- The nav renders only visible tabs.
- Section `<div hidden={...}>` wrappers are also gated: `{rs.sectionVisibility.today && <div hidden={tab !== "today"}>...}`.
- A `useEffect` auto-advances the active tab to the first visible tab if the currently-selected tab gets hidden (lines 142–148).
- If all five are hidden, a `.section-empty` fallback is shown (line 208–212).

The `DashboardSection` in the Settings modal exposes all five as checkboxes (`SettingsModal.tsx:757–801`). Changes are pending and committed on Done. A warning appears when all five are unchecked.

---

## 10. Reminder Defaults + Quiet Hours

**Service worker** (`src/background/service-worker.ts`):

- `defaultReminderLeadMinutes`, `defaultRecurrence` — read by the Reminders section UI when creating a new reminder, not by the service worker itself.
- `snoozeMinutes` — read directly from `state.settings.snoozeMinutes ?? 10` in `handleAlarm` (line 212) and the snooze button listener (line 312).
- `quietHours` — read from `state.settings.quietHours` (line 204). Logic in `handleAlarm` (lines 203–209): if the alarm fires during the quiet window (`isInQuietHours()`), a new alarm is created for `quietHoursEndAt()` and the notification is suppressed. The quiet-period end time is computed by taking the `to` field and advancing to the next day if it would be in the past (to handle the midnight-crossing case).

`isInQuietHours` handles midnight-crossing: if `fromMin >= toMin`, it checks `nowMin >= fromMin || nowMin < toMin` (line 178).

---

## 11. Import / Export

**Module:** `src/storage/exportImport.ts`

**Export format (JSON):**
```ts
interface ProclivityExport {
  schemaVersion: number;  // currently 1
  appVersion: string;     // from chrome.runtime.getManifest().version
  exportedAt: string;     // ISO 8601
  data: ProclivityState;  // full state verbatim
}
```

**`exportData()`** — reads state, wraps in the envelope, creates a `Blob`, fires a browser download via `<a download>` click pattern, and revokes the object URL.

**`importData(file: File): Promise<ImportResult>`** — reads the file as text, parses JSON, validates that `schemaVersion` and `data` fields exist, rejects if `schemaVersion > CURRENT_SCHEMA_VERSION`, then writes `{ ...EMPTY_STATE, ...(data as Partial<ProclivityState>) }` to storage. On success the modal closes. On failure the modal shows an inline error.

**Validation:** structural only — checks for the presence of `schemaVersion` (number) and `data` (object) keys. Does not validate that `data.todos` elements conform to the `Todo` interface. Future migrations would be added as version-range branches before the `storage.set()` call.

**Round-trip safety:** because `importData` spreads against `EMPTY_STATE`, any top-level fields added to `ProclivityState` after an old backup was made will be populated from `EMPTY_STATE` defaults rather than being absent.

---

## 12. Hooks

**`src/hooks/useThemeSync.ts`**  
Signature: `useThemeSync(settings: UserSettings): void`  
Consumer: `Header` in `src/newtab/App.tsx:44`.  
Three effects: (1) DOM-attribute writes on settings changes, (2) system-theme MediaQuery listener, (3) reduced-motion MediaQuery listener. Returns nothing — pure side-effect hook.

That is the only hook in `src/hooks/`. No additional hooks were introduced by the v2 work.

The store hook lives at `src/storage/useStore.ts`:  
Signature: `useStore(): { state: ProclivityState; loading: boolean; update: (fn) => Promise<void> }`  
Consumed by: `Header` (App.tsx:41), `App` (App.tsx:132), and `SettingsModal` (SettingsModal.tsx:75). `update` has a stable reference via `useCallback([], [])` so it is safe as a dependency.

---

## 13. TypeScript Health

Build command: `npm run build` (`tsc -b && vite build`)  
**Exit code: 0 — clean build with no errors or warnings.**

Output summary:
```
✓ 90 modules transformed.
dist/assets/index-D5wLKdlF.css    23.45 kB (gzip: 4.72 kB)
dist/assets/index.html-CVF5hs_f.js  194.60 kB (gzip: 61.54 kB)   ← main chunk
dist/assets/MeshBackground-B1k46qg3.js  823.54 kB (gzip: 221.23 kB)  ← lazy chunk
```

The initial newtab chunk (194.60 kB) is under the CLAUDE.md cap of ~200 kB. The Three.js chunk is correctly lazy-loaded.

**Strict flags honored** (tsconfig.json — not re-read but confirmed by clean `tsc -b`):
- `strict: true`
- `exactOptionalPropertyTypes: true` — honored via `?: T | undefined` pattern throughout (see types/index.ts:3–8 comment explaining the convention).
- `noUncheckedIndexedAccess: true` — honored; array accesses use the non-null assertion or optional-chain with a fallback (e.g., `colorKeys[0]!.h` in MeshBackground.tsx:131; `parts[0] ?? 0` in service-worker.ts:162).

---

## 14. Conventions to Mirror

- **File location:** Feature-specific sub-components live in a named sub-directory under `src/components/` (e.g., `src/components/settings/`). The CSS file co-locates with the TSX file that imports it.
- **CSS class prefix:** All classes inside a feature directory use a matching prefix (`settings-*`). No CSS Modules.
- **Types:** All shared interfaces and union types live in `src/types/index.ts`. Feature-local interfaces (e.g. `LiveUpdater`) are defined in the file that uses them.
- **Default resolution:** Every settings consumer calls `resolvedSettings(state.settings)` and reads from the resolved object. No inline `?? fallback` guards on settings fields outside `constants.ts`.
- **`useStore` wrapping pattern:** Destructure `{ state, update }`. Pass `update` directly to sub-components that need to write; pass `state.settings` (or `rs`) to sub-components that only read. `loading` is rarely checked — the `EMPTY_STATE` defaults make the UI safe to render while loading.
- **Live vs. pending split:** Visual settings that can be safely reverted via snapshot use `live()`; functional settings that change behavior (notification timing, tab visibility) go through pending state. Follow this boundary strictly.
- **Debounce for high-frequency inputs:** The `liveDebounced` wrapper (150 ms) is used for range inputs and color pickers that fire many events during drag (SettingsModal.tsx:159–162). Use the same `debounce` utility for any future continuous-value inputs.
- **Snapshot-revert for Cancel:** Take a `structuredClone` at open and restore it on Cancel. Do not rely on undo history.
- **Two-step destructive actions:** Pattern used in `DataSection` — a rest/confirm state machine showing a neutral button first, then a confirmation panel with a plain Cancel and a `btn-danger` confirm. Use this for any irreversible action.

---

## 15. Gaps and Risks

### Gemini Nano regression (primary reason this document exists)

**The `NanoStatusBlock` and `NanoBadge` components from `gemini-nano-m1` are missing from the v2 modal.** The old `src/components/SettingsModal.tsx` (deleted in commit `0adb9c6`) contained a "Gemini Nano (on-device)" settings field that:
- Ran `availability()` from `src/llm/nano.ts` on each open.
- Displayed a live `NanoBadge` (Checking / Ready / Downloading N% / Downloadable (~4 GB) / Unavailable).
- Offered a "Test prompt" button invoking `nanoCreateSession` → `session.prompt("Say hi in 5 words.")` with download-progress monitoring and AbortController cancel-on-close.
- Showed a graceful "unavailable" state with a link to `chrome://flags/#prompt-api-for-gemini-nano`.

The v2 `SettingsModal.tsx` contains no reference to `src/llm/nano.ts` and no Gemini Nano section. The `nano.ts` module itself survives intact. The regression is purely in the UI layer. The natural home for the re-introduced section is a new `GeminiNanoSection` component inside `src/components/settings/SettingsModal.tsx`, slotted between `DisplaySection` and `NotificationsSection` (or at the end of the body before `DataSection`), following the same pattern as the eight existing sections.

### `meshColorMode` / `meshColor` fields are orphaned

`UserSettings` has `meshColorMode` and `meshColor` fields (types/index.ts:93–94), `DEFAULT_SETTINGS` declares them, and `resolvedSettings()` resolves them — but `BackgroundSection` in the v2 modal exposes no control for either. `WarpMesh` does not read them (it uses the built-in time-of-day cycle). These fields are dead weight until a "Custom mesh color" control is added to `BackgroundSection`.

### `timeFormat` is live while its peers are pending

In `DateTimeSection`, `timeFormat` calls `live()` (line 568) so it previews immediately, but `relativeDates` and `weekStart` call their `setPending*` setters and require Done. This asymmetry is technically intentional (time format is a visual change; relative dates change date strings; week start changes the Gantt) but may surprise future maintainers. A comment in the code would help.

### Export/import validation is shallow

`importData` checks only the presence and type of `schemaVersion` and `data`. It does not validate the shape of `data.todos[]`, `data.reminders[]`, etc. A malformed backup (e.g., missing `id` fields) would be written to storage and could cause downstream type errors in the UI.

### `snoozeMinutes` accessed with `?? 10` in the service worker

`service-worker.ts:212` reads `state.settings.snoozeMinutes ?? 10` directly rather than calling `resolvedSettings()`. This bypasses `DEFAULT_SETTINGS.snoozeMinutes` and hard-codes the fallback to 10. If `DEFAULT_SETTINGS.snoozeMinutes` were ever changed, the service worker would not pick up the new default. Pattern inconsistency; low risk in practice since the values happen to match.

### No storage migration for the expanded `UserSettings` shape

The `?? EMPTY_STATE` spread in `storage.get()` handles new top-level fields in `ProclivityState`, but `UserSettings` is a nested field. Old stored data with `settings: { name: "Chris" }` will work correctly (all new fields resolve to defaults via `resolvedSettings()`). There is no active risk, but documenting the implicit migration path would reduce future confusion.

### Build bundle note

The main newtab chunk at 194.60 kB gzipped (61.54 kB) is close to the ~200 kB CLAUDE.md cap. The Gemini Nano section adds `src/llm/nano.ts` imports to the modal; if the modal is ever code-split those remain in the settings chunk, but currently everything is in the main bundle. The nano.ts wrapper was previously measured at +3.93 kB (commit `b849eb0`). Adding it back to the modal should stay under the cap but is worth re-checking after the re-integration.
