# Research: Functional & Behavioral Settings for Proclivity

> Scope: locale, time/date, reminders, keyboard shortcuts, data management, section visibility.
> Visual/theming is owned by the sibling agent — nothing here overlaps that scope.
> Date researched: 2026-05-11. Author: Claude Sonnet 4.6 (sub-agent).

---

## 1. Executive Summary — Top 5 Recommendations for This App

1. **Defer almost everything to the `Intl` API, expose only one escape hatch.**
   For a solo, single-device, English-UI extension, `navigator.language` + `Intl.DateTimeFormat` cover ~95% of users correctly out of the box. The single override worth exposing is a `timeFormat` toggle (`"auto" | "12h" | "24h"`), because 12h/24h preference is intensely personal and diverges from locale defaults (e.g. many en-US developers prefer 24h). Everything else — date order, number separators, relative-time language — can follow the browser locale with zero config.

2. **Week start deserves an explicit setting; derive timezone and locale from the system.**
   Week start (`"sun" | "mon" | "sat" | "locale"`) has a concrete impact on the Gantt chart and Sprint boundaries, and users have strong opinions that often differ from their locale default. `Intl.Locale.getWeekInfo()` is not yet Baseline (missing Firefox stable as of 2026), so provide a fallback. Timezone, by contrast, should never be stored — `chrome.alarms` uses epoch milliseconds (UTC), so the system clock is the ground truth; see Design Question #2.

3. **Notifications: ship snooze defaults and a "quiet hours" window; skip sound control.**
   Things 3's snooze model (10 min / 30 min / 1 hr) and Notion Calendar's pre-meeting lead time selector are the right reference points. A `doNotDisturb` time window (stored as `{ from: "HH:MM", to: "HH:MM" }` in 24h strings) lets the service worker suppress notification firing without requiring OS-level configuration. Sound on/off is OS-controlled and irrelevant to the extension — skip it.

4. **Export/import should use a versioned JSON envelope; skip checksums for v1.**
   A `{ schemaVersion: number, exportedAt: string, data: ProclivityState }` wrapper costs one line and prevents silent corruption on future imports. CRC/SHA checksums add user confusion with negligible real-world benefit at this scale. Destructive "clear all data" must be a two-step confirmation (type "DELETE" or a second button click), never a single tap.

5. **Keyboard shortcuts: document only, do not expose customization in v1.**
   The Chrome `commands` API has severe limitations in a newtab-page context (it cannot override browser-level shortcuts; Ctrl+Alt combos are forbidden; global scope is restricted to Ctrl+Shift+[0-9]). In-page keyboard shortcuts (j/k navigation, n for new item, etc.) are not routable through `chrome.commands` at all. Documenting them in a help panel costs nothing; building a full shortcut remapper is weeks of work for marginal gain on a solo-use extension.

---

## 2. Settings Bucket Reviews

### 2.1 Time Format

**What it is:** Whether times display as `5:30 PM` (h12), `17:30` (h23), or follow the browser locale.

