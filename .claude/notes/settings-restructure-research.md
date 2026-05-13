# Settings Restructure — Research & Recommendations

Author: UX research pass for Proclivity (Chrome extension, MV3, single-user, local-only)
Audience: two downstream Sonnet agents who will implement the IA, sizing, and
new settings. They will read this top-to-bottom and split work along the
"Implementation handoff" boundaries below.

Source files surveyed:
- `src/components/settings/SettingsModal.tsx`
- `src/components/settings/SettingsControls.tsx`
- `src/components/settings/NanoSection.tsx`
- `src/components/settings/SettingsModal.css`
- `src/components/Modal.tsx` + `src/components/Modal.css`
- `src/storage/constants.ts` (`DEFAULT_SETTINGS`, `resolvedSettings`)
- `src/types/index.ts` (`UserSettings`, `ResolvedUserSettings`, the auxiliary unions)
- `src/newtab/App.tsx` (greeting cutoff logic)
- `src/sections/sprint/sprintUtils.ts`, `src/sections/gantt/ganttUtils.ts` (hardcoded defaults)

External reference (real apps studied for IA patterns):
- VS Code Settings editor — sidebar tree, top search with `@`-prefix filters,
  per-setting search-as-you-type. `https://code.visualstudio.com/docs/getstarted/settings`
- macOS System Settings (Ventura+) — left sidebar grouped by theme, deep-links
  to specific panes. `https://www.macosadventures.com/2022/12/05/how-to-open-every-section-of-macos-ventura-system-settings/`
- Linear settings (Dec 2024 redesign) — sidebar split into "Features /
  Administration / Your teams / Account", notifications grouped by channel.
  `https://linear.app/changelog/2024-12-18-personalized-sidebar`
- Notion settings, Discord User Settings, GitHub account settings — all
  follow the same archetype: persistent left sidebar of category labels,
  right pane is a scrollable form for the active category, Save/Done is
  either implicit (per-control live save) or pinned at the bottom of the pane.

---

## Current state inventory

Every field rendered today by `SettingsModal.tsx`, in document order, with
the storage key on `UserSettings` and the default in `DEFAULT_SETTINGS`.

| Pane order | Section heading | Field (UI label) | UserSettings key | Type | Default | Live or staged |
|---|---|---|---|---|---|---|
| 1 | Appearance | Theme | `theme` | `ThemeMode` (system / light / dark) | `system` | Live |
| 1 | Appearance | Accent color | `accentColor` | hex string | `#7c9cff` | Live (debounced for color picker) |
| 1 | Appearance | Font size | `fontSize` | `sm` / `md` / `lg` | `md` | Live |
| 1 | Appearance | Density | `density` | `compact` / `default` / `spacious` | `default` | Live |
| 1 | Appearance | Reduce motion | `reducedMotion` | boolean | `false` | Live |
| 2 | Background | Mesh background | `meshEnabled` | boolean | `true` | Live |
| 2 | Background | Intensity (range 0–100) | `meshIntensity` | number 0..1 | `0.20` | Live (debounced) |
| 3 | Date & Time | Time format | `timeFormat` | `auto` / `12h` / `24h` | `auto` | Live |
| 3 | Date & Time | Relative dates | `relativeDates` | boolean | `true` | Staged |
| 3 | Date & Time | Week starts on | `weekStart` | `sun` / `mon` / `sat` | `mon` | Staged |
| 4 | Display | Greeting | `greetingStyle` | `none` / `time-of-day` | `time-of-day` | Live |
| 4 | Display | Todo layout | `layoutMode` | `list` / `card` | `list` | Live |
| 5 | Notifications | Default reminder lead time | `defaultReminderLeadMinutes` | `0/5/10/15/30/60` | `10` | Staged |
| 5 | Notifications | Snooze duration | `snoozeMinutes` | `10/30/60` | `10` | Staged |
| 5 | Notifications | Quiet hours (toggle + from/to) | `quietHours` | `{from,to}` or undefined | undefined | Staged |
| 6 | Dashboard | Visible sections | `sectionVisibility.*` | 6 booleans | all true | Staged |
| 7 | Tags | Create / rename / recolor / delete | (operates on `state.tags`, not settings) | n/a | n/a | Write-through (bypasses snapshot/revert) |
| 8 | Account | Your name | `name` | string | `""` | Staged |
| 9 | Gemini Nano | Model status (read-only) | (derived) | n/a | n/a | n/a |
| 9 | Gemini Nano | Enable chat panel | `geminiNano.chatEnabled` | boolean | `false` | Live |
| 10 | Data | Export / Import / Clear all | (action buttons) | n/a | n/a | Immediate (no Done/Cancel) |
| 11 | Developer (`<details>`) | Verbose debug logging | `debug.enabled` | boolean | `false` | Live |
| 11 | Developer | Namespace filter | `debug.namespaces` | string (DEBUG glob) | `"*"` | Live |
| 11 | Developer | Redact toggle + LogViewer | (session-local) | n/a | n/a | n/a |

