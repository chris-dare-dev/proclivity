// Lazy-loaded motion features bundle. This file exists as a separate
// module so Rollup will split it into its own chunk — without the
// indirection, `import("motion/react")` in App.tsx merges back into
// the main chunk because that path is also statically imported for
// `{ LazyMotion }`. See .claude/notes/milestones/frontend-uplift-2026q2-m2/
// research/synthesis.md §3 for the bundle-budget rationale.
//
// Re-exported as default so the dynamic import in App.tsx can write
// `.then(m => m.default)` — a common Vite pattern that pairs cleanly
// with `React.lazy` / `LazyMotion` features loaders.
export { domAnimation as default } from "motion/react";
