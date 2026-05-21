# milestone-researcher lessons

This file is an **append-only log**. Each entry records what was learned during a single
Phase 1 research run. Never delete or rewrite previous entries. To correct a prior entry,
append a new one that references the old timestamp.

Entry format (defined in `.claude/agents/milestone-researcher.md` § Memory protocol):

```
## <ISO-8601 UTC timestamp> · milestone:<id> · status:<status>
- **Bottleneck observed:** ...
- **What worked:** ...
- **What didn't:** ...
- **Reusable lesson:** ...
```

---

<!-- Entries will be appended below this line by the milestone-researcher agent. -->

## 2026-05-20T09:00:00Z · milestone:frontend-uplift-2026q2-m8 · status:complete (explore researcher)
- **Bottleneck observed:** Brief said apply `useAutoAnimate` to `ClosedTodosView.tsx`'s list but it uses `.closed-list` not `.todo-list`; separately, ArchivedSprintRow is a sub-component inside SprintManager.tsx requiring its OWN `useAutoAnimate()` call (hooks can't be called inside `.map()` or in a parent for a child). Also: `ClosedTodosView` renders multiple `<ul>` elements (one per recency group) via `.map()` — applying the hook to all groups requires a child component extract.
- **What worked:** Grepping for both `className="todo-list"` and `className="closed-list"` in one pass immediately surfaced the naming discrepancy. Checking each `<ul>` host component to see if it was a sub-component or the root confirmed the ArchivedSprintRow hook-call requirement.
- **What didn't:** n/a — structure was clean once the sub-component nesting was traced.
- **Reusable lesson:** For `useAutoAnimate` briefs that say "apply to X, Y, Z list containers", always grep for the exact class name used in each target file — list containers in the same project often have different class names (`.todo-list` vs `.closed-list`). Also verify whether the `<ul>` lives in a sub-component vs the main component — `useAutoAnimate` is a hook and sub-components need their own call.

## 2026-05-20T08:00:00Z · milestone:frontend-uplift-2026q2-m11 · status:complete (explore researcher)
- **Bottleneck observed:** App.tsx is at `src/newtab/App.tsx` not `src/App.tsx` — the newtab subdir is easy to miss. `setSettingsOpen` is confirmed in `Header()` memo scope (line 183), NOT App() scope; `setHelpOpen` and `setTab` ARE in App() scope (lines 324, 321). The `Tab` type is LOCAL to App.tsx (not in `src/types/index.ts`) — needs export or re-declaration in palette-commands.ts.
- **What worked:** Reading App.tsx top-to-bottom and classifying every useState by which function scope owns it (Header vs App) gave a definitive answer on the settings event vs prop debate without ambiguity.
- **What didn't:** n/a — codebase was clean and the NAV_CLOSED_EVENT precedent was the obvious template.
- **Reusable lesson:** For command-palette milestones where "open settings" is a command, always verify whether settings state lives in App() or in a memo sub-component — if in a sub-component, the custom-event pattern (like NAV_CLOSED_EVENT) is the lowest-diff bridge. Also always check whether the `Tab`/section-id type is exported from App.tsx or only local — palette-commands.ts will need to reference it.

## 2026-05-20T06:30:00Z · milestone:frontend-uplift-2026q2-m11 · status:complete (general/external researcher)
- **Bottleneck observed:** Brief said "4 Radix peer-deps" but cmdk's direct deps are 4 packages that pull in 22 transitive Radix packages (plus react-remove-scroll, tslib, aria-hidden). The "peer-dep" claim is accurate for package.json but misleading for bundle impact. Actual all-in gz: 14.9 kB (not 15-20 kB range).
- **What worked:** Bundlephobia JSON API (`/api/size?package=cmdk`) returned the complete transitive dependency tree with individual approximateSizes — this is the most efficient way to enumerate ALL transitive deps and their weights in one call.
- **What didn't:** Bundlephobia rate-limited individual `/api/size?package=@radix-ui/*` calls; the aggregate cmdk query was sufficient to get all per-package sizes from `dependencySizes[]` in one shot.
- **Reusable lesson:** For "how big is this library" questions, use `https://bundlephobia.com/api/size?package=<name>` (no `@latest` suffix) — the response includes a `dependencySizes[]` array with every transitive dep's approximate minified size and the top-level `gzip` total. One API call gives the full picture. Also: when a new library's "open settings" action targets state inside a memo'd sub-component (not the root App), flag the custom-event vs state-lift architectural decision explicitly — it's always the riskiest assumption for palette milestones.

