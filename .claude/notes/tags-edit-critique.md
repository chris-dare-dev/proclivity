# Adversarial Critique: Tags + Edit Feature Plans

## Verdict

**Ship with mandatory fixes — not as-is.** The two plans are individually
sober and align on the big strokes (modal edit, OR filter, normalized
tags, chrome.alarms re-arm via `diffAndSyncAlarms`). But they leak
across each other in five places that will bite the implementor in the
first hour: the **color encoding format** (hex vs OKLCH), the **edit
patch type contract** (`scope`, `done`, `completedAt` mutability),
the **filter-state location** (TodoList vs. section wrapper), the
**focus-trap behavior of a popover inside the focus-trap of a modal**,
and **whether the tag picker is a shared component or two copies**.
None of those are dramatic. All of them must be settled before commit
1.

Beyond the contradictions, both plans share a quiet structural defect:
neither audits the spread-patch under `exactOptionalPropertyTypes`,
which is the one TS flag most likely to reject the plans as written.

## Severity-graded issues

### CRITICAL — must fix before shipping

1. **The two plans encode `Tag.color` in incompatible formats.**
   - Data plan §1: `Tag.color: string` documented as hex (`"#7c9cff"`)
     with `""` sentinel = "use accent default" (line 53).
   - UI plan §2 (line 240–252): `TAG_PRESETS` literal values are
     `"oklch(0.65 0.18 264)"` strings.
   - Existing pattern: `ACCENT_PRESETS` in `SettingsModal.tsx:35–44` is
     **hex strings** (`#7c9cff`). The user-facing color picker is a
     `<input type="color">` which only emits 6-digit hex.
   - Consequence: a "preset" stored as OKLCH cannot be edited or
     compared with a user-picked hex. The "first unused preset" rule
     in UI plan §3 step 5 can't compare across encodings.
   - **Fix:** standardize on hex everywhere (matches `ACCENT_PRESETS`,
     matches `<input type="color">`, matches `chip-color` inline
     style — `color-mix(in oklch, #abc 15%, transparent)` does work
     in Chrome 111+). Rewrite UI plan §2 preset values to hex.

2. **`exactOptionalPropertyTypes` will reject the proposed edit patch
   shape.** Data plan §6 declares
   `onSave: (patch: Partial<Omit<Todo, "id" | "createdAt" | "done" | "completedAt">>) => void`.
   `Partial<T>` adds `?:` to every field; under `exactOptionalPropertyTypes`,
   `Partial<{notes?: string | undefined}>` becomes
   `{notes?: (string | undefined) | undefined}` — fine for `notes`
   but **the spread call `{...todo, ...patch}` in the handler is what
   breaks**: `patch.scope` is `TodoScope | undefined` and Todo.scope is
   non-optional `TodoScope`. TS will reject the spread.
   - The existing pattern (`SprintManager.editSprint`, line 418–427)
     never uses `Partial<>`; it accepts the three concrete fields by
     name. Match that pattern.
   - **Fix:** edit handler signature should be
     `onSave: (id: string, fields: { title: string; notes: string; scope: TodoScope; sprintId: string | undefined; tags: string[]; }) => void`.
     Concrete, non-optional fields. The handler decides what to write.
     No `Partial`.

3. **The two plans disagree on where filter state lives.**
   - Data plan §4 "verdict": per-section `useState`. §10 then says
     "if `TodoList` owns it, [Today/LongTerm] do not change" (line 530–531).
   - UI plan §5 places the toolbar **inside the section, between
     add-input and list** — Today and LongTerm both render their own
     `TodoList` instance. If `TodoList` owns the filter state, both
     instances render their own toolbar with their own state. **This
     is the correct behavior** but the data plan §4 last paragraph
     says SprintManager gets the same `activeTagIds` state — implying
     the section-level (not `TodoList`-level) owns it.
   - **Fix:** declare explicitly that filter state is owned by the
     section component (`TodoList` for Today/LongTerm, `SprintManager`
     for Sprint, `RemindersManager` for Reminders). `TodoList` owning
     it works because each scope renders its own `TodoList` instance,
     but the prop boundary must be specified: the toolbar lives
     inside `TodoList`, not above it. Confirm in writing.

