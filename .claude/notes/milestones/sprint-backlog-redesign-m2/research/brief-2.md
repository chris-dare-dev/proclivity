# Research brief 2 — sprint-backlog-redesign-m2

**Milestone.** Explicit sprint lifecycle (draft / active / closed) + stale-sprint banner.
**Working dir.** `/Users/chris.dare/Personal/SourceCode/proclivity`
**Phase.** External research + external-writes flag list.
**Date.** 2026-05-14

---

## 1. External sources consulted

**None.** This milestone is entirely internal UI wiring on top of m1's schema fields. No new vendor surface, no network endpoint, no SDK. I confirmed the brief implies no new dependency by enumerating its building blocks:

- `ConfirmDialog` — already present at `/Users/chris.dare/Personal/SourceCode/proclivity/src/components/Modal.tsx:155-192` (`open`, `onClose`, `title`, `message: ReactNode`, `confirmLabel`, `onConfirm`). Re-using it is the obvious move; passing a `ReactNode` `message` that contains a `<textarea>` is supported by the current signature.
- Stale-sprint banner — `package.json` declares only `react`, `react-dom`, `@react-three/fiber`, `three`. No toast/snackbar library is installed. A precedent banner already exists at `/Users/chris.dare/Personal/SourceCode/proclivity/src/components/QuickPrompt.tsx:106-148` (`QuickResultBanner`) — a plain inline `<div>` with a dismiss button. The right move is to build a minimal inline banner inside `SprintManager.tsx` (or a sibling file) in the same spirit, not to add a dep.
- Session-scoped flag — `sessionStorage` is a built-in browser API available in MV3 extension pages (the newtab page runs as a normal browser document with full `window` surface). Zero dep cost. `useState` is also free but has different semantics (see §3).

**Recommendation.** No new npm package. Re-use `ConfirmDialog`; write a minimal inline banner; persist the dismissal flag in `sessionStorage` keyed by `sprintId`.

---

