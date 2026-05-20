### `frontend-uplift-2026q2-m3` — Icon-system adoption (UPL-8 + UPL-21 partial + UPL-22)

**Stories:**

**`frontend-uplift-2026q2-e1-s6` — Install `lucide-react` and replace all Unicode icon characters with named Lucide imports** (M)

Given `lucide-react` is not yet in `package.json` and the codebase contains Unicode icons (`✎`, `✕`, `→`, `▾`, `▸`) and ad-hoc inline SVGs across section components
When the developer runs `npm install lucide-react`, searches for all Unicode icon usages and inline SVG elements, and replaces each with the corresponding named import (e.g. `import { Pencil, X, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'`)
Then every Unicode character and ad-hoc inline SVG in the newtab UI is replaced by a named Lucide component; `npm run build` passes with zero TypeScript strict errors; named-import pattern is used throughout (no default barrel import)

Specialist: Bundle-budget reviewer — verify tree-shaking produces ≤6 KB gz total for all ~12 icons via `vite build --report`; if a barrel import accidentally inflates the chunk, switch each usage to the explicit named path

**`frontend-uplift-2026q2-e1-s7` — Apply hex-to-token substitutions in icon-touched files (UPL-21 partial)** (S)

Given `lucide-react` icons are in place and the icon-replacement pass has touched specific component files
When the developer scans only the files modified in s6 for hardcoded hex values (`#0b0e14`, etc.) that should instead use `var(--bg)`, `var(--panel)`, `var(--text-dim)`, or other established tokens
Then all hardcoded hex values in those files are replaced with the matching CSS custom-property reference; no new hardcoded hex values are introduced; `npm run build` passes clean

Specialist: Bundle-budget reviewer — this is a CSS-token substitution only; bundle delta must be zero

**`frontend-uplift-2026q2-e1-s8` — Add `@media (prefers-reduced-motion: reduce)` guards at all unguarded motion sites (UPL-22)** (S)

Given approximately 5 motion sites lack the canonical dual-guard convention: sprint progress fill, QuickPrompt banner, MeshBackground fade-in, settings-badge-pulse, and any others identified during the search
When the developer searches for CSS `animation` and `transition` declarations in `src/styles/` and component files, identifies those missing either `@media (prefers-reduced-motion: reduce) { ... }` or `[data-reduced-motion="true"] { ... }`, and adds the missing guard to each site
Then every motion declaration in the codebase carries both a `prefers-reduced-motion` media query guard and a `[data-reduced-motion]` attribute guard; `npm run build` passes with zero TypeScript strict errors; no animation fires in a test with `prefers-reduced-motion: reduce` forced via DevTools

Specialist: A11y reviewer — verify with axe-core and DevTools forced reduced-motion mode that no animation or transition fires under `prefers-reduced-motion: reduce`; the dual-guard pattern (media query + data attribute) must be present at every site, not just the media query alone

---