4. **`exactOptionalPropertyTypes` rejects `{tags: [], ...t}` spread when
   `t.tags` is missing from a stored object.** Data plan §7 line 425
   proposes `base.todos.map((t) => ({ tags: [], ...t }))`. Under
   `exactOptionalPropertyTypes`, `t` is typed as `Todo`, which now
   *requires* `tags`. TS will complain that the input `Todo[]` from
   `readRaw()` already satisfies the type — but at runtime, stored JSON
   may genuinely lack `tags`. The plan blurs runtime vs type-time.
   - **Fix:** widen the input type before backfill. Either:
     - Type `readRaw()` return as
       `Partial<ProclivityState> & { todos?: unknown[]; reminders?: unknown[] }`
       and validate per-item; OR
     - Use a cast: `(t as Todo & { tags?: string[] }).tags ?? []`,
       then spread into a freshly-constructed `Todo`. Lint will yell
       but the boundary is honest.
   - The plan's claim that "the backfill in `get()` is precisely the
     enforcement boundary" (line 433) is correct in spirit but its
     code sample won't compile.

5. **Tag picker popover inside the edit modal will break the modal's
   focus trap.** UI plan §3 line 287–290 says the popover is "not a
   portal — it lives inside the form so focus-trap logic in Modal.tsx
   continues to work without modification."
   - Verified `Modal.tsx:67–97`: focus trap uses `getFocusable(panelRef)`,
     which returns ALL focusable descendants of the panel. If the
     popover is rendered inside the panel, its focusable elements
     ARE in the trap — fine for Tab cycling. BUT the popover also
     handles Escape and click-outside. The modal's `handleKeyDown`
     on Escape **calls `e.stopPropagation()` and `onClose()`**
     (Modal.tsx:69–72). The popover's Escape handler must execute
     FIRST (deeper in the DOM tree) and call `stopPropagation()` —
     but React's synthetic event capture-vs-bubble means the modal's
     `onKeyDown` (bubbling phase, on the backdrop) fires AFTER the
     popover's. The popover MUST capture Escape and stopPropagation
     before it reaches the modal — exactly as UI plan Appendix B item
     9 calls out, but the plan does not specify that the popover
     attach its own `onKeyDown` handler in the capture phase or how
     the implementor enforces ordering.
   - The "click outside the popover" close behavior also conflicts
     with `Modal.tsx:104–107` — clicking the modal backdrop closes
     the modal. The popover must intercept clicks inside the modal
     panel area too.
   - **Fix:** UI plan must specify a `<TagPickerPopover>` component
     that (a) attaches its own document-level `mousedown` listener
     to detect outside-clicks (a la headless-ui), AND (b) attaches
     its own `onKeyDown` with `e.stopPropagation()` on Escape. The
     trap-Tab cycling in Modal stays correct because tabbable items
     in the popover are reachable.

6. **Cascade-delete of a tag while an edit modal has that tag selected
   creates a stale ref.** Data plan §2 `deleteTag` cascades: it
   removes the id from `state.todos[*].tags` and `state.reminders[*].tags`.
   But if the user has an edit modal open with the tag selected in
   local `useState`, the modal's local state still holds the deleted
   tag id. On Save, the modal writes the deleted id back into the
   item's tag list. The cascade is then *un-done*.
   - **Fix:** Either disable tag deletion while any edit modal is
     open (heavy), or, simpler: on save, validate that every tag id
     in the patched item still exists in `state.tags`. The save
     handler can re-read `state.tags` (fresh from the closure) and
     filter the picked-tag list against it. The data plan's
     `filterByTags` already tolerates orphan ids — the edit save
     path must do the same defensively.

