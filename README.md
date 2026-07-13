# Proclivity

## What it is

Proclivity is a personal Manifest V3 Chrome extension that replaces the new-tab
page with a planning surface. Five tabs organize the work: **Today** (daily
task list), **Sprint** (time-boxed sprint with per-sprint task scopes and an
archived-sprint history), **Long-term** (open-ended goals and initiatives),
**Gantt** (one or more named Gantt charts with nested tasks, collapse/expand,
drag-to-move, and drag-to-resize), and **Reminders** (one-shot or
daily/weekly recurring alerts backed by `chrome.alarms`, delivered as
in-app toasts on the dashboard plus a toolbar-badge count). Behind
everything sits an animated wireframe-mesh background whose color cycles
smoothly through the day — indigo at 1 am, bright blue by morning,
turquoise at noon, yellow in the afternoon, orange at sunset, red in the
evening, purple at 10 pm.

Local-only. Not published to the Chrome Web Store.

---

## Why

Momentum is beautiful but shallow. Notion is powerful but heavyweight and
requires a context-switch. The goal here is a planning tool that loads the
instant a new tab opens, persists everything locally without a server, and
can be shaped exactly to how this person actually plans work — sprints,
Gantt charts, and timed reminders — without paying for or waiting on
anyone else's roadmap.

---

## Stack

- **Vite 5** + **React 18** + **TypeScript 5** (strict mode)
- **`@crxjs/vite-plugin` ^2.0.0-beta.28** — wraps the MV3 manifest, handles
  content-script injection and hot-reload during dev
- **`chrome.storage.local`** — single-key persistence (~10 MB cap)
- **`chrome.alarms` + in-app alert toasts** — service-worker-driven
  reminder delivery; `chrome.notifications` was dropped because OS-level
  delivery fails silently on macOS and Windows
- **`@react-three/fiber` ^8** + **`three` ^0.169** — animated background,
  lazy-loaded so three.js stays out of the initial chunk

---

## Architecture

### The five sections

**Today** and **Long-term** are thin wrappers around the shared
[`TodoList`](src/sections/TodoList.tsx) component; the only difference is the
`scope` value (`"today"` or `"long"`) stamped on each `Todo` record.

**Sprint** ([`src/sections/sprint/SprintManager.tsx`](src/sections/sprint/SprintManager.tsx))
manages a list of named sprints, each with `startsAt`/`endsAt` timestamps.
Exactly one sprint is "active" at a time (`activeSprintId` in
`ProclivityState`). Sprint tasks are `Todo` records with `scope: "sprint"` and
a `sprintId` foreign key. Sprints whose `endsAt` is in the past are shown as
collapsed, expandable rows in an "Archived" section; they are never deleted
automatically. The sprint header shows a progress bar driven by task-completion
ratio, plus a "Day N of M" calendar progress indicator.

**Gantt** ([`src/sections/Gantt.tsx`](src/sections/Gantt.tsx) + [`src/sections/gantt/ChartView.tsx`](src/sections/gantt/ChartView.tsx))
supports multiple named charts, each a tab at the top of the section. Within a
chart, tasks have `startsAt`/`endsAt` timestamps and an optional `parentId` for
nesting. `flattenTasks()` in [`ganttUtils.ts`](src/sections/gantt/ganttUtils.ts)
does a depth-first traversal and respects each task's `collapsed` flag, so
entire subtrees can be hidden. The timeline grid is rendered as an absolutely-
positioned canvas of divs; each bar responds to `onPointerDown`/`onPointerMove`/
`onPointerUp` via `setPointerCapture` so drag works across the bar boundary.
The 6-pixel edge zones on each bar switch to resize-start or resize-end mode;
the center zone is a move. Pressing Escape during a drag reverts the preview and
releases pointer capture. The drag preview is kept in local component state; the
final position is committed to storage only on pointer-up.