## 2026-05-20T05:00:00Z · milestone:frontend-uplift-2026q2-m10 · status:complete (explore researcher)
- **Bottleneck observed:** Brief stated "scattered `addEventListener('keydown', ...)` calls" — grep revealed only ONE such call (ChatPanel.tsx:53); all other keyboard handling is JSX `onKeyDown=`. Validating the scope claim early prevented over-migration.
- **What worked:** Classifying every `onKeyDown=` handler by scope (form-input vs widget-internal vs global shortcut) up front made the migration target list unambiguous; only 1 raw listener + 1 Modal.tsx handler (kept) needed analysis.
- **What didn't:** n/a — structure was clean.
- **Reusable lesson:** For "replace ad-hoc keydown listeners" briefs, always grep both `addEventListener.*keydown` AND `onKeyDown=` separately, then classify each JSX handler as form-scoped / widget-internal / global-shortcut — only the last category is a migration target. The raw `addEventListener` count is usually much smaller than the JSX handler count.

## 2026-05-20T03:00:00Z · milestone:frontend-uplift-2026q2-m7 · status:complete (explore researcher)
- **Bottleneck observed:** Both SettingsModal and TodoEditModal delegate entirely to a shared `Modal.tsx` base component — the animation target is `Modal.tsx`, not the leaf components. The `editingTodo &&` guard in TodoList.tsx and SprintManager.tsx outer-gates the Suspense block, which destroys the exit animation window before AnimatePresence can play it.
- **What worked:** Reading `Modal.tsx` first (not the feature modals) revealed the single-site animation target and the `createPortal` + `if (!open) return null` pattern immediately.
- **What didn't:** n/a — structure was clear once the shared-base pattern was identified.
- **Reusable lesson:** For motion AnimatePresence milestones, always check whether the target modal delegates to a shared base component — if so, one change to the base covers all variants. Also check whether callers use `{editingThing && <Modal open={...}/>}` vs `<Modal open={editingThing !== null}/>` — the former breaks exit animations because the outer conditional destroys the component before AnimatePresence can delay the unmount.

## 2026-05-20T00:00:00Z · milestone:frontend-uplift-2026q2-m5 · status:complete
- **Bottleneck observed:** `data-staggered` placement requires understanding that tabpanel `hidden=` is owned by App.tsx, not the section components — sections are always mounted.
- **What worked:** tracing from `Today`/`LongTerm`/`Sprint` through to the `<ul>` and confirming all three render the same `.todo-list` class via `TodoList.tsx` and `SprintManager.tsx`; this made the single CSS selector `[data-staggered="true"] .todo-list li` unambiguous.
- **What didn't:** n/a — codebase was well-structured and easy to trace.
- **Reusable lesson:** For CSS animation briefs, always check whether the `<ul>/<li>` items receive an explicit index prop — in proclivity they do NOT, so `--stagger-idx` must be injected via inline style at the map call-site in the parent, not inside `TodoItem`.

## 2026-05-20T00:10:00Z · milestone:frontend-uplift-2026q2-m5 · status:complete (general/external researcher)
- **Bottleneck observed:** Bundlephobia WebFetch returns an empty page; use the direct JSON API `https://bundlephobia.com/api/size?package=<name>` via curl instead.
- **What worked:** Computing stagger total-sequence duration in Python (last-delay + animation-duration) gives concrete acceptance-criteria numbers ("last item finishes at 715 ms") that are more useful than vague UX prose.
- **What didn't:** caniuse.com WebFetch does not render the data table — use the feature-specific URL (`/css-scrollbar`) and note the global usage % from the page text.
- **Reusable lesson:** For pure-CSS animation milestones, validate clamp() calibration math inline (min crossover, max crossover, 2:1 a11y ratio) and compute stagger total-sequence duration — these concrete numbers are load-bearing for the implementer's acceptance criteria. SHA256s are URL-string hashes, not content hashes.

