# Gemini Nano → Settings v2 Adaptation Plan

**Produced:** 2026-05-12  
**Source commits:** `b849eb0` (m1 initial), `b99a92b` (m1 rectify — use this one)  
**Target:** working tree at HEAD (`0adb9c6 feat(skill): SettingsModal v2`)  
**Scope:** plan only — no working-tree files modified.

---

## 1. Goal

Re-introduce the Gemini Nano availability surface — the `NanoStatusBlock`,
`NanoBadge`, and `runTestPrompt` flow from `gemini-nano-m1` — into the v2
Settings modal without regressing any of the v2 work (theme, density, mesh,
quiet hours, section visibility, import/export, etc.). The adaptation preserves
all three rectify fixes from `b99a92b`: H1 (`ProgressEvent.loaded` is a byte
count, not a 0–1 fraction), M1 (signal captured into a local before
microtask gaps can null `abortRef.current`), and M2 (implicit, flows from M1
fix). The new code must compile under `strict: true`,
`exactOptionalPropertyTypes: true`, and `noUncheckedIndexedAccess: true` and
must pass `npm run build` without growing the initial newtab chunk beyond the
5 kB target stated in the m1 acceptance criteria.

---

## 2. Recovered Code

All symbols below come from **`b99a92b:src/components/SettingsModal.tsx`**
(the rectified file). `src/llm/nano.ts` is already on disk, unmodified.

| Symbol | Source | Notes |
|---|---|---|
| `NanoState` interface | `b99a92b:src/components/SettingsModal.tsx:19–29` | 5 fields: `availability`, `downloadProgress`, `testResponse`, `error`, `testInFlight` |
| `initialNanoState` constant | `b99a92b:src/components/SettingsModal.tsx:31–37` | All fields at their resting values |
| `NanoStatusBlock` component | `b99a92b:src/components/SettingsModal.tsx:176–235` | Renders the badge + Test Prompt button + hint copy + response/error blocks |
| `NanoBadge` component | `b99a92b:src/components/SettingsModal.tsx:237–259` | Five-way switch on `availability` state |
| `runTestPrompt` async function | `b99a92b:src/components/SettingsModal.tsx:107–159` | AbortController lifecycle, download-progress monitor, session prompt, error handling |
| `nano` state hook | `b99a92b:src/components/SettingsModal.tsx:47` | `useState<NanoState>(initialNanoState)` |
| `abortRef` ref | `b99a92b:src/components/SettingsModal.tsx:49` | `useRef<AbortController \| null>(null)` |
| Availability `useEffect` | `b99a92b:src/components/SettingsModal.tsx:63–78` | Fires when modal opens; calls `nanoAvailability()` |
| Abort-on-close `useEffect` | `b99a92b:src/components/SettingsModal.tsx:80–86` | Aborts in-flight session when modal closes |
| `.settings-nano*` CSS classes | `b99a92b:src/components/SettingsModal.css:25–94` | `settings-nano`, `settings-nano-row`, `settings-nano-badge` (5 modifiers), `settings-nano-response`, `settings-nano-error`, `settings-nano code`, `settings-nano a` |

The `useEffect` that re-syncs form state on open (`b99a92b:73`) is **not** needed
in the new section because v2 already handles its snapshot/reset cycle in
`SettingsModal.tsx:122–145`; the Nano effects only need the modal's `open` prop.

---

## 3. Where It Lives in v2

**Chosen file: `src/components/settings/NanoSection.tsx`** (new file, ~110 LOC).

Rationale: v2 does not yet have a `sections/` sub-folder — every section
(`AppearanceSection`, `BackgroundSection`, `NotificationsSection`, etc.) is a
private function co-located in the single `src/components/settings/SettingsModal.tsx`
file (`SettingsModal.tsx:337–930`). However, the Nano section has three traits
that make a sibling file preferable over inlining:

1. It carries its own `useRef` and two `useEffect`s tied to `open`. Inlining
   these inside the already-large modal adds more cross-cutting state to an
   already complex component.
2. It imports from `@/llm/nano`. Keeping that import in a separate file makes
   it trivially code-split later (m2 will want the import tree separate from
   the main settings bundle).
