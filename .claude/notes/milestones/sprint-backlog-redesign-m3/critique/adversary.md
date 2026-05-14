# Critique — sprint-backlog-redesign-m3 — adversary

**Critic:** adversary
**Commit range:** dc270a3..046e706
**Generated:** 2026-05-13T23:55:00-04:00
**Diff stats:** 6 files (2 production, 4 notes), 1404 insertions / 9 deletions; production-code delta ≈ 296 LOC across SprintManager.tsx + sprint.css

## Verdict

SHIP-WITH-FIXES

The m3 implementation is functionally correct against the AC matrix, build passes cleanly under strict TS, the m1 fixture replay still reports 4/4, no new deps, no external writes, GPG signature is valid, and the conventional-commit subject is 45 chars (under 50). The semantics distinction called out in the brief (goal CLEARS on empty vs retroNote PRESERVES) is honored in both code paths and explicitly documented. However, the GoalEditor reproduces the exact same component-instance leak class as m2's H1 (StaleSprintBanner needed `key={sprint.id}` on sprint switch) and the brief explicitly asked the critic to check for it — this is the one HIGH finding. A handful of MEDIUMs around closed-sprint reachability, multi-tab clobber, CSS fragility, and bundle-budget drift round out the changes that should land in a single rectification pass before the milestone closes.

## Executive summary

- [HIGH] H1 — GoalEditor lacks `key={sprint.id}`; switching tabs while `editing=true` leaks `editing` state into the next sprint, causing the new sprint's goal to appear pre-filled in an auto-focused input the user didn't open.
- [MEDIUM] M1 — `ActiveSprintHeader` renders for closed sprints (activeSprintId is not cleared by `closeSprint`), so the inline GoalEditor is actually reachable for closed sprints despite the source comment claiming otherwise.
- [MEDIUM] M2 — Multi-tab race in GoalEditor: when `goal` prop updates while the user is mid-edit, the `useEffect` silently clobbers the in-progress draft. Brief flagged as UX risk; no `editing`-guard implemented.
- [MEDIUM] M3 — Initial-newtab chunk is now 203.54 kB, past CLAUDE.md's "~200 kB" ceiling. m2 already breached; m3 increments. Local AC budget (+8 kB) is fine, but the higher-precedence rule is now drifting and unacknowledged in-repo.
- [MEDIUM] M4 — CSS selectors `.sprint-header > .sprint-header-top > div > .sprint-goal-display` rely on an unnamed `<div>` wrapper; a future DOM tweak silently breaks the inline-block + margin-top layout.
- [LOW] L1 — Asymmetric `goal` write hygiene: `createSprint` uses conditional spread to omit the key, `editSprint` writes `goal: undefined` explicitly. JSON.stringify normalizes both, but the in-memory shapes differ.
- [LOW] L2 — Inline `<input>` in editing mode has no explicit aria-label or label association; relies on placeholder as accessible-name fallback.
- [LOW] L3 — No automated test for GoalEditor or setSprintGoal; project pattern is manual walkthrough + replay-fixtures only, consistent with prior milestones but worth re-noting.

## Findings

### CRITICAL

(None.)

### HIGH

#### [HIGH] H1 — GoalEditor missing key={sprint.id} — editing state leaks across sprint switches

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 406
- **Anchor:** `          <GoalEditor goal={sprint.goal} onSave={onSaveGoal}`
- **What:** `<GoalEditor>` is mounted without a `key`, so React reuses the same component instance when the parent ActiveSprintHeader receives a new `sprint` prop via the tab switcher. The `useEffect([goal])` re-syncs `draft` to the new sprint's goal, but the `editing` boolean is NOT reset. If the user clicks `+ Add goal` on sprint A and then switches to sprint B via the tabs before blurring, sprint B's GoalEditor renders in `editing=true` with B's goal pre-filled in an auto-focused input the user never opened.
- **Why it matters:** Exactly the failure class the brief carries forward from m2's H1 (StaleSprintBanner `dismissed` state leaked across sprints until `key={sprint.id}` was added). Two-fold harm: (a) auto-focus steals the keyboard from whatever the user intended to do next on sprint B, (b) a stray blur (e.g. clicking another tab) would then trigger `commit()` and — if `next !== goal` — silently call `onSave` on sprint B with B's own value, producing a no-op storage write. The semantic write is benign by accident, but the auto-focus surprise and the spurious `chrome.storage.local` write + subscribe fan-out are user-visible.
- **Proposed fix:** Add `key={sprint.id}` to the `<GoalEditor>` mount. One-line patch:
  ```tsx
  <GoalEditor key={sprint.id} goal={sprint.goal} onSave={onSaveGoal} />
  ```
  Mirror the m2 rect comment style ("rect(m3) — H1: key={sprint.id} forces remount...") so the next agent doesn't re-litigate.
