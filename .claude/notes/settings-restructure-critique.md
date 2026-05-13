# Adversarial Critique — Settings Restructure & 8 New Settings

## Verdict

The structural work (Agent A) is clean and complete. The new settings (Agent B) are largely correct but have three concrete bugs: the `ClosedTodosView` retention display is permanently wrong regardless of user preference, the `isLowering` purge-warning skips the most destructive transition (Forever → 7 days), and the deep-linking URL parameter is acknowledged as deferred in the modal but never flagged for follow-up. Do not ship without fixing at least the first two. The third is a tracking gap, not a regression.

---

## Build / typecheck status

`npm run build` passes clean. TypeScript strict mode (including `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`) raises no errors.

- **Initial newtab chunk:** 198.61 kB (threshold: 200 kB — passes by 1.4 kB; fragile margin)
- **SettingsModal lazy chunk:** 37.91 kB (Agent A baseline was 31.70 kB; Agent B added ~6.2 kB for 8 new settings — within the 40 kB ceiling)

---

## Severity-graded findings

### CRITICAL

None. No data loss path found.

---

### HIGH

**H1. `ClosedTodosView` displays hardcoded retention days instead of user's setting**

File: `src/components/closed/ClosedTodosView.tsx:216` and `:235`

```tsx
{CLOSED_TODO_RETENTION_DAYS} days.      // empty-state
{CLOSED_TODO_RETENTION_DAYS} days       // header subtitle
```

Both strings import `CLOSED_TODO_RETENTION_DAYS` (the constant 30) and never read `rs.closedTodoRetentionDays`. A user who sets retention to 7 days sees "auto-clears after 30 days" in two places. A user who sets Forever sees "auto-clears after 30 days" when in fact nothing will auto-clear. The purge logic itself is correct (`closedTodos.ts:248` reads the setting properly); only the UI disclosure is wrong.

**Fix:** Pass `retentionDays` as a prop or read `resolvedSettings(state.settings).closedTodoRetentionDays` inside the component. For the Forever case (`null`), render "No auto-clear (count cap still applies)".

---

**H2. `isLowering` warning skips the highest-stakes transition: Forever → any finite value**

File: `src/components/settings/panes/TodosPane.tsx:49-52`

```tsx
const isLowering =
  pendingClosedRetention !== null &&
  savedClosedRetention !== null &&
  pendingClosedRetention < savedClosedRetention;
```

When `savedClosedRetention` is `null` (Forever), the second `!== null` check fails and `isLowering` is `false`. A user who had Forever enabled and drops to 7 days could silently schedule deletion of years of closed todos — with no warning. This is the *worst* case, not an edge case. The current code only warns on numeric downsteps (90 → 30, 30 → 7) and ignores the null-to-finite transition entirely.

**Fix:**

```tsx
const isLowering =
  pendingClosedRetention !== null &&
  (savedClosedRetention === null || pendingClosedRetention < savedClosedRetention);
```

---

**H3. Deep-link URL parameter (`?settings=<paneId>`) is not implemented**

File: `src/newtab/App.tsx:169-172`

```tsx
<SettingsModal
  open={settingsOpen}
  onClose={() => setSettingsOpen(false)}
/>
```

The `initialPane` prop is never passed. The brief explicitly specifies: "read the `?settings=<paneId>` URL param in App.tsx's settings-opening effect." The modal itself supports `initialPane` (documented with a comment acknowledging the gap), but the caller never reads the URL or passes the prop. A `?settings=todos` deep-link opens to the last-visited pane, not Todos.

This is a divergence from spec, not a regression (feature never worked), but it was on the ship list. Track it explicitly or accept the gap.

---

**H4. `ClosedTodosView` subtitles use the old retention constant even when retention = null (Forever)**

File: `src/components/closed/ClosedTodosView.tsx:233-235`

When `closedTodoRetentionDays` is `null`, the header renders: "5 closed tasks · auto-clears after 30 days". This is factually wrong — with Forever retention, no age-based auto-clear occurs. Users will believe todos disappear after 30 days when they won't (until the 500-item cap is hit). This is the same root cause as H1 but the failure mode is reversed (false alarm rather than missed alarm).

---

### MEDIUM

**M1. `greetingFor()` adds an undocumented "Still up" zone not mentioned in the brief or hint text**

File: `src/newtab/App.tsx:74-82`, `src/components/settings/panes/GeneralPane.tsx:146-150`

The implementation adds a night cutoff (5am/4am/6am for standard/earlyBird/nightOwl) that returns "Still up" between midnight and that hour. The brief specified cutoffs of 12/17 (standard), 10/16 (earlyBird), 13/19 (nightOwl) — no "Still up" zone. The hint text ("Morning until noon, afternoon until 5pm, evening after") never mentions what shows between midnight and 5am. A user who sees "Still up" at 3am will be confused because the hint implies only three states (morning / afternoon / evening).

