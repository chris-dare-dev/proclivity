# brief-2 — external-research + external-writes + risk

**Milestone.** `sprint-backlog-redesign-m3` — Inline-editable sprint goal in
header and forms.
**Role.** External-research / external-writes / risk researcher.
**Working directory.** `/Users/chris.dare/Personal/SourceCode/proclivity`.

---

## 1. External sources consulted

None. This milestone is pure UI on a schema field (`Sprint.goal`) that has
already been declared in `src/types/index.ts` (m1) and is currently unused.
Confirmed by reading the brief, the roadmap, and the project's CLAUDE.md
constraints:

- No new vendor, SDK, hosted endpoint, or network call.
- No new Chrome permission, manifest change, or service-worker change.
- No new npm dependency required — every primitive needed
  (`useState<boolean>`, controlled `<input>`, `onBlur`, `onKeyDown`,
  `maxLength`, CSS `text-overflow: ellipsis`) is already in React 18 +
  the existing stylesheet plumbing.
- The single external write expected is `git push origin main`,
  pre-authorized by CLAUDE.md's "work on `main` only" branching policy.

### Existing click-to-edit / inline-edit utility check

Searched `src/` for inline-edit hooks, `EditableText`, `InlineEdit`,
`contentEditable`, and `onBlur`. **No reusable click-to-edit component or
hook exists.** The two precedents are both "permanent-input" patterns
(input always rendered, never a display-mode toggle):

- `src/sections/gantt/TaskRow.tsx:146-158` — always-rendered controlled
  `<input>` for task title with `onBlur` commit, Enter blurs, Escape
  reverts to the original.
- `src/components/settings/panes/TagsPane.tsx:102-114` — uncontrolled
  `<input>` with `defaultValue`, `onBlur` rename, Enter blurs.

Neither is shaped like m3's spec (display the goal text as a non-input,
swap to `<input>` on click, swap back on blur). Recommendation:
**hand-roll the lightest viable inline shape** — exactly the one
suggested in the job description.

#### Recommended inline shape (display-then-input toggle)

```tsx
function GoalEditor({ goal, onSave }: { goal: string | undefined; onSave: (v: string | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal ?? "");

  // re-sync draft when the persisted goal changes from elsewhere
  // (e.g. EditSprintForm modal saves a goal while inline is closed)
  useEffect(() => { setDraft(goal ?? ""); }, [goal]);

  const commit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    // Conditional spread pattern (matches closeSprint's retroNote logic in
    // SprintManager.tsx:699-715): empty string resolves to `undefined`,
    // and we only call onSave when the value actually changed.
    const next = trimmed === "" ? undefined : trimmed;
    if (next !== goal) onSave(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="sprint-goal-input"
        type="text"
        maxLength={120}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(goal ?? ""); setEditing(false); }
        }}
      />
    );
  }

  return goal ? (
    <button
      type="button"
      className="sprint-goal-display"
      onClick={() => setEditing(true)}
      aria-label="Edit sprint goal"
    >
      {goal}
    </button>
  ) : (
    <button
      type="button"
      className="sprint-goal-empty"
      onClick={() => setEditing(true)}
    >
      + Add goal
    </button>
  );
}
```

That's ~35 LOC of TSX. No new dependency. Uses only `useState`, `useEffect`
(for the EditSprintForm re-sync — see Risk §3), and DOM events that React
18 already ships. Reuses the project's existing Escape-revert idiom from
`TaskRow.tsx` so the inline edit feels familiar.

The forms (`NewSprintForm`, `EditSprintForm`) get a plain
`<input type="text" maxLength={120}>` between Name and the date row —
no toggle needed, the form is already in edit mode by definition.

---

