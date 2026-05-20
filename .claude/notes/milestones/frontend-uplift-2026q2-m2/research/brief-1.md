---
milestone_id: "frontend-uplift-2026q2-m2"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://motion.dev/docs/react-lazy-motion"
    sha256: "0000000000000000000000000000000000000000000000000000000000000000"
    takeaway: "LazyMotion accepts a features prop (async or sync) and a strict prop; m.* components must be used inside it instead of motion.* to preserve bundle splitting"
  - url: "https://raw.githubusercontent.com/motiondivision/motion/main/packages/motion/package.json"
    sha256: "ed2e33d9e72fafceb71ffa01f940ec64053153febc3ab2eebfe190b8a9b9adf6"
    takeaway: "motion@12.39.0 is MIT licensed — no manifest permission requirements for a Chrome extension"
injection_attempts: 0
---

# Codebase Context Brief — frontend-uplift-2026q2-m2

## 1. External sources consulted

- **URL:** https://motion.dev/docs/react-lazy-motion
  **SHA256:** `0000000000000000000000000000000000000000000000000000000000000000` (403 blocked on raw fetch; content retrieved via WebFetch)
  **Takeaway:** `LazyMotion` wraps the tree; `features` prop accepts a promise-returning loader for async code-split; `strict` prop throws if a `motion.*` component renders inside (enforces that only `m.*` is used). The async pattern is `features={() => import('motion/react').then(r => r.domAnimation)}`.

- **URL:** https://raw.githubusercontent.com/motiondivision/motion/main/packages/motion/package.json
  **SHA256:** `ed2e33d9e72fafceb71ffa01f940ec64053153febc3ab2eebfe190b8a9b9adf6`
  **Takeaway:** `motion@12.39.0` declares `"license": "MIT"`. No binary native addons, no server-side calls. No Chrome extension `manifest_permissions` required.

## 2. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

## 3. App.tsx — structure inventory

**File:** `src/newtab/App.tsx`

### Top-level JSX root (line 363–518)

The `export default function App()` returns a React Fragment (`<>…</>`):

```
<>                                          ← line 364 — THE JSX ROOT
  {rs.meshEnabled && (
    <Suspense fallback={null}>
      <MeshBackground … />                  ← lazy, line 65–67
    </Suspense>
  )}
  <div className="app">                     ← line 373
    <Header />                              ← memo component, line 145
    <Suspense fallback={null}>
      <QuickPrompt />                       ← lazy, line 81–83
    </Suspense>
    {rs.sectionVisibility.photos && (
      <Suspense fallback={null}>
        <Photos />                          ← lazy, line 101
      </Suspense>
    )}
    <nav className="tabs" …>…</nav>
    <main className="content">…</main>
  </div>
</>
```

**`<LazyMotion>` insertion point:** The Fragment (`<>`) at line 364 is the outermost
element. `<LazyMotion>` must wrap the entire Fragment to make `m.*` components available
anywhere in the tree — including lazy-loaded chunks. The canonical insertion is:

```tsx
// Before (line 363-364):
return (
  <>

// After:
return (
  <LazyMotion features={() => import('motion/react').then(r => r.domAnimation)} strict>
```

and close `</LazyMotion>` before line 518's `</>`. This is a 2-line change in App.tsx
plus the import line = ~3 lines total in that file.

### Existing providers/wrappers already in App.tsx

| Wrapper | Location | Notes |
|---|---|---|
| React Fragment `<>` | line 363 outermost | no StrictMode wrapper at this level |
| `Suspense fallback={null}` | lines 239, 261, 366, 380, 389, 476, 505 | 7 Suspense boundaries already in use |
| `memo(Header)` | line 145 | sub-component only |

There is no `StrictMode`, `ErrorBoundary`, or `React.StrictMode` wrapper at the App
level. `LazyMotion` slots in cleanly at the outermost level.

## 4. motion / framer-motion usage scan

```
grep -rn "framer-motion|from 'motion|from \"motion" src/  → 0 results
grep -rn "motion\." src/ (filtered for package usage) → 0 results
```

**Result: zero existing motion.* usage stubs.** The word "motion" appears only in:
- `rs.reducedMotion` — the user-settings boolean (not the library)
- `data-reduced-motion` — the HTML data attribute set by `useThemeSync`
- `MeshBackground.tsx:220` — `effectiveReduced = reducedMotion || osReducedMotion` (local prop)

No migration of existing `motion.*` to `m.*` is required. Story s4's "replace any
existing `motion.*` usage stubs with `m.*`" is a no-op for this codebase.

## 5. package.json — motion dependency check

**File:** `package.json`

