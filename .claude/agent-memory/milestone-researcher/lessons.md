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
