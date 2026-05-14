# sprint-backlog-redesign-m3 — Research synthesis

**Phase 1 mode:** default (1× Explore Haiku + 1× general-purpose Sonnet).
**Briefs:** `research/brief-1.md` (codebase context), `research/brief-2.md` (external + risk + diff estimate).
**Injection attempts reported across briefs:** 0.

---

## Affected files (deduped across briefs)

| Path | Role in m3 | LOC delta est. |
|---|---|---|
| `src/sections/sprint/SprintManager.tsx` | New `GoalEditor` inline component (display↔input toggle); mount in ActiveSprintHeader between dates and progress row; new `setSprintGoal` action; SprintForm extended with optional goal `<input>`; createSprint/editSprint signatures accept goal; ArchivedSprintRow renders goal line when present. | +75 to +115 |
| `src/sections/sprint/sprint.css` | New classes for `.sprint-goal-line`, `.sprint-goal-display`, `.sprint-goal-input`, `.sprint-goal-empty`, `.sprint-archived-goal`, plus a form-row variant. | +30 to +40 |
| `src/types/index.ts` | **No change** — `Sprint.goal?: string \| undefined` already declared in m1. | 0 |
| `src/storage/storage.ts` | **No change** — m1 normalizer already round-trips `goal` via the base spread. | 0 |
| Any test surface | **No change** — manual walkthrough is the established discipline; m1 fixtures still replay. | 0 |

Total estimate: **2 files, ~115-150 LOC.** Strongly inline.

---

## Acceptance criteria (deduped, verbatim from the milestone brief)

1. **AC#1** — Given an active sprint with `goal: undefined`, When the user clicks the "+ Add goal" placeholder, Then a `<input type="text" maxLength="120">` replaces it; on blur or Enter the value is trimmed and persisted; an empty trimmed value reverts to the placeholder.
2. **AC#2** — Given an active sprint with a non-empty goal, When the user views the header, Then the goal renders on its own line under the date range, single-line with CSS `text-overflow: ellipsis` on overflow, and clicking it re-opens the editor.
3. **AC#3** — Given an archived sprint row expanded, When the sprint has a non-empty goal, Then the goal renders between the date range and the task list as italic muted text.
4. **AC#4** — NewSprintForm and EditSprintForm include an optional goal `<input>` after the name field; the existing date validation is unaffected.
5. **AC#5** — `npm run build` passes; cumulative initial-chunk size delta from the pre-m1 baseline ≤ +8 kB (current cumulative is +2.57 kB → headroom 5.43 kB).
6. **AC#6** — No regression in the sprint progress bar, archived rail expansion, sprint switcher tabs, or the m2 close-sprint flow.

---