**Reminders** ([`src/sections/reminders/RemindersManager.tsx`](src/sections/reminders/RemindersManager.tsx))
lets you create a reminder with a title, an exact fire time, a recurrence
(`daily`/`weekly`/`none`), and an optional link to an existing todo. When
a reminder is saved, the service worker's `chrome.storage.onChanged` listener
picks up the diff and creates a `chrome.alarms` entry. On alarm fire, the
service worker enqueues a pending alert (`src/storage/alerts.ts`) that the
dashboard renders as a persistent toast with dismiss/snooze actions; while
no dashboard tab is open, the toolbar badge carries the pending count and
the alert surfaces on the next new-tab open. Recurring reminders have their
`fireAt` advanced by one day or one week (anchored from the original `fireAt`,
not the actual firing time, so they don't drift). Non-recurring reminders are
marked `fired: true`.

### Persistence layer

All state lives under a single key — `"proclivity:state:v1"` — in
`chrome.storage.local`. The entire `ProclivityState` object is read, patched,
and written back on every mutation. This keeps the storage model simple (no
partial-key merges, no migrations between fields) at the cost of one full read-
modify-write per operation.

Concurrent writes from the React UI would clobber each other without
serialization. [`storage.update()`](src/storage/storage.ts) solves this with an
in-memory promise chain (`writeChain`): each call appends to the tail of the
chain, so writes execute in arrival order and each write reads the result of the
previous one.

The service worker runs in a separate module scope and cannot share the UI's
`writeChain`. It maintains a parallel queue (`swWriteChain` in
[`service-worker.ts`](src/background/service-worker.ts)) for the same reason.
Both queues enforce the same read-latest → transform → write-back sequence.

### `useStore()` hook

[`useStore()`](src/storage/useStore.ts) is a plain React hook, not a Context
provider. Every section that needs state calls it directly. This is a deliberate
choice: the app has five sections kept permanently mounted (all rendered, only
hidden with `hidden={...}`), so a shared context would re-render all five on
every state change anyway. With the hook-per-section pattern, each section's
re-render is triggered only when its own `useStore()` subscription fires — which
happens to be the same event since there is only one storage key. The hook
exposes `state`, `loading`, and a stable `update` callback (memoized via
`useCallback` so consumer `useCallback` deps stay clean).

### Mesh background

[`MeshBackground`](src/components/MeshBackground.tsx) is a full-screen WebGL
canvas rendered by `@react-three/fiber`. It is lazy-loaded via `React.lazy` in
[`App.tsx`](src/newtab/App.tsx) so the ~800 kB three.js bundle never blocks the
initial render.

The geometry is a `PlaneGeometry` (90 × 50 units, 140 × 80 segments) tilted to
a shallow perspective angle. A `ShaderMaterial` runs a 3-octave fractional
Brownian motion (fBm) in GLSL using the Ashima Arts simplex noise implementation.
Two pairs of slow sine waves drive a `uWander` uniform that offsets the noise
field coordinates each frame, so the warping appears to travel across the screen
rather than pulse in place. The fragment shader brightens peaks slightly based on
the `vElevation` varying. Color is updated each frame by interpolating between
eight time-of-day key colors using a smoothstep curve. Rendering is paused when
the tab is hidden (`visibilitychange`) and reduced to a single static frame when
`prefers-reduced-motion: reduce` is set.

### Shared components

[`Modal`](src/components/Modal.tsx) is a portal-rendered dialog with focus
trap, Escape-to-close, and save/restore of previously focused element. Two
specializations are exported alongside it: `TextInputModal` (for create/rename
flows) and `ConfirmDialog` (for destructive confirmations). The base `Modal`
uses `useId()` per instance so nested modals each have a unique
`aria-labelledby` target.

[`TodoItem`](src/components/TodoItem.tsx) is a shared `<li>` row used by
`TodoList`, `SprintManager`, and archived sprint rows.

### Service worker lifecycle

On `onInstalled` and `onStartup`, the service worker calls `reconcileAlarms()`.
This reads the current reminder list, computes which alarms should exist (all
non-fired reminders with a future `fireAt`), clears any orphaned
`proclivity:reminder:*` alarms, and creates any missing ones. Reminders whose
`fireAt` is already in the past at reconcile time are fired immediately (missed-
reminder path) and either advanced (if recurring) or marked `fired`.

The `chrome.storage.onChanged` listener runs `diffAndSyncAlarms()` on every
state change, comparing old and new reminder arrays to create, update, or clear
alarms reactively. This means the service worker stays synchronized without
needing explicit messages from the UI.

---

## Layout

```
proclivity/
├── manifest.config.ts        # MV3 manifest generated by @crxjs
├── vite.config.ts            # Vite config: crx plugin, @ alias, build target
├── tsconfig.json             # Strict TS: exactOptionalPropertyTypes, noUncheckedIndexedAccess
├── package.json
├── public/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── src/
    ├── newtab/
    │   ├── index.html        # Extension new-tab entry point
    │   ├── App.tsx           # Tab router, lazy MeshBackground, memoized Header
    │   ├── App.css           # Global layout, tab bar, header
    │   └── index.css         # CSS reset and root vars
    ├── background/
    │   └── service-worker.ts # chrome.alarms + in-app alert queue + reconcileAlarms
    ├── types/
    │   └── index.ts          # Canonical data model: Todo, Sprint, GanttTask, GanttChart, Reminder, ProclivityState
    ├── storage/
    │   ├── constants.ts      # STORAGE_KEY = "proclivity:state:v1"
    │   ├── storage.ts        # get/set/update (write queue) + subscribe + uid()
    │   └── useStore.ts       # React hook: state + loading + stable update callback
    ├── sections/
    │   ├── sections.css      # Shared section layout styles
    │   ├── Today.tsx         # TodoList wrapper (scope="today")
    │   ├── LongTerm.tsx      # TodoList wrapper (scope="long")
    │   ├── TodoList.tsx      # Reusable add/toggle/delete list for Today and Long-term
    │   ├── Sprint.tsx        # Re-export of SprintManager
    │   ├── Gantt.tsx         # Chart-tab manager + modals; delegates to ChartView
    │   ├── Reminders.tsx     # Re-export of RemindersManager
    │   ├── sprint/
    │   │   ├── SprintManager.tsx  # Full sprint UI: switcher, active sprint, archived sprints
    │   │   ├── sprintUtils.ts     # Date helpers: todayMidnight, isArchived, sprintDayProgress
    │   │   └── sprint.css
    │   ├── gantt/
    │   │   ├── ChartView.tsx      # Timeline grid, drag engine, add-task form
    │   │   ├── TaskRow.tsx        # Left-panel task row with collapse toggle
    │   │   ├── ganttUtils.ts      # flattenTasks, chartBounds, monthSpans, collectDescendants
    │   │   └── gantt.css
    │   └── reminders/
    │       ├── RemindersManager.tsx  # Add form, upcoming/fired lists
    │       ├── reminderUtils.ts      # relativeTime, tsToDatetimeLocal, formatFireAt
    │       └── reminders.css
    └── components/
        ├── Modal.tsx          # Base Modal + TextInputModal + ConfirmDialog
        ├── Modal.css
        ├── TodoItem.tsx       # Shared checkbox + title + delete row
        ├── MeshBackground.tsx # three.js GLSL warp mesh, time-of-day color cycle
        └── MeshBackground.css
```

---

## Develop

```bash
npm install

# Dev server with HMR (port 5173, HMR on 5174)
npm run dev

# Production build (tsc -b + vite build)
npm run build

# Type-check only, no emit
npm run typecheck
```

**Load as an unpacked extension:**

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked** and select the `dist/` directory (after `npm run build`)
   or the `@crxjs` dev output directory during `npm run dev`
4. Open a new tab

During development, `@crxjs/vite-plugin` patches the extension manifest and
injects HMR plumbing automatically; you do not need to reload the extension
manually after most edits.

**TypeScript strictness.** The `tsconfig.json` enables `strict: true` plus two
additional flags:

- `exactOptionalPropertyTypes: true` — `foo?: T` and `foo?: T | undefined` are
  distinct; the code uses the latter where `undefined` must be assignable in
  spreads.
- `noUncheckedIndexedAccess: true` — array index access returns `T | undefined`;
  all callers must handle the undefined case or use a non-null assertion.

Both flags are non-negotiable. `npm run build` runs the full compiler suite and
must pass cleanly before any change is considered done.

---

## Google Photos setup (optional)

The **Photos** tab plays a slideshow of photos the user picks from their
Google account via the [Photos Picker API](https://developers.google.com/photos/picker).
The feature is inert until the one-time Google Cloud setup below is complete.
This checkout already contains the developer's Chrome-extension OAuth client;
forks should replace it with a client registered to their own pinned extension
ID.

1. **The extension ID is already pinned.** OAuth client_ids are bound to one
   extension ID, so it has to be stable. [`manifest.config.ts`](manifest.config.ts)
   commits a `key` (public half of an RSA keypair), which fixes the ID at
   `cpflcminmnekdfjpmdhgblbolmclcdkk` no matter where the repo lives. Confirm it
   matches the ID on the Proclivity card at `chrome://extensions` after loading.

   Do not delete `key`. Without it Chrome derives the ID from the absolute path
   of the loaded `dist/` directory, so moving the checkout silently changes the
   ID and `getAuthToken` starts failing with `bad client id`. See Chrome's docs
   on [keeping an extension ID consistent](https://developer.chrome.com/docs/extensions/reference/manifest/key).

2. **Create a Google Cloud project.** In the
   [Google Cloud console](https://console.cloud.google.com/), create a new
   project (or reuse one).

3. **Enable the Photos Picker API.** APIs & Services → Library → search for
   "Photos Picker API" → Enable.

4. **Configure the OAuth consent screen.**
   - User type: **External** (with yourself added as a test user) is fine for
     a personal install; you do not need to publish the app.
   - Add the scope `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.

5. **Create an OAuth client_id.** APIs & Services → Credentials → Create
   credentials → OAuth client ID. Application type: **Chrome extension**.
   Paste your pinned extension ID into the Application ID field.

6. **Drop the client_id into the manifest (forks only).** Open
   [`manifest.config.ts`](manifest.config.ts), replace
   `GOOGLE_OAUTH_CLIENT_ID` with the client_id from step 5, run `npm run build`,
   and reload the unpacked extension. The committed developer client already
   matches the pinned ID above.

7. **Connect from Settings.** Open Settings → **Google Photos** → **Connect
   Google Photos**. Chrome will surface the consent dialog the first time;
   subsequent picks reuse the cached token.

**Troubleshooting `bad client id`.** If Connect fails with
`OAuth2 request failed: Service responded with error: 'bad client id: …'`, the
Item ID registered on the OAuth client does not match the ID Chrome is handing
to `getAuthToken`. Compare the ID on the `chrome://extensions` card against the
Application ID in Cloud Console (step 5) — they must be identical. The pane's
**Copy diagnostics** button dumps the runtime ID and manifest state; error-level
logs also persist to `proclivity:logs:v1`, so the failure is recoverable after
the fact.

Because the extension ID namespaces `chrome.storage.local`, changing it starts
the extension with empty todos, reminders and settings. Export first via
Settings → **Data** → **Export data**, then re-import after reloading under the
new ID. The Obsidian API key (Settings → Roadmaps) has to be re-entered too.

**How the photo data is handled.** When you pick photos, the extension fetches
each one downscaled to 1600×1000 with `Authorization: Bearer <token>`,
encodes it as a base64 data URL, and writes the set under a dedicated
`chrome.storage.local` key (`proclivity:photos:v1`). The total cache is
budgeted at 6 MB so the main app data has headroom under Chrome's 10 MB
quota. The cached photos are **not** included in the JSON export — they live
outside `ProclivityState` by design.

The `baseUrl` on a Picker mediaItem expires roughly an hour after the pick
session, which is why we cache the bytes locally rather than storing the
URLs. Re-picking from the settings pane replaces the cache.

---

## Google Calendar setup (optional)

The **Calendar** tab can overlay events from the signed-in account's primary
Google Calendar. This is a strictly one-way source: Google events flow into the
Proclivity grid, while local todos, sprints, reminders, Gantt tasks, finances,
and other panel data are never sent to Google.

1. In the same Google Cloud project used for Photos, [open Google Calendar API
   for project `455929700165`](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=455929700165)
   and enable it. The project number must match the prefix of the OAuth client
   ID in `manifest.config.ts`; enabling the API in another selected project
   does not activate it for Proclivity.
2. In **Google Auth Platform → Data Access**, add only
   `https://www.googleapis.com/auth/calendar.events.owned.readonly`. This scope
   can view events on calendars the account owns; it cannot insert, update, or
   delete events.
3. If the app audience is **External / Testing**, add the Google account as a
   test user. Personal testing grants can expire, in which case Proclivity will
   show a Reconnect action rather than opening consent during page load.
4. Run `npm run build`, reload `dist/` at `chrome://extensions`, then open
   **Settings → Google Calendar → Connect Google Calendar**.

No API key, client secret, new Chrome API permission, or Google Calendar host
permission is required. Proclivity requests Calendar and Photos scopes
separately, so connecting Photos does not silently request Calendar access.

**Synchronization model.** On connect, month navigation, or manual refresh,
Proclivity performs a read-only `events.list` for the visible 42-day grid. It
asks Google to expand recurring events, follows pagination, and replaces the
matching bounded snapshot atomically. Up to six recently viewed windows are
retained, subject to a 5,000-event total ceiling. A successful snapshot is
considered fresh for ten minutes; stale events stay visible if the network is
temporarily unavailable. Incremental `syncToken` and background polling are
intentionally deferred.

**Data boundary.** Only event ID, title, start/end, all-day dates, and an
optional validated Google Calendar link are cached under
`proclivity:google-calendar:v1`. Descriptions, attendees, organizer email,
locations, and conferencing data are not requested. The cache lives outside
`ProclivityState`, is excluded from JSON exports, and can never create a local
alarm. **Turn off and clear events** removes the local cache and cached Calendar
token without disturbing Google Photos. The Photos pane's explicit
**Disconnect Google account** action revokes all Proclivity Google access and
clears both integration caches.

---

## Data model

```typescript
// src/types/index.ts

// Backs the Today, Sprint, and Long-term lists. scope + sprintId
// together determine which list a todo belongs to.
interface Todo {
  id: string;
  title: string;
  notes?: string | undefined;
  scope: "today" | "sprint" | "long";
  done: boolean;
  createdAt: number;           // ms since epoch
  completedAt?: number | undefined;
  dueAt?: number | undefined;
  sprintId?: string | undefined; // set iff scope === "sprint"
}

// One planning sprint. activeSprintId in ProclivityState points at the
// current sprint; sprints past their endsAt are "archived" but kept.
interface Sprint {
  id: string;
  name: string;
  startsAt: number;  // ms since epoch (local midnight)
  endsAt: number;
}

// One row in a Gantt chart. parentId creates a tree; collapsed hides subtree.
interface GanttTask {
  id: string;
  chartId: string;
  parentId?: string | undefined;
  title: string;
  startsAt: number;
  endsAt: number;
  progress: number;   // 0–100; forced to 100 in UI when done is true
  done: boolean;
  collapsed?: boolean | undefined;
  color?: string | undefined;
}

// A named container for a set of GanttTasks.
interface GanttChart {
  id: string;
  name: string;
  createdAt: number;
}

// One alarm entry. The service worker owns alarm creation; fired=true
// means the alarm has been delivered and should not re-arm.
interface Reminder {
  id: string;
  title: string;
  fireAt: number;    // ms since epoch
  recurrence?: "daily" | "weekly" | "none" | undefined;
  fired?: boolean | undefined;
  linkedTodoId?: string | undefined;
}

// The entire persisted state stored under one chrome.storage.local key.
interface ProclivityState {
  todos: Todo[];
  sprints: Sprint[];
  activeSprintId?: string | undefined;
  ganttCharts: GanttChart[];
  ganttTasks: GanttTask[];
  reminders: Reminder[];
}
```

---

## Working with the code

- **All work runs directly on `main`.** No feature branches, no PRs. See
  [`CLAUDE.md`](CLAUDE.md) for the full branching policy and commit conventions.
- **`npm run build` is the verification bar.** It must pass cleanly (`tsc -b &&
  vite build`) before a change is done. Do not merge code that fails typecheck.
- **Strict TypeScript flags are non-negotiable.** Do not disable `strict`,
  `exactOptionalPropertyTypes`, or `noUncheckedIndexedAccess` to make code
  compile.
- **Keep the initial chunk small.** The newtab chunk should stay under ~200 kB.
  Heavy dependencies (like three.js) must be lazy-loaded via `React.lazy` +
  `Suspense`. Do not add new npm dependencies without justification.
- **Sections are all mounted, only hidden.** `App.tsx` keeps all five section
  components mounted at all times and hides inactive ones with `hidden={...}`.
  This is deliberate — switching tabs preserves local component state (drafts,
  expanded archived sprints, etc.). Do not break this with lazy-loaded sections
  unless you handle the state preservation explicitly.
- **Agent slash commands.** Two Claude Code slash commands are available for
  planning and execution:
  - [`/roadmap`](.claude/commands/roadmap.md) — turns a brief into the
    canonical `plans/<slug>/roadmap.yaml` with milestone identifiers.
  - [`/milestone-pipeline`](.claude/commands/milestone-pipeline.md) — executes
    one milestone end-to-end through Research → Implement → Critique →
    Rectify with sub-agent orchestration.

---

## Roadmap

- [x] Today / Long-term todo lists
- [x] Sprint as a real entity (start/end dates, active sprint, per-sprint task
      scope, archived sprint history)
- [x] Reminders UI wired to `chrome.alarms` + in-app alert toasts (replaced
      `chrome.notifications` — OS delivery fails silently on macOS/Windows)
- [x] Gantt: multiple charts, tasks with start/end, nesting via `parentId`,
      collapse/expand, drag-to-move and drag-to-resize bars
- [x] Animated wireframe-mesh background with time-of-day color cycle
- [ ] Drag-and-drop between sections (e.g. promote a today task to a sprint)
- [ ] Daily / weekly review prompts
- [ ] Due-date support and overdue indicators on todo items
- [ ] Gantt task progress editing in the UI (the field exists in the data model)
- [ ] Gantt task color picker

---

## Storage cap note

`chrome.storage.local` has a quota of approximately 10 MB. The data model is
composed entirely of small records — todos, sprints, Gantt tasks, reminders are
each a handful of scalar fields — so normal usage is well within that limit. The
one design to avoid is unbounded append-only growth: long-term activity logs,
audit trails, or history of completed items should be pruned or capped rather
than accumulated indefinitely. If Gantt charts grow into hundreds of tasks, or
reminder history is never cleared, monitor the storage footprint with
`chrome.storage.local.getBytesInUse()` during development.
