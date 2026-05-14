# sprint-backlog-redesign-m2 — Research synthesis

**Phase 1 mode:** default (1× Explore Haiku + 1× general-purpose Sonnet).
**Briefs:** `research/brief-1.md` (codebase context), `research/brief-2.md` (external + writes + risk + diff estimate).
**Injection attempts reported across briefs:** 0.

---

## Affected files (deduped across briefs)

| Path | Role in m2 | LOC delta est. |
|---|---|---|
| `src/sections/sprint/SprintManager.tsx` | `createSprint` defaults to `state: "draft"`; ActiveSprintHeader renders Start vs Close button; close-sprint flow opens ConfirmDialog with a controlled textarea; stale-sprint banner mounts inside the active-sprint view; ArchivedSprintRow shows the retro note via `<details>`. | +120 to +180 |
| `src/sections/sprint/sprintUtils.ts` | `isArchived()` rewrite: `sprint.state === "closed"` (date check removed). | −5 net |
| `src/sections/sprint/sprint.css` (or `sections.css`) | Styles for the stale-sprint banner, Start/Close buttons, retro note display. | +40 to +60 |
| `src/components/Modal.tsx` | **No change** — `ConfirmDialog`'s `message: ReactNode` already accepts a JSX textarea. | 0 |
| `src/types/index.ts` | **No change** — `Sprint.state` and `Sprint.retroNote` already declared in m1. | 0 |
| `src/storage/storage.ts` | **No change** — m1 normalizer already backfills `state` for legacy data. | 0 |
| `src/sections/calendar/**` | **No change** — calendar rendering is date-based, not state-based; the `isArchived()` rewrite is invisible to it. | 0 |
| `scripts/replay-fixtures.ts` | Possibly +1-2 lines if we want to assert the draft-default path. Optional; m1 fixtures still replay correctly post-m2. | 0 to +5 |

Total estimate: **3 files modified, ~165-250 LOC net additions.**

---

## Acceptance criteria (deduped, verbatim from the milestone brief)

1. **AC#1** — Given a newly created sprint, When the user finishes the create form, Then the sprint is stored with `state: "draft"` and the active-sprint header renders a "Start sprint" button instead of the task input.
2. **AC#2** — Given a draft sprint, When the user clicks "Start sprint", Then `state` flips to `"active"` and the header renders the existing task input, progress bar, and close button.
3. **AC#3** — Given an active sprint, When the user clicks "Close sprint", confirms, and optionally enters a retro note, Then `state` flips to `"closed"`, `retroNote` is persisted on the sprint, and the sprint relocates from the live tabs list to the archived rail in the next render.
4. **AC#4** — Given an active sprint with `endsAt < todayMidnight() - 86_400_000`, When the user opens newtab, Then a dismissible banner renders once per session-id offering to close the sprint; dismissing sets a session-scoped flag that prevents re-display for the rest of the session.
5. **AC#5** — `isArchived()` is updated to `sprint.state === "closed"`; the date-based check is deleted. All call sites in `SprintManager.tsx` still compile and render the archived rail correctly.
6. **AC#6** — Three captured v1 fixtures from m1 still render correctly post-m2 (no double-archival, no orphaned state).
7. **AC#7** — `npm run build` passes; cumulative initial-chunk size delta from the pre-m1 baseline ≤ +6 kB.
8. **AC#8** — Manual walkthrough captured in the commit body: create-draft → start → close-with-retro → archived rail shows it with the retro note expandable.

---