## external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy (solo + private repo)"
```

No new external writes. No new npm dependency. No new Chrome permission, manifest change, or service-worker touch.

---

## Resolved open questions (orchestrator-decided)

1. **Empty-trimmed clears the goal (CRITICAL semantic difference from m2's retroNote).** AC#1 says "empty trimmed value reverts to the placeholder." That means `Sprint.goal === undefined` after clearing — not `""`. The conditional-spread pattern used in m2's `closeSprint` (`...(trimmed ? { retroNote: trimmed } : {})`) is the WRONG idiom here because it never writes a clearing value. Use `goal: trimmed || undefined` (or the explicit `...(trimmed ? { goal: trimmed } : { goal: undefined })`). The type `goal?: string | undefined` allows the literal `undefined` value under `exactOptionalPropertyTypes` per the comment block in `src/types/index.ts:3-8`. **Document this difference in inline comments** so a future contributor doesn't "harmonize" the patterns.

2. **Re-sync inline draft on external update.** brief-2 caught a subtle bug: if a user has the inline editor open with an unsaved draft, the modal saves a different goal in another flow, and they return to the (still-open) inline editor → the inline `<input>` should reflect the new persisted value. Add `useEffect(() => setDraft(goal ?? ""), [goal])` inside the inline component. Without it, the inline blur-commit would silently overwrite the modal save.

3. **Inline-edit pattern: hand-roll a display↔input toggle.** No reusable component exists. The closest precedents are `src/sections/gantt/TaskRow.tsx:146-158` and `src/components/settings/panes/TagsPane.tsx:102-114`, but both are "always-rendered input" patterns — not what we want. Innovate the lightest viable shape per brief-2 §1: `useState<boolean>` editing toggle + controlled `<input>` with autoFocus, onBlur commit, Enter commits via blur, Escape reverts.

4. **maxLength symmetry.** Both surfaces (inline `<input>` in ActiveSprintHeader and the `<input>` in NewSprintForm/EditSprintForm) must use `maxLength={120}`. Asymmetry would let the form set a 200-char goal that the inline editor truncates next edit.

5. **Blur-commit when opening EditSprintForm.** Chose: commit on blur AND on Enter, no special-case suppression. Rationale per brief-2: clicking Edit blurs the inline input → commits whatever was typed. The modal then opens with the just-committed value already in props. If the user cancels the modal, the inline-committed value persists — that's the expected "promote inline draft to form draft" semantics. Don't peek at `e.relatedTarget`.

6. **UX polish defaults:**
   - Goal display has subtle hover state (per brief-1 OQ#1).
   - "+ Add goal" empty-state styled as a button (matches "+ New sprint" pattern; brief-1 OQ#2).
   - No tooltip / help text on the form goal input — placeholder is enough (brief-1 OQ#3).
   - Archived row goal overflows with `text-overflow: ellipsis` single-line (brief-1 OQ#4).
   - No on-screen char count for the 120-cap (brief-1 OQ#5).

---

## Open questions still pending implementer judgment (max 5)

1. **Goal line position in ActiveSprintHeader:** brief-1 §2.2 suggests inserting between `.sprint-header-dates` (line ~274) and the `{isDraft ? ... : <progress-row>}` block. Inside the `<div>` that wraps name+dates, or as a sibling? Inside is cleaner visually.
2. **EditSprintForm + inline editor coexistence:** When the user is in EditSprintForm mode, should the ActiveSprintHeader's inline goal editor still render? The header isn't visible during edit-form mode (the form replaces the header per the current SprintManager render). Verify.
3. **Should `goal` show on a draft sprint?** Per AC, yes — the goal is a property of the sprint regardless of lifecycle state. The draft view's "Not started yet" placeholder pairs naturally with a goal line above it: user can capture intent before starting.
4. **Form goal input default value when editing:** When EditSprintForm opens for a sprint with a goal, the form's goal input should show the current goal as `initialValue`. Verify the SprintForm props plumbing.
5. **CSS variable for italic-muted style:** The archived row goal is "italic muted text." Use `font-style: italic` + `color: var(--text-dim)` (existing token). Don't invent new tokens.

---

## Footguns surfaced for the implementer

- **Don't copy `closeSprint`'s `retroNote` conditional-spread idiom for goal — different semantics.** retroNote does NOT clear on empty (m2 M3 codified that). goal MUST clear on empty (m3 AC#1). Use `goal: trimmed || undefined` for goal, NOT `...(trimmed ? { goal: trimmed } : {})`.
- Work directly on `main`. Conventional commit type `feat(sprint):`.
- `npm run build` must pass under strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- Bundle budget: AC#5 caps cumulative at +8 kB from pre-m1 baseline. m3 should add ≤ +2 kB. If measured delta exceeds +5 kB, investigate (likely CSS bloat or accidental import pull-in).
- No new dependencies, no new Chrome permissions, no service-worker changes.
- m2's `check-rect-tests.sh` regex limitation still applies — the rect commit will FAIL the structural check because proclivity doesn't use `*.test.*` filenames. Manual walkthrough is the established compensating control; don't bypass with `--no-verify`.
- The Photos integration is in active WIP under `src/lib/googlePhotos/` and `src/components/settings/panes/GooglePhotosPane.tsx` — do not touch those files.

---

## Synthesis status

Both briefs cleared schema validation. Both agree on inline path, 2 files, ~115-150 LOC. The semantic difference between goal (clears on empty) and retroNote (preserves on empty) is the most important caveat to carry forward. Bundle headroom is comfortable. No external research needed.

**Recommended next action:** transition to `research-complete` → `implement-running`, implement inline in the main session, run `npm run build` + `npx tsx scripts/replay-fixtures.ts`.