- **Regression-guard:** Manual walkthrough additions to the next commit body: (1) Open sprint A, click `+ Add goal`, do not blur, click the tab for sprint B; observe sprint B renders in display/placeholder mode, NOT in an autofocused input. (2) Repeat with sprint B having an existing goal; observe sprint B shows its display chip, not an input pre-filled with B's value. Long-term: when a test runner lands, assert `render(<GoalEditor goal="A" />); rerender(<GoalEditor goal="B" />)` keeps `editing=false` after a key change.
- **Source critic:** adversary
- **Source axis:** C. GoalEditor remount on sprint switch (m2 H1 analog)

### MEDIUM

#### [MEDIUM] M1 — ActiveSprintHeader reachable for closed sprints; comment claims otherwise

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 409-411
- **Anchor:** `          {/* sprint-backlog-redesign-m2: lifecycle bu`
- **What:** The m2 inline comment claims "Closed sprints live in the archived rail and never render this header." That's not actually enforced — `closeSprint` (line 878–894) flips `state` to `"closed"` but does NOT update `activeSprintId`. Immediately after close, `sprints.find((s) => s.id === activeSprintId)` returns the closed sprint, `activeSprint` is truthy, and `ActiveSprintHeader` renders with the closed-sprint data. The GoalEditor renders inside it. The user can then edit the goal of a closed sprint via `setSprintGoal`, which has no `state` guard.
- **Why it matters:** Brief axis D explicitly asks whether `setSprintGoal` needs a state guard like `closeSprint`/`startSprint` (which do guard `sp.state === "active"` and `=== "draft"` respectively). The current code permits goal edits on a sprint the user just closed — surprising for a "read-only archived" sprint per the cross-plan #14 resolution noted in `ArchivedSprintRow`. Not a corruption bug (the goal field is permitted on any state per the type), but the UX implies closed sprints are frozen.
- **Proposed fix:** Add a state guard inside `setSprintGoal`:
  ```ts
  const setSprintGoal = async (goal: string | undefined) => {
    if (!activeSprintId) return;
    await update((s) => ({
      ...s,
      sprints: s.sprints.map((sp) =>
        sp.id === activeSprintId && sp.state !== "closed"
          ? { ...sp, goal }
          : sp,
      ),
    }));
  };
  ```
  Alternatively, gate the GoalEditor render inside ActiveSprintHeader on `sprint.state !== "closed"` and update the comment at line 411 to match reality. Pick one; don't do both. The first is cheaper and matches m2's `startSprint`/`closeSprint` guard idiom.
- **Regression-guard:** Manual walkthrough addition: create a sprint, set a goal, start it, close it with a retro, then attempt to click the goal chip in the still-rendering header — verify it either doesn't render or doesn't accept the edit.
- **Source critic:** adversary
- **Source axis:** D. setSprintGoal correctness / closed-sprint reachability