## 2026-05-20T01:00:00Z · milestone:frontend-uplift-2026q2-m4 · status:complete (explore researcher)
- **Bottleneck observed:** `.content` in App.css has no `position` rule — the `position: absolute; inset: 0` on `[data-leaving]` would escape to `.app` (which already has `position: relative`) if `.content { position: relative }` is not added first.
- **What worked:** Checking all existing `@keyframes` names and `data-*` attributes upfront confirmed zero name collisions for both `tabpanel-fade-in` and `[data-leaving]`.
- **What didn't:** n/a.
- **Reusable lesson:** For absolute-positioning overlays, always verify that the intended CSS stacking parent has `position: relative` — a grandparent with `position: relative` will silently steal the layout context if the direct parent lacks positioning.

## 2026-05-20T01:10:00Z · milestone:frontend-uplift-2026q2-m4 · status:complete (general/external researcher)
- **Bottleneck observed:** MDN View Transitions API page did not render browser compatibility table data — had to rely on Chrome Developers doc for version numbers (Chrome 111+, Firefox 144+, Safari 18+ for same-document).
- **What worked:** Reading App.tsx in full confirmed the `staggeredTab` useLayoutEffect + useRef timeout-cancel pattern is directly reusable for `leavingTab` — prior m5 lesson was confirmed and saved analysis time.
- **What didn't:** n/a — prior explore researcher already caught the `position: relative` gap, validating cross-agent convergence on this class of issue.
- **Reusable lesson:** For cross-dissolve fade briefs, verify whether `animation-fill-mode: both` is specified for the incoming panel's keyframes — without it, the incoming panel flashes at opacity 1 for one frame before the from-state takes hold, which is the primary flash-of-content vector for the incoming side (separate from the leaving-panel FOUC).

## 2026-05-20T02:00:00Z · milestone:frontend-uplift-2026q2-m6 · status:complete (general/external researcher)
- **Bottleneck observed:** The CSS Transitions Level 1 spec (§application) and the CSSWG cascade-5 editor's draft appear to contradict each other on animation vs transition precedence — transitions-1 says animation suppresses transition during runtime; cascade-5 says transitions beat animations. Both are correct but for different temporal windows: transitions-1 applies while the animation is in-flight (transition is not added to cascade), cascade-5 applies to the post-animation state (transition wins once animation ends).
- **What worked:** Reading the existing `sections.css` upfront confirmed the `120ms ease` pattern is already used codebase-wide (`.todo-edit`, `.closed-scope-counter`, scope-option) — this validated the brief's timing without needing external benchmarks.
- **What didn't:** The theme.css path differed from expectation (not `src/theme.css` but `src/styles/theme.css`) — always use `find` to locate CSS files rather than assuming flat structure.
- **Reusable lesson:** For hover-lift CSS milestones, the animation/transition precedence question (stagger vs hover interaction) always arises — cite both transitions-1 §application and cascade-5 §cascade-sort, and resolve the apparent contradiction by noting the two different time windows (in-flight vs post-animation). The answer is always "animation wins during its run, transition wins after."

## 2026-05-20T02:00:00Z · milestone:frontend-uplift-2026q2-m6 · status:complete (explore researcher)
- **Bottleneck observed:** CSS3 animation/transition precedence for same-property (transform) conflict between stagger animation and hover transition — needed to confirm CSS3 §17.4 rule that running animation wins over transition.
- **What worked:** Checking that no `@media (hover: hover) and (pointer: fine)` exists anywhere in src/ upfront — confirmed m6 is the first usage, so the implementer knows to establish the pattern rather than match an existing one.
- **What didn't:** n/a — codebase state was clean and well-documented.
- **Reusable lesson:** For hover-lift briefs where a stagger animation also runs on `transform`, CSS3 guarantees the running animation wins over the hover transition on the same property — no special JS guard or animation-play-state toggling is needed; the cascade handles it.