`dependencies` block (lines 13–18):
```json
"@react-three/fiber": "^8.18.0",
"react": "^18.3.1",
"react-dom": "^18.3.1",
"three": "^0.169.0"
```

`devDependencies` block (lines 19–29): no `motion` entry.

**Confirmed: `motion` is NOT present in package.json.** Story s3's pre-measurement
gate is valid and safe to proceed from.

## 6. vite.config.ts — chunk-splitting audit

**File:** `vite.config.ts`

```typescript
build: {
  target: "esnext",
  sourcemap: true,
  chunkSizeWarningLimit: 1000,
}
```

**No manual `rollupOptions.output.manualChunks` configuration.** Vite's default
code-splitting applies. Key observations:

- No explicit `external` list that would conflict with motion's lazy loader.
- No `optimizeDeps.include/exclude` entries that would force motion into the initial chunk.
- `target: "esnext"` is compatible with motion's ESM exports.
- `@crxjs/vite-plugin` wraps Rollup under the hood — the plugin overrides Rollup to
  `^2.80.0` via `overrides` in package.json. This is a Rollup v2 constraint. Motion
  12.x ships standard ESM; no Rollup v2 incompatibility is expected for dynamic
  `import()` boundaries.

**No vite config changes are required for this milestone.**

## 7. Existing lazy-import pattern (MeshBackground convention)

**File:** `src/newtab/App.tsx`, lines 65–67

```typescript
// Three.js is ~800kB minified — keep it out of the initial chunk so the
// planner UI renders without waiting on it. The mesh fades in once loaded.
const MeshBackground = lazy(() =>
  import("@/components/MeshBackground").then((m) => ({ default: m.MeshBackground })),
);
```

The `<LazyMotion>` features loader must follow the same `.then(r => r.domAnimation)`
pattern. The implementer should match the code style (arrow function, inline comment
explaining the deferral reason). The async form is:

```typescript
features={() => import('motion/react').then(r => r.domAnimation)}
```

This is equivalent in split behavior to the MeshBackground pattern — the dynamic
`import()` is the chunk boundary that keeps the library out of the synchronous chunk.

## 8. Baseline chunk size

**Confirmed from dist/assets (build timestamp: 2026-05-20 12:43):**

| Artifact | Bytes | KB |
|---|---|---|
| `index.html-CWDHtu93.js` (newtab initial JS chunk) | 203,650 | **198.88 KB** |
| `index-BC0QUXAd.css` (newtab initial CSS) | 28,215 | 27.56 KB |

The brief states "203.65 KB after m1" — this aligns with the measured 203,650 bytes
(the KB value in the brief was using 1000-byte KB, not 1024; either convention is
consistent). **The baseline for s3 is 198.88 KB (binary KB) / 203.65 KB (decimal KB).**

The story s5 ceiling is 200 KB. The brief uses decimal KB (203.65 KB = 200 kB decimal
ceiling check). The implementer should clarify which convention Rollup's report uses —
Rollup reports in **kB (decimal, 1000 bytes)**, so the 200 kB ceiling is against the
Rollup-reported number. At 203.65 kB the current build is already AT the boundary
before motion is added. The expected delta of ~4.6 kB would push to ~208 kB.

**This is a risk item** — see Section 10.

## 9. TypeScript strict-mode compatibility

**File:** `tsconfig.json`

Active strict flags that could create motion-types friction:
- `"strict": true` — enables strictNullChecks, strictFunctionTypes, etc.
- `"exactOptionalPropertyTypes": true` — optional props must not pass `undefined` explicitly
- `"noUncheckedIndexedAccess": true` — array/object index returns `T | undefined`
- `"noUnusedLocals": true` + `"noUnusedParameters": true` — will error if `m` is imported but unused

**LazyMotion props type surface:**
- `features` prop is `() => Promise<MotionFeatures>` (async form). TypeScript will infer
  this correctly from `() => import('motion/react').then(r => r.domAnimation)`.
- `strict` prop is `boolean | undefined`. With `exactOptionalPropertyTypes: true`, passing
  `strict` (no value) is fine; passing `strict={undefined}` would be an error — do not
  do that.
- The `m` export from `motion/react` is the lightweight component factory. It is not
  used in App.tsx itself (only in future child components) — which means importing `m`
  in App.tsx will trigger `noUnusedLocals`. **Do not import `m` in App.tsx.** Import
  only `{ LazyMotion }`.

**Friction summary:** No friction on `LazyMotion` itself. The `m` import must only
appear in component files that actually use animated elements — not in App.tsx.

## 10. Reduced-motion guard — conflict analysis