7. **`color-mix(in oklch, ...)` is Chrome 111+ but the manifest sets
   no `minimum_chrome_version`.** `manifest.config.ts` does not
   declare `minimum_chrome_version` (verified — only manifest_version,
   name, icons, urls, permissions). The UI plan claims (Appendix B
   item 1) that "if a user is on an ancient Chrome, chips will fall
   back to the transparent background (no solid fill), which is
   acceptable." That is false: when `color-mix()` is the only value
   in a `background` property, the entire declaration is invalid and
   the property reverts to its inherited / initial value (`transparent`
   for `background`), **but the text color is set the same way and
   would also collapse to `inherit`** — text could become the modal
   background color = invisible.
   - **Fix:** either add `"minimum_chrome_version": "111"` to the
     manifest, OR specify a hex fallback per chip via CSS custom
     property: `background: var(--chip-color, transparent); background: color-mix(...)`.
     The double-declaration pattern is the canonical progressive-
     enhancement workaround.

8. **`schemaVersion` should bump.** Data plan §8 (line 458) says no
   bump is required because the field is additive. But:
   `exportImport.ts:99` does `{ ...EMPTY_STATE, ...(data as Partial<ProclivityState>) }`.
   With the new EMPTY_STATE.tags = [], importing a v1 backup that
   predates this feature works fine (EMPTY_STATE supplies `tags: []`).
   BUT: importing a v1 backup whose `todos[*]` items lack `tags` will
   spread non-conforming objects into state.todos. The storage
   backfill in `get()` runs on next read — fine. But **the import
   path does NOT pass through `get()`**: it calls `storage.set(merged)`
   directly (line 101). After import, `state.todos[*].tags` is
   `undefined` until the user reloads the newtab (where `get()`
   runs). In the interim, any code that does `todo.tags.includes(...)`
   crashes.
   - **Fix:** route imports through the same backfill: import handler
     should call the same normalization that `get()` does, or
     `importData` should explicitly map `tags: []` over imported todos
     and reminders.

### HIGH — fix or accept the consequences

