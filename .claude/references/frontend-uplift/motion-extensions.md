# Motion extensions — Proclivity-only primitives (`[PMOT-N]`)

**This file EXTENDS the shared canon. It does not replace it.**

| Namespace | Owner | Where it is defined |
|---|---|---|
| `[MOT-N]` | fleet canon (registry-synced) | `.claude/references/frontend-uplift-motion-vocabulary.md` |
| `[EXP-N]` | fleet canon (registry-synced) | `.claude/references/frontend-uplift-experiential-motion.md` |
| `[PMOT-N]` | **this repo only** | this file |

Cite a shared primitive with `[MOT-N]`. Cite a Proclivity-only primitive with
`[PMOT-N]`. Never cite a bare `[MOT-N]` for anything defined below — the number
means something else in the canon.

> **Why the prefix exists.** Until 2026-07 this repo kept its own `[MOT-N]` table
> under the same token name as the fleet canon, with **26 overlapping ids and not
> one shared meaning**. The worst case was safety-relevant: local `MOT-31` meant
> `magnetic-cursor`, while canon `MOT-31` means `floating-orbs`. A scout proposing
> `[MOT-31]` on a Complete/Delete button read downstream as a decorative
> background, so `PMOT-NO-4` (the rule that forbids exactly that) never fired.
> The `PMOT-` prefix makes the two namespaces impossible to confuse.

**Reduced-motion baseline (load-bearing).** `src/newtab/index.css` ships a
`@media (prefers-reduced-motion: reduce)` block that disables most animation.
EVERY primitive below must honor it: animate only inside
`@media (prefers-reduced-motion: no-preference)`, and state the fallback in the brief.

**Motion-jobs test still applies.** Per canon `§0`, every motion candidate must name
the job it serves — orientation / causality / feedback / continuity. No job, no
motion. There is no quota. `[PMOT-N]` does not exempt a candidate from that test.

---

## §1 — Retired local ids: use the canon instead

These eight primitives ARE fleet primitives. Their old Proclivity ids are retired.
Cite the canon token on the right. (The middle column is what the id used to mean
here — kept so pre-2026-07 briefs can be read correctly.)

| Retired local id | Name | Cite this instead |
|---|---|---|
| ~~MOT-1~~ | `fade-in` | `[MOT-1]` (canon — same id, same meaning) |
| ~~MOT-3~~ | `stagger-reveal` | `[MOT-3]` (canon — same id, same meaning) |
| ~~MOT-4~~ | `scale-in` | `[MOT-4]` (canon — same id, same meaning) |
| ~~MOT-11~~ | `gradient-shift` | `[MOT-32]` (canon) |
| ~~MOT-20~~ | `parallax-bg` | `[MOT-39 parallax]` (canon) — and see `PMOT-NO-2` |
| ~~MOT-31~~ | `magnetic-cursor` | `[MOT-27]` (canon) — and see `PMOT-NO-4` |
| ~~MOT-51~~ | `shared-element-transition` | `[MOT-14]` (canon) |
| ~~MOT-65~~ | `floating-orbs` | `[MOT-31]` (canon) |

---

## §2 — Proclivity-only primitives

Numbers are carried over from the pre-split table so archived briefs stay traceable.

### Entry / exit

| ID | Name | Description | When to use |
|---|---|---|---|
| `PMOT-2` | `fade-up` | Opacity 0→1 + `translateY(8px → 0)` over 250–400ms | Section headings on first load. (Canon-adjacent: `MOT-2 slide-up` is for content appearing below a fold — not the same job.) |
| `PMOT-5` | `slide-from-edge` | `translateX(±100% → 0)` over 250–350ms | Drawer / sheet entry, if added |
| `PMOT-6` | `dissolve` | Cross-fade between two elements in the same slot | Section switches (Today ↔ Sprint), tab swaps. Canon-adjacent: `MOT-12 crossfade` (route transitions) |

### Continuous / ambient

| ID | Name | Description | Caveats |
|---|---|---|---|
| `PMOT-10` | `breathing-glow` | Box-shadow or opacity slow pulse, 2–4s loop | Live indicators (alarms armed, sync state). Cap intensity; respect reduced-motion |
| `PMOT-12` | `cursor-tracking-spotlight` | Radial gradient following the pointer | Premium cards only. Disable on touch / reduced-motion |
| `PMOT-13` | `skeleton-shimmer` | Diagonal sheen across a skeleton background | Only where Proclivity actually shows skeletons; not a licence to add them |
| `PMOT-14` | `tick-flash` | Brief colour flash on a numeric / status change | Reminder armed, todo completed, sprint progress. Serves the *feedback* job |

### Scroll-driven

| ID | Name | Description | When to use |
|---|---|---|---|
| `PMOT-21` | `progress-bar-by-scroll` | Sticky header progress bar reflecting scroll | Long surfaces (LongTerm with >50 items) |
| `PMOT-22` | `pinned-section-reveal` | Section pins while inner content scrolls | Onboarding flow only |
| `PMOT-23` | `scroll-triggered-counter` | Number counts up on entering viewport | Welcome metrics. Never on live planning values (`PMOT-NO-1`) |