**Architecture:** Proclivity uses a `data-reduced-motion="true"` attribute on `<html>`,
set by `useThemeSync` (src/hooks/useThemeSync.ts lines 44–51 and 87–96). It reads
both `rs.reducedMotion` (user toggle) and OS `prefers-reduced-motion`.

**Motion library's `useReducedMotion()`:** The `motion` library exports its own
`useReducedMotion()` hook that also reads `prefers-reduced-motion`. If future
`m.*` components call `useReducedMotion()` from `motion/react`, that hook reads
the OS media query directly — it does NOT read Proclivity's `data-reduced-motion`
attribute.

**Potential conflict:** A user could have `reducedMotion: false` in Proclivity settings
but an OS `prefers-reduced-motion: reduce` setting. In that case:
- `useThemeSync` would set `data-reduced-motion="true"` (OS wins, line 47: `rs.reducedMotion || osReducedMotion`)
- Motion's `useReducedMotion()` would also return `true` (OS wins)
- **No conflict in this case** — both systems agree.

Conversely, if `reducedMotion: true` in Proclivity settings but OS is not set:
- `data-reduced-motion="true"` is set
- Motion's `useReducedMotion()` returns `false` (it only sees OS, not Proclivity toggle)
- **Conflict:** CSS animations are disabled, but `m.*` Spring/tween would still run.

**Recommendation for implementer:** When using `m.*` in future components (not this
milestone), prefer reading `rs.reducedMotion` from `useStore()` or checking
`document.documentElement.dataset.reducedMotion === 'true'` rather than calling
`useReducedMotion()` from motion. This is a **deferred risk** for post-m2 work —
this milestone only installs the LazyMotion wrapper, not any animated components.
For m2 itself (wrapper installation only), no conflict arises.

## 11. Pre-computed implementation scope (LOC estimate)

**Files to touch:**

| File | Change | Est. LOC delta |
|---|---|---|
| `package.json` | Add `"motion": "^12.x"` to dependencies | +1 |
| `src/newtab/App.tsx` | Add `import { LazyMotion } from 'motion/react'` at top | +1 |
| `src/newtab/App.tsx` | Wrap Fragment return with `<LazyMotion features={…} strict>` | +3 (open tag on its own line with comment, close tag) |

**Total:** ~5 lines changed across 2 files. The `npm install motion` step modifies
`package-lock.json` (not a hand-authored LOC).

The brief's estimate of "~10-15 lines" appears to have assumed more ceremony; the
actual implementation is closer to 5 lines of hand-authored code.

## 12. Riskiest assumption + alternative

The riskiest assumption is that the initial newtab chunk will stay under the 200 kB
ceiling after adding `<LazyMotion>`. The current dist artifact measures 198.88 KB
(binary) / 203.65 kB (decimal Rollup output), which is already above 200 kB in
Rollup's own decimal reporting. Story s5 says: "if the chunk exceeds 200 KB the
`motion` dependency is removed." The `<LazyMotion>` component itself is the
synchronous part of the motion package; its own overhead is documented as
"as low as 4.6 KB" for the features bundle (async, deferred), but the `LazyMotion`
component wrapper itself adds a small synchronous cost (~0.5–1 kB minified+gzip
for the component shell). If that pushes the Rollup report from 203.65 kB to
208+ kB, s5's abort condition fires.

**Alternative path if s5 fires:** Re-export a custom wrapper component from a
separate lazy-loaded chunk (e.g., `src/components/AnimationProvider.tsx`) that itself
contains the `<LazyMotion>` and is loaded via `React.lazy`. This adds one extra async
boundary but means zero synchronous cost in the initial chunk. Tradeoff: animated
components appear only after two async boundaries resolve.

## 13. Acceptance criteria the implementer must meet

1. Run `npm run build` with the current `package.json` (no `motion`) and record the
   Rollup-reported initial newtab chunk size in kB as the s3 baseline (expected: ~203.65 kB decimal).
2. Run `npm install motion` and confirm `motion` appears in `package.json` dependencies.
3. Add `import { LazyMotion } from 'motion/react'` to `src/newtab/App.tsx` — do NOT
   import `m` or `domAnimation` in App.tsx (unused-locals error).
4. Wrap the App return's outermost Fragment with `<LazyMotion features={() => import('motion/react').then(r => r.domAnimation)} strict>` and close before the closing `</>`.
5. Run `npm run build` (= `tsc -b && vite build`) and confirm zero TypeScript errors.
6. Verify in the Rollup report that no `motion` symbols appear in the initial
   `index.html-*.js` chunk (they must appear only in a separate async chunk).
7. If the post-install initial chunk exceeds 200 kB (Rollup decimal), execute the
   abort protocol from s5: remove `motion`, revert App.tsx, and file a spike note
   before committing.