#### [MEDIUM] M2 — Multi-tab race silently clobbers in-progress goal draft

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 302-304
- **Anchor:** `  useEffect(() => {`
- **What:** The re-sync `useEffect(() => setDraft(goal ?? ""), [goal])` runs unconditionally when the persisted goal changes. If a second tab (or the EditSprintForm save flow) writes a new goal while this tab has `editing === true` with user-typed content in `draft`, the user's draft is replaced with the external value mid-keystroke. No guard against `editing`.
- **Why it matters:** Brief axis B explicitly flags this as a UX risk. Contention window is narrow (multi-tab + concurrent edits), but the failure is silent and destructive — the user has no signal their keystrokes were just overwritten. Worse: if the user then blurs, `commit()` writes the now-clobbered draft (= the other tab's value), so the user thinks their edit failed mysteriously.
- **Proposed fix:** Skip the re-sync while editing, OR show a soft "this was updated elsewhere — discard your edit?" affordance. The minimal patch:
  ```ts
  useEffect(() => {
    if (!editing) setDraft(goal ?? "");
  }, [goal, editing]);
  ```
  This preserves the in-progress draft until the user blurs/commits; the next render after commit will pick up the new goal via the normal path. Acceptable trade-off: if the user is editing during an external write, their blur-commit will "win" with their own text — last-writer-wins, matching the multi-tab race semantics already accepted elsewhere in the codebase.
- **Regression-guard:** Manual: open two newtabs, focus the goal input in tab 1, set the goal via tab 2 (e.g. EditSprintForm save), confirm tab 1's draft is untouched.
- **Source critic:** adversary
- **Source axis:** B. GoalEditor state lifecycle (external update during edit)

#### [MEDIUM] M3 — Initial newtab chunk past CLAUDE.md ~200 kB ceiling; documented drift unresolved

- **File:** `dist/assets/index.html-*.js`
- **Line:** n/a (bundle output)
- **Anchor:** `dist/assets/index.html-BQxr19sm.js            203.54 kB`
- **What:** CLAUDE.md states "The initial newtab chunk should stay under ~200 kB". Build output for this commit shows the initial chunk at 203.54 kB. m2 already breached at 202.19 kB; m3 adds another 1.35 kB raw. Local milestone AC#5 allows +8 kB cumulative from pre-m1 baseline, which this commit is within, but that local budget does not override CLAUDE.md.
- **Why it matters:** Documented project policy is drifting unacknowledged. The bundle increase is benign (it's the inline-editor + form goal field, no new deps confirmed), but if the project enforces the ceiling later (e.g. via the GitHub Actions bundle-budget check at `feat(build): GitHub Actions CI + bundle budget`), m3 already trips it.
- **Proposed fix:** Either (a) update CLAUDE.md to acknowledge the new soft ceiling (e.g. "~205 kB" with a rationale paragraph), or (b) factor goal-editing into a lazy-loaded chunk. (a) is cheaper and matches the project's "personal, local-only" pragmatism. The fact that the CI bundle-budget already exists (commit 5d3f672) means the actual enforced threshold is whatever lives in that config — verify and align.
- **Regression-guard:** Bundle-budget assertion in CI; ensure the threshold in `.github/workflows/*` is consistent with whatever CLAUDE.md states.
- **Source critic:** adversary
- **Source axis:** 11. Doc drift

#### [MEDIUM] M4 — Deep CSS selector relies on unnamed div wrapper

- **File:** `src/sections/sprint/sprint.css`
- **Line:** 463-465
- **Anchor:** `.sprint-header > .sprint-header-top > div > .sprint-`
- **What:** The container selector for the inline-block + margin-top wrapper of `.sprint-goal-display`/`-empty`/`-input` includes a bare `> div >` pointing at the unnamed wrapper `<div>` at SprintManager.tsx line 400 (sibling of `.sprint-header-actions`). Any future refactor that adds a className to that div, replaces it with a Fragment, or nests another wrapper silently breaks the layout — GoalEditor falls back to default inline display with no top margin.
- **Why it matters:** Silent CSS breakage is hard to spot in code review. The project convention elsewhere in sprint.css uses single-class selectors (e.g. `.sprint-stale-dismiss:hover`), so this nested chain is also stylistically inconsistent.
- **Proposed fix:** Either name the wrapper div (e.g. `.sprint-header-meta`) and re-target, or move the margin-top + max-width onto `.sprint-goal-display`/`-empty`/`-input` directly:
  ```css
  .sprint-goal-display,
  .sprint-goal-empty,
  .sprint-goal-input {
    display: inline-block;
    margin-top: 4px;
    max-width: 100%;
    vertical-align: top;
  }
  ```
  The classes are unique to the GoalEditor, so the descendant constraint is redundant.
- **Regression-guard:** Visual diff against screenshots in the manual walkthrough; consider a simple Playwright pixel-diff once the project lands a test runner.
- **Source critic:** adversary
- **Source axis:** F. CSS selector specificity / fragility

### LOW

#### [LOW] L1 — Asymmetric goal-write hygiene between createSprint and editSprint

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 797
- **Anchor:** `        sp.id === activeSprintId ? { ...sp, name, sta`
- **What:** `createSprint` uses `...(goal ? { goal } : {})` to omit the key when falsy. `editSprint` (line 797) writes `{ ...sp, name, startsAt, endsAt, goal }` unconditionally, so a cleared form input persists an in-memory `goal: undefined` own property until the chrome.storage round-trip drops it via JSON.stringify. Acceptable under `exactOptionalPropertyTypes` because Sprint.goal is `goal?: string | undefined`, but the asymmetry is intentional in only one direction.
- **Why it matters:** No functional consequence — JSON.stringify normalizes — but if any future code does `"goal" in sp` or `Object.keys(sp).includes("goal")` between the write and the reload, behavior diverges from a freshly normalized state. Codebase grep shows no such checks today.
- **Proposed fix:** For consistency, mirror createSprint's spread idiom:
  ```ts
  sp.id === activeSprintId
    ? { ...sp, name, startsAt, endsAt, ...(goal ? { goal } : { goal: undefined }) }
    : sp,
  ```
  Or accept the asymmetry and add a comment. Cheaper to leave as-is; flagging only because the brief asked.
- **Regression-guard:** n/a (no current bug).
- **Source critic:** adversary
- **Source axis:** E. editSprint clearing semantics

#### [LOW] L2 — Inline input has no aria-label or labelled-by; relies on placeholder

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 316-335
- **Anchor:** `      <input`
- **What:** The editing-state `<input>` has only a `placeholder="Sprint goal (optional)…"`. No `aria-label`, `aria-labelledby`, or wrapping `<label>`. Most screen readers fall back to the placeholder as the accessible name, but this is an AT-implementation-dependent behavior, not a guarantee.
- **Why it matters:** Mild accessibility gap. The display chip and empty-state button both have proper `aria-label`s; only the input is unlabelled.
- **Proposed fix:** Add `aria-label="Sprint goal"` to the input.
- **Regression-guard:** Axe-core scan, once introduced; for now, manual VoiceOver pass during the manual walkthrough.
- **Source critic:** adversary
- **Source axis:** K. Accessibility

#### [LOW] L3 — No automated test for GoalEditor or setSprintGoal

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** n/a
- **Anchor:** n/a
- **What:** Production-code delta of ~296 LOC has zero test-file delta. Project pattern is manual walkthrough in commit body + `scripts/replay-fixtures.ts` for schema round-trip only. m3 is consistent with this norm; calling it out per axis 10's "flag honestly" instruction.
- **Why it matters:** GoalEditor has four mutually-exclusive render branches, the m2-H1-class remount risk, the multi-tab clobber risk (M2), and a commit() path with a non-trivial conditional. Manual walkthroughs cover the happy path but won't catch race conditions or the H1 leak.
- **Proposed fix:** Defer — bringing a test runner into the project is a separate milestone-scoped decision. For now, expand the manual walkthrough in the commit body to explicitly exercise the H1 case (open editor on A, switch to B without blurring) and the M2 case (two-tab concurrent edit) once those are fixed.
- **Regression-guard:** n/a.
- **Source critic:** adversary
- **Source axis:** 10. Test discipline

## What was done well

- GPG signature verified (`Good signature from "Chris Dare"`); conventional-commit subject is 45 chars after the prefix, well within the ≤50 cap.
- Build passes cleanly under `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`. `npx tsx scripts/replay-fixtures.ts` reports 4/4 m1 fixtures normalize, confirming AC#6's no-regression claim.
- No new npm dependencies (package.json + package-lock.json untouched), preserving the project's lean dependency posture.
- No external writes, network calls, telemetry, or hosted-endpoint additions — local-only constraint honored.
- The m2 semantic distinction (`retroNote` preserves on empty, `goal` clears on empty) is correctly implemented in both `setSprintGoal`/`commit` and `SprintForm.handleSave`, and is explicitly documented in three places with anti-harmonization warnings (block comment at line 274, inline comment at line 145–148, action comment at line 800–805).
- `createSprint` correctly uses the conditional spread `...(goal ? { goal } : {})` to avoid persisting `goal: undefined` for fresh sprints with no goal.
- The `next !== goal` short-circuit in `commit()` correctly avoids spurious chrome.storage writes when the user opens/closes the editor without changing the value.
- The Enter handler delegates via `(e.target as HTMLInputElement).blur()` so that Enter and blur share the same commit path, avoiding two divergent code paths.
- The archived-row goal renders inside the `{open && sprint.goal && ...}` guard so it never appears for collapsed rows or sprints without goals — matches AC#3 verbatim.
- Manual walkthrough in the commit body covers every AC #1 through #4 step-by-step, including the empty-clear path (step 4) and the Edit-form overwrite path (step 6).
- Per-axis comments (`sprint-backlog-redesign-m3:`) tag every new block so the next agent can locate the milestone's touch points via grep without re-reading the whole file.

## Recommended rectification order

H1, M1, M2, M4, M3, L1, L2, L3
