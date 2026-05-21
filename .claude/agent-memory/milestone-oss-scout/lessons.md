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

## 2026-05-20 — frontend-uplift-2026q2-m11
- **Bottleneck observed:** npm's semver resolution placed nested copies of `@radix-ui/react-primitive` (2.1.3 under 4 packages) and `@radix-ui/react-slot` (1.2.4 under react-primitive) alongside their top-level peers; Vite bundles each unique realpath separately, confirmed via the `.js.map` source list. Source map analysis (`sources` array in the `.map` file) is the authoritative way to detect Vite module duplication — faster than diffing bundle output.
- **What worked:** `node -e "require('./package-lock.json').packages"` combined with `Object.keys().filter()` gave a complete, verified license table in one pass. `npm audit` returned clean in <2s. Diff of `dist/index.mjs` files directly confirmed whether two version-pinned copies were byte-for-byte identical.
- **What didn't:** `npm ls --all cmdk` showed only the root package (node_modules not fully installed for sub-trees). Always use lockfile JSON directly or inspect `node_modules/<pkg>/node_modules/` to find nested version conflicts.
- **Reusable lesson:** For any dep that introduces a Radix UI stack, run `Object.keys(lock.packages).filter(k => k.includes('/node_modules/@radix-ui'))` to detect nested version duplication early; if found, recommend `resolve.dedupe` in `vite.config.ts` and validate via source map `sources` array after rebuild.

## 2026-05-20 — frontend-uplift-2026q2-m10
- **Bottleneck observed:** Brief-2 claimed `isMacOS()` was exported from `react-hotkeys-hook` — it is NOT in `index.d.ts` or the public API of v5.3.2. Always verify public exports from the installed `dist/index.d.ts`, not from GitHub source files (internal helpers are NOT automatically exported).
- **What worked:** `typeof document < "u"` guards in the dist bundle confirmed MV3 service-worker safety without needing to read the full source; grep for `eval` + `Function(` in dist is a fast CSP check. GitHub Releases API (`gh api repos/<owner>/<name>/releases`) gives exact release timestamps and total counts — use this instead of trying to parse npmjs.com timestamps.
- **What didn't:** Bundlephobia WebFetch still returns intro copy only, not numeric size data (confirmed again — same failure as m3). The registry.npmjs.org/<name>/<version> JSON endpoint remains the gold standard for license + integrity + deps.
- **Reusable lesson:** When a brief claims a library exports a specific helper function, verify by reading the installed `packages/<inner>/dist/index.d.ts` — npm-published packages may have a different export surface than the GitHub source tree (monorepo inner packages sometimes have a separate `package.json` with its own `exports` map that doesn't re-export internal utilities).

## 2026-05-20 — frontend-uplift-2026q2-m3
- **Bottleneck observed:** npmjs.com /package/<name> returns 403 to WebFetch; use the registry API at registry.npmjs.org/<name>/<version> instead for license, integrity, sideEffects, and peerDependency data.
- **What worked:** registry.npmjs.org JSON endpoint reliably returned license, integrity sha512, sideEffects, and peerDependencies in a single fetch with no auth required.
- **What didn't:** Bundlephobia WebFetch returned only the intro page copy, not actual size numbers — treat bundlephobia as a fallback signal only; prefer smoke-build measurements (which the implementer already did: +1.75 kB for 2 icons).
- **Reusable lesson:** For pure SVG-as-React-component icon libraries (lucide-react, @tabler/icons-react), zero transitive dependencies is the norm — confirm by checking `node_modules/<name>.dependencies` in lockfile, not by assuming. A zero-dep entry is a strong positive supply-chain signal worth calling out explicitly in the OSS table.

## 2026-05-20 — frontend-uplift-2026q2-m2
- **Bottleneck observed:** motion.dev docs ("~4.6 kB synchronous" for LazyMotion) understated motion v12 sync cost by ~6×; actual Rollup-measured delta was +28.44 kB.
- **Lesson:** For any motion-family library adoption, treat published bundle-size figures as an order-of-magnitude estimate only. Verify with `vite build --report` before/after.
- **For next OSS review:** Default to "expect 5–10× docs estimate" for any animation library's sync provider runtime in v10+ releases. Cross-check with bundlephobia and a real build measurement.
