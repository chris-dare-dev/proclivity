# Adversarial critique — frontend-uplift-2026q2-m5

- **Critic:** milestone-adversary-critic
- **Commit range:** `684aeda..HEAD` (2 commits, 7 files, +128/-6)
- **Generated:** 2026-05-20T (Phase 3, post-implement)
- **Diff scope:** UPL-3 stagger-reveal on todo list activation (m5-s9) + UPL-16 mobile header fluid clock + scrollable tabs (m5-s10)

---

## Verdict

**SHIP-WITH-FIXES.**

The diff is small (134 LOC), pure CSS + a small React state machine, with no external-write, persistence, or strict-TS violations. The build passes cleanly at 234.53 kB initial chunk (verified by independent `npm run build` — matches the implementer's claim to the byte). The state machine correctly cancels pending timeouts on rapid tab switching and seeds `staggeredTab` to `"today"` so first-paint plays. However, the m5-s9 commit uses an invented scope (`motion`) not in the active list, the m5-s10 commit subject overruns the 50-char limit, and the CSS selector `[data-staggered="true"] .todo-list li` also matches the card-mode fallback `<ul className="todo-list card-fallback-list">` — meaning at narrow viewports in card mode (where the fallback list is `display:flex`), items animate with no `--stagger-idx` (all simultaneously). These are MEDIUM-grade polish issues, not blockers.

---

## Executive summary

- [MEDIUM] `feat(motion):` scope is not in the CLAUDE.md active scope list — invented scope.
- [MEDIUM] `feat(a11y):` subject is 52 chars (CLAUDE.md hard cap is 50 after the prefix).
- [MEDIUM] `.todo-list` selector matches the card-mode fallback `<ul className="todo-list card-fallback-list">` inside Today/LongTerm tabpanels — at <600 px viewport in card mode, items animate without `--stagger-idx` (simultaneous, no stagger).
- [MEDIUM] Archived sprint rows under the Sprint tabpanel inherit `data-staggered` and animate without `--stagger-idx` — known/accepted per synthesis Q3 but undocumented in CSS.
- [MEDIUM] Research synthesis §3.6 asserts "Card mode exclusion is implicit" — this claim is incorrect (the card-mode fallback list keeps the `.todo-list` class); doc drift.
- [LOW] `staggeredTab` initial value duplicates the `tab` initial value (`"today"`) — small DRY/maintenance hazard if either default changes.
- [LOW] `scrollbar-width: thin` is universal-on with no media-query guard — defensible per synthesis §3.5 but worth noting as a UX deferral.

---

## Findings

### CRITICAL

_None._

### HIGH

_None._

### MEDIUM

#### [MEDIUM] M1 — `feat(motion):` scope not in CLAUDE.md active scope list

- **File:** `git log` (commit `9473337`)
- **Line:** subject line of commit `9473337efd66a989066ebd6bc6a2bd930cbe1b87`
- **Anchor:** `feat(motion): stagger-reveal on todo list a`
- **What:** The commit uses scope `motion`, which is not in the CLAUDE.md "scopes in active use" list (`gantt, sprint, reminders, mesh, storage, build, a11y, skill, roadmap, docs, tune, style, perf, refactor, fix, feat`).
- **Why it matters:** CLAUDE.md says "Pick the closest match rather than inventing new scopes." Scope drift accumulates noise across the changelog; future scope-grep queries will miss this commit. `style`, `feat`, or `a11y` (since UPL-3 is itself a polish/a11y story sibling of UPL-16) would all have been valid matches.
- **Proposed fix:** Going forward, prefer `feat(style):` for visual-polish motion changes, OR amend CLAUDE.md to add `motion` to the active scope list if this is the start of a recurring scope. Do NOT amend the pushed commit — the rect summary should note the convention drift and let the user decide whether to backfill the scope list in CLAUDE.md.
- **Regression-guard:** Pre-commit hook checking commit subject against the CLAUDE.md scope list (none today; would be a small `scripts/check-commit-scope.sh`).
- **Source critic:** milestone-adversary-critic
- **Source axis:** Axis 10 (conventional commits)

#### [MEDIUM] M2 — `feat(a11y):` subject is 52 chars; CLAUDE.md cap is 50

- **File:** `git log` (commit `690b20b`)
- **Line:** subject line of commit `690b20b43badafbd52f2de3fc530b5be387a8370`
- **Anchor:** `feat(a11y): mobile header fluid clock + scro`
- **What:** Subject after the `feat(a11y): ` prefix is `mobile header fluid clock + scrollable tabs (m5-s10)` = 52 chars. CLAUDE.md commits §: "subject ≤ 50 chars after the prefix."
- **Why it matters:** The cap exists so `git log --oneline` stays readable in 80-col terminals. Two chars over is small but the rule is hard-numbered, not "around 50." Repeated drift dilutes the discipline.
- **Proposed fix:** No fix on the pushed commit (CLAUDE.md says "never `--amend` on a commit that has been pushed"). Rect summary should note the drift and propose a tighter form for the next sibling commit, e.g. `feat(a11y): fluid mobile clock + scrollable tabs (m5-s10)` (50 chars) or drop the milestone tag (which is logged in the body anyway).
- **Regression-guard:** Pre-commit hook measuring subject length post-prefix (none today).
- **Source critic:** milestone-adversary-critic
- **Source axis:** Axis 10 (conventional commits)

#### [MEDIUM] M3 — `.todo-list` selector also matches `.card-fallback-list` under card mode

- **File:** `src/sections/sections.css`
- **Line:** 278
- **Anchor:** `[data-staggered="true"] .todo-list li {`
- **What:** The selector `[data-staggered="true"] .todo-list li` is keyed solely on the `.todo-list` class. `TodoCardSection.tsx:175` renders `<ul className="todo-list card-fallback-list">` for the <600 px viewport fallback, AND that `<ul>` lives inside the Today/LongTerm tabpanel which gets `data-staggered="true"`. At narrow viewports in card mode, those `<li>`s match the selector but the call site (`TodoCardSection.tsx:177-184`) does NOT pass `index={idx}` to `<TodoItem>`. With no inline `--stagger-idx`, the CSS fallback `var(--stagger-idx, 0)` kicks in for every row → all rows animate with `delay = 0`.
- **Why it matters:** The synthesis §3.6 explicitly asserted "Card mode exclusion is implicit. `.todo-list` selector doesn't match in card mode (TodoCardSection uses its own classes)" — this is factually wrong; the class is literally `todo-list card-fallback-list`. The user-visible effect is mild (a synchronous fade-up of all card-mode rows on tab activation at narrow viewports) but the intended-per-spec stagger is silently absent in this branch. The next contributor reading the synthesis will be misled.
- **Proposed fix:** Either (a) tighten the selector to `[data-staggered="true"] .todo-list:not(.card-fallback-list) li` so the rule applies only to true list-mode rendering, OR (b) pass `index={idx}` from `TodoCardSection.tsx:176` (and `RemindersCardSection.tsx:407` for consistency, though Reminders' tabpanel doesn't get `data-staggered` today) so card-mode fallback ALSO gets stagger. Option (a) is the minimal-change correct choice given that card mode is a fundamentally different visual paradigm.
- **Regression-guard:** Visual regression test under <600 px viewport on Today tab card mode — not present in proclivity today.
- **Source critic:** milestone-adversary-critic
- **Source axis:** Axis 12 (doc drift) + m5-specific axis "Stagger state machine correctness"

#### [MEDIUM] M4 — Archived sprint rows animate without `--stagger-idx` (synthesis Q3 known issue, undocumented in CSS)

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 609-619
- **Anchor:** `<ul className="todo-list">`
- **What:** `ArchivedSprintRow` (rendered inside the Sprint tabpanel) maps `sprintTodos.map((t) => <TodoItem ... />)` with no `index={idx}` prop. When the user expands an archived row and then activates the Sprint tab, those `<li>` items inherit `data-staggered="true"` from the parent tabpanel and animate with the CSS fallback `var(--stagger-idx, 0)` → all simultaneously.
- **Why it matters:** Synthesis Q3 documented this as "either accept it (minor) or scope" and implement/synthesis §3 says it was "intentionally left unscoped." But the CSS file at `sections.css:278` carries no comment marking this as a known deferred case, so the next contributor reading the selector won't know it was an intentional choice. Visually: archived rows do a synchronous fade rather than a stagger, which is the same outcome as M3.
- **Proposed fix:** Add a comment to `sections.css:278` near the selector: `/* Note: also matches archived-sprint <ul>s inside the Sprint tabpanel. These animate simultaneously (no --stagger-idx) by design (synthesis Q3 / m5-s9). Pass index={idx} from ArchivedSprintRow if a true stagger is desired later. */` — OR pass `index={idx}` from `SprintManager.tsx:610` (one-line change). Documenting the choice is cheapest and matches the synthesis's stated stance.
- **Regression-guard:** None today; visual smoke covers this when manually checked.
- **Source critic:** milestone-adversary-critic
- **Source axis:** m5-specific axis "Sprint archived rows"

#### [MEDIUM] M5 — Research synthesis §3.6 makes a false card-mode claim — doc drift

- **File:** `.claude/notes/milestones/frontend-uplift-2026q2-m5/research/synthesis.md`
- **Line:** 52
- **Anchor:** `6. **Card mode exclusion is implicit.** `.todo`
- **What:** The synthesis asserts "Card mode exclusion is implicit. `.todo-list` selector doesn't match in card mode (TodoCardSection uses its own classes), so leaving `data-staggered` on the tabpanel is harmless." This is factually wrong: `TodoCardSection.tsx:175` renders `<ul className="todo-list card-fallback-list">`. The card-mode fallback `<ul>` carries the `.todo-list` class verbatim and is rendered inside the same tabpanel that receives `data-staggered`.
- **Why it matters:** Synthesis statements are load-bearing for future contributors. A false assertion here means the next person doing card-mode work will assume isolation that doesn't exist. M3 is the user-visible consequence; this finding is the documentation root cause.
- **Proposed fix:** Update `synthesis.md:52` to say: "Card mode partially matches: `TodoCardSection`'s narrow-viewport fallback `<ul>` is `.todo-list card-fallback-list` and lives inside the Today/LongTerm tabpanel. At <600 px in card mode, those `<li>`s match the selector but have no `--stagger-idx` (all delay=0). Selector should be scoped to `.todo-list:not(.card-fallback-list)` if a clean exclusion is intended." Pair with the M3 fix.
- **Regression-guard:** N/A (documentation correction).
- **Source critic:** milestone-adversary-critic
- **Source axis:** Axis 12 (doc drift)

### LOW

#### [LOW] L1 — `staggeredTab` initial value duplicates `tab` initial value as a hard-coded `"today"`

- **File:** `src/newtab/App.tsx`
- **Line:** 314, 321
- **Anchor:** `const [staggeredTab, setStaggeredTab] = useS`
- **What:** Both `useState<Tab>("today")` (line 314) and `useState<Tab | null>("today")` (line 321) hard-code `"today"` independently. If the initial-tab default ever changes (e.g., to honor a stored last-active-tab from `chrome.storage.local`), the stagger seed will silently fall out of sync.
- **Why it matters:** Small DRY violation. Bug surface is narrow (initial paint stagger plays on the wrong tab → no visible bug, just no first-paint cascade) but the coupling is invisible.
- **Proposed fix:** Either share the constant — `const INITIAL_TAB: Tab = "today";` at module scope, used in both `useState` calls — OR seed `staggeredTab` from the `tab` state itself via `useState<Tab | null>(tab)` at the call-site (works because `tab` was just declared above and `useState`'s initial value is evaluated at mount). Either is one-line.
- **Regression-guard:** N/A.
- **Source critic:** milestone-adversary-critic
- **Source axis:** Axis 4 (strict-TS / code-quality)

#### [LOW] L2 — `scrollbar-width: thin` is universal — desktop users see a thin scrollbar slot when tabs don't overflow

- **File:** `src/newtab/App.css`
- **Line:** 101
- **Anchor:** `scrollbar-width: thin;`
- **What:** `.tabs { scrollbar-width: thin; }` applies at all viewport widths. The synthesis §3.5 explicitly chose universal-on; this finding is a UX deferral, not a bug.
- **Why it matters:** On Firefox-based browsers, `scrollbar-width: thin` reserves layout space for the scrollbar even when not actively overflowing (Chromium auto-hides). At >1024 px the tab row never overflows, so on Firefox-likes the slot is harmless but visible. Worth tracking.
- **Proposed fix:** Defer. If a user complains, wrap in `@media (max-width: 599px) { .tabs { scrollbar-width: thin; } }`. Not needed today.
- **Regression-guard:** N/A.
- **Source critic:** milestone-adversary-critic
- **Source axis:** m5-specific axis "scrollbar-width: thin at desktop widths"

---

## What was done well

1. **Build verifies clean and matches implementer's claim to the byte.** Independent `npm run build` returned `dist/assets/index.html-BwgsDy2E.js   234.53 kB │ gzip:  75.15 kB`, exactly the +0.51 kB delta from m3's 234.02 kB baseline. The build artifact is reproducible and the bundle accounting is trustworthy.
2. **`useRef` + `clearTimeout` cancellation is correct.** The `useEffect` cleans up pending timeouts both on rapid tab change (the `if (staggerTimeoutRef.current !== undefined)` guard at line 331) AND on unmount (the returned cleanup function at lines 340-345). Functional setter `setStaggeredTab((current) => current === tab ? null : current)` guards against the timeout clearing a newer tab's stagger.
3. **`Math.min(idx, 9)` cap correctly enforced at the call site** (TodoItem.tsx:55), with both a code comment and a `CSSProperties` type cast that's justified inline ("React's type signature doesn't include CSS custom properties") — no `// @ts-ignore` and no naked `any`.
4. **Dual-guard reduced-motion mirroring the established pattern.** `sections.css:288-294` carries both `[data-reduced-motion="true"]` and `@media (prefers-reduced-motion: reduce)` blocks, matching the `.closed-scope-counter` block at lines 234-252 — and the global `theme.css:153-171` reset is the load-bearing one, so this is correctly belt-and-suspenders rather than the primary defense.
5. **Clamp calibration is mathematically correct.** `clamp(28px, 6vw, 56px)` gives a 2.0 ratio (MDN's 200%-zoom guideline), with the active scaling band between 467 px (28/0.06) and 933 px (56/0.06) — matches the synthesis's worked example.
6. **Optional `index` prop with `index?: number | undefined`** plays correctly with `exactOptionalPropertyTypes: true` — explicit `| undefined` in the type means `index={undefined}` and `index` omitted are both valid, and the runtime guard at TodoItem.tsx:54 (`index !== undefined`) suppresses the empty-style emission cleanly.
7. **`data-staggered` only applied to Today/Sprint/LongTerm tabpanels**, not Gantt/Reminders/Calendar/Closed. The implementer's note in implement/synthesis §2.2 ("setting the attribute would be a no-op but also misleads readers about intent") is the right call — intent-mapping is preserved.
8. **No new dependencies, no chrome.storage delta, no manifest/permission change, no service-worker touch.** All risk axes that could turn a pure-UI commit into a footgun were avoided. The implementer correctly identified this as a Path-a pure-CSS solution.
9. **`hidden=true` correctly co-exists with `data-staggered`.** When a hidden tabpanel still carries `data-staggered` (during the 250 ms window before the timeout clears), `hidden`'s `display:none` suppresses the animation visually — no flash-of-content concern.
10. **Co-author trailer present on both commits**, signing chain unbroken, no `--no-verify`, no `--amend` on pushed commits. The git hygiene is clean.

---

## Recommended rectification order

1. **M3** — scope the selector to `.todo-list:not(.card-fallback-list)` OR pass `index={idx}` from TodoCardSection (one-line fix; resolves the user-visible card-mode-at-narrow-viewport inconsistency).
2. **M5** — update synthesis.md §3.6 to reflect the actual card-mode behavior (cheap doc fix, blocks future contributors from inheriting the false assumption).
3. **M4** — add a `/* known: also matches archived-sprint <ul>s */` comment near `sections.css:278` (or pass `index={idx}` from SprintManager.tsx:610).
4. **M1** — note the `motion` scope drift in rect summary; user decides whether to backfill CLAUDE.md's scope list.
5. **M2** — note the 52-char subject in rect summary; tighten the next sibling-commit's subject form.
6. **L1, L2** — defer unless touching the area for an unrelated reason.

---

## Phase 4 status

_Left blank — orchestrator fills at rectify time._
