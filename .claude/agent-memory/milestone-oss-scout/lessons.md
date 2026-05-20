# milestone-oss-scout lessons

This file is an **append-only log**. Each entry records what was learned during a single
Phase 3 OSS scout run. Never delete or rewrite previous entries. To correct a prior
entry, append a new one that references the old timestamp.

Entry format (defined in `.claude/agents/milestone-oss-scout.md` § Memory protocol):

```
## <ISO-8601 UTC timestamp> · milestone:<id> · status:<status>
- **Bottleneck observed:** ...
- **What worked:** ...
- **What didn't:** ...
- **Reusable lesson:** ...
```

---

<!-- Entries will be appended below this line by the milestone-oss-scout agent. -->

## 2026-05-20 — frontend-uplift-2026q2-m2
- **Bottleneck observed:** motion.dev docs ("~4.6 kB synchronous" for LazyMotion) understated motion v12 sync cost by ~6×; actual Rollup-measured delta was +28.44 kB.
- **Lesson:** For any motion-family library adoption, treat published bundle-size figures as an order-of-magnitude estimate only. Verify with `vite build --report` before/after.
- **For next OSS review:** Default to "expect 5–10× docs estimate" for any animation library's sync provider runtime in v10+ releases. Cross-check with bundlephobia and a real build measurement.