The enhancement is reasonable but the hints should say "Still up until Xam, morning until…" to document all four states.

---

**M2. `dayBoundaryHour` only wired into `ClosedTodosView` grouping, not into `Calendar` "today" marker**

File: `src/sections/Calendar.tsx:45,48,49`

```tsx
const [today, setToday] = useState<number>(() => startOfDay(Date.now()));
// ...
const msUntilMidnight = startOfDay(Date.now()) + 86_400_000 - Date.now();
```

The Calendar's "today" highlight and rollover timer use `startOfDay` (local midnight, always 0am). A user with `dayBoundaryHour=5` who opens the calendar at 3am will see "today" as yesterday's date — inconsistent with the ClosedTodosView grouping that correctly respects the boundary. The brief warned "audit `src/lib/` and `src/sections/` before sizing" and reserved the right to "downgrade Day-boundary to skip" if the audit came up large. The audit came up large (Calendar, Gantt, sprint date utils all use `startOfDay`), and the agents shipped partial wiring. The setting should either be fully wired or come with a documented scope caveat. Currently there's neither.

---

**M3. Arrow-key navigation triggers `handleChangePane` immediately when `dirty=true`**

File: `src/components/settings/SettingsSidebar.tsx:47-50`

```tsx
case "ArrowDown":
  e.preventDefault();
  nextIndex = (currentIndex + 1) % panes.length;
  break;
// ...
onChangePane(entry.id);
```

Arrow keys call `onChangePane` immediately, which in the modal maps to `handleChangePane` which opens the discard dialog if dirty. The user pressing ArrowDown to browse panes while mid-edit gets a discard-dialog interrupt on every keystroke. Standard ARIA tablist pattern: arrow keys move *focus* only; Enter/Space activate. Focus should move without triggering pane switch or dirty check.

---

**M4. Dirty dot only appears on the currently-active pane, providing no cross-pane signal**

File: `src/components/settings/SettingsSidebar.tsx:99`

```tsx
const showDirtyDot = isActive && dirty;
```

If a user edits General, the dot shows on General. If they switch panes (through the discard-confirm flow), dirty is cleared so the dot vanishes. This is logically sound — the discard dialog prevents silent context loss. But if dirty persists (user clicks "Keep editing" in the discard dialog and then navigates via keyboard in a future fix), the dot would be on the wrong pane. Consider placing a global dirty indicator (e.g., on the modal title or footer Cancel button) instead of an active-pane indicator.

---

**M5. `SegmentedControl` generic type `<7 | 30 | 90 | 0>` for the "Forever" sentinel leaks the implementation detail**

File: `src/components/settings/panes/TodosPane.tsx:89`

The control is typed as `SegmentedControl<7 | 30 | 90 | 0>` where `0` is the UI-layer sentinel for "Forever" (stored as `null`). The `onChange` immediately converts back: `v === 0 ? null : v`. This works and compiles, but `0` as a domain sentinel for "no limit" is semantically confusing — `0` days would normally mean "purge immediately." A named type alias `type RetentionSentinel = 7 | 30 | 90 | "forever"` or simply a separate boolean toggle for "Forever" would be cleaner.

---

### LOW

**L1. Initial chunk is 198.61 kB — 1.4 kB from the 200 kB limit**

Any future addition to the shared chunk (another import pulled into the initial bundle) will break the threshold. The margin is tight enough that one additional utility import would push it over. Consider auditing what's in the 198 kB (likely `three.js` is NOT there since it's lazy-loaded, but something is large). Not urgent; document the limit and add a build-time assertion if the threshold matters.

---

**L2. `setPendingVisibility` wrapped in `makeDirty` but `GeneralPane` declares it as `React.Dispatch<React.SetStateAction<SectionVisibility>>`**

File: `src/components/settings/panes/GeneralPane.tsx:54`, `src/components/settings/SettingsModal.tsx:426`

`makeDirty<T>(setter: (v: T) => void)` returns `(v: T) => void`. `React.Dispatch<React.SetStateAction<T>>` accepts both `T` and `(prev: T) => T`. The mismatch compiles (the callback case is compatible via structural typing) but the prop type in `GeneralPane` promises a full `Dispatch` capability that the wrapper doesn't expose. This could break if `GeneralPane` ever tries to use the functional updater form explicitly — it does today (line 224: `setPendingVisibility((v) => ({...v, ...}))`) and it works because maceDirty calls `setter(functionArg)` which React correctly interprets as a functional updater. Low risk but the type declaration is inaccurate.

---

**L3. `ClosedTodosView` imports `resolvedSettings` (for `dayBoundaryHour`) but still imports `CLOSED_TODO_RETENTION_DAYS` for display — inconsistent pattern**