**Who does it well:**
- **Notion Calendar** — simple dropdown with "12-hour" / "24-hour" options, clearly labeled. ([Notion Calendar settings](https://www.notion.com/help/notion-calendar-settings))
- **Fantastical** — delegates to macOS Language & Region for date/time format, with a direct "Date & Time Formats…" button that opens System Settings. Clean separation of concerns. ([Fantastical Mac settings](https://flexibits.com/fantastical/help/settings))
- **macOS Language & Region** — exposes "24-hour time" as a single checkbox; everything else adapts. ([Apple support](https://support.apple.com/guide/mac-help/change-how-dates-times-and-more-appear-on-mac-mh27073/mac))

**Tradeoffs:**

| Option | Pro | Con |
|---|---|---|
| Always follow locale (`Intl.DateTimeFormat(navigator.language)`) | Zero config, always correct | en-US users who want 24h are silently wrong |
| Expose `"auto" \| "12h" \| "24h"` toggle | Addresses the real divergence | One more field |
| Expose all four `hourCycle` values (h11/h12/h23/h24) | Technically complete | Nobody knows what h11 or h24 means |

**Verdict:** `"auto" | "12h" | "24h"` is the right surface. Map "auto" to `Intl.DateTimeFormat(navigator.language).resolvedOptions().hourCycle` at render time, never store it. Map "12h" → `hourCycle: "h12"` and "24h" → `hourCycle: "h23"` (these are the familiar conventions; h11 and h24 are edge cases not worth exposing).

**Implementation primitives:**
```ts
// Cache per (locale, hourCycle) pair — constructing Intl.DateTimeFormat is expensive
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function getTimeFmt(locale: string, hourCycle: "h12" | "h23" | undefined): Intl.DateTimeFormat {
  const key = `${locale}:${hourCycle ?? "auto"}`;
  if (!fmtCache.has(key)) {
    fmtCache.set(key, new Intl.DateTimeFormat(locale, {
      hour: "numeric", minute: "2-digit",
      ...(hourCycle ? { hourCycle } : {}),
    }));
  }
  return fmtCache.get(key)!;
}
```
No reload required on change — formatters are created on next render.

---

### 2.2 Date Format

**What it is:** Whether `2026-05-11` renders as `05/11/2026` (US), `11/05/2026` (EU), `2026-05-11` (ISO), or `May 11, 2026` (long).

**Who does it well:**
- **Notion** — database date properties offer `Full Date`, `Month/Day/Year`, `Day/Month/Year`, `Year/Month/Day`. No "auto" option; each database sets it independently. ([Notion help](https://www.notion.com/help/account-settings))
- **Google Calendar** — derives from your Google account language/region, not exposed as a separate toggle.
- **Todoist** — exposes date format in Settings → General → Date & Time; accepts ISO, US, and EU. ([Todoist dates guide](https://www.todoist.com/help/articles/introduction-to-dates-and-time-q7VobO))

**Tradeoffs:**

| Option | Pro | Con |
|---|---|---|
| Always follow locale | Correct for most users | Not customizable |
| `"auto" \| "iso" \| "us" \| "eu"` enum | Familiar terms | Doesn't cover long/short, relative |
| `Intl.DateTimeFormat` `dateStyle` option (`"short"`, `"medium"`, `"long"`, `"full"`) | Covers all variants, localizable | Long/full is verbose for dense lists |

**Verdict for Proclivity:** Auto-from-locale for all date display. The only toggle worth adding is **relative dates** ("2 days ago" vs. "May 9") as a boolean. Absolute formats are rarely the source of friction; relative vs. absolute is.

**Relative date implementation:**
```ts
// Intl.RelativeTimeFormat — fully Baseline, works across all modern browsers
const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: "auto" });
// "auto" gives "yesterday" instead of "1 day ago"

function relativeDate(ts: number): string {
  const diffMs = ts - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (Math.abs(diffDays) <= 1) return rtf.format(diffDays, "day");
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");
  // Fall back to absolute for dates > 1 week out
  return new Intl.DateTimeFormat(navigator.language, { dateStyle: "medium" }).format(ts);
}
```

---

### 2.3 Week Start

**What it is:** Which day appears in the leftmost column of a weekly calendar view and sets sprint/week boundaries.

**Who does it well:**
- **Google Calendar** — Settings → General → "Week starts on" dropdown (Saturday / Sunday / Monday). Persists to account. ([Google Calendar week start](https://support.google.com/calendar/answer/6110849))
- **Notion** — "Start week on Monday" toggle under Language & Time in Preferences. Simple boolean because their user base skews European/corporate. ([Notion preferences](https://www.notion.com/help/account-settings))
- **Fantastical** — "Start week on" full dropdown with any day. ([Fantastical settings](https://flexibits.com/fantastical/help/settings))

**Tradeoffs:**

| Option | Pro | Con |
|---|---|---|
| `Intl.Locale.getWeekInfo().firstDay` | Zero config | Not Baseline; Firefox stable may not support it |
| Explicit `"sun" \| "mon" \| "sat"` setting | Simple, reliable | Ignores locale |
| Explicit setting with locale-derived default | Best of both | Slightly more complex init |

**Verdict:** Explicit `"sun" | "mon" | "sat"` setting, defaulting to `"mon"` if `getWeekInfo()` is unavailable. Provide a locale-aware fallback:
```ts
function defaultWeekStart(): "sun" | "mon" | "sat" {
  try {
    const info = new Intl.Locale(navigator.language).getWeekInfo?.();
    if (info?.firstDay === 7) return "sun";
    if (info?.firstDay === 6) return "sat";
    return "mon";
  } catch {
    return "mon"; // safe default
  }
}
```

**Impact on Proclivity:** Affects the Gantt chart week column headers and any future "this week" sprint boundary calculations.

---

### 2.4 Timezone

**What it is:** Whether reminder `fireAt` timestamps are interpreted in local time vs. a fixed IANA timezone.

**Who does it well:**
- **Notion Calendar** — "Ask to update my primary time zone when in a different location" toggle — opt-in prompt on timezone change, not automatic silently. ([Notion Calendar settings](https://www.notion.com/help/notion-calendar-settings))
- **Google Calendar** — "Use device time zone" toggle; when off, lets you pin a primary timezone. ([Google Calendar timezone](https://support.google.com/calendar/answer/37064))
- **Fantastical** — "Time zone override" in Advanced, plus a secondary time zone for display. ([Fantastical settings](https://flexibits.com/fantastical/help/settings))

**Tradeoffs — the `chrome.alarms` constraint:**

`chrome.alarms` takes `{ when: number }` in milliseconds-since-epoch — that is, a UTC absolute timestamp. It is timezone-agnostic by design. When a user creates a reminder for "9:00 AM tomorrow", the extension converts that local clock time to a UTC epoch value and stores it in `reminder.fireAt`. The alarm fires at that UTC epoch regardless of system timezone.

This means: **if the user flies to Tokyo, their "9 AM reminder" will fire at what is now 10 PM Tokyo time**, because the stored epoch hasn't changed.

**Recommendation:** Do not store a timezone preference. Instead:
- When creating a reminder, always capture `fireAt` as the user's current local epoch at time of creation (i.e., `new Date("2026-05-12T09:00:00").getTime()` using local parsing).
- Add a visible "Travelling? Reschedule reminders" affordance in the Reminders UI rather than a background setting.
- A `timezone?: string | undefined` field in `UserSettings` is future-safe but should be labeled clearly as "display timezone for new reminders" — it does not retroactively shift stored `fireAt` values without a migration.

For the v1 scope of this extension (single device, solo user, no server-side component), **omit the timezone setting entirely** and document the travel behavior in the UI tooltip near `fireAt` inputs.

---

### 2.5 Locale / Language

**What it is:** Controlling which language and regional format conventions apply to dates, numbers, and relative times.

**Who does it well:**
- **Notion** — Language dropdown in Settings → Preferences → Language & Time; ships ~15 languages; date/number formats follow the selected language. ([Notion account settings](https://www.notion.com/help/account-settings))
- **Fantastical** — Ships localized in 8 languages; date/time handling deferred to OS Language & Region.

**Tradeoffs for an English-only extension:**

Proclivity ships English UI only. The question is whether `Intl` formatting (dates, numbers, relative time) should follow:
- `navigator.language` — best default; respects what the user configured in Chrome/OS.
- A stored locale string — allows override without changing system settings.

**Verdict:** Do not expose a "Language" setting in v1. The UI is English-only; there is nothing to translate. For `Intl` formatting, always use `navigator.language` at call time — it reads the current browser locale without storing anything. If a user wants different number formatting than their locale suggests, they can change it in macOS Language & Region and it will be reflected automatically.

The one exception: if a stored `localeOverride?: string | undefined` is desired for power users, it should be an unlabeled advanced field (or omitted from the UI entirely) until the extension ships multiple UI languages.

---

### 2.6 Greeting / Display Behavior

**What it is:** Whether and how the page greets the user (name, time-of-day phrase, or nothing).

**Who does it well:**
- **Momentum** — "Good morning / afternoon / evening" with precise cutoffs published in their help center:
  - Morning: 5:00 AM – 11:59 AM
  - Afternoon: 12:00 PM – 4:59 PM
  - Evening: 5:00 PM – 4:59 AM
  ([Momentum greeting help](https://get.momentumdash.help/hc/en-us/articles/115007629867-When-do-the-greetings-Good-morning-afternoon-and-evening-change))
- **Notion** — No greeting; shows user avatar and name in sidebar only.

**Design options:**

| Mode | Display | Notes |
|---|---|---|
| `"none"` | No greeting | Clean, minimal |
| `"name-only"` | "Chris" | Personalized without time logic |
| `"time-of-day"` | "Good evening, Chris" | Most common productivity-app pattern |
| `"custom"` | User-defined string | Overkill for v1 |

**Cutoff recommendations (Momentum's model is well-researched):**
- Morning: 05:00–11:59
- Afternoon: 12:00–16:59
- Evening: 17:00–04:59 (wraps through midnight)

**Verdict:** Ship `"none" | "time-of-day"` as the `greetingStyle` setting. The existing `name` field handles personalization. A separate "greeting mode" toggle is the minimal addition. Skipping "name-only" (the distinction from "time-of-day" is just removing the prefix) keeps the setting simple.

---

### 2.7 Keyboard Shortcuts

**What it is:** Whether users can customize the in-app keyboard shortcuts that drive productivity (create item, navigate, complete, etc.).

**Who does it well:**
- **Linear** — Comprehensive shortcut system; all shortcuts shown in a help panel (? key); command palette shows shortcut next to every action as a learning mechanism. No user customization. ([Linear keyboard shortcuts](https://keycombiner.com/collections/linear/))
- **Raycast** — Full shortcut remapper with real-time conflict detection: turns red if a combination is already used, shows the conflicting command by name. ([Raycast command aliases](https://manual.raycast.com/command-aliases-and-hotkeys))

**Chrome extension constraints:**

The `chrome.commands` API has hard limitations that make custom shortcut UX difficult for a new-tab extension:
- Cannot override browser shortcuts (Ctrl+T, Ctrl+W, Ctrl+L, etc.)
- `Ctrl+Alt+[key]` combos are forbidden (AltGr conflict on non-US keyboards)
- Global shortcuts are restricted to `Ctrl+Shift+[0-9]`
- In-page shortcuts (j/k, n, Escape) operate entirely in React's `onKeyDown` handlers — not routable through `chrome.commands` at all

**Verdict:**
- **v1:** Document in-page shortcuts in a `?` help panel (a keyboard icon in the header or a modal). Zero configuration surface. This mirrors Linear's approach and costs almost nothing to implement.
- **v2+ consideration:** A shortcut remapper for in-page actions is feasible but requires a full key-conflict detection system. Not worth building until the shortcut set is stable.

**Conflicts to pre-empt in implementation:**
- Do not intercept Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z (browser text editing)
- Do not intercept Ctrl+F (browser find)
- Do not intercept Tab (focus traversal — critical for accessibility)
- Safe keys for new-tab page actions: `n` (new), `j`/`k` (navigate), `e` (edit), `d` (done/delete), `/` (search), `?` (help), `Escape` (cancel/close)

---

### 2.8 Notifications & Reminders Behavior

**What it is:** How the app handles reminder delivery: sounds, snooze, quiet hours, default lead time, recurrence defaults.

**Who does it well:**
- **Things 3** — Snooze options at notification time: 10 minutes / 30 minutes / 1 hour. No app-level sound toggle (deferred to macOS Notifications). ([Things 3 notifications](https://culturedcode.com/things/support/articles/1665164/))
- **TickTick** — "Constant reminder" (repeat notification every N minutes until dismissed), configurable snooze intervals, default reminder lead time per calendar. ([TickTick constant reminder](https://help.ticktick.com/articles/7374017550633402368))
- **Notion Calendar** — Pre-meeting notification lead time ("5 min / 10 min / 15 min / 30 min / 1 hr before") with sound selection per notification type. ([Notion Calendar settings](https://www.notion.com/help/notion-calendar-settings))

**Feasibility within `chrome.alarms`:**

- **Sound on/off:** Chrome notifications use the OS notification sound. The `chrome.notifications` API has no volume/sound parameter. Sound control is OS-level only — **do not expose this setting**.
- **Snooze:** Implemented by the service worker creating a new alarm `N` minutes after the notification is dismissed or actioned. Things 3's 3-option model (10/30/60) is the clearest design.
- **Default lead time:** A stored offset (e.g., `defaultReminderLeadMinutes: 10`) prepopulates the time picker when creating a new reminder. Notion Calendar's 5/10/15/30/60 minute options are the right range.
- **Quiet hours ("Do Not Disturb"):** The service worker can check `Date.now()` against a stored `{ from: "HH:MM", to: "HH:MM" }` window before calling `chrome.notifications.create()`. If within the window, it can defer the alarm to the end of the quiet period or simply skip non-recurring reminders. This is entirely in-extension and does not require OS DND access.
- **Recurrence defaults:** The existing `Reminder.recurrence` field already supports `"daily" | "weekly" | "none"`. A `defaultRecurrence` setting (`"none"` by default) is the only addition needed.

**Verdict — ship these; skip the rest:**

| Setting | Ship? | Notes |
|---|---|---|
| Snooze presets | Yes | 3-option picker: 10/30/60 min |
| Default lead time | Yes | 5/10/15/30/60 min options |
| Quiet hours window | Yes | `from`/`to` as `"HH:MM"` strings |
| Sound on/off | No | OS-controlled; not accessible |
| Recurrence default | Yes | Simple `"none" \| "daily" \| "weekly"` |
| Constant/repeat reminder | No | TickTick feature; overkill here |

---

### 2.9 Data Management

**What it is:** Export, import, clear-all, and storage-usage display.

**Who does it well:**
- **Todoist** — Backup & export available in account settings; exports tasks as CSV or JSON.
- **Raycast** — Settings are exportable as a JSON file with a `schemaVersion` field; importing shows a diff/preview before applying.
- **Arc browser** — "Data & Privacy" section with a distinct destructive zone, visually separated by a red-bordered card. Requires explicit confirmation text for irreversible actions.

**Export/import format:**

Recommendation: a thin versioned envelope over the raw `ProclivityState`:
```json
{
  "schemaVersion": 1,
  "appVersion": "0.4.2",
  "exportedAt": "2026-05-11T14:00:00.000Z",
  "data": { /* ProclivityState */ }
}
```
- `schemaVersion` (integer, not semver) allows step-by-step migration: v1→v2→v3.
- `appVersion` is informational — for bug reports, not migration logic.
- `exportedAt` is an ISO 8601 string for human readability.
- No checksum: at this data scale (<10 MB, plain JSON), truncation is obvious on parse failure; a SHA-256 field adds user confusion with negligible real benefit in v1.

**Storage-used display:**

`chrome.storage.local.getBytesInUse(null)` returns total bytes used. Display as `"X KB of 10 MB used"` in the data management section. The Chrome storage quota is ~10 MB (increased from 5 MB in Chrome 114); the `unlimitedStorage` permission can raise it but requires manifest change.

**Destructive zone UX:**

- Visually separate "Clear all data" from non-destructive controls (e.g. a red-bordered section or a horizontal rule with a "Danger zone" label — GitHub's pattern).
- Two-step confirmation: first button click shows an inline confirmation `"This will permanently delete all todos, sprints, Gantt charts, and reminders. Are you sure?"` with a Cancel and a red "Delete everything" button.
- Do not use a text-type confirmation (e.g. "type DELETE") — it's patronizing for a solo personal extension. A second button click suffices.

---

### 2.10 Section Visibility

**What it is:** Toggle which dashboard sections (Today / Sprint / Long-term / Gantt / Reminders) are visible.

**Who does it well:**
- **Momentum** — Settings panel with show/hide toggles for each widget (Focus, Weather, Links, Background, etc.). Implemented as a list of boolean checkboxes. ([Momentum settings](https://get.momentumdash.help/hc/en-us/articles/360016334234-Settings))
- **Notion** — Sidebar section visibility controlled per-user; sections can be collapsed or hidden.
- **Linear** — Views can be favorited/unfavorited; unfavorited views disappear from the sidebar.

**Tradeoffs:**

| Approach | Pro | Con |
|---|---|---|
| Boolean per section | Simple, explicit | Binary; no reorder |
| Drag-to-reorder + visibility | Full control | Complex to implement |
| Boolean + ordering index | Good balance | Slightly more storage |

**Verdict for Proclivity v1:** Boolean visibility per section. Reordering is a v2 concern and requires a drag-and-drop implementation that is out of scope. Five sections × one boolean is the minimal surface.

```ts
interface SectionVisibility {
  today: boolean;
  sprint: boolean;
  longTerm: boolean;
  gantt: boolean;
  reminders: boolean;
}
```

Default: all `true`. Hiding Gantt is the most common use case (it's a heavyweight feature not everyone will use).

---

## 3. Design Questions — Answered

### Q1: Should we expose time format separately, or always defer to `Intl.DateTimeFormat` with a "use system locale" toggle?

**Stance: Expose exactly one time format escape hatch — a `"auto" | "12h" | "24h"` picker. No full locale override.**

The rationale:
- `Intl.DateTimeFormat(navigator.language)` is correct for ~95% of users with zero config. en-US users who want 24h and European users who want 12h are real and vocal minorities, which is why every major calendar app exposes this toggle explicitly.
- A full "use system locale" toggle implies the alternative is not using the system locale — which raises the question of what else to use. Since the UI is English-only, there is nothing meaningful to localize beyond number/date formatting, which should always follow the browser locale.
- Exposing `hourCycle` values h11/h12/h23/h24 is too technical. "12-hour" / "24-hour" / "System default" maps directly to what users know.
- Implementation: when `timeFormat === "auto"`, derive at render time via `new Intl.DateTimeFormat(navigator.language).resolvedOptions().hourCycle`. Never persist the derived value.

### Q2: For a Chrome extension using `chrome.alarms`, what is the right way to think about timezones when the user travels?

**Stance: Store `fireAt` as an epoch integer (already done). Do not store a timezone setting. Add a user-visible warning and a one-tap "shift all reminders" action.**

The mechanism:
- `chrome.alarms` schedules by UTC epoch milliseconds. A reminder for "9 AM next Tuesday" is stored as the epoch of 09:00:00 in the user's local timezone at time of creation.
- When the user flies from New York (UTC-5) to Tokyo (UTC+9), that stored epoch now corresponds to 11 PM Tokyo time — the alarm fires at the wrong local hour.
- The correct architecture is: **"show a one-time banner when the detected timezone diverges from the timezone at last reminder creation."** The banner offers "Shift reminders to match your current timezone" as a bulk operation (add/subtract the offset delta to all non-fired `fireAt` values).
- Do not auto-shift silently — an alarm that fired while the user was mid-flight is gone; auto-shifting could cause a cascade of late notifications.
- Implementation: store `lastKnownTzOffset?: number | undefined` (e.g. `-300` for UTC-5) in `UserSettings`. On extension load, compare `new Date().getTimezoneOffset()` against the stored value. If different by > 30 minutes, show the banner.

**For the initial implementation (v1):** Skip the banner and the `lastKnownTzOffset` field. Simply document the limitation in a tooltip on the reminder time picker: "Reminder times are saved in your current timezone. Update manually if you travel." This is the honest, low-complexity answer for a solo-use extension that the user will predominantly use from a single physical location.

### Q3: Export/import format recommendation — JSON vs. a more structured envelope (versioned, with checksums)?

**Stance: Versioned JSON envelope. No checksum in v1.**

Recommendation:
```json
{
  "schemaVersion": 1,
  "appVersion": "0.4.2",
  "exportedAt": "2026-05-11T14:00:00.000Z",
  "data": { /* ProclivityState verbatim */ }
}
```

Rationale:
- **Plain JSON without versioning** breaks silently on future schema changes. Even adding a field to `UserSettings` can cause an import to miss that field if the consumer doesn't know to expect it.
- **`schemaVersion` as an integer** (not semver) enables a simple migration chain: v1→v2→v3. The import function reads the version, runs the appropriate migrations, then hands off a normalized `ProclivityState` to `storage.set()`.
- **No checksum:** At <10 MB of plain UTF-8 JSON, truncation is immediately visible as a parse failure (`JSON.parse` throws). SHA-256 checksums require either a SubtleCrypto async verification step or a synchronous polyfill — added complexity with no practical benefit when corruption manifests as parse failure anyway.
- **No separate schema files or TypeScript type imports in the export:** the envelope is self-contained and human-readable for debugging.
- **File extension:** `.json` with MIME type `application/json`. Do not use a custom `.proclivity` extension — it prevents users from inspecting the backup file in any editor.

---

## 4. Proposed `UserSettings` Field Additions

This is the schema recommendation only — no implementation. It is designed to be additive and non-breaking relative to the existing `UserSettings { name?: string | undefined }`. The visual/theming agent owns its own additions (theme, font, density, motion, background); nothing here overlaps those.

```typescript
/**
 * Expanded UserSettings — functional/behavioral preferences.
 * All fields optional with exactOptionalPropertyTypes-safe signatures.
 * "undefined" means "use the application default", not "disabled".
 */
export interface UserSettings {
  // ── Existing ──────────────────────────────────────────────────────────────
  /** Display name for the greeting. */
  name?: string | undefined;

  // ── Greeting ──────────────────────────────────────────────────────────────
  /**
   * "none"        → no greeting rendered
   * "time-of-day" → "Good morning/afternoon/evening, {name}" (default)
   */
  greetingStyle?: "none" | "time-of-day" | undefined;

  // ── Locale / Formatting ───────────────────────────────────────────────────
  /**
   * "auto"  → derive from navigator.language via Intl (default)
   * "12h"   → force hourCycle h12
   * "24h"   → force hourCycle h23
   */
  timeFormat?: "auto" | "12h" | "24h" | undefined;

  /**
   * Whether to display dates as relative strings ("2 days ago") when
   * within ±7 days of today. Falls back to absolute beyond that range.
   * Default: true.
   */
  relativeDates?: boolean | undefined;

  /**
   * First day of the week. Affects Gantt column headers and any
   * "this week" sprint boundary calculations.
   * Default: derived from Intl.Locale.getWeekInfo(), fallback "mon".
   */
  weekStart?: "sun" | "mon" | "sat" | undefined;

  // ── Section Visibility ────────────────────────────────────────────────────
  /**
   * Per-section visibility. Omitting a key means the section is visible.
   * Defined as a nested object to keep diff-friendly updates.
   */
  sectionVisibility?: {
    today?: boolean | undefined;
    sprint?: boolean | undefined;
    longTerm?: boolean | undefined;
    gantt?: boolean | undefined;
    reminders?: boolean | undefined;
  } | undefined;

  // ── Reminders & Notifications ─────────────────────────────────────────────
  /**
   * Default lead time in minutes for new reminders.
   * Accepted values: 0, 5, 10, 15, 30, 60.
   * Default: 10.
   */
  defaultReminderLeadMinutes?: 0 | 5 | 10 | 15 | 30 | 60 | undefined;

  /**
   * Default recurrence for new reminders.
   * Default: "none".
   */
  defaultRecurrence?: "none" | "daily" | "weekly" | undefined;

  /**
   * Snooze duration offered in the notification action.
   * Default: 10 (minutes).
   */
  snoozeMinutes?: 10 | 30 | 60 | undefined;

  /**
   * "Do Not Disturb" quiet hours window.
   * Times are 24-hour "HH:MM" strings in the user's local clock.
   * The service worker skips notification firing during this window.
   * Example: { from: "22:00", to: "07:00" } for overnight quiet.
   *
   * Both fields must be present or both absent (undefined = DND disabled).
   * Crossing midnight is supported (from > to means wraps overnight).
   */
  quietHours?: {
    from: string; // "HH:MM" 24h
    to: string;   // "HH:MM" 24h
  } | undefined;

  // ── Future / Reserved ─────────────────────────────────────────────────────
  /**
   * Reserved for future travel-timezone handling.
   * Stores the UTC offset (in minutes, as returned by Date.getTimezoneOffset())
   * at the time reminders were last created, so a divergence can be detected.
   * Not surfaced in Settings UI in v1.
   */
  lastKnownTzOffset?: number | undefined;
}
```

**What this schema deliberately excludes:**
- `timezone` (IANA string) — see Design Question #2; defer to system clock
- `language` / `locale` — English-only UI; format follows `navigator.language`
- `soundEnabled` — not accessible via `chrome.notifications`
- `keyboardShortcuts` map — v2+ concern; no customization in v1
- Any visual/theming fields — sibling agent scope

**`EMPTY_STATE` default implications:**
All new fields default to `undefined`, which the application code must interpret as "use default". No migration needed for existing storage blobs — the spread `{ ...EMPTY_STATE, ...s }` in `storage.get()` already handles this correctly.

---

## 5. References

- [Todoist: Introduction to dates and time](https://www.todoist.com/help/articles/introduction-to-dates-and-time-q7VobO)
- [Notion: Account settings & preferences](https://www.notion.com/help/account-settings)
- [Notion Calendar settings](https://www.notion.com/help/notion-calendar-settings)
- [Fantastical for Mac: Settings](https://flexibits.com/fantastical/help/settings)
- [Fantastical: Saving Daylight with Time Zones](https://flexibits.com/blog/2023/03/saving-daylight-with-fantasticals-time-zones/)
- [Raycast: Command Aliases & Hotkeys](https://manual.raycast.com/command-aliases-and-hotkeys)
- [Linear: Keyboard Shortcuts changelog](https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help)
- [Linear design patterns (gunpowderlabs)](https://gunpowderlabs.com/2024/12/22/linear-delightful-patterns)
- [Google Calendar: Use Calendar in different time zones](https://support.google.com/calendar/answer/37064)
- [Google Calendar: Change first day of week](https://support.google.com/calendar/answer/6110849)
- [Things 3: Troubleshooting notifications](https://culturedcode.com/things/support/articles/1665164/)
- [TickTick: Constant reminder](https://help.ticktick.com/articles/7374017550633402368)
- [Momentum: Greeting cutoffs](https://get.momentumdash.help/hc/en-us/articles/115007629867-When-do-the-greetings-Good-morning-afternoon-and-evening-change)
- [Momentum: Settings](https://get.momentumdash.help/hc/en-us/articles/360016334234-Settings)
- [MDN: Intl.DateTimeFormat() constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat)
- [MDN: Intl.Locale.prototype.getWeekInfo()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo)
- [MDN: Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
- [MDN: Navigator.language](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language)
- [Chrome Developers: chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Chrome Developers: chrome.commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [Chrome Developers: chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Apple Support: Change how dates/times appear on Mac](https://support.apple.com/guide/mac-help/change-how-dates-times-and-more-appear-on-mac-mh27073/mac)
- [Apple Support: Change Language & Region settings](https://support.apple.com/guide/mac-help/change-language-region-settings-on-mac-intl163/mac)
- [Schema versioning for JSON config files](https://offlinetools.org/a/json-formatter/schema-versioning-for-json-configuration-files)
- [DEV: Every way to detect a user's locale (from best to worst)](https://dev.to/lingodotdev/every-way-to-detect-a-users-locale-from-best-to-worst-369i)
- [xjavascript.com: Cross-browser safe keyboard shortcuts guide](https://www.xjavascript.com/blog/available-keyboard-shortcuts-for-web-applications/)
- [Sunsama: Account settings](https://help.sunsama.com/docs/user-settings)
- [GitHub Primer: RelativeTime component guidelines](https://primer.style/product/components/relative-time/guidelines/)