## 2026-05-20T03:30:00Z · milestone:frontend-uplift-2026q2-m7 · status:complete (general/external researcher)
- **Bottleneck observed:** Existing `Modal.css` had CSS entry animations (`modal-fade-in`, `modal-slide-in`) that would conflict with the incoming `motion` animations — this is a pre-work requirement the brief did not mention; found by reading Modal.css before fetching any external docs.
- **What worked:** Reading the LazyMotion + motion component source directly confirmed the `strict` mode check only fires inside `createMotionComponent`, not inside `AnimatePresence` — no external doc covered this clearly.
- **What didn't:** `motion.dev/docs/react-m-component` returned 404; `motion.dev/docs/react-lazy-motion` and `react-animate-presence` were fetchable but didn't cover the LazyMotion+AnimatePresence interaction — local source inspection was required.
- **Reusable lesson:** For `<AnimatePresence>` milestones on top of an existing Modal: always read the modal's existing CSS first — if CSS keyframe entry animations are already present, they MUST be stripped before motion is added, or both animate simultaneously on mount. `AnimatePresence` itself is NOT subject to LazyMotion `strict` mode — only `motion.*` components are.

## 2026-05-20T05:00:00Z · milestone:frontend-uplift-2026q2-m10 · status:complete (general/external researcher)
- **Bottleneck observed:** Brief said "replace every ad-hoc keydown listener" but Modal.tsx uses `onKeyDown` (not `document.addEventListener`) — conflating the two would break nested-modal Escape behavior; the real migration scope is only `document.addEventListener("keydown", ...)` calls.
- **What worked:** Fetching the raw GitHub source (`parseHotkeys.ts`, `validators.ts`) via `curl https://raw.githubusercontent.com/...` instead of WebFetch resolved the 404 on GitHub blob pages; confirmed `mod` alias is implemented natively in v5 (not via hotkeys-js) and resolves to `metaKey` on macOS and `ctrlKey` elsewhere.
- **What didn't:** WebFetch to `react-hotkeys-hook.vercel.app/docs/documentation/*` returned 404 on most subpaths; the npm registry JSON endpoint and raw GitHub source were more reliable.
- **Reusable lesson:** For `useHotkeys` migration briefs, always grep for `addEventListener.*keydown` AND separately grep `onKeyDown` — only the former are ad-hoc global listeners that should be replaced; React `onKeyDown` props are properly scoped and should NOT be migrated to global useHotkeys calls.

## 2026-05-20T23:00:00Z · milestone:frontend-uplift-2026q2-m8 · status:complete (general/external researcher)
- **Bottleneck observed:** Brief conflated sonner's JS `duration` prop (auto-dismiss timer) with animation duration — instructing `duration={0}` under reduced-motion, which would make toasts instantly unreadable. Sonner's CSS `@media (prefers-reduced-motion)` block independently kills all CSS transitions/animations; the JS duration prop has no effect on animation speed.
- **What worked:** Reading sonner's `styles.css` directly confirmed the native `@media (prefers-reduced-motion)` block at line 704; reading `index.tsx` confirmed `aria-live="polite"` at line 779. No external docs needed — GitHub raw source + bundlephobia JSON API gave complete picture.
- **What didn't:** n/a — both libraries were well-documented in source.
- **Reusable lesson:** For toast library milestones, always distinguish the JS `duration` prop (auto-dismiss timer in ms) from CSS animation duration — they are orthogonal. Setting `duration={0}` collapses the dismiss timer (toast disappears instantly), NOT the animation. If reduced-motion is the goal, check whether the library already ships a CSS `@media (prefers-reduced-motion)` block before wiring any JS `useReducedMotion()` hook.