**Declared on `UserSettings` but NOT rendered today** (latent capacity):

- `defaultRecurrence` (`none/daily/weekly`) — declared, defaulted, even staged into `pendingRecurrence` in `SettingsModal.tsx`, never rendered. **Bug-shaped TODO.**
- `meshColorMode`, `meshColor` — declared, defaulted, no control. Defer (Phase 3 rejects).
- `lastKnownTzOffset`, `settingsV2Seen`, `cardHintSeen` — internal flags.

**Hardcoded constants that could become settings** (see Phase 3):

- Greeting cutoff 12/17 (`App.tsx:68-73`)
- Sprint default 14 days (`sprintUtils.ts:26`)
- Closed-todo retention 30 days / 500 items (`constants.ts:32-43`)
- Gantt empty-window 15 days, card snap-grid 8 px — internal, no need.

---

## Recommended IA

### Sidebar entries (top to bottom)

```
┌──────────────────────┐
│  General             │  ← lands here on first open; default deep-link
│  Appearance          │
│  Notifications       │
│  Todos               │
│  Reminders           │
│  Gemini Nano         │
│  Tags                │
│  Data                │
│  Advanced            │
└──────────────────────┘
```

Nine entries. The user's brief proposed seven; I'm keeping **Appearance**
and **Tags** as siblings rather than burying them: Appearance is the
highest-frequency destination in every app surveyed (VS Code, Linear,
Notion), and Tags is a CRUD list manager (not a form) that already
write-throughs immediately, bypassing the Done/Cancel snapshot — same
shape as Linear's "Labels" pane.

### Pane contents

**General**
- Your name (`name`)
- Greeting style (`greetingStyle`)
- Time format (`timeFormat`)
- Week starts on (`weekStart`)
- Relative dates (`relativeDates`)
- Dashboard → Visible sections (`sectionVisibility.*`)

**Appearance**
- Theme (`theme`)
- Accent color (`accentColor` + presets)
- Font size (`fontSize`)
- Density (`density`)
- Reduce motion (`reducedMotion`)
- — divider —
- Mesh background (`meshEnabled`)
- Mesh intensity (`meshIntensity`)
- *(if shipped)* Mesh color mode / color (`meshColorMode`, `meshColor`)

The mesh is visual chrome, not a separate concept; merge Background into
Appearance under a clear `Background` sub-header.

**Notifications**
- Default reminder lead time (`defaultReminderLeadMinutes`)
- Default recurrence (`defaultRecurrence`) — **NEW**, latent today
- Snooze duration (`snoozeMinutes`)
- Quiet hours (`quietHours`)

**Todos**
- Layout mode (`layoutMode`)
- *(if shipped)* Closed-todos retention (`closedTodoRetentionDays`) — see Phase 3

**Reminders**
- *(reserved)* — Reminders today share the Notifications fields. Phase 3
  recommends adding `reminders.defaultSound` and a default-tag option here.
  If neither lands now, **collapse this entry and put a top-of-Notifications
  hint instead.** Don't ship a placeholder pane.

