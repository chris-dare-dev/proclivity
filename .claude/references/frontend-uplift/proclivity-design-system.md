# Proclivity design-system inventory (read this BEFORE proposing changes)

**Purpose:** anchor every proposed upgrade to what Proclivity *actually* has today.  Without this, scouts propose Framer Motion when Proclivity could keep its surface CSS-driven, or propose Tailwind / shadcn when Proclivity has neither installed.

Loaded by **every scout at Phase 1 start** and by the **synthesizer at Phase 2 start**.  Cite specific entries here when surfacing a proposal.

This file is curated by hand from `CLAUDE.md`, `src/styles/theme.css`, and the section components.  When those change, update here.  Drift is expected after milestone deliveries — flag in your brief if you find divergence.

---

## 1. Stack snapshot (verify against `package.json` at Phase 1 read)

| Layer | What | Why it constrains proposals |
|---|---|---|
| Framework | React 18.3 + Vite 7 + TypeScript 5.6 | NOT React 19; some newer libs (e.g. React 19-only Motion features) are out of scope until upgrade |
| Build | `@crxjs/vite-plugin` for MV3 + `tsc -b && vite build` build gate | Initial newtab chunk targets ≤~400 KB; heavier features must `React.lazy + Suspense` |
| Style | Plain CSS / CSS modules + a few `*.css` files per surface | NO Tailwind; NO CSS-in-JS; design tokens are CSS custom properties in `src/styles/theme.css` |
| UI lib | None (custom components in `src/components/`) | NO shadcn; NO Radix; NO Material UI — adding any is a major bundle commitment |
| Charts / canvas | `@react-three/fiber` + `three.js` for the MeshBackground; lazy-loaded | Three.js is intentionally large and already lazy-loaded |
| State | Zero global store; `useStore` hook over `chrome.storage.local` | NO Zustand; NO Redux; NO Jotai — the storage hook IS the global state |
| Data persistence | `chrome.storage.local` (~10 MB cap) | NO IndexedDB by default; adding Dexie / idb-keyval is a major architectural change |
| Icons | None standardized | Section components use inline SVG or none; standardizing an icon library is itself a candidate |
| Motion | None installed | Animation currently lives in raw CSS transitions; adopting a library is a foundational candidate |

## 2. Color tokens (CSS custom properties; defined in `src/styles/theme.css`)

| Category | Variables | Purpose | Reserved? |
|---|---|---|---|
| Surface | `--bg`, `--panel`, `--panel-2` | Background hierarchy | No |
| Border | `--border` | Edge definition | No |
| Text | `--text`, `--text-dim` | Text hierarchy | No |
| Accent | `--accent` (default `#7c9cff`), `--accent-2`, `--accent-on` | Primary accent (user-customizable via settings appearance pane) | The accent value is user-overridable via inline style on `<html>`; don't hardcode color hexes — use the token |
| Status | `--danger`, `--warn`, `--ok` | UI state (error / warning / success) | **YES — reserved for explicit state communication; NEVER use for decorative color** |

**Light / dark themes** are both supported via `theme.css` — every proposal must hold contrast under BOTH themes.

## 3. Spacing / typography (in `src/styles/theme.css`)

| Token | Value | Purpose |
|---|---|---|
| `--space-1` | 4px | Tightest gap (icon padding) |
| `--space-2` | 8px | Default inline gap |
| `--space-3` | 12px | Section internal padding |
| `--space-4` | 16px | Card / pane padding |
| `--space-5` | 20px | Major spacing (section gap) |
| `--row-height` | 44px | Standard row height (todo rows) — load-bearing for keyboard nav |
| `--section-gap` | 20px | Between sections |
| `--panel-pad-y` / `--panel-pad-x` | 16px / 20px | Panel inner padding |
| `--form-gap` | 12px | Default form-control gap |
| `--font-size-base` | 15px | Base body font size |
| `--line-height-base` | 1.5 | Base line height |
| `--radius` | 10px | Card / button border-radius |

**Font:** browser default sans-serif (Proclivity does not bundle a custom font today — proposing one is a non-trivial bundle commitment).

## 4. Component primitives (current inventory)

### Section components (live under `src/sections/`)
- `Today.tsx` — today's plan / quick todos
- `Sprint.tsx` — active sprint with backlog
- `LongTerm.tsx` — long-horizon items
- `Gantt.tsx` — timeline view (lazy-loaded; uses @react-three/fiber)
- `Reminders.tsx` — reminders / alarms list
- `Photos.tsx` — Google Photos integration
- `Calendar.tsx` — calendar view
- `Today.tsx` / `TodoCardSection.tsx` / `TodoList.tsx` — todo list rendering primitives