3. It will grow in m2: a "Show chat panel" toggle moves into this file, and in
   m3 it may need a temperature/topK tuning control. Keeping it isolated avoids
   repeated diffs to the 930-line modal.

The CSS for the Nano section should live in a **sibling stylesheet**
`src/components/settings/NanoSection.css` (new file, ~60 LOC). This mirrors the
v2 convention that `SettingsModal.css` is imported only by `SettingsModal.tsx`
(`SettingsModal.css:6–7`).

**Import point:** `src/components/settings/SettingsModal.tsx`, inside the
`<div className="settings-body">` block (line 257–314). The parent passes
only the `open` prop.

```tsx
// In SettingsModal.tsx, inside settings-body, just before DataSection:
<NanoSection open={open} />
```

The `NanoSection` component manages its own `nano` state and effects using
`open` as the trigger, exactly as the m1 modal did.

---

## 4. Tab / Section Placement

v2's layout is a **single scrollable panel** with no tabs — it uses a list of
`<section className="settings-section">` blocks separated by 24 px of gap
(`SettingsModal.css:26–34`), each headed by an `<h3 className="settings-section-heading">`.
The current order is:

1. Appearance
2. Background
3. Date & Time
4. Display
5. Notifications
6. Dashboard
7. Account
8. Data (danger zone)

**Proposed position: between Account (7) and Data (8).**

Justification: "Gemini Nano" is an AI/capability feature, not a data-management
or appearance feature. Placing it just before the danger zone keeps it out of
the top-of-modal hierarchy (where the user frequently visits for theme / density)
without burying it inside the destructive Data section. The section heading will
read **"Gemini Nano"** (not "AI" — the roadmap uses that name throughout and
users who encounter the unavailable state will search for it by that name).

If the panel gains tabs in a future refactor, the Nano section should move to
an **"AI"** tab alongside any m3 structured-output config.

---

## 5. Conventions to Apply

### 5.1 Component markup

The m1 `NanoStatusBlock` uses bare `<button>` and `<div>` elements. The v2
`SettingsControls.tsx` exports only `SegmentedControl` and `ToggleSwitch`.
Neither maps cleanly to the badge-plus-button row that Nano needs, so the
recovered components keep their existing markup. To stay consistent with v2:

- Wrap the whole block in `<section className="settings-section">` with a
  `<SectionHeader>` (copy the `SectionHeader` helper from `SettingsModal.tsx:333–335`
  or re-export it). This matches every other section in the modal.
- The "Test prompt" button should use the same unstyled `<button>` that v2's
  Data section uses for Export/Import actions (`SettingsModal.tsx:861–878`).
  Apply `settings-action-btn` class to it.
- The response block (`settings-nano-response`) and error block
  (`settings-nano-error`) are unique to Nano; no v2 primitive replaces them.
  Port them as-is.

### 5.2 Class naming

v2 uses BEM-adjacent flat classes with a `settings-` prefix, e.g.
`settings-section`, `settings-field`, `settings-hint`, `settings-action-btn`.
The m1 Nano classes (`settings-nano`, `settings-nano-badge`, etc.) follow the
same pattern — no rename needed. Move them from the old `SettingsModal.css`
into `NanoSection.css` verbatim.

Example from v2: `.settings-danger-zone` (SettingsModal.css:386) — dashed
top border, extra top padding. Nano section uses standard `.settings-section`
with no extra modifier.

### 5.3 CSS tokens

The m1 CSS already uses the v2 token vocabulary (`--text-dim`, `--border`,
`--panel`, `--panel-2`, `--accent`, `--danger`, `--ok`, `--radius`). No
translation needed.

### 5.4 State management

v2 uses two patterns:

- **Live-preview** (Appearance, Background, Date & Time): calls `live(key, value)` /
  `liveDebounced(key, value)` which write directly to the store on every change.
- **Apply-on-Done** (Notifications, Dashboard, Account): state is held in
  `useState` locals in the modal and flushed only when the user clicks Done.

The Nano section has **no persistent state to write on Done** (see §6 below).
Its `nano` state is purely transient (live status + test result). This is a
third, simpler pattern: pure component-local state, no store writes, no
pending-local cycle. The `NanoSection` component owns its state internally and
receives only `open: boolean` from the parent.

