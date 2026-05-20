# Implement synthesis — frontend-uplift-2026q2-m2 (RETRY)

**Milestone:** Motion-library foundation (UPL-1)
**Path:** inline (3 files touched, ~30 LOC)
**Base SHA:** `55d81ac` (post chunk-budget raise)
**Implement commit:** `2c38371` — `feat(build): adopt motion library lazy (m2)`
**Retry context:** Initial m2 attempt aborted with scope-exceeded (chunk 232 kB exceeded the old 220 kB hard ceiling). After CLAUDE.md policy change to 400/500 kB on 2026-05-20 (commit 55d81ac), the same implementation pattern now lands safely.

---

## Files changed

| File | +/− | Summary |
|---|---|---|
| `package.json` | +1 / 0 | Added `motion@^12.39.0` to dependencies |
| `package-lock.json` | +69 / 0 | npm regen for motion + 22 transitive deps |
| `src/newtab/App.tsx` | +22 / 2 | Added `LazyMotion` import + `loadDomAnimation` arrow + wrapped root JSX in `<LazyMotion features={...} strict>` (replaces the outer fragment) |
| `src/newtab/motion-features.ts` | +11 / 0 | NEW — re-exports `domAnimation` as default. The chunk-split forcing module per the synthesis §3 pattern |

---

## Bundle measurement

| Build | Initial chunk | Motion-features chunk | vs new 500 kB hard ceiling |
|---|---|---|---|
| Baseline (post-m1, pre-m2) | 203.65 kB | — | ✓ 296 kB under |
| **Post-m2 (this commit)** | **232.09 kB** | **41.10 kB (deferred)** | **✓ 268 kB under (substantial headroom)** |
| Delta | +28.44 kB sync | +41.10 kB lazy | — |

The `motion-features-*.js` chunk is **NOT** in the modulepreload list of the built `dist/src/newtab/index.html` — verified directly. It loads only when a `m.*` consumer actually renders, which is never in this milestone (the foundation lands without any motion consumers; downstream milestones will add them).

---

## Story acceptance

- **s3** (record baseline) — recorded inline in research synthesis §5 + this synthesis. 203,650 bytes / 203.65 kB.
- **s4** (add motion + wrap App in `<LazyMotion>`) — done. `package.json` has motion@12.39.0; `App.tsx` wraps the root JSX. `strict` enforced for downstream consumers.
- **s5** (verify chunk under ceiling) — done **under the corrected reading** (delta gate per synthesis §6; CLAUDE.md hard ceiling at 500 kB after commit 55d81ac). 232.09 kB << 500 kB. Delta +28.44 kB (5.7× the originally-expected ~5 kB, due to motion v12's heavier `LazyMotion` runtime — a known v12-vs-older-docs discrepancy documented in the scope-exceeded post-mortem).

---

## Check matrix

| Gate | Result |
|---|---|
| `npm run build` (tsc -b + vite build) | ✓ pass — zero TS errors |
| Initial newtab chunk size | 232.09 kB (under new 400 kB warn, 500 kB hard ceiling) |
| `git status --porcelain` post-commit | ✓ clean (only m2 state audit.jsonl shows untracked) |
| `package(-lock).json` changed → npm ci verified | ✓ |
| `.github/workflows/*` touched | ✗ no — workflow lint skipped |
| Motion-features chunk split off main | ✓ — separate 41.10 kB chunk, not in modulepreload |

---

## What ships in this commit

- `motion` runtime is installed and the `<LazyMotion>` provider is mounted at the App root
- The `strict` mode is enforced — any future `motion.*` (non-`m.*`) import will throw at dev time
- Zero behavioral change at runtime: no animations are wired yet. The foundation is in place; m4/m5 and subsequent milestones now have access to `import { m } from "motion/react"` and `<AnimatePresence>` / `useReducedMotion()` / `motion.div` (with strict-mode caveat) for actual animation work

---

## What does NOT ship

- No motion consumers (no `m.div` usages in app code)
- No `useReducedMotion()` integration with the existing `data-reduced-motion` attribute — that's a m4 design choice
- No `AnimatePresence` wrapper around modals — that's the m2-follow-on UPL-2 (section-fade) and UPL-4 (modal scale-in) milestones

---

## external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

(`npm install motion` already executed locally as part of the implementation work; the only remaining external write is the push.)