## 2. external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy (solo + private repo)"
```

That is the complete list. The milestone touches:

- `src/types/index.ts` — *no change expected* (all fields already declared in m1).
- `src/sections/sprint/sprintUtils.ts` — `isArchived()` rewrite.
- `src/sections/sprint/SprintManager.tsx` — header buttons, close dialog, banner, `createSprint` default flip.
- `src/sections/sprint/SprintManager.css` (or equivalent stylesheet) — banner + start/close button styles.
- Possibly `src/newtab/App.tsx` — only if the banner needs to live above `<SprintManager>`. Likely not — SprintManager already owns the active-sprint surface.

No file in `src/background/`, no manifest field, no Chrome permission, no service-worker change, no fixture rebuild (m1 fixtures replay through m2 unchanged because `Sprint.state` is already populated by the m1 normalizer). No new npm dep, no CI change, no remote creation. The `npm run build` step runs locally and writes to `dist/` — not an external write.

---

## 3. Riskiest assumption + alternative

**Riskiest assumption: "once per session-id" semantics for the stale-sprint banner.** The brief is ambiguous between two meanings:

1. *Browser-session scoped* — `sessionStorage`, persists across newtab refreshes and across the same tab's lifetime, but cleared when the browser closes. Survives `F5` on the newtab page.
2. *Newtab-instance scoped* — React `useState`, fresh per mount. Every new tab (`Ctrl+T`) shows the banner again because each newtab page is its own document with its own React tree.

Reading the roadmap §m2 acceptance "a dismissible banner renders **once per session-id** offering to close the sprint; dismissing sets a session-scoped flag that prevents re-display **for the rest of the session**" — "session" here most naturally maps to `sessionStorage` (#1). Every newtab in Chrome runs as a fresh document with its own `sessionStorage` (chrome-extension://… newtab pages do NOT share `sessionStorage` across tabs), so option #1 effectively means "dismissed for the rest of THIS tab's life, but a new tab re-prompts". That's actually closer to #2 in practice — the meaningful difference is only "survives F5 refresh on the same tab".

**Recommended interpretation.** Use `sessionStorage.setItem('proclivity:sprint-banner-dismissed:' + sprintId, '1')`. Reasons: (a) survives the user accidentally refreshing the newtab, (b) keyed by sprint id so closing one expired sprint and re-opening newtab while a second sprint is also expired still prompts for the second one, (c) it's a one-line `useState` initializer (`useState(() => sessionStorage.getItem(...) === '1')`), (d) `sessionStorage` is per-document so each newtab tab gets its own — which is fine; reminding the user once per fresh tab is reasonable for a "this sprint is overdue" nudge.

**Alternative implementation path.** Skip the dismissal-persistence flag entirely and rely on `useState`-only. Pro: simpler (no `sessionStorage` import surface, no key-management). Con: a stray re-render of the `SprintManager` subtree (e.g. after `useStore` settles or after settings change) would NOT re-show the banner if the state lives in `SprintManager`'s own `useState` (good) — but the banner WOULD re-appear on every fresh newtab open, every refresh. That's noisier than option #1. The orchestrator should pick option #1 (`sessionStorage`) unless the user prefers minimalism.

**Other risks worth a one-liner each, not picked as "riskiest":**

- *Retro-note input type.* Brief says "optional one-line retro-note textarea". Roadmap §m2 description says the same. Pick `<textarea rows={2}>` — `<textarea>` allows soft-wrap if the user types a long note, while still rendering as one visible line by default. Single-line `<input>` would also satisfy "one-line" but loses graceful overflow. Confirm with the implementer; either is defensible.
- *Stale-sprint math.* Brief: `endsAt < todayMidnight() - 86_400_000`. `todayMidnight()` already exists in `sprintUtils.ts` and uses `setHours(0,0,0,0)` on a local-time `Date`, so it is DST-safe within a day but the literal `86_400_000` ms is not. Across the spring-forward DST boundary this becomes "23 hours before today's midnight" instead of "yesterday's midnight". Acceptable for a "this sprint expired >1 day ago" nudge — at worst the banner shows up an hour early or late once a year. The roadmap doesn't require calendar-day precision here. **Recommend keeping the literal** for code simplicity; do NOT introduce `addCalendarDays(todayMidnight(), -1)` unless the implementer specifically wants it.
- *Backwards compat.* m1 normalizer backfills `Sprint.state` for legacy data — existing sprints become `"active"` or `"closed"` based on `endsAt < todayMidnight()`. m2 changes the *default for new sprints* from `"active"` (m1's temporary) to `"draft"`. Existing user data isn't touched. **No migration needed.** Confirm by re-running `scripts/replay-fixtures.ts` after the m2 edits land — the fixture assertions don't pin `state` values from the writer side, only from the normalizer, so they'll still pass.
- *`isArchived()` callers.* Two call sites in `SprintManager.tsx` (line 428 — `archivedSprints` filter; line 432 — `liveSprints` filter; line 544 — sprint-switch fallback). After the rewrite, a draft sprint with `state === "draft"` is NOT archived, so it appears in `liveSprints` — correct. A long-expired sprint that the user never explicitly closes stays `"active"` and remains live (the stale-banner is the prompt to close it). That's the intended new behavior per the brief.

---

## 4. Acceptance criteria the implementer must meet

Verbatim from the milestone brief (the 8 listed in the brief, preserving order):

1. **AC#1** — Given a newly created sprint, When the user finishes the create form, Then the sprint is stored with `state: "draft"` and the active-sprint header renders a "Start sprint" button instead of the task input.
2. **AC#2** — Given a draft sprint, When the user clicks "Start sprint", Then `state` flips to `"active"` and the header renders the existing task input, progress bar, and close button.
3. **AC#3** — Given an active sprint, When the user clicks "Close sprint", confirms, and optionally enters a retro note, Then `state` flips to `"closed"`, `retroNote` is persisted on the sprint, and the sprint relocates from the live tabs list to the archived rail in the next render.
4. **AC#4** — Given an active sprint with `endsAt < todayMidnight() - 86_400_000`, When the user opens newtab, Then a dismissible banner renders once per session-id offering to close the sprint; dismissing sets a session-scoped flag that prevents re-display for the rest of the session.
5. **AC#5** — `isArchived()` is updated to `sprint.state === "closed"`; the date-based check is deleted. All call sites in `SprintManager.tsx` still compile and render the archived rail correctly.
6. **AC#6** — Three captured v1 fixtures from m1 still render correctly post-m2 (no double-archival, no orphaned state).
7. **AC#7** — `npm run build` passes; cumulative initial-chunk size delta from the pre-m1 baseline ≤ +6 kB.
8. **AC#8** — Manual walkthrough captured in the commit body: create-draft → start → close-with-retro → archived rail shows it with the retro note expandable.

---

## 5. Diff size estimate + inline-vs-delegated recommendation

**Files touched (estimated):**

| File | Change | LOC estimate |
|---|---|---|
| `src/sections/sprint/sprintUtils.ts` | `isArchived()` rewrite (2-line body change, may add a brief comment) | ~5 LOC |
| `src/sections/sprint/SprintManager.tsx` | `createSprint` default flip to `"draft"`; conditional header rendering (draft → Start button, active → existing task input + Close button); close-sprint dialog (ConfirmDialog with controlled `<textarea>` and `startSprint` / `closeSprint` action creators); stale-sprint banner component + sessionStorage dismissal hook; new local state (`closingSprint: boolean`, `retroNoteDraft: string`) | ~120–180 LOC net additions |
| `src/sections/sprint/SprintManager.css` (or equivalent stylesheet) | Styles for `.sprint-stale-banner`, `.sprint-start-btn`, `.sprint-close-btn`, possibly a `.sprint-draft-empty` placeholder for the header pre-start state | ~40–60 LOC |
| `src/newtab/App.tsx` | Likely untouched — the banner mounts inside `SprintManager`. *If* it needs to live higher, +10 LOC; assume not. | 0 (probable) |
| `scripts/replay-fixtures.ts` | No change — m1 fixtures still replay; the AC#6 verification is "still works", not "new assertion". May add a one-line assertion that draft-default doesn't appear in normalized output. | 0–5 LOC |

**Total estimate:** **3 files modified (sprintUtils.ts, SprintManager.tsx, the sprint stylesheet), ~165–250 LOC net additions.**

**Recommendation: INLINE.** Reasoning:
- File count = 3, well under the ≤ 5 ceiling.
- LOC estimate sits at 165–250, well under the 300 LOC inline ceiling for the typical case. Even at the high end (250) it's still inline-eligible.
- All work is in one tightly scoped subtree (`src/sections/sprint/`) that the orchestrator's parent session has already touched in m1 — context is warm.
- The new code is mechanical UI plumbing on top of well-understood existing patterns (`ConfirmDialog`, `useState`, `useStore`'s `update()`). Zero algorithmic risk.
- No multi-file refactor, no new module, no test scaffolding beyond what m1 produced.

If the implementer discovers mid-flight that the banner needs a new shared `<DismissibleBanner>` component extracted to `src/components/` to avoid duplicating the `QuickResultBanner` pattern, that adds 1 file (~40 LOC) and pushes us to 4 files / ~210–290 LOC — still inline. Only escalate to **delegated** if the implementer also wants to introduce a `useSessionFlag` hook in `src/hooks/` (currently no `src/hooks/` directory exists — would be a new directory + module), which would push file count to 5 and create new architectural surface — at that point delegation buys isolation.

**Inline is the safe default. Recommend the orchestrator pick inline unless the implementer flags scope creep.**