## 2. external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy"
```

No other external writes. Specifically confirmed:

- **No `package.json` change.** No new npm dependency.
- **No `manifest.config.ts` change.** No new Chrome permission, no new
  host permission, no new content-script, no new background entry.
- **No `src/background/service-worker.ts` change.** Reminders, alarms,
  and notifications are untouched.
- **No `src/storage/storage.ts` change.** `Sprint.goal` field is already
  declared in `src/types/index.ts:111` and the storage normalizer in m1
  already round-trips it as `?: string | undefined`. m3 only reads and
  writes the field via `update(s => ...)`.
- **No new chunk or `React.lazy` boundary.** All m3 code lives in
  components that are already in the initial newtab chunk
  (`SprintManager.tsx` + `sprint.css`).

The Phase 4 boundary is preserved: this brief does not invoke
`git push`. Orchestrator-only.

---

## 3. Riskiest assumption + alternative

The riskiest assumption is the **interaction between the inline header
editor and the EditSprintForm modal's goal field**. AC#1 commits the
inline value on blur. Clicking the "Edit" button to open the
EditSprintForm modal removes focus from the inline `<input>`, which
fires `blur` and persists whatever the user had typed — including a
half-typed string the user did not intend to commit. If the user then
opens the modal expecting a clean slate, types a new goal there, and
saves, the modal's `editSprint` reducer (currently
`SprintManager.tsx:632-641`) overwrites the inline-committed value
cleanly, so the end state is correct — but the in-between save and any
storage-listener side effects (none today, but conceivable) fire on a
value the user never confirmed.

**Picked strategy: commit-on-blur AND on-Enter, with no special-case
suppression when opening the modal.** Rationale:

1. The brief's AC#1 explicitly says "on blur or Enter the value is
   trimmed and persisted." That is the contract.
2. The end state after the modal save is what the user wanted anyway —
   the modal's save overwrites the inline blur-commit.
3. Suppressing blur-commit when focus moves to the Edit button requires
   peeking at `e.relatedTarget`, which is brittle and pollutes the
   inline editor with knowledge of the modal trigger. Worse, it would
   cause genuine blur (clicking outside the header entirely) to drop
   the user's typing — a UX regression we'd take to avoid a non-bug.
4. **The conditional-spread pattern from m2's `closeSprint`
   (`SprintManager.tsx:699-715`) carries forward** to neutralize the
   "empty trimmed" case: an empty trimmed inline value resolves to
   `undefined` and is written via `...(trimmed ? { goal: trimmed } : {})`
   rather than `goal: undefined` directly. This matters under
   `exactOptionalPropertyTypes` — an explicit `goal: undefined` is
   structurally different from "field absent" in TS, and the project
   already standardised on the conditional-spread idiom to clear
   optional fields. (See M3 in `.claude/notes/milestones/sprint-backlog-redesign-m2/rectify/summary.md:18`.)

**Alternative considered and rejected: on-Enter-only persistence (blur
discards the draft, reverts to displayed value).** This sidesteps the
modal-open side-effect entirely but contradicts AC#1 ("on blur or
Enter") and surprises users who finished typing and clicked elsewhere
expecting their text to stick — that's the standard inline-edit muscle
memory across the web. Not worth fighting the spec.

### Secondary risks (smaller, but call out for the implementer)

- **Inline draft lost when EditSprintForm opens.** If the user opens
  the inline editor, types "ship it", and clicks Edit before the input
  blurs, the inline blur-commit fires and persists "ship it"; the modal
  then opens with `initialGoal="ship it"`. That's the desirable
  outcome — the inline draft is *not* lost, it's promoted. If the user
  cancels the modal, "ship it" remains. Document this in the
  implementer's commit body so they don't second-guess.
- **maxLength symmetry.** Both surfaces (inline `<input>` in
  `ActiveSprintHeader` and the form `<input>` in `SprintForm`) must use
  `maxLength={120}`. Asymmetry would let the form set a 200-char goal
  that the inline editor truncates on next edit — confusing.
- **Empty-trimmed clears the goal.** AC#1 says "an empty trimmed value
  reverts to the placeholder." This means clearing an existing goal
  "ship it" → "" must result in `Sprint.goal === undefined`, not
  `Sprint.goal === ""`. Use the conditional-spread pattern. This is the
  opposite semantic from m2's `retroNote` (which intentionally does
  NOT clear on empty — see M3 in m2's rect summary) — be careful not
  to copy that "no-clearing" rule into the goal handler. Goal must
  clear on empty; retroNote must not.
- **Re-sync inline draft when the modal saves.** If the user has the
  inline editor open with an unsaved draft, opens the modal in another
  flow, saves a new goal there, then returns to the (still-open)
  inline editor — the inline `<input>` should reflect the new value.
  The `useEffect(() => setDraft(goal ?? ""), [goal])` line in the
  recommended shape handles this. Without it, the inline draft would
  silently overwrite the modal save on its blur-commit.

---

## 4. Acceptance criteria — verbatim from the milestone brief

1. Given an active sprint with `goal: undefined`, When the user clicks
   the "+ Add goal" placeholder, Then a
   `<input type="text" maxLength="120">` replaces it; on blur or Enter
   the value is trimmed and persisted; an empty trimmed value reverts
   to the placeholder.
2. Given an active sprint with a non-empty goal, When the user views
   the header, Then the goal renders on its own line under the date
   range, single-line with CSS `text-overflow: ellipsis` on overflow,
   and clicking it re-opens the editor.
3. Given an archived sprint row expanded, When the sprint has a
   non-empty goal, Then the goal renders between the date range and
   the task list as italic muted text.
4. NewSprintForm and EditSprintForm include an optional goal `<input>`
   after the name field; the existing date validation is unaffected.
5. `npm run build` passes; cumulative initial-chunk size delta from
   the pre-m1 baseline ≤ +8 kB.
6. No regression in the sprint progress bar, archived rail expansion,
   sprint switcher tabs, or the m2 close-sprint flow.

---

## 5. Diff size estimate + inline-vs-delegated recommendation

### LOC and file count

| File | Change | LOC |
|---|---|---:|
| `src/sections/sprint/SprintManager.tsx` | `GoalEditor` inline component (display ↔ input toggle, useEffect re-sync, Escape revert) | ~35 |
| `src/sections/sprint/SprintManager.tsx` | `ActiveSprintHeader` — mount `<GoalEditor>` below date range; pass `onSave` handler | ~10 |
| `src/sections/sprint/SprintManager.tsx` | New top-level `setSprintGoal` handler (mirror `closeSprint`'s conditional-spread pattern) | ~10 |
| `src/sections/sprint/SprintManager.tsx` | `SprintForm` — optional `goal` prop + `<input>` between name and date row; threaded through `NewSprintForm` / `EditSprintForm` | ~15 |
| `src/sections/sprint/SprintManager.tsx` | `createSprint` / `editSprint` signature update — accept and persist `goal` with the conditional-spread idiom | ~8 |
| `src/sections/sprint/SprintManager.tsx` | `ArchivedSprintRow` — render italic muted goal line between date range and task list when present | ~6 |
| `src/sections/sprint/sprint.css` | `.sprint-goal-display`, `.sprint-goal-input`, `.sprint-goal-empty`, `.sprint-archived-goal` — 4 classes covering display, input, empty placeholder, and the archived italic variant | ~30 |

**Total: 2 files, ~115 LOC.** Slightly above the brief's ~85 estimate
because the re-sync `useEffect` + a dedicated `setSprintGoal` handler
(mirroring `startSprint`/`closeSprint`'s state-guard discipline) push
the SprintManager delta up by ~20 LOC. Still squarely in the
"S complexity" band.

### Inline-vs-delegated recommendation

**Strongly inline (no sub-agent dispatch).** Justifications:

- One contributor touching two files in a contiguous edit; no
  parallelizable axis.
- All changes confined to a single React tree (`SprintManager.tsx`)
  plus its co-located stylesheet — no cross-file refactor to
  coordinate.
- Schema field (`Sprint.goal`) is already declared (m1), already
  normalizes through `storage.get()`, and has no readers/writers yet
  → no schema-evolution risk, no fixture replay needed.
- No new chunk boundary, so no lazy-import / Suspense plumbing to
  research.
- Verification is a single `npm run build` + manual walkthrough,
  identical to m2's pattern.

The orchestrator should run this milestone in a single implement →
critique → rectify loop without delegating sub-pieces.

---

## 6. Carry-forward from m2 rect summary

These two concerns from m2's rect summary
(`.claude/notes/milestones/sprint-backlog-redesign-m2/rectify/summary.md:22-27`)
land on m3's doorstep. The m3 implementer should be aware of them but
**should not re-litigate them in m3**:

### Bundle target: 202.19 kB raw is over CLAUDE.md's "~200 kB" soft target

- Pre-m1 baseline: 199.62 kB raw / 63.12 kB gzip.
- Post-m2 rect (current `main`): **202.19 kB raw / 63.88 kB gzip**.
- Cumulative delta from pre-m1 baseline: **+2.57 kB raw**.
- m3 AC#5 caps cumulative delta at **+8 kB** (i.e. ≤ 207.62 kB raw).
- m3 expected delta: **~1–2 kB raw**. The new `GoalEditor` component
  (~35 LOC of TSX) + ~30 LOC of CSS should land comfortably under
  2 kB raw; the new state-handler scaffolding is shared-chunk JS.
- After m3 lands, expected cumulative: **~204 kB raw** — still
  under AC#5's +8 kB cap but ~4 kB over CLAUDE.md's "~200 kB" soft
  target. **Do not introduce a CSS prune or lazy-import in m3 to
  chase the soft target** — that's a roadmap-level decision (the m2
  rect summary explicitly flagged it for separate planning) and
  would expand m3's scope.

If m3's measured delta unexpectedly exceeds +5 kB raw, that's the
signal to investigate (likely a CSS bloat or an accidental import
pull-in). Otherwise, accept the +1–2 kB and move on.

### No automated UI test coverage

The proclivity project has no test runner (no `vitest`,
`@testing-library/react`, or `bats`). The established discipline is
**manual walkthrough captured in the commit body** — m1's and m2's
commits both do this and m2's rect commit adds explicit steps for the
H1 + H2 fixes.

**m3 must follow the same pattern.** Do NOT introduce a test harness
in m3 — that's out of scope per m2's M4 deferral. The m3 implement
commit body should include a manual walkthrough covering:

1. Active sprint with no goal → click "+ Add goal" → type "ship m3"
   → press Enter → goal persists, header re-renders display mode.
2. Click the displayed goal → input re-opens with current value →
   clear all text → blur → goal resets to undefined, placeholder
   shows.
3. Open NewSprintForm → name + goal + dates → save → new sprint has
   the goal in its header.
4. Open EditSprintForm on an existing sprint → modify the goal →
   save → header reflects the new goal.
5. Close an active sprint (m2 path) with a goal set → expand it in
   the archived rail → goal renders italic-muted between date range
   and task list.
6. Sprint progress bar, archived rail expansion/collapse, sprint
   switcher tabs, and the stale-sprint banner from m2 all still work.

`check-rect-tests.sh` will report FAIL on the rect commit because the
project does not use `*.test.*` / `*.spec.*` / `*.bats` filename
conventions — same known limitation that m1 and m2 both noted. This is
not an m3 blocker.

---

## Closing notes for the orchestrator

- No external research surface to chase; no vendor docs to pin.
- No external writes beyond the standard `git push origin main`.
- Implementer can proceed inline; one contributor, two files,
  ~115 LOC, single build + manual walkthrough.
- The two carry-forward items from m2 rect are surfaced so the
  implementer doesn't re-open settled debates inside this milestone.