**Gemini Nano**
- Model status + Test prompt
- Enable chat panel (`geminiNano.chatEnabled`)
- Chat position (`geminiNano.chatPosition`) — exposed for the first time

**Tags**
- The existing TagsSection, full pane width.

**Data**
- Export / Import / Clear all
- *(if shipped)* Backup recency display — see Phase 3

**Advanced**
- Verbose debug logging (`debug.enabled`)
- Namespace filter (`debug.namespaces`)
- Log viewer + Redact toggle

Rename "Developer" → "Advanced". Single-user solo project (CLAUDE.md);
"developer" vs "user" is a false distinction. "Advanced" frames the
log buffer correctly: rarely-needed, may surprise you.

### ASCII wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Settings                                                       [×]  │
├──────────────────────┬───────────────────────────────────────────────┤
│ ⌕ Search settings…   │  GENERAL                                      │
├──────────────────────┤                                               │
│ ▸ General         •  │  Your name                                    │
│   Appearance         │  ┌─────────────────────────────────────┐      │
│   Notifications      │  │ Chris                               │      │
│   Todos              │  └─────────────────────────────────────┘      │
│   Reminders          │  Appears in the greeting.                     │
│   Gemini Nano   NEW  │                                               │
│   Tags               │  Greeting                                     │
│   Data               │  ( Off ) ( With time of day )                 │
│   ─────────────      │                                               │
│   Advanced           │  Time format                                  │
│                      │  ( System ) ( 12h ) ( 24h )                   │
│                      │  …                                            │
│                      │                                               │
│                      │  DASHBOARD                                    │
│                      │  Visible sections                             │
│                      │  ☑ Today  ☑ Sprint  ☑ Long-term  …            │
│                      │                                               │
├──────────────────────┴───────────────────────────────────────────────┤
│                                          [ Cancel ]  [ Done ]        │
└──────────────────────────────────────────────────────────────────────┘
```

The dot next to **General** marks the active pane. The "NEW" badge next
to **Gemini Nano** appears only when the user hasn't visited that pane
yet (see Cross-cutting decisions).

---

## Modal sizing

Current: `width: 100%; max-width: 480px; max-height: min(80vh, 720px);`
(`Modal.css:25-27` + `SettingsModal.css:13`).

**Recommended new dimensions:**

- **Width:** `min(94vw, 880px)`. 880 covers 1280/1440/1680/1920 with breathing room; 94vw survives a 1024-wide window. Narrower → mobile fallback.
- **Height:** `min(88vh, 760px)`. Modest bump from `80vh / 720px`.
- **Sidebar pane:** fixed 200px (`min-width: 180`, `max-width: 220`). Wide enough for "Notifications" at default font.
- **Content pane:** `flex: 1 1 auto; min-width: 480px` so existing controls keep their optical relationships.
- **Minimum viewport target:** 1280×720. 880 centered → 200 px side margin; 88vh of 720 → ~633, content-pane scrolls.

CSS changes summary:

```
.settings-modal-panel {
  max-width: min(94vw, 880px);
  max-height: min(88vh, 760px);
  /* sidebar + content layout — overrides default vertical column */
}
.settings-modal-panel .settings-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  min-height: 0;            /* allow inner scrolling */
}
```

The existing `.modal-panel { max-width: 480px }` rule in `Modal.css` is
overridden by `.settings-modal-panel` per the existing pattern; don't
touch `Modal.css`.

---

## Additional settings — recommended for ship

Eight recommendations, ranked by impact. Each is opinionated: yes / no,
where it lives, control type, complexity. Implementors should ship 5–8;
the bottom items can defer if scope tightens.

### 1. Surface `defaultRecurrence` in Notifications  *(BUG-FIX, ship now)*
Already declared, defaulted (`"none"`), staged into `pendingRecurrence`
in `SettingsModal.tsx`, and consumed by the reminder-create flow — but
dropped from render, almost certainly during the v2 restructure that
NanoSection's comment refers to.
- **Pane:** Notifications, under "Default reminder lead time".
- **Default:** `"none"` (unchanged). **Control:** SegmentedControl `None / Daily / Weekly`.
- **Complexity:** **S.** No type changes; one new control. Snapshot/revert already handles it.

### 2. Greeting time cutoffs  *(ship)*
Hardcoded 12/17 in `App.tsx:71-73` makes "Good afternoon" land at noon
and "Good evening" at 5 PM — wrong half the day for late workers. A
coarse three-option preset solves it without inventing a custom-hours UI.
- **Pane:** General, adjacent to Greeting style. Hide when `greetingStyle === "none"`.
- **Default:** `standard`. **Control:** SegmentedControl
  `Standard (12/17) / Early bird (10/16) / Night owl (13/19)`.
- **Storage:** `greetingSchedule?: "standard" | "early-bird" | "night-owl"`.
- **Complexity:** **S.** Three constants → switch in `greetingFor()`.

### 3. Closed-todo retention window  *(ship)*
`CLOSED_TODO_RETENTION_DAYS = 30` is constant today. Low-volume users
want longer history; aggressive-clearers want 7. The count cap stays
internal — it's a safety net, not a preference.
- **Pane:** Todos. **Default:** `30`.
- **Control:** SegmentedControl `7 / 30 / 90 / Forever`. "Forever" → sentinel `0`; purge no-ops.
- **Storage:** `closedTodoRetentionDays?: 7 | 30 | 90 | 0`.
- **Complexity:** **M.** Thread the resolved value into `service-worker.ts`'s purge job and the on-open purge call.

### 4. Today-view reset hour ("day boundary")  *(ship)*
Common in calendar tools (Fantastical, TickTick, Things). Midnight
rollover is jarring for late workers; 4am/5am matches the wake/sleep
boundary.
- **Pane:** General, under Time format. **Default:** `0` (midnight).
- **Control:** SegmentedControl `12am / 3am / 5am`. Free-form time picker is over-engineered.
- **Storage:** `dayBoundaryHour?: 0 | 3 | 5`.
- **Complexity:** **M.** Single source of truth required — audit `src/lib/` and `src/sections/` for `new Date()` / `startOfDay()` calls before sizing. If the audit comes up large, downgrade to skip.

### 5. Backup recency display  *(ship — post-incident)*
The user just survived a card-resize data-loss scare (recent commit
`fix(resize): resolve CRITICAL data-loss`). Surface "Last exported:
12 days ago" so stale backups become visible. Don't auto-backup —
that's a sync feature; CLAUDE.md forbids.
- **Pane:** Data, above Export. **Default:** "Never exported".
- **Control:** Read-only line + relative-time. Color-shift to warning at > 30 days.
- **Storage:** `lastExportAt?: number` (epoch ms). Written by `exportData()` in `src/storage/exportImport.ts`.
- **Complexity:** **S.** One write site, one read site.

### 6. Accessibility consolidation  *(ship — partial)*
Reduce motion exists but is buried in Appearance. A small
"Accessibility" sub-header inside Advanced collects it alongside a new
Focus-ring style toggle (`auto` / `always-visible`) — helps keyboard
users since the focus ring is `:focus-visible`-only today.
- **Pane:** Advanced → Accessibility sub-header (above Debug).
- **Defaults:** Reduce motion unchanged; Focus ring `auto`.
- **Storage:** `focusRingMode?: "auto" | "always"`.
- **Complexity:** **S.** One CSS class on `<body>` + one toggle; Reduce motion is just a move.

### 7. Sprint default length  *(ship)*
Hardcoded 14-day default in `sprintUtils.ts:26`. Solo dev → personal
preference, not team-imposed. Short control wins.
- **Pane:** Todos, adjacent to layout. **Default:** `14`.
- **Control:** SegmentedControl `1wk / 2wk / 3wk / 4wk` (7/14/21/28).
- **Storage:** `defaultSprintDays?: 7 | 14 | 21 | 28`.
- **Complexity:** **S.** One default → consult on create in `sprintUtils.ts:26`.

### 8. Onboarding hint replay  *(ship)*
`cardHintSeen` and `settingsV2Seen` are one-shot today; no way to
replay after dismissal. A "Replay onboarding tips" button resets both
flags. Cheap insurance for future one-shot hints.
- **Pane:** Advanced. **Control:** Button (no confirm — reversible by dismiss). **Complexity:** **S.**

### Final recommended ship list (8 items, ranked by ROI)

1. **Surface `defaultRecurrence`** (Notifications) — S, bug-shaped.
2. **Backup recency display** (Data) — S, post-data-loss reassurance.
3. **Sprint default length** (Todos) — S, unblocks non-2-week sprints.
4. **Closed-todo retention** (Todos) — M, user-controllable hygiene.
5. **Greeting time cutoffs** (General) — S, fixes a real annoyance.
6. **Today reset hour** (General) — M, common ask in this category.
7. **Onboarding hint replay** (Advanced) — S, future-proofing.
8. **Focus-ring "always visible" toggle** (Advanced) — S, a11y.

### Considered and rejected (one-liners)

- *Custom greeting templates* — over-flexible for a one-line label.
- *Sprint name template* — premature; no signal.
- *Gantt density / row height / show-weekends* — wait for a real complaint.
- *Per-section week-start override* — two settings confuses; one is enough.
- *Card-mode defaults (default w/h / group-by)* — auto-derive from grid.
- *Notification grouping / DND on focus / custom sound* — `chrome.notifications` doesn't expose them.
- *Tag color palette customization* — per-tag custom color already covers it.
- *Editor preferences (Enter-to-save / autofocus)* — current behavior is the convention.
- *Multi-monitor / weekday new-tab redirect* — conflicts with new-tab override contract.
- *Auto-backup schedule / cross-device sync* — would need a sync target; CLAUDE.md forbids.
- *High-contrast toggle / reduce transparency / larger touch targets* — OS-level / desktop-only.
- *Section reorder of dashboard tabs* — defer; visibility already exists.
- *Mesh color override* — fields declared but UX cost outweighs benefit; defer.
- *24h-with-seconds, locale override, keyboard rebinding* — niche / no demand.
- *Anonymous error reports / telemetry* — CLAUDE.md explicit policy violation.

---

## Cross-cutting UX decisions

### Live preview vs apply-on-Save — **keep the hybrid pattern**

Today (see `SettingsModal.tsx:165-180` + `handleDone` / `handleCancel`):
*live* settings write through immediately (theme, accent, fontSize,
density, reducedMotion, mesh*, timeFormat, greetingStyle, layoutMode,
geminiNano.chatEnabled, debug.*); *staged* settings (name, weekStart,
relativeDates, lead, recurrence, snooze, quietHours, sectionVisibility)
write on Done and revert via `snapshotRef`. Preserve this split — the
live ones *are* their own preview (toggle dark mode → page goes dark);
the staged ones need to feel deliberate. New settings all map to
**staged** (no live visual diff): `defaultRecurrence`, `defaultSprintDays`,
`closedTodoRetentionDays`, `dayBoundaryHour`, `greetingSchedule`,
`focusRingMode`. `lastExportAt` is action-written, not a setting.

### Search inside settings — **defer**

VS Code's `@modified` / `@tag:experimental` filter is a delight, but
that product has hundreds of settings. Proclivity will have ~32 after
this expansion — reachable in ≤2 clicks via the sidebar. Skip search;
revisit when the field count crosses ~50. Don't ship a dead stub input;
empty controls train users to ignore the spot.

### Deep linking — **yes, lightweight**

Two mechanisms: (1) Query param `chrome://newtab?settings=todos` read
in `App.tsx`'s settings-open effect, accepting the 9 pane ids; unknown
values fall back to `general`. Strip the param from the URL after
consumption. (2) Imperative prop `<SettingsModal initialPane="nano" />`.
Not persisted; subsequent opens use the "remembered last-visited" field.