### Shared components (live under `src/components/`)
- `MeshBackground.tsx` — animated WebGL mesh (lazy)
- `Modal.tsx` — modal primitive (used for settings + TodoEditModal)
- `QuickPrompt.tsx` — quick-create prompt input
- `TodoItem.tsx` — single todo row
- `TodoEditModal.tsx` — todo edit pane
- `TagChip.tsx` , `TagFilterToolbar.tsx`, `TagPickerArea.tsx` — tag primitives
- `ClosedScopeCounter.tsx` — closed-items counter
- `settings/` subtree — Settings modal + panes (general, appearance, notifications, todos, geminiNano, googlePhotos, tags, data, advanced)
- `card/`, `chat/`, `closed/` subtrees — additional groupings

**No shadcn / no Radix / no headlessui.**  Adding any of these is a major commitment — surface as its own candidate with the bundle-size + adoption-pattern argument.

## 5. Accessibility constraints

### Reduced-motion baseline (load-bearing)
`src/newtab/index.css` ships a `@media (prefers-reduced-motion: reduce)` block that suppresses most CSS animation/transition durations.  EVERY new motion proposal must:
- Either rely on transitions / animations that the baseline already overrides
- Or scope new animations inside `@media (prefers-reduced-motion: no-preference)`

### Decorative icon rule
Inline SVGs rendered alongside visible text should carry `aria-hidden="true"` to prevent screen-reader double-announcement.  Icon-only buttons require `aria-label`.

### Focus / keyboard
The 44 px `--row-height` is load-bearing for keyboard navigation in todo lists.  Don't propose shrinking it without a measured accessibility justification.

## 6. Patterns that have already been considered and rejected (DON'T re-propose)

| Pattern | Why rejected |
|---|---|
| Adopting Tailwind CSS | Stack convention is plain CSS + tokens; switching is a major refactor.  Surface only if the synthesis genuinely warrants it. |
| Adopting shadcn/ui | Same as above — pulls in a Tailwind + Radix dependency tree |
| Cross-device sync / hosted endpoint | Local-only is a hard constraint per `CLAUDE.md` |
| Class-based React components | Stack is React 18 functional + hooks |
| Server-side rendering | The "server" is the user's browser; SSR is meaningless |
| Adding non-MIT animation libs as direct deps (e.g. paid GSAP tier) | Adds license complexity to a personal project |
| Confetti / heavy celebratory animation on every todo completion | Tone mismatch — Proclivity is a calm planner, not a gamified to-do app |

## 7. What's UNDERDEVELOPED (candidate surface)

The discovery scouts will likely converge on a subset of these — surface them prominently if your scan finds confirming evidence.

- **No motion library installed** — opportunity for Framer Motion / Motion / auto-animate adoption (lazy-loaded)
- **No skeleton loading states** for sections that fetch (Photos, Gemini-backed surfaces)
- **No view-transition / section-switch animation** — switching between Today/Sprint/LongTerm is currently abrupt
- **No keyboard-shortcut help overlay** — no Cmd-/ or Cmd-? surface
- **No command-palette / quick-action** — QuickPrompt exists but is narrow-scope
- **No empty-state illustrations / first-run onboarding** beyond the bare default
- **No mobile / narrow-viewport handling** — the newtab is desktop-first; new Chrome variants (Android, narrow windows) get cramped layouts
- **No drag-to-reorder** on todo lists despite Sprint / LongTerm being inherently re-orderable
- **No drag-to-calendar** to compose Gantt items from todos
- **No animated transitions between section tabs** — abrupt content swaps
- **No theme variants beyond light/dark** — could add high-contrast, sepia, or seasonal accents
- **No animated state on alarm-armed reminders** — visually flat
- **No virtualization on long todo lists** — may matter at scale
- **No standardized icon set** — section components have ad-hoc SVGs

## 8. How to anchor a proposal to this file

Every candidate in the synthesis catalog must cite ONE of:

- A specific Proclivity component file:line that's the closest existing implementation
- A CSS token (`--accent` / `--panel` / `--text` / `--space-N`) to be applied
- An accessibility constraint that the proposal must honor (reduced-motion baseline, 44 px row height, focus rings)
- A pattern in §7 above (the "underdeveloped" list)

If none of those apply, the proposal is probably not Proclivity-shaped — push back.
