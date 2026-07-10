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

---

## §9 — House thesis (this repo's standing art direction)

The shared canon (`.claude/references/frontend-design-language.md`) is product-neutral and carries **no**
thesis — its §9 is a contract that says *the product declares its thesis in its own overlay*. This is
that declaration for Proclivity. The `frontend-uplift-art-direction-scout` MUST read this section before
proposing a thesis or directions; the `frontend-uplift-challenger` axis 11 scores every candidate against
it. It states **invariants**, never a page silhouette — cloning a fixed shell across surfaces is BAN-15.

### Visual thesis (one sentence — passes the swap-test)

> **Proclivity is a private planning instrument you meet on every new tab: today's work and the long
> horizon held in one calm, still frame — rendered almost entirely in ink and paper, with the single
> accent the user chose as the only color that carries meaning.**

Swap-test: substitute *Momentum* (photo-hero clock, not "one still planning frame"), *Sunsama* (hosted,
team-adjacent, its own brand color — not "self-owned, user-chosen accent"), or *Todoist* (denser,
multi-color priority chips). The sentence collapses for each — it is anchored to Proclivity's actual
invariants, so it passes.

### Invariants this thesis protects (NOT a silhouette)

1. **Calm at extreme repeat-use.** This surface is opened dozens of times a day and is never the task —
   it is the frame around the task. It must never demand attention, celebrate, or animate for its own
   sake. Stillness is the default; motion earns its place only by naming a job (see below).
2. **One still frame across time horizons.** Today → Sprint → LongTerm → Gantt is one instrument spanning
   near-to-far planning, not a grid of equal-weight persona cards. Each view has a focal answer to "what
   needs me now" (§6 lede discipline); no BAN-2/BAN-5 equal-card wall.
3. **A single user-owned accent is the only chroma.** `--accent` is user-overridable (theme.css); every
   other color is achromatic ink/paper steps. Semantic `--danger`/`--warn`/`--ok` are reserved for state
   ONLY (BAN-11). No second neon, no rainbow tags-as-identity.
4. **Private and local-only.** No "Welcome back, <name>", no team chrome, no telemetry, no hosted-endpoint
   affordances (a hard `CLAUDE.md` constraint). The voice is a private instrument's, not a SaaS greeter's.
5. **Legible-first, honest data.** 44 px rows for keyboard nav, tabular numerals on plan/date values,
   real light+dark parity, and the reduced-motion baseline in `src/newtab/index.css` are load-bearing —
   every direction inherits them.

A run may satisfy these invariants through a canon §8 style seed (D-A Precision Instrument fits Proclivity
most naturally), a §8 product mental-model, or a genuinely new direction — what it may **not** do is clone
another surface's or a prior run's shell (BAN-15).

### Named anti-references (what Proclivity must never become)

| Anti-reference | What it looks like | BAN tokens |
|---|---|---|
| **The gamified to-do app** | Confetti/streak-flames on every completion, celebratory motion, "You're on fire!" copy | BAN-10 + motion anti-pattern (flat `frontend-uplift-motion-vocabulary.md` §8; confetti-on-every-todo already rejected in §6 above) |
| **The generic AI-dashboard new-tab** | Navy shell + neon accents, sidebar + 6-up equal KPI/stat cards, "Welcome back" hero + Quick Actions | BAN-1, BAN-2, BAN-5, BAN-13 |
| **The maximalist photo-hero new-tab** (Momentum-style) | Full-bleed background photo + centered clock + quote burying the actual planning data | BAN-8, BAN-5 (Proclivity *has* a Photos surface, but the plan is the point — the photo is never the hero) |
| **The badge-soup planner** | Colored priority pills + status chips scattered across every todo row and card | BAN-7, BAN-11 |
| **Multi-accent / rainbow-tag identity** | Per-tag/per-priority colors used as the primary visual system | BAN-1, BAN-11 (Proclivity commits to ONE user accent + reserved semantics) |

(No persisted "never-again" screenshots exist yet; link them here when a future run captures one. The
completed `2026q2-visual-refresh` run's screenshots under `.claude/notes/frontend-uplifts/…/screenshots/`
are the current baseline of what IS.)

### Surface map (grounded in `manifest.config.ts` — verify at read time)

Proclivity's manifest declares exactly ONE UI surface: `chrome_url_overrides.newtab`. There is **no popup**
(the toolbar `action` has no `default_popup` — the icon only carries the pending-alert badge and opens a
new tab), **no options page, no content scripts, no injected panels.** The whole product is the new-tab
dashboard. Therefore there is **no S-1** (marketing/landing/docs) and **no true S-1m threshold**
(local-only, no login/onboarding/auth). Do not invent those surfaces.

| Surface (code) | Class | Why / motion budget |
|---|---|---|
| New-tab shell — section nav + panel frame (`src/newtab/App.tsx`) | **S-2 tool** | Repeat-use, planning data, instant paint. `MOT-*` only; no spectacle. |
| Today / Sprint / LongTerm (`src/sections/`) | **S-2 tool** | Dense planning lists; stillness; state-borne `MOT-*` only. Parallax/scroll-scrub = BLOCKER (flat §8 AP-1, on S-2). |
| Gantt (`src/sections/Gantt.tsx`) | **S-2 tool** | Timeline data-viz; annotate, don't decorate (§6 data-viz). No scroll-driven scrub. |
| Reminders (`src/sections/Reminders.tsx`) | **S-2 tool** | List + alarm state; `PMOT-14 tick-flash`-class state feedback only; no magnetic-cursor on Snooze/Complete. |
| Photos (`src/sections/Photos.tsx`) | **S-2 tool (media)** | Google Photos grid; skeleton loading is legitimate; the photo is content, never a hero. |
| Calendar (`src/sections/Calendar.tsx`) | **S-2 tool** | Date grid; still. |
| Settings modal + panes, TodoEditModal, QuickPrompt (`src/components/…`) | **S-2 tool** | Overlays; `MOT-4 scale-in` + backdrop fade only. |
| **MeshBackground** — R3F/WebGL ambient layer (`src/components/MeshBackground.tsx`) | **S-1m-bounded (decorative island)** | The ONE place bounded ambient GPU craft is legitimate. It is NOT a full experiential surface (no threshold, no fast-path-through, always behind the working UI). Locks: reduced-motion → static poster (already lazy-loaded + shader-gated), must never obscure planning data (AP-6), must never leak parallax/scroll-motion onto the sections, single-accent-tinted. |

**Consequence for the pipeline:** default `--surface tool`. The `frontend-uplift-experiential-scout` is
**not** dispatched by default — Proclivity has no landing/hero/onboarding for it to serve. The
MeshBackground is a bounded island the art-direction-scout may note, not a reason to flip the run to
`experiential`. MV3 realities the challenger must respect: **CSP forbids remote code and inline script**
(no CDN-loaded animation libs; everything bundles), the new-tab has no hosted egress (local-only), and any
new dependency lands in the initial newtab chunk unless `React.lazy`-split (≤~400 KB soft / 500 KB hard,
per `CLAUDE.md`).