## external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy (solo + private repo)"
```

No new external writes. No new npm dependency. No Chrome permission, no manifest change, no service-worker change.

---

## Resolved open questions (orchestrator-decided)

The two researchers disagree on one substantive point. Resolved here:

1. **Banner dismissal mechanism: `sessionStorage` or `useState`?** brief-2 recommends `sessionStorage` (survives F5 on the same tab, keyed by sprint id); brief-1 recommends React `useState` (per-mount). **Decision: `sessionStorage`, keyed by sprint id.** Aligns with "session-scoped" in the brief language. Survives accidental refresh of the newtab, which matches user expectation that a nudge they dismissed stays dismissed for the tab's session. Trivial to implement: one-line `useState(() => sessionStorage.getItem('proclivity:sprint-banner-dismissed:' + sprintId) === '1')` initializer plus a setter that writes through. Per-tab semantics are fine (each newtab is its own document) — re-prompting once per fresh tab is reasonable for an overdue nudge.

2. **Retro-note input type: `<input>` or `<textarea rows={2}>`?** brief-2's lean: textarea with `rows={2}` allows graceful overflow if the user types something longer, while still rendering as ~one visible line by default. **Decision: `<textarea rows={2} maxLength={280}>`.** Single-line input is too restrictive; an unbounded multi-line textarea is overkill for a one-line nudge. `maxLength={280}` matches the "one tweet" mental model.

3. **Stale-sprint math:** Use the literal `86_400_000` ms exactly as the brief specifies, not a calendar-day helper. Acceptable DST fuzz of ±1 hour for a "your sprint is overdue" nudge. The brief is unambiguous about the math; don't second-guess it.

4. **Start-sprint button placement:** Show Start + Edit, hide Delete for draft sprints. User can delete from the Edit form. Matches the "primary action + secondary metadata edit" pattern already in the project.

5. **Auto-dismissal of stale banner on close action:** When the user clicks "Close sprint" from the banner and confirms, the state flips to `"closed"` → `isStaleSprint` becomes irrelevant (the sprint is no longer the active sprint and the banner unmounts). No separate dismissal write needed in the close flow.

6. **New draft-sprint fixture:** Skip for m2. m1 fixtures already verify the normalizer backfill path; AC#6 explicitly says "**three** captured v1 fixtures from m1 still render correctly post-m2." Adding a draft fixture is recommended by brief-1 but not in AC scope. Can be added when m3 lands `Sprint.goal` UI.

---

## Open questions still pending implementer judgment (max 5)

1. **Retro-note display in ArchivedSprintRow:** brief-1 recommends a `<details><summary>Retro note</summary>...</details>` disclosure. Confirm during implementation that this matches the surrounding aesthetic (no other archived rows use disclosure widgets today).
2. **Banner copy:** brief specifies "This sprint ended N days ago. Close it?" — verify exact text in the rendered banner matches AC#4 (N is dynamic per `Math.floor((Date.now() - endsAt) / 86_400_000)`).
3. **Optional `scripts/replay-fixtures.ts` assertion:** add a one-liner that `createSprint`'s default isn't part of the normalizer's output (i.e. fixtures never have `state: "draft"` post-normalize). Cheap if we keep replay as the only test surface. Optional.
4. **CSS file selection:** brief-2 says `src/sections/sprint/SprintManager.css`, brief-1 says possibly `sections.css`. Verify which file the existing sprint styles live in via `git grep -l 'sprint-header'` and add to it (don't introduce a new stylesheet).
5. **`createSprint`'s `activeSprintId` behavior:** When creating a draft sprint, should it auto-become the `activeSprintId` (the current m1 behavior) so the user sees the "Start sprint" prompt immediately, or should it stay queued until started? **Recommend: keep current behavior.** Auto-promoting to activeSprintId makes the Start affordance discoverable; not auto-promoting hides the draft in the tab list.

---

## Footguns surfaced for the implementer

- Work directly on `main`. No feature branches.
- `npm run build` must pass under strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- Cumulative bundle delta cap is +6 kB from pre-m1 baseline (199.62 kB raw). Brief-1 estimates +0.5 kB for m2 → cumulative ~0.75 kB. Plenty of headroom.
- Conventional commit type: per m1 critique M2, use a standard type. **`feat(sprint):`** is the natural choice for adding lifecycle UI.
- GPG signing required; pre-commit hooks honored. Never `--no-verify`.
- The Photos integration has live WIP files in `src/lib/googlePhotos/` and `src/components/settings/panes/GooglePhotosPane.tsx` — do not touch those.
- AC#3 says retro note is persisted to `Sprint.retroNote`. That field is `?: string | undefined` per the m1 type. An empty trimmed retro should result in `retroNote: undefined`, not `retroNote: ""` (matches the `Sprint.goal` pattern in m3 plans).

---

## Synthesis status

Both briefs cleared schema validation. Single disagreement (banner dismissal mechanism) resolved in favor of `sessionStorage`. Both briefs recommend **inline implementation** at 3 files / ~165-250 LOC. The orchestrator concurs.

**Recommended next action:** transition to `research-complete` → `implement-running`, implement inline in the main session, run `npm run build` + `npx tsx scripts/replay-fixtures.ts` to verify AC#6 + AC#7.