### Pointer / hover / focus

| ID | Name | Description | When to use |
|---|---|---|---|
| `PMOT-30` | `lift-on-hover` | `translateY(-2px)` + shadow elevation | Interactive cards (todo items, reminders) |
| `PMOT-32` | `border-on-hover` | Border colour shift or gradient-border reveal | Settings rows, card-style buttons |
| `PMOT-33` | `icon-spin-on-action` | Refresh / retry icon rotates 360° once | Refresh and retry buttons |
| `PMOT-34` | `inline-accent-edge-glow` | Accent outline glow on `:focus-visible` | Accessibility focus rings — NOT decorative |

### Drag / gesture

| ID | Name | Description | Caveat |
|---|---|---|---|
| `PMOT-40` | `drag-to-reorder` | List items dragged with rearranging feedback | Pair with Framer `Reorder` or auto-animate |
| `PMOT-41` | `swipe-to-action` | Touch gesture revealing per-row actions | Mobile only; desktop equivalent is hover-revealed buttons |
| `PMOT-42` | `drag-to-calendar` | Drag a todo onto a Gantt timeslot | Sunsama / Akiflow pattern |
| `PMOT-43` | `drag-time-scrubber` | Horizontal drag scrubs a timeline | Gantt timeline navigation |

### Section-switch

| ID | Name | Description | When to use |
|---|---|---|---|
| `PMOT-50` | `section-fade` | Cross-fade between section tabs (Today → Sprint) | Default for section switches |
| `PMOT-52` | `view-transitions-api` | Native `document.startViewTransition` | No canon equivalent. Pair with a Framer fallback |

### Decorative / brand-feel (the `MeshBackground` S-1m island only)

Per `proclivity-design-system.md §9`, the R3F `MeshBackground` is the ONE bounded
decorative surface. Everything else is `S-2` and these are BLOCKED there.

| ID | Name | Description | Caveat |
|---|---|---|---|
| `PMOT-60` | `mesh-gradient-bg` | SVG / WebGL mesh gradient | Proclivity already has an R3F mesh — extend, don't replace |
| `PMOT-61` | `noise-overlay` | Subtle SVG-noise texture over gradient | 2–4% opacity max |
| `PMOT-62` | `aurora-effect` | Multi-layer radial gradients animating opacity | Off by default; off under reduced-motion |
| `PMOT-63` | `border-beam` | Animated gradient sweeping a card border | Cap to 1–2 instances per viewport |
| `PMOT-64` | `dot-grid-bg` | Subtle dot-grid background | Settings / empty-state surfaces |

---

## §3 — Anti-patterns (do NOT propose)

These are Proclivity-specific and stricter than the canon's `[AP-N]` list. Both apply.

| ID | Name | Why |
|---|---|---|
| `PMOT-NO-1` | bouncy easing on data values | Elastic curves on planning values read as an unstable UI — it destroys trust |
| `PMOT-NO-2` | parallax on the Today / Sprint / Gantt sections | Planning surfaces want stillness; parallax obscures data and causes motion sickness |
| `PMOT-NO-3` | auto-rotating carousel for plannable content | The user must control what they see; auto-advance loses information |
| `PMOT-NO-4` | magnetic-cursor on operational buttons | Complete / Delete / Snooze must not move toward the cursor — accidental-click risk |
| `PMOT-NO-5` | continuous animation with no `prefers-reduced-motion` fallback | Categorical a11y regression per the `index.css` baseline |
| `PMOT-NO-6` | confetti / celebration on completing every todo | Tone mismatch — a calm planning surface, not a gamified to-do app. A subtle once-per-day milestone effect could be in scope; tighten to that |
| `PMOT-NO-7` | motion that fires on every render | Remount-driven animation feels broken on state change; tie motion to explicit triggers |

---

## §4 — How to cite

Name the job, then the token. Shared primitives take `[MOT-N]`; Proclivity-only
primitives take `[PMOT-N]`:

> "On the cold-load Today section, replace the static fade with `[MOT-3 stagger-reveal]`
> (job: **orientation** — it shows the list's shape as it lands). Ambient warmth via
> `[PMOT-60 mesh-gradient-bg]`, confined to the `MeshBackground` island. Both gated by
> `@media (prefers-reduced-motion: no-preference)` per the `index.css` baseline."

The synthesizer dedupes across scout briefs on these tokens, which is why the two
namespaces must never overlap: "library-scout cites Framer Motion; visual-scout cites
*fade-up on todo cards*; both point at `[MOT-3 stagger-reveal]`."

---

## §5 — Reading pre-2026-07 artifacts

Briefs and synthesis catalogs under `.claude/notes/frontend-uplifts/2026q2-visual-refresh/`
were written before this split. Their bare `[MOT-N]` tags mean the **old local** table,
not the canon. Translate with `§1` (for the eight retired ids) and by adding the `PMOT-`
prefix (for everything in `§2`). See that run's `ERRATA.md`.