File: `src/components/closed/ClosedTodosView.tsx:42-44`

The component correctly reads `rs.dayBoundaryHour` from resolved settings but then displays `CLOSED_TODO_RETENTION_DAYS` (the hardcoded constant) in the header. The inconsistency makes the H1 bug harder to notice in review — the pattern looks intentional rather than accidental.

---

**L4. Greeting schedule hint doesn't document the "Still up" state**

File: `src/components/settings/panes/GeneralPane.tsx:147-150`

Hint says "Morning until noon, afternoon until 5pm, evening after" — implies only three states exist. "Still up" between midnight and 5am is invisible in the settings UI. Users who see "Still up" at 2am may be confused. Each hint should read: "Still up until 5am, morning until noon, afternoon until 5pm, evening after." (values appropriate per schedule).

---

**L5. `Replay onboarding hints` resets `geminiNanoSeen` but the current open modal session holds stale `rs`**

File: `src/components/settings/panes/AdvancedPane.tsx:62-74`

After `handleReplayHints` fires, `rs.geminiNanoSeen` in the modal will refresh on the next render cycle (storage write → subscriber → re-render). The NEW badge will reappear without needing a modal close/reopen. This is correct behavior but is not tested or documented. A user might expect the badge to only reappear on their next tab open; if it pops back immediately inside the open modal it could seem like a bug. Add a comment clarifying the live-update behavior.

---

## Per-setting verification matrix

| Setting | On `UserSettings` type | In `DEFAULT_SETTINGS` | In `resolvedSettings()` | Rendered in pane | Wired in app code |
|---|---|---|---|---|---|
| `greetingSchedule` | ✓ (`GreetingSchedule`) | ✓ (`"standard"`) | ✓ | ✓ GeneralPane | ✓ `greetingFor(now, rs.greetingSchedule)` in App.tsx:114 |
| `dayBoundaryHour` | ✓ (`0\|3\|5`) | ✓ (`0`) | ✓ | ✓ GeneralPane | PARTIAL — wired in `ClosedTodosView.tsx:164` only; Calendar and Gantt use hardcoded midnight |
| `defaultRecurrence` | ✓ (`RecurrenceDefault`) | ✓ (`"none"`) | ✓ | ✓ NotificationsPane (was the latent bug from research brief, now fixed) | ✓ `RemindersManager.tsx:60` uses as `useState` initial value |
| `defaultSprintDays` | ✓ (`7\|14\|21\|28`) | ✓ (`14`) | ✓ | ✓ TodosPane | ✓ `SprintManager.tsx:494,669` reads `_rs.defaultSprintDays` and passes to `defaultEndsAt()` |
| `closedTodoRetentionDays` | ✓ (`7\|30\|90\|null`) | ✓ (`30`) | ✓ (null/undefined handled correctly) | ✓ TodosPane | ✓ `useStore.ts:31`, `service-worker.ts:200`; WARNING: isLowering bug (H2), display bug (H1) |
| `chatPosition` | ✓ (`"right"\|"bottom"`) on `geminiNano` | ✓ (`"right"`) | ✓ | ✓ GeminiNanoPane | ✓ `ChatPanel.tsx:36-59` reads and applies `.chat-panel--bottom` class; CSS rules exist |
| `lastExportAt` | ✓ (`number\|undefined`) | ✓ (`undefined`) | ✓ | ✓ DataPane (recency display with >30d warning) | ✓ `exportImport.ts:54` writes after download; `handleClearAll` preserves it |
| `focusRingMode` | ✓ (`FocusRingMode`) | ✓ (`"auto"`) | ✓ | ✓ AdvancedPane | ✓ `useThemeSync.ts:57-60` writes `data-focus-ring="always"`; CSS rule in `theme.css:158` |

---

## Code structure / abstractions audit

**Good:**
- `PANE_ORDER` registry is the single source of truth; sidebar and modal switch both consume it without drift.
- `SettingsPaneId` union matches `PANE_ORDER` entries exactly (8 entries, same names).
- `makeDirty` helper is clean and centralizes the dirty-flip without requiring every pane to know about it.
- Snapshot includes `cardLayouts` (H4 carry-over from prior fix) — correctly preserved.
- All 8 pane files have a file-level JSDoc docblock.
- Live vs staged split is respected: no new staged field sneaked into a live path or vice versa.
- `purgeOldClosed` null-vs-undefined distinction is handled correctly via explicit `!== undefined` check rather than `??`.