9. **The pencil button is "always rendered with `visibility: hidden`"
   per UI plan §9 — `visibility: hidden` removes elements from the
   tab order in most browsers.** The plan claims (lines 836–838) that
   "`visibility: hidden` removes it from screen but NOT from the
   accessibility tree." **This is wrong** — `visibility: hidden`
   removes the element from both the accessibility tree AND tab
   focus in Chrome. The plan's keyboard-discoverability story
   collapses.
   - **Fix:** use `opacity: 0; pointer-events: none` at rest, plus
     `aria-hidden="true"`. On `:hover` and `:focus-within` (parent
     `li`), flip to `opacity: 1; pointer-events: auto`. To make the
     pencil reachable for keyboard users at all, leave it tabbable
     always (don't change `pointer-events`) but use opacity for
     visual reveal. Or simpler: make the pencil always visible
     (drop the "appear on hover" UX) — it's only 16 px wide and
     does not crowd the row meaningfully.

10. **Row-click vs checkbox-click ambiguity is not actually addressed.**
    UI plan §9 line 783 disqualifies "full-row click to edit" because
    the row has a checkbox. Good. But the UI plan also says (§9
    line 813) "`.todo-item:hover .todo-edit, .todo-item:focus-within
    .todo-edit { visibility: visible; }`" — the pencil is a `<button>`
    inside the `<li>`. The plan does not specify whether `onClick` on
    the pencil button calls `e.stopPropagation()`. If the parent `<li>`
    later gains any click handler (drag-reorder, keyboard activation,
    long-term refactor), the pencil click will bubble. Defensive
    `stopPropagation` belongs in the spec.

11. **`Tag.color = ""` sentinel is undocumented at the chip render
    boundary.** Data plan §1 line 53 says `""` = "inherit accent."
    UI plan §1 line 178 says `style={{ "--chip-color": tag.color }}`.
    If `tag.color === ""`, the inline style sets `--chip-color: ""` —
    which is an invalid CSS value, and the var() falls back to its
    default. The CSS fallback chain `var(--chip-color, var(--accent))`
    in UI plan §1 line 150 saves it only when the var is `unset`, NOT
    when it's the empty string.
    - **Fix:** the rendering component must check `tag.color` and
      either omit the inline style entirely when `color === ""`, or
      set `style={{ "--chip-color": tag.color || "var(--accent)" }}`.
      State this in both plans' shared section.

12. **Tag picker is duplicated between Todo edit modal, Todo create
    flow (UI plan §3), Reminder edit modal, Reminder create flow.
    Neither plan factors it.** Data plan §10 lists 0 new component
    files; UI plan Appendix C commit 2 lists `TagPickerArea.tsx` —
    so the UI plan does extract it, but the data plan never names it.
    Both plans must agree: there's one shared `TagPickerArea` (and
    one `TagChip`) component used in 4+ places.
    - **Fix:** add `src/components/TagPickerArea.tsx`, `src/components/TagChip.tsx`
      to data plan §10's file list. Both plans cite the same component
      surface (props: `tags`, `assigned`, `onToggle`, `onCreate`).

13. **No shared `EditFormModal` primitive.** Both Todo and Reminder
    edit modals share: snapshot pattern, Save/Cancel footer, focus
    management, validation surface, "Save changes" copy. They differ
    only in their field sets. The plans propose two parallel local
    components. Pattern from `SprintForm` (the shared form that
    backs both Create and Edit) suggests a similar consolidation is
    warranted. Not blocking, but the implementor should at least
    extract `EditModalFrame({ title, onCancel, onSave, children })`.

14. **The "fireAt in the past" save path is a footgun for non-
    recurring reminders.** UI plan §8 line 769 specifies an inline
    warning but allows save anyway. After save, `diffAndSyncAlarms`
    sees `r.fireAt <= now` and **does not create an alarm** (verified
    `service-worker.ts:267`: `if (r.fireAt <= now) continue;`). The
    reminder enters limbo: it shows as upcoming in the UI but will
    never fire — until the next service-worker startup, when
    `reconcileAlarms` calls `fireMissedReminder`. Either:
    - **Behavior A:** mark fired immediately on save with past
      fireAt; show in "Fired" not "Upcoming." Need additional logic
      in the save handler.
    - **Behavior B:** block save with past fireAt unless recurrence
      is set.
    - Pick one in writing. The current plan picks neither.

15. **Filter toolbar `opacity: 0.55` at rest is a WCAG 1.4.3 failure
    in light theme.** UI plan §5 line 541 sets `.tag-filter-toolbar
    { opacity: 0.55; }`. In light theme, the chip text inside the
    toolbar is already `var(--text-dim)` = `oklch(0.45 …)` against
    `var(--panel)` = `oklch(1.00 0 0)`. Compounding 0.55 opacity
    drops effective contrast to ~2.0:1 — below the WCAG 1.4.3 4.5:1
    minimum for text.
    - **Fix:** Don't use container opacity for "subdued." Use a
      class that changes the text color directly to a known-good
      dim token. `opacity` is a contrast killer.

16. **The `Showing N of M items` status announcement fires on every
    keystroke in the picker.** UI plan §10 lines 873–875 set the
    status `<div role="status" aria-live="polite">`. But the
    `activeTagIds` change only on click, not on type. So this is
    OK — UNLESS the implementor wires keystroke-based filter (e.g.
    typing in the picker filters the list). Re-read carefully:
    UI plan §3 step 3 says typing in the **picker popover** filters
    the popover list, not the section list. So the live region
    doesn't fire from keystrokes. Verified safe. (Recording this
    as confirmed-OK so the implementor doesn't worry.)

17. **Tag rename uniqueness check is a runtime concern unspecified
    in the data plan.** UI plan Appendix B item 5 calls out: "if
    the user renames tag 'design' to a label that already exists,
    the `onRenameTag` call must reject." The data plan §2's
    `renameTag` does NOT check uniqueness — it just writes. Either:
    - Data plan: add uniqueness guard to `renameTag` and return
      `Promise<{ ok: true } | { ok: false; error: string }>`. UI
      plan then expects that shape and shows inline error.
    - Or: accept duplicates; rely on the user to fix.
    - Pick one. The plans must agree.

18. **`AddReminderForm` Omit type is wrong after the new field.** The
    data plan §3 line 247–249 hedges: "the Omit must now include tags…
    Simplest: leave Omit as-is; AddReminderForm initialises tags state
    to [] and includes it in the onSave payload." This **does not
    compile** — `Omit<Reminder, "id" | "fired">` includes `tags: string[]`,
    so `onSave({...without tags})` violates the contract. The "leave
    Omit as-is" suggestion is wrong on its face.
    - **Fix:** AddReminderForm must include `tags: []` in the payload.
      State explicitly.

19. **`useStore` returns whole state — every storage change re-renders
    every section.** Plans claim memoization is sufficient. Verified
    `useStore.ts:20`: `storage.subscribe(setState)` triggers full
    state replacement on every storage change. Every component that
    calls `useStore` re-renders. Adding tag state changes (rename,
    recolor) to the storage write path means every section re-renders
    when a tag is renamed in Settings. The `useMemo` on filtered todos
    guards the inner work, but the chip render (which resolves
    `state.tags.find(...)`) is downstream of every TodoItem. Not a
    real perf problem at scale — but the plans should not claim "no
    extra re-renders" since they will happen. Plans are silent on
    this; flag it.

### MEDIUM — improvements worth doing

20. **OR filter is one direction; the user can never narrow to "items
    tagged BOTH A and B."** This is a real productivity limitation
    for someone wanting "design + backend" overlap. The plans dismiss
    AND with "users can select one tag at a time" — but that
    contradicts the entire purpose of multi-select. Consider a tiny
    toggle: `[ANY ▾]` / `[ALL ▾]` next to the Clear button.

21. **The data plan says modal flow uses snapshot-on-open, but the
    UI plan doesn't specify it.** UI plan §7 line 718 says "Cancel
    restores no changes (form state is local; no optimistic write
    happens until Save)." That matches snapshot. Confirmed aligned —
    but the plans should cross-reference each other on this.

22. **`structuredClone` is not mentioned by either plan.** The
    Settings v2 modal uses snapshot-on-open via `snapshotRef`
    (`SettingsModal.tsx:83`); the snapshot stores the original
    `UserSettings` for Cancel revert. The tag/edit modals will need
    their own local snapshot. Plain `{...item}` is shallow; `tags`
    is an array — shallow-clone preserves the array reference, so
    mutating `tags.push(...)` would corrupt the snapshot. Use
    `[...item.tags]` or `structuredClone(item)` for the snapshot.
    Either plan should call this out.

23. **Empty tag picker (no tags exist yet) is not specified.** UI
    plan §3 step 3 says "+ Create '<value>'" appears when input
    matches nothing. Fine. But what if `state.tags.length === 0`
    and the user opens the picker with no typed input? The list
    is empty; no "Create" row appears (the user has typed nothing
    to create). The picker is a dead modal. Plan should show an
    empty-state hint: "Type a name to create your first tag."

24. **A tag with zero attached items still shows in the filter
    toolbar.** UI plan §5 says "shows all tags that appear in the
    current section" (Appendix B item 4 says "shows all tags in
    the toolbar that appear in the current section"). Cross-plan
    contradiction — the implementor needs to know: filter toolbar
    chips = all global tags? all tags-in-section? UI plan implies
    the latter; data plan is silent. Settle.

25. **No tag count display decision.** Neither plan addresses
    "Design (12)" vs "Design" in the filter toolbar or picker.
    Recommend: omit counts in filter toolbar (chrome competes with
    chip color), include counts in Settings > Tags so the user
    can see which tags are stale before deletion.

26. **An item with zero tags, with a filter active.** Both plans
    use OR semantics. With OR, untagged items match no filter, so
    they vanish when ANY filter is active. The user might expect
    "I want to see my untagged backlog" — add an `[Untagged]`
    pseudo-chip to the toolbar. Out of scope but worth a note.

27. **Drag-reorder is currently absent and the plans do not check.**
    No section in `TodoList`, `SprintManager`, or `RemindersManager`
    has drag-reorder today (verified). Adding tags doesn't break
    anything that doesn't exist. Plans should explicitly note "no
    drag-reorder integration needed."

28. **Tag chip's `aria-label={tag.label}` is redundant per WCAG and
    can confuse screen readers** (UI plan §10 line 854–856). The
    label text is already inside the `<span>`. Drop the aria-label.

### LOW — polish / nice-to-have

29. **Status string copy "any selected tag" reads awkwardly** (UI
    plan Copy Deck, line 1032). Native-English readers parse "any"
    as "any one." Consider "matches any selected tag" or just drop
    it and rely on the convention.

30. **Settings > Tags discovery is 4 clicks deep.** No critical
    issue — Settings is already where users go for color/visibility.
    Acceptable.

31. **`role="status"` already implies `aria-live="polite"`** —
    redundant in UI plan §5 line 620. Pick one.

32. **The chip border `2px` solid in the selected state** (UI plan
    §5 line 585) — every other chip in the codebase is 1px, and
    chip width changing by 1px on selection will cause adjacent
    chips to reflow. Use box-shadow inset or keep 1px and change
    border color saturation only.

## Cross-plan contradictions

| # | Topic | Data plan says | UI plan says | Resolution |
|---|-------|---------------|---------------|------------|
| 1 | `Tag.color` encoding | Hex string (`#7c9cff`); `""` sentinel | OKLCH strings in presets | Use hex. Match existing `ACCENT_PRESETS`. |
| 2 | Edit save signature | `Partial<Omit<Todo,…>>` | "patch covers all changed fields" (§7) | Concrete fields, not Partial. Match `editSprint`. |
| 3 | Filter state location | Per-section `useState` (could be `TodoList`) | Toolbar inside section between input and list | TodoList owns filter state; toolbar renders inside TodoList. |
| 4 | Tag picker as shared component | Not mentioned in §10 file list | New `TagPickerArea.tsx` in commit 2 | Add to data plan's §10. |
| 5 | TagChip as shared component | Not mentioned | New `TagChip.tsx` in commit 1 | Add to data plan's §10. |
| 6 | Tag-create initial color | "any hex string is valid" (data §11.4) | "first unused preset" (UI §3 step 5) | UI logic owns it; data layer is indifferent. State explicitly that color is `""` sentinel until UI picks. |
| 7 | Tag delete confirmation | Single-step `deleteTag(id)` | Two-stage inline confirm row (UI §4) | UI handles the confirm; data API is one call. Aligned but should be cross-referenced. |
| 8 | Tag rename uniqueness | Not checked in `renameTag` | "Implementor must handle uniqueness" (UI Appendix B item 5) | Add uniqueness check to data plan's `renameTag` (return result type). |
| 9 | `tags` field on stored items pre-feature | Backfilled in `storage.get()` only | (UI plan silent) | Add `importData` to the backfill path. |
| 10 | Filter toolbar chip universe | (silent) | "all tags in the current section" | UI owns; document. |
| 11 | Edit modal panel sizing | (silent) | `max-width: 520px` for Todo, `480px` for Reminder | UI owns; add to data plan's commit 4–5 notes. |
| 12 | Edit pencil visibility tech | (silent) | `visibility: hidden` (broken — see CRITICAL #9) | UI plan must switch to `opacity + aria-hidden`. |
| 13 | "Done" todos editable? | Data plan §6 says yes | UI plan silent | Aligned implicitly; document. |
| 14 | Archived sprint tasks tagging | "active sprint only" (data §11.3) | "tag chips shown in ArchivedSprintRow … pencil shown for archived" (UI §11) | Contradiction. Data says no filter on archive; UI says pencil-edit IS shown. Pick: read-only archive vs. editable archive. Recommend read-only (chips display, no edit, no filter). |

## Things the plans don't cover

- **Import of an item whose tag id doesn't exist in imported state.**
  Data plan §8 covers the "show as missing" rendering case but does
  not say what `filterByTags` does. Verified: `filterByTags` uses
  `.includes()`, so orphan ids simply don't match any active filter
  — fine. But `TagChip` rendering on the item row must skip orphans
  (`state.tags.find(...) === undefined`). Plans mention but don't
  spec the chip's null-tag render path.
- **Per-section filter visibility when `state.tags.length === 0`.**
  UI plan §11 Today row says "Only visible if `state.tags.length > 0`"
  — but this is per-section state, so a section with tags absent
  but global tags present still shows the toolbar with all-zero
  counts. Spec the precise rule.
- **What happens if `state.tags` itself is dropped from an imported
  backup (older schema)?** The shallow merge of `EMPTY_STATE` supplies
  `tags: []`. Verified safe.
- **Tag picker behavior under reduced-motion preference.** Plans
  don't address. Probably fine; the popover fade is 100ms anyway.
- **Localization of filter toolbar copy.** Out of scope (extension
  has no i18n today).
- **Tag deletion while a filter is active using that tag.** Cascade
  removes the tag; the filter's `activeTagIds` may still hold the
  deleted id. `filterByTags` is tolerant (returns nothing matching),
  but the toolbar UI would show a chip for a tag that no longer
  exists in `state.tags`. **Fix:** the section components should
  filter `activeTagIds` against `state.tags` on render.
- **Tag count visualization** — plans don't decide. Recommend: omit
  in toolbar, include in Settings.
- **A tag with zero items showing in the picker.** Plans don't say.
  Recommend: include (no reason to hide; user might want to assign).
- **A tag with zero items showing in the toolbar.** Per the implicit
  UI rule "tags that appear in the section," it would NOT show.
  Verify and document.

## Recommended addendum to each plan

### Data plan (`tags-edit-data-architecture.md`)

1. **Fix the spread pattern under `exactOptionalPropertyTypes`.**
   Rewrite §7 to use `(t as Todo & { tags?: string[] })` or widen
   `readRaw`'s return type and validate. The current code sample
   will not compile.
2. **Replace the `Partial<Omit<Todo,…>>` edit patch signature** with
   concrete-field signatures matching `editSprint` (SprintManager.tsx:418).
3. **Add uniqueness check to `renameTag`** and return a result type.
   Or call out explicitly that duplicates are allowed.
4. **Route `importData` through the tag backfill.** Don't rely on
   the next page reload to normalize newly-imported state.
5. **Add `src/components/TagChip.tsx` and `src/components/TagPickerArea.tsx`**
   to the file list in §10 — these are shared components, not
   section-local.
6. **State the orphan-tag-on-edit-save defense:** on Save, filter
   the patched item's `tags` against current `state.tags`.

### UI plan (`tags-edit-uiux-design.md`)

1. **Switch tag color encoding from OKLCH to hex.** Match
   `ACCENT_PRESETS` (`SettingsModal.tsx:35–44`). Convert TAG_PRESETS
   in §2 to hex.
2. **Replace `visibility: hidden` with `opacity + aria-hidden`** for
   the pencil reveal. `visibility: hidden` removes the element from
   the accessibility tree and tab order — breaks the stated keyboard
   story.
3. **Add `minimum_chrome_version: "111"` to the manifest** OR
   specify a hex fallback `background: var(--chip-color, transparent);`
   above the `color-mix()` declaration so older Chrome degrades
   visibly rather than to invisible text.
4. **Specify the popover's keyboard and click capture** —
   `onKeyDown` with `e.stopPropagation()` on Escape, document-level
   `mousedown` listener for outside-click. Modal's focus trap is
   compatible only with the in-flow approach as long as the popover
   owns its own escape/blur handling.
5. **Drop the `opacity: 0.55` filter-toolbar at-rest treatment.** Use
   a dim text token instead — opacity compounds against `--text-dim`
   and drops light-theme contrast below WCAG 1.4.3.
6. **Specify the fireAt-in-the-past save behavior** for non-recurring
   reminders: pick "mark fired immediately" or "block save."

---

*End of critique. Implementor: read the CRITICAL section before
opening any of the files in §10 of the data plan.*