The `open` prop replaces the old `open` from the modal's own `Props`. The v2
modal already passes `open` to its children implicitly via being mounted
(sections don't receive `open` today), so we need to thread it explicitly to
`NanoSection` since the availability check depends on it. One clean way: the
parent passes it as a prop.

---

## 6. Persistent State Question

**Recommendation: keep Nano state component-local only (m1's choice). No new
`UserSettings` fields in this milestone.**

The only candidate for persistence would be a custom test-prompt string, but:
- The m1 hardcodes `"Say hi in 5 words."` which is fine for a diagnostics button.
- Persisting a custom prompt adds a `UserSettings` field, a `ResolvedUserSettings`
  field, a `DEFAULT_SETTINGS` entry, and a `resolvedSettings()` branch — ~20
  LOC of pure overhead with no user-visible benefit at m1/m2 level.

The m2 "Show chat panel" toggle **does** need persistence. Pre-declare it now
so m2 doesn't require a separate type-shape commit:

```ts
// src/types/index.ts — add to UserSettings:
geminiNano?: {
  /** When true, App.tsx renders the persistent <ChatPanel>. */
  chatEnabled?: boolean | undefined;
  /** Where the chat panel docks. Defaults to "right". */
  chatPosition?: "right" | "bottom" | undefined;
} | undefined;
```

```ts
// src/storage/constants.ts — no DEFAULT_SETTINGS entry needed.
// resolvedSettings() reads chatEnabled ?? false, chatPosition ?? "right"
// at the call site; no resolver branch required (the field is optional).
```

This addition is **two lines** in `types/index.ts`, no other files. It
satisfies `exactOptionalPropertyTypes` (all nested fields are `| undefined`).
Pre-declaring it in this milestone means m2 only writes the toggle handler and
the `<ChatPanel>` component — no type infrastructure diff.

---

## 7. Forward Look — `gemini-nano-m2`

The m2 milestone adds an embedded chat side panel. The Settings modal is not
the panel itself — it hosts the toggle that enables/disables the panel.

**Settings connection (NanoSection.tsx, m2 addition):**

Add a `ToggleSwitch` (from `SettingsControls.tsx`) to `NanoSection`, reading
`rs.geminiNano?.chatEnabled ?? false` and writing via `live("geminiNano", {...})`.
Disable the toggle when `nano.availability !== "available"` (show a hint: "Nano
must be ready before enabling the chat panel."). The toggle is a live-preview
write (uses `live()`, not pending local) since there's no "save on Done" needed.

**Chat panel itself (`src/components/ChatPanel.tsx`, new in m2):**

Rendered by `App.tsx` (or `NewTab.tsx` — wherever the main layout lives)
conditioned on `rs.geminiNano?.chatEnabled`. It sits outside the Settings modal,
so it doesn't touch `NanoSection` or `SettingsModal` at all beyond the toggle.

```tsx
// App.tsx (m2 addition):
{rs.geminiNano?.chatEnabled && (
  <React.lazy(() => import("./components/ChatPanel"))>
    <Suspense fallback={null}>
      <ChatPanel position={rs.geminiNano?.chatPosition ?? "right"} />
    </Suspense>
  </React.lazy>
)}
```

The `ChatPanel` imports `createSession` and `prompt` directly from
`src/llm/nano.ts`. It never touches `SettingsModal` internals.

**What m2 touches in Settings (NanoSection.tsx only):**

1. Import `ToggleSwitch` from `./SettingsControls`.
2. Add `live: LiveUpdater` to `NanoSection`'s props.
3. Add a `ToggleSwitch` for "Show chat panel" below the test-prompt block,
   gated on `availability === "available"`.

That is the only Settings diff for m2 — no modal restructuring needed.

---

## 8. Step-by-Step Adaptation

### Step 1 — `src/types/index.ts` (+6 LOC)

Add the `geminiNano` optional field to `UserSettings`:

```ts
geminiNano?: {
  chatEnabled?: boolean | undefined;
  chatPosition?: "right" | "bottom" | undefined;
} | undefined;
```

No change to `ResolvedUserSettings` or `DEFAULT_SETTINGS` — m1's Nano section
has no persistent fields beyond what m2 pre-declares here. `resolvedSettings()`
does not need updating for m1; m2 will add the resolver branch when it needs
`chatEnabled` as a guaranteed boolean.

**Files:** `src/types/index.ts`. Delta: +6 lines.

### Step 2 — `src/components/settings/NanoSection.css` (new, ~60 LOC)

Create the file. Content: the `.settings-nano*` rules verbatim from
`b99a92b:src/components/SettingsModal.css` lines 25–94. No edits needed — the
token names and class names are already v2-compatible.

**Files:** `src/components/settings/NanoSection.css` (new). Delta: +60 lines.

### Step 3 — `src/components/settings/NanoSection.tsx` (new, ~130 LOC)

Create the file. Content assembled from:

- Imports: `useEffect`, `useRef`, `useState` from React; `availability as nanoAvailability`,
  `createSession as nanoCreateSession`, `NanoUnavailableError`, `type NanoAvailability`
  from `@/llm/nano`; `"./NanoSection.css"`.
- `NanoState` interface + `initialNanoState` constant (from `b99a92b`, §2 above).
- `NanoSection` function component:
  - Props: `{ open: boolean }` (m2 will add `live: LiveUpdater` here).
  - Hooks: `nano` state, `abortRef`.
  - The availability `useEffect` (fires on `open`).
  - The abort-on-close `useEffect`.
  - JSX: `<section className="settings-section">` with `<SectionHeader>Gemini
    Nano</SectionHeader>` and `<NanoStatusBlock nano={nano} onTestPrompt={runTestPrompt} />`.
- `runTestPrompt` async function (from `b99a92b`, preserving H1+M1+M2 fixes).
- `NanoStatusBlock` component (from `b99a92b`).
- `NanoBadge` component (from `b99a92b`).

`SectionHeader` cannot be imported from `SettingsModal.tsx` because it's a
private function there. Two options:

- **Option A (preferred):** Extract `SectionHeader` into `SettingsControls.tsx`
  and import it. This is a ≤5 LOC move and makes the control available to all
  sections.
- **Option B:** Inline a local equivalent in `NanoSection.tsx`:
  `const SectionHeader = ({ children }: { children: ReactNode }) => <h3 className="settings-section-heading">{children}</h3>;`

Option B adds zero coupling. Prefer it for the m1.5 inline path; refactor to
Option A in a dedicated cleanup commit.

**Files:** `src/components/settings/NanoSection.tsx` (new). Delta: +130 lines.

### Step 4 — `src/components/settings/SettingsModal.tsx` (~+8 LOC)

Add one import and one JSX insertion.

Import (at top of file, after existing imports):

```ts
import { NanoSection } from "./NanoSection";
```

JSX (inside `<div className="settings-body">`, between `<AccountSection>` and
`<DataSection>`):

```tsx
<NanoSection open={open} />
```

Pass `open` from the modal's own `open` prop — already in scope at line 74.

**Files:** `src/components/settings/SettingsModal.tsx`. Delta: +8 lines (1
import + 1 JSX element + blank lines for readability).

### Step 5 — Verify build

```
npm run build
```

Expected: clean compile, no new TS errors. The `NanoSection` imports only
`@/llm/nano` (already on disk) and React. The `geminiNano` type is optional;
no existing code references it so there are no unresolved property accesses.

**Files:** none. Delta: 0.

---

## 9. Estimated Diff

| File | Status | LOC delta |
|---|---|---|
| `src/types/index.ts` | modified | +6 |
| `src/components/settings/NanoSection.css` | new | +60 |
| `src/components/settings/NanoSection.tsx` | new | +130 |
| `src/components/settings/SettingsModal.tsx` | modified | +8 |
| **Total** | **4 files** | **+204 LOC** |

This fits the milestone-pipeline **`inline`** path (≤ 300 LOC, ≤ 5 files).
No new npm dependencies. The NanoSection module is lazy by virtue of being
imported only by `SettingsModal.tsx`, which is itself only rendered when the
user opens the modal. No explicit `React.lazy` needed at this stage (the
Settings modal isn't code-split yet; if it is later, the NanoSection import
rides along for free).

---

## 10. Verification Plan

After the changes land, the maintainer should:

1. Run `npm run build` — confirm clean compile, no chunk-size warning (the
   nano wrapper is ~4 kB minified; the section component adds ~2 kB).
2. Open Chrome with `chrome://flags/#prompt-api-for-gemini-nano` enabled
   and Nano downloaded.
3. Open the new-tab page. Click the gear icon to open Settings.
4. Scroll to the **Gemini Nano** section (between Account and Data).
5. Observe the badge reads **"Ready"** within ~1 second of the modal opening.
6. Click **"Test prompt"**. Button should read "Running…" while in flight.
7. Within ≤ 5 seconds, a response block should appear below the button
   ("Nano said: …").
8. Close the modal mid-flight (re-open, click Test prompt, immediately
   close). Confirm no console errors; `abortRef` should cancel the session
   cleanly (M1/M2 fix coverage).
9. On a Chrome without the flag enabled: open Settings, confirm badge reads
   **"Unavailable"**, hint text includes `chrome://flags/#prompt-api-for-gemini-nano`
   and a link to Chrome AI docs. Test prompt button should be disabled.
10. On a fresh install where Nano is downloadable: confirm badge reads
    **"Downloadable (~4 GB)"** and hint explains the download. Clicking Test
    prompt should trigger the download and badge should transition to
    "Downloading X%" (H1 fix: percentage is computed from bytes, not passed
    directly as a fraction).

---

## 11. Risks / Open Questions

### R1 — Modal lazy-mount behavior

v2 renders all sections unconditionally inside `<Modal open={open}>`. The
`availability()` call fires on every `open` transition. If v2 ever moves to
lazy-mounting sections (only rendering a section when its scroll-position
enters the viewport), the `useEffect([open])` trigger would need to change
to a `useIntersectionObserver` or similar. For now the current pattern is fine;
flag this if a virtual-scroll is ever added to the settings body.

### R2 — `SectionHeader` duplication

`SectionHeader` is a private function inside `SettingsModal.tsx:333–335`.
`NanoSection.tsx` will need to either duplicate it or we extract it to
`SettingsControls.tsx`. Duplication is 3 lines; extraction is clean. The plan
(Step 3, Option B) prefers inline duplication for the m1 path with a note to
clean up. If the maintainer prefers extraction immediately, add Step 3.5:
move `SectionHeader` to `SettingsControls.tsx`, export it, update the import
in `SettingsModal.tsx`. +5 LOC to `SettingsControls.tsx`, -3 LOC from
`SettingsModal.tsx` — stays within the inline budget.

### R3 — m2 `live` prop thread-through

Step 4 passes only `open` to `NanoSection`. When m2 adds the "Show chat panel"
toggle, it needs `live: LiveUpdater` as well. `LiveUpdater` is currently a
local type alias inside `SettingsModal.tsx:339–341`. m2 should either export
it from `SettingsModal.tsx` or (better) move it to `SettingsControls.tsx`
alongside `SegmentedControl` and `ToggleSwitch`. Flag this in the m2 research
phase.

### R4 — Nano unavailability in v2 snapshot/cancel flow

v2's Cancel path (`handleCancel`, line 196) restores the snapshot via
`snapshotRef.current`. Since Nano adds no persistent fields (§6), Cancel has
no effect on the Nano section. The `abortRef` cleanup effect fires on
`open === false` regardless of whether the user clicked Cancel or Done, so
in-flight prompts are always cancelled. No risk.

### R5 — `settings-nano-badge.ready` uses `--ok` variable

The m1 badge uses `var(--ok, var(--accent))` for the "Ready" green. If v2's
token set doesn't define `--ok`, it falls back to `--accent` (indigo). This
produces a visually correct but not-semantically-green badge. Check
`src/styles/` for the token definition before landing; add `--ok: oklch(...)` if
missing.

### R6 — Sibling agent output

A sibling agent was tasked with `plans/settings-v2-architecture.md` in
parallel. As of writing, that file does not exist in `plans/`. If it appears
before this plan is implemented, cross-reference it for any tab structure,
section-ordering, or state-threading decisions that would affect the placement
in §4 or the prop interface in §3. The choices here are conservative enough
that the only likely conflict is if v2 gains tabs — in which case the Nano
section moves to an "AI" tab with no other changes.