**Concerns:**
- `SectionHeader` is defined identically in `GeneralPane.tsx`, `NotificationsPane.tsx`, `TodosPane.tsx`, `GeminiNanoPane.tsx`, `AdvancedPane.tsx` — five private duplicates of a 3-line component. Extract to `src/components/settings/PaneSection.tsx` or add to `SettingsControls.tsx`.
- `SettingsModal.tsx` at 578 lines is notably longer than the pre-restructure version would have been for the shell alone. The staged state declarations (17 useState hooks) + dirty-check wiring + renderPane switch make the file unwieldy. The staged state could move to a custom hook `usePendingSettings(rs)` returning all pending values and setters.
- `useThemeSync` now manages six attributes on `<html>` (theme, density, font-size, reduced-motion, accent, focus-ring). It's at the edge of "one thing" — a further addition (e.g., high-contrast) would push it over. The function is still readable but note the creep.

---

## Documentation gaps

1. **`dayBoundaryHour` wiring scope not documented.** The JSDoc on `UserSettings.dayBoundaryHour` says "Affects Today scope filter and date groupings" but only `ClosedTodosView` respects it. Calendar and Gantt still use midnight. The comment is misleading.

2. **"Still up" night-boundary not mentioned in any hint text.** Three of four possible greetings are undocumented in the Settings UI.

3. **Deep-linking contract not documented.** `SettingsModal.tsx:67-73` has a comment noting the URL parse is deferred, but there's no corresponding issue, roadmap item, or TODO in CLAUDE.md.

4. **`dirty` flag mechanism has a partial inline comment** (`SettingsModal.tsx:148-156`) but doesn't document the full invariant: live-preview fields (theme, accent, etc.) do NOT set dirty, and pane-switch writes (settingsLastPane, geminiNanoSeen) do NOT set dirty.

5. **`closedTodoRetentionDays` type comment uses "Forever → sentinel `0`"** in the brief (research doc §3) but the actual sentinel in storage is `null`. The discrepancy is benign (0 is only a UI layer value) but anyone reading the brief and then the code will be confused.

---

## Divergence from brief

| Brief specification | Implementation |
|---|---|
| `?settings=<paneId>` URL param read in `App.tsx` | Not implemented; `SettingsModal` accepts `initialPane` prop but App.tsx never passes it (SettingsModal.tsx comment acknowledges this) |
| `closedTodoRetentionDays` sentinel = `0` for "Forever" | Sentinel is `null` in storage; `0` is only a SegmentedControl UI value converted in onChange |
| `greetingSchedule` cutoffs: standard `12/17`, earlyBird `10/16`, nightOwl `13/19` | Implementation adds a night boundary: `5/12/17`, `4/11/16`, `6/13/18` — adds "Still up" state not in brief |
| "Collapse sidebar to a `<select>` at < 640px" | Implemented as a horizontal scroll strip, not a `<select>` — CSS comment acknowledges this, but the brief specified a select to reduce visual clutter |
| `focusRingMode` under Accessibility sub-header in Advanced with `reducedMotion` co-located | `reducedMotion` stays in AppearancePane; only `focusRingMode` is in AdvancedPane. Brief said merge them under an "Accessibility" sub-header in Advanced |

---

## Recommended fixer agenda

Priority order:

1. **Fix `isLowering` to cover Forever → finite transition** (`TodosPane.tsx:49-52`) — HIGH bug, 1-line fix, no risk.

2. **Fix `ClosedTodosView` to display the user's actual retention setting** (`ClosedTodosView.tsx:216,235`) — HIGH bug, pass `retentionDays` as a prop or read from `resolvedSettings`. Handle null→"No auto-clear" text. 

3. **Fix `greetingFor` hint text to document the "Still up" state** (`GeneralPane.tsx:146-150`) — MEDIUM, 3 strings.

4. **Document `dayBoundaryHour` wiring scope** — fix the JSDoc on `UserSettings.dayBoundaryHour` in `types/index.ts` to say "currently affects ClosedTodosView grouping only; Calendar and Gantt use midnight". Consider whether to fully wire or explicitly defer Calendar wiring in a follow-up plan item.

5. **Implement `?settings=<paneId>` URL param in `App.tsx`** — add ~8 lines reading `window.location.search`, stripping after consumption. The modal prop already exists.

6. **Fix arrow-key navigation to move focus only, not activate** (`SettingsSidebar.tsx:41-84`) — ArrowUp/Down should call `.focus()` on the target button without calling `onChangePane`. Only Enter/Space should activate.

7. **Extract `SectionHeader` into a shared primitive** — remove the 5-file duplication. Add to `SettingsControls.tsx` or new `PaneSection.tsx`.

8. **Extract staged state into a `usePendingSettings(rs)` hook** — reduce `SettingsModal.tsx` line count and improve testability.

9. **Move `reducedMotion` into AdvancedPane Accessibility section** alongside `focusRingMode` — matches the brief's intent to co-locate accessibility controls.

10. **Add a build-time size assertion** for the initial chunk at 200 kB — the current margin is 1.4 kB.
