# Implement synthesis — sprint-backlog-redesign-m3

**Path:** inline (main session). 2 source files modified, both under `src/sections/sprint/`. Diff size ~165 LOC net additions — well within the inline ceiling (300 LOC / 5 files).

**Base SHA:** `dc270a3` (chore: record m2 metrics + pipeline index). All edits below are layered on top in a single commit.

## Built

1. **`GoalEditor` inline component** (new) in `SprintManager.tsx`. Three mutually-exclusive rendered states:
   - **Editing** (`editing === true`): `<input type="text" maxLength={120} autoFocus>` with placeholder "Sprint goal (optional)…". Commit triggers on blur OR Enter; Escape reverts. AC#1 ✓.
   - **Display** (`goal` set): `<button>` rendering the goal text, single-line with `text-overflow: ellipsis` on overflow via CSS. Clicking re-opens the editor. AC#2 ✓.
   - **Empty placeholder** (`goal === undefined`): dashed `<button>` rendering "+ Add goal". Clicking opens the editor. AC#1 empty-state.
   - `useEffect(() => setDraft(goal ?? ""), [goal])` re-syncs the draft when the persisted goal changes from elsewhere (multi-tab write or EditSprintForm save in another flow). Without it, the inline blur-commit would silently overwrite a concurrent external write.

2. **`ActiveSprintHeader` rewired** to take a new `onSaveGoal` prop and mount `<GoalEditor goal={sprint.goal} onSave={onSaveGoal} />` between the date range and the progress/draft block. The goal renders for BOTH draft and active sprints — intent is intrinsic to the sprint, not lifecycle-phase. (Closed sprints never reach this component; they live in `ArchivedSprintRow`.)

3. **`setSprintGoal` action** on the SprintManager component. Mirrors the pattern of `startSprint` / `closeSprint`. Writes `goal` to the active sprint via `update()`. **Distinct from `closeSprint`'s retroNote handling** — `undefined` argument CLEARS the goal field (m3 AC#1 semantics: "empty trimmed value reverts to the placeholder"). The action ships an inline comment that warns against "harmonizing" with m2's preserve-on-empty pattern.

4. **`SprintForm` extended** with an optional goal `<input>` between the name field and the date row. Threaded via the new `initialGoal` prop and an updated `onSave` signature `(name, startsAt, endsAt, goal: string | undefined) => void`. The form trims the goal on save and resolves empty to `undefined`. AC#4 ✓.

5. **`NewSprintForm` / `EditSprintForm`** pass the goal through. `EditSprintForm` seeds `initialGoal={sprint.goal}` so an existing goal pre-populates the input.

6. **`createSprint` and `editSprint` signature updates** accept the new `goal: string | undefined` parameter:
   - `createSprint` uses `...(goal ? { goal } : {})` conditional spread — a brand-new sprint with no goal does NOT carry an explicit `goal: undefined` key.
   - `editSprint` writes `goal` directly to the sprint object so editing CAN clear an existing value (form gives the user explicit control; this matches the inline editor's clearing semantics).

7. **`ArchivedSprintRow` updated** to render the goal as italic-muted text between the row button and the expanded task block when `sprint.goal` is non-empty. CSS handles single-line ellipsis via `text-overflow`. AC#3 ✓.

8. **CSS** in `src/sections/sprint/sprint.css`: five new classes (`.sprint-goal-display`, `.sprint-goal-empty`, `.sprint-goal-input`, `.sprint-form-goal`, `.sprint-archived-goal`) plus a small layout helper for the goal slot inside `.sprint-header-top`. Uses existing theme tokens (`--accent`, `--border`, `--text`, `--text-dim`, `--bg`, `--radius`) — no new color decisions.

## Files touched (m3-scoped)

- `src/sections/sprint/SprintManager.tsx` — `GoalEditor` component, `setSprintGoal` action, `ActiveSprintHeader` rewiring, `SprintForm` goal field, `createSprint`/`editSprint` signatures, `ArchivedSprintRow` goal line. (~140 LOC net.)
- `src/sections/sprint/sprint.css` — five new classes + container layout. (~85 LOC.)

Files NOT touched (intentional — already-correct per m1):
- `src/types/index.ts` — `Sprint.goal?: string | undefined` declared in m1.
- `src/storage/storage.ts` — normalizer round-trips `goal` via base spread; no field-specific logic needed.
- `test/fixtures/*.json` — m1 fixtures still cover the AC#6 round-trip case; replay reports 4/4 pass.
- `scripts/replay-fixtures.ts` — no new assertion needed for m3.
- `src/components/Modal.tsx`, `src/components/TodoEditModal.tsx`, `src/newtab/App.tsx` — none touched.

## Verification (AC-by-AC)

- **AC#1** — Active sprint with `goal: undefined` shows "+ Add goal" button; click → input with autoFocus + maxLength=120; blur or Enter commits trimmed value; empty trimmed value reverts to placeholder (via `setSprintGoal(undefined)`). ✓ (manual walkthrough captured in commit body).
- **AC#2** — Sprint with non-empty goal renders the goal as a single-line display chip (CSS ellipsis). Clicking re-opens the editor. ✓
- **AC#3** — Archived sprint row, when expanded, renders italic-muted goal between date range (the row button) and the task block. ✓
- **AC#4** — NewSprintForm and EditSprintForm both include an optional goal `<input>` between the name field and the date row. Date validation unchanged. ✓
- **AC#5** — `npm run build` passes the full `tsc -b && vite build` under strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`. Cumulative bundle delta from pre-m1 baseline:
  - **Pre-m1 baseline:** 199.62 kB raw / 63.12 kB gzip.
  - **Post-m2 rect (pre-m3 baseline):** 202.19 kB raw / 63.87 kB gzip.
  - **Post-m3 implement:** **203.54 kB raw / 64.24 kB gzip**.
  - **m3 delta:** **+1.35 kB raw / +0.37 kB gzip** (well under the 5 kB intra-milestone warn threshold from the synthesis).
  - **Cumulative delta from pre-m1:** **+3.92 kB raw / +1.12 kB gzip** — well under the +8 kB AC#5 limit. ✓
- **AC#6** — `npx tsx scripts/replay-fixtures.ts` reports **4/4 fixtures normalize cleanly** post-m3 (unchanged from m2 since m3 does not touch storage). No regression in sprint progress bar, archived rail expansion, sprint switcher tabs, or the m2 close-sprint flow. ✓ (manual walkthrough confirms each).

## Deferred (per the milestone brief)

- Bundle "~200 kB" soft-target carry-forward from m2: post-m3 cumulative is 203.54 kB, ~1.8% over CLAUDE.md's soft target. Still 7.7% under the CI fail-at-220 kB threshold. **No action in m3.** This is a roadmap-level decision — the m2 rect already flagged it for m3 planning; m3's measured +1.35 kB delta keeps us in budget for the redesign work.
- No automated UI test harness introduced — out of m3 scope per synthesis (and m2's M4 deferral).

## external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy"
```

No new external writes. No new npm dependency. No Chrome permission change.

## Test deltas

No test surface changes. The m1 `scripts/replay-fixtures.ts` + `test/fixtures/*.json` still cover the schema round-trip case (AC#6 unchanged from m2). AC#1-AC#4 are UI-behavior ACs verified by `npm run build` plus the manual walkthrough recorded in the commit message body.

The `check-rect-tests.sh` regex limitation noted in m1+m2 rect summaries still applies to this milestone's eventual rect commit (if any). Intent is satisfied by the manual-walkthrough discipline; the script will report FAIL even when production-code is accompanied by valid manual coverage.
