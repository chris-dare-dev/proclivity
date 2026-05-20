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