### Keyboard navigation — **explicit, spec'd**

Sidebar is `<nav role="tablist">` over `role="tab"` `<button>`s;
content pane is `role="tabpanel"`. **Tab** enters the active tab,
moves to the content pane, then to the footer. **Arrow Up/Down**
moves between tabs. **Enter/Space** activates a tab. **Escape**
closes (existing Modal behavior, don't override). **Cmd/Ctrl+F** is
not intercepted — browser find still works.

### Mobile / narrow viewport — **collapse sidebar to a select**

At `< 640px` wide: sidebar becomes a `<select>` at the top of the panel
("Section"); content fills the rest. No accordion or slide-out drawer —
overkill for the rarity. CSS-only media query.

### Sidebar persistence — **remember last-visited**

New field `settingsLastPane?: SettingsPaneId` on `UserSettings`.
Written on sidebar click; read on open as the default when no
`initialPane` deep-link is passed. Default `"general"`. Lives on
`UserSettings` (not localStorage) so it round-trips with export/import.

### Section badges — **only for genuinely new sections**

`NEW` badge on a sidebar entry when the user hasn't visited it yet and
it represents discoverability-critical functionality. Today's only
candidate: **Gemini Nano**, tracked via a new `geminiNanoSeen?: boolean`.
Don't badge `Advanced` or `Data` — utilitarian.

### Reduced motion — **no new transitions**

Pane switch is instant; only the active sidebar item gets a CSS class
change. Existing reduced-motion handling already disables transitions
globally. New animations: zero.

### Done/Cancel scope — **modal-wide, one transaction**

Cancel / Done apply to all staged fields across panes. Don't introduce
per-pane Save buttons (that's macOS-pattern; clunky here). Data pane
actions remain immediate verbs.

### "Unsaved changes" warning — **add it**

Today Cancel silently reverts; fine for a small modal, painful for a
larger one. Track a `dirty` `useMemo` against snapshot; on
Cancel/Escape/backdrop with `dirty===true`, show an inline confirm —
"Discard unsaved changes? [Discard] [Keep editing]" — using the
existing `ConfirmDialog` in `Modal.tsx:166`. Don't block close on the
X button; that's hostile.

---

## Implementation handoff

Two implementor agents will pick this up. The work splits cleanly:

### Agent A — IA + chrome (the structural shell)

**Owns:**
- `src/components/settings/SettingsModal.tsx` — restructure to host
  the sidebar + content layout. Extract each existing `*Section`
  component into its own file under `src/components/settings/panes/`.
  Keep Section bodies functionally identical; just relocate.
- `src/components/settings/SettingsModal.css` — sidebar grid, sizing,
  responsive collapse. Don't touch `Modal.css`.
- `src/components/settings/SettingsSidebar.tsx` — **new.** Renders
  the nav, owns the active-pane state via lifted props from the
  modal. Tablist semantics (see Keyboard nav section). Accepts
  `{ activePane, onSelect, badges }` props.
- `src/components/settings/types.ts` — **new.** Export
  `export type SettingsPaneId = "general" | "appearance" | "notifications" | "todos" | "reminders" | "nano" | "tags" | "data" | "advanced";`
  and a `PANE_ORDER` array of the same.
- `src/types/index.ts` — add `settingsLastPane?: SettingsPaneId` to
  `UserSettings`; add the resolved field to `ResolvedUserSettings`.
  Also add `geminiNanoSeen?: boolean` for the badge state.
- `src/storage/constants.ts` — add defaults:
  `settingsLastPane: "general"`, `geminiNanoSeen: false`. Add the
  matching cases to `resolvedSettings()`.
- `SettingsModal` props grow: `initialPane?: SettingsPaneId` (deep-link).
- Wire the `?settings=<paneId>` URL parameter in `App.tsx`'s settings-
  opening effect. Strip the param from the URL after consumption so
  reload doesn't re-trigger.

**Contracts to maintain:**
- Existing snapshot/revert behavior in `handleCancel`. Snapshot
  scope unchanged.
- Live vs staged classification of every existing field — preserved.
- Tag operations remain immediate write-through.
- Data pane actions remain immediate.

**Does not touch:**
- The 8 new settings from Phase 3. Agent B owns those.
- Section body internals.

### Agent B — new settings (the content additions)

**Owns:**
- The 8 shipping recommendations in Phase 3. For each:
  - Add the field to `UserSettings` and `ResolvedUserSettings` in
    `src/types/index.ts`.
  - Add the default to `DEFAULT_SETTINGS` and the resolve case in
    `src/storage/constants.ts`.
  - Render the control inside the appropriate `*Pane.tsx` file
    (which Agent A will have created or relocated).
  - Wire any consumer code (greeting cutoffs → `App.tsx:greetingFor`;
    retention → service worker purge job; sprint default →
    `sprintUtils.ts:26`; backup timestamp → `exportImport.ts`).
- "Unsaved changes" inline confirmation: a new dirty-check
  `useMemo` in `SettingsModal.tsx` + a small `ConfirmDialog`
  invocation on Cancel-with-dirty. (Could go to Agent A; either is
  fine, but it lives in the modal shell so put it with whichever
  agent finishes first.)

**Does not touch:**
- IA shell.
- Existing field semantics, defaults, or live/staged classification.

### Shared invariants (both agents)

- `npm run build` must pass cleanly (CLAUDE.md). Run it before claim-done.
- No new npm dependencies.
- `noUncheckedIndexedAccess` is on — every array/object access guarded.
- `exactOptionalPropertyTypes` is on — `undefined` is explicit on every
  optional field both in declaration and in the resolve table.
- Co-author trailer on commits; commit on `main`; conventional commits
  with scope `settings` (new scope — closest existing match is `style`,
  but `settings` is conceptually distinct enough to add). Confirm with
  user if scope-purism matters.

### Recommended commit cadence

Each agent: one commit per logical unit. Suggested ordering:

A1. `feat(settings): extract per-pane components and shell scaffolding`
A2. `feat(settings): add sidebar layout, deep linking, mobile fallback`
A3. `feat(settings): persist last-visited pane and Gemini Nano badge`
B1. `fix(settings): surface defaultRecurrence in Notifications pane`
B2. `feat(settings): add greeting schedule, today reset hour, sprint default`
B3. `feat(settings): add closed-todo retention setting`
B4. `feat(settings): add backup recency display and onboarding replay`
B5. `feat(settings): add accessibility focus-ring toggle`
B6. `feat(settings): warn before discarding unsaved changes`

Each must pass `npm run build` before commit.

---

## Risks & open questions

- **Snapshot scope.** New staged settings inherit revert via
  `structuredClone(state.settings)` automatically. Verify
  `handleCancel` after the type-shape grows — no regression expected.
- **Service-worker race on retention change.** Dropping 30 → 7 mid-
  session means the next purge wipes ~3 weeks of closed todos with no
  undo. Ship an inline warning ("Existing closed todos older than 7
  days will be removed on next purge — Export to retain") instead of
  building a grace-period mechanism.
- **Day-boundary propagation.** Every `startOfDay()` / `today()` /
  `new Date()` call must consult the setting. Audit `src/lib/` and
  `src/sections/` before sizing. If the audit comes up large,
  **downgrade Day-boundary to skip** rather than half-apply it.
- **Reminders pane content gap.** None of the 8 shipping
  recommendations target Reminders (all reminder-adjacent settings
  live under Notifications). **Drop the Reminders sidebar entry**
  rather than ship an empty pane. Final panes: General, Appearance,
  Notifications, Todos, Gemini Nano, Tags, Data, Advanced (8).
- **Backup recency survives Clear-all.** Decide whether `handleClearAll`
  preserves `lastExportAt`. **Recommend: yes**, preserve. Clear is
  about user data; export timestamp is metadata.
- **Commit scope.** CLAUDE.md scope list doesn't include `settings`;
  closest existing is `style`. Recommend adding `settings` formally
  to CLAUDE.md on the first commit; use `feat(settings):` meanwhile.
- **Live-preview visibility.** At 880 px wide the backdrop's side
  margin narrows; the user sees more dashboard, so live density/theme
  toggles are more visible. If distracting, darken backdrop
  `rgba(0,0,0,0.5)`. Don't go further — live preview is the feature.

---

End of brief.
