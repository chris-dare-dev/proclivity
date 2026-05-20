# milestone-adversary-critic lessons

This file is an **append-only log**. Each entry records what was learned during a single
Phase 3 adversarial critique. Never delete or rewrite previous entries. To correct a
prior entry, append a new one that references the old timestamp.

Entry format (defined in `.claude/agents/milestone-adversary-critic.md` § Memory protocol):

```
## <ISO-8601 UTC timestamp> · milestone:<id> · status:<status>
- **Bottleneck observed:** ...
- **What worked:** ...
- **What didn't:** ...
- **Reusable lesson:** ...
```

---

<!-- Entries will be appended below this line by the milestone-adversary-critic agent. -->

## 2026-05-20T18:47:00Z · milestone:frontend-uplift-2026q2-m3 · status:complete
- **Bottleneck observed:** Hex/rgba-to-CSS-token swaps that assume one theme silently regress in the other. `rgba(0,0,0,X)` → `color-mix(in srgb, var(--bg) X%, transparent)` works in dark theme (where `--bg` is near-black) but inverts in light (where `--bg` is near-white). Foreground-derived (`--text`-mix) overlays are theme-invariant; background-derived overlays are not.
- **What worked:** Independent `npm run build` re-run inside the critic verified the implementer's 234.02 kB claim — caught nothing wrong but gave high-confidence anchor for the verdict. Cross-checking the implementer's "fully uncovered files" list against actual `grep prefers-reduced-motion src/**/*.css` output caught two false positives (sections.css + ClosedTodosView.css both ALREADY had per-site guards), which propagated into a doc-drift finding in theme.css.
- **What didn't:** Initially trusted the research synthesis's enumeration of "fully-uncovered" vs "asymmetric" CSS files without re-grepping. The synthesis classification was wrong on 2 of 9 files — and the implementer carried that error forward verbatim.
- **Reusable lesson:** When critic-ing a milestone whose research synthesis enumerates files into pre-baked buckets ("uncovered," "asymmetric," "fully-guarded"), independently re-derive the bucketing via grep before judging fit. Synthesis classification is a hypothesis to verify, not a fact. Also: any hex→token swap that touches a value whose semantic role depends on a fixed luminance direction (shadows, dim-tints, darken-overlays) needs explicit theme-symmetry inspection — prefer `--text`-derived overlays over `--bg`-derived when the goal is "always darken" or "always lighten relative to the content."

## 2026-05-20T22:00:00Z · milestone:frontend-uplift-2026q2-m5 · status:complete
- **Bottleneck observed:** CSS selectors keyed on a class name (`[data-staggered] .todo-list li`) silently fan out to every `<ul>` that carries that class within the scoped subtree — including `card-fallback-list` and `ArchivedSprintRow` `<ul>`s. The synthesis asserted "card mode exclusion is implicit" but `TodoCardSection.tsx:175` renders `<ul className="todo-list card-fallback-list">`, so the exclusion was illusory. The selector matched but the call site didn't pass `index={idx}`, producing a silent visual degradation (all rows animate with delay=0) rather than a build failure.
- **What worked:** [CONFIRMED] Independent `npm run build` to verify the implementer's chunk-size claim — saved 30s and gave high-confidence anchor for the verdict. Grep'ing `todo-list` across `src/**` to enumerate every `<ul>` that carries the class — that's how the card-mode + archived-sprint matches surfaced. Reading both the synthesis AND the implement/synthesis to compare claimed vs actual coverage.
- **What didn't:** Initially trusted the synthesis's §3.6 card-mode-exclusion claim. Had to re-grep `todo-list` across the codebase to discover it was wrong. Same lesson as m3 confirmed: synthesis classifications are hypotheses to verify.
- **Reusable lesson:** For any milestone that introduces a `[data-X="true"] .someClass <elem>` style selector, enumerate every `<ul>`/`<li>` (or relevant tag) carrying `.someClass` via repo-wide grep BEFORE judging whether scope/exclusion claims hold. The class is the selector's surface area; React composability means the same class can appear in unexpected subtrees. Also: commit-subject length ≤50 after the prefix is a hard CLAUDE.md rule — measure with `printf '%s' "..." | wc -c`, not by eyeball; off-by-2 is the most common drift.
