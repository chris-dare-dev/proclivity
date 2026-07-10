# Phase 2 — SYNTHESIZE (main session)

**Purpose:** the main session reads every discover brief end-to-end + reviews the captured screenshots + writes a unified modernization-candidate catalog at `artifacts/synthesis.md`.

## Inputs

- `.claude/notes/frontend-uplifts/{ID}/discover/art-direction-scout-brief.md` (**the FRAME — read FIRST**; thesis + 3 directions + BAN list + surface map)
- `.claude/notes/frontend-uplifts/{ID}/discover/visual-scout-brief.md`
- `.claude/notes/frontend-uplifts/{ID}/discover/library-scout-brief.md` (standard / deep / experiential modes)
- `.claude/notes/frontend-uplifts/{ID}/discover/inspiration-scout-brief.md` (standard / deep modes)
- `.claude/notes/frontend-uplifts/{ID}/discover/experiential-scout-brief.md` (ONLY on `--surface` ≠ `tool`)
- `.claude/notes/frontend-uplifts/{ID}/discover/current-state-critic-brief.md`
- `.claude/notes/frontend-uplifts/{ID}/screenshots/*.png` (visual evidence)

## Output

`.claude/notes/frontend-uplifts/{ID}/artifacts/synthesis.md`

## Synthesis protocol

0. **ADOPT THE FRAME FIRST.**  The synthesis OPENS with the art-direction-scout's frame (thesis + 3 divergent directions + BAN-1..15 list + surface map).  If no art-direction brief exists (frame-degraded run), build a PROVISIONAL frame from `frontend-design-language.md` §8 (direction seeds) + the §9 overlay, and say so — the challenger will flag a truly frameless catalog as a run-level BLOCKER.  Every candidate below is then placed against the frame: `[DIRECTION-DEFINING]` (changes the language), frame-compatible, or `[polish]`.
1. **Read every brief end-to-end first.**  Hold them all in working memory.
2. **Look at the screenshots.**  The visual scout's screenshots are evidence; the synthesizer references them in candidate entries by path.
3. **Build a candidate inventory.**  Every distinct modernization opportunity proposed across the briefs becomes a candidate row (`UPL-1`, `UPL-2`, …).
4. **Deduplicate.**  Triangulation is the strongest signal.  When two briefs surface the same upgrade (e.g., library-scout cites Framer Motion + visual-scout cites "stagger-reveal needed on todo list"), merge into ONE candidate with both evidence sources.
5. **Cross-link motion vocabulary + name the job.**  Every candidate that involves animation cites a flat-canon `[MOT-N]` primitive from `.claude/references/frontend-uplift-motion-vocabulary.md` (`[EXP-N]` from `.claude/references/frontend-uplift-experiential-motion.md` only on `--surface` ≠ `tool` runs) AND **names the motion job it serves** — orientation / causality / feedback / continuity (flat motion §0).  A candidate with no named job is NOT a motion candidate — the absence of animation is a gap only when a named job goes unserved.  This is what makes the catalog comparable and keeps out motion-for-its-own-sake.
6. **Categorize** with this fixed taxonomy:
   - **Motion** — animation primitives (Framer Motion adoption, stagger-reveal, fade-up, etc.)
   - **Scroll/parallax** — scroll-driven, parallax, intersection-observer reveals
   - **Typography** — font, scale, weight, monospace usage
   - **Layout** — density, grid, spacing, responsive breakpoints
   - **Color/theme** — token application, gradient usage, theming (incl. light theme contrast)
   - **Interaction** — hover, focus, command-palette, keyboard shortcuts
   - **Data viz** — Gantt rendering, calendar grid, sparkline-style accents
   - **Library / dependency** — adding a new lib (Framer Motion, vaul, @tanstack/virtual, etc.)
   - **Accessibility** — a11y improvements
   - **Cross-cutting refactor** — design-system rationalization
7. **T-shirt every candidate.**  XS (<1d), S (1–3d), M (4–10d), L (>10d).
8. **Don't propose solutions in detail.**  1-paragraph sketches; detailed design happens via `/milestone-pipeline` if/when pulled forward.

## Candidate entry shape (use verbatim)

```markdown
### UPL-N — Short imperative title

**Category:** Motion | Scroll/parallax | Typography | Layout | Color/theme | Interaction | Data viz | Library/dependency | Accessibility | Cross-cutting refactor
**Frame placement:** [DIRECTION-DEFINING] | frame-compatible | [polish]  (which of the frame's directions it serves, or `[polish]`)
**Size:** XS | S | M | L
**Evidence triangulation:** N briefs (e.g. "art-direction ✓, visual ✓, library ✓" — count of briefs that surfaced this)
**Motion primitives + job:** [MOT-N name] serving <orientation | causality | feedback | continuity> (omit for non-motion candidates)

**What it is:** 2-3 sentence plain-English description of the upgrade.

**Why it matters:** 1-2 sentence value-pitch from the user's perspective.

**Sources:**
- Visual scout: <bullet pointing to the gap row + screenshot path>
- Library scout: <bullet pointing to the library row>
- Inspiration scout: <bullet pointing to the pattern row + competitor URL>
- Current-state critic: <bullet pointing to the gap row + file:line>

**Closest Proclivity analog today:** `src/path/to/component.tsx:NNN` — what's there now, why it's insufficient.  Or "no analog" when net-new.

**Screenshot evidence:** `screenshots/<view-id>-desktop.png` (visual-scout-captured)

**Sketch:** 1-paragraph design hint.  Cite specific file:line attach points where credible.  Cite `--accent` / `--panel` / `--text` / `--space-N` tokens to be applied.  Cite [MOT-N] primitives composing the upgrade.  Note `prefers-reduced-motion` requirements and the React-18 / strict-TS / ≤~400 KB chunk constraints.

**Open questions:** bullet list, or "none" when well-specified.
```

## Synthesis sections

1. **The adopted frame** (OPENS the document) — the art-direction-scout's visual thesis + 3 divergent directions + active BAN-1..15 list + surface map, recapped so the reader sees the direction BEFORE the catalog.  Mark it PROVISIONAL if the run was frame-degraded.
2. **Executive summary** — 4–6 sentences: how many candidates, dominant categories, top theme, top tension across briefs, and how many candidates are `[DIRECTION-DEFINING]` vs `[polish]`.
3. **Triangulation strength** — count candidates by evidence-source count: "N candidates have 3+ brief sources (strong); N have 2; N have 1 (weak — flag for challenger scrutiny)".
4. **Foundational + direction-defining candidates** — surface FIRST: the `[DIRECTION-DEFINING]` moves and the candidates others depend on (e.g., "adopt a lazy-loaded motion library" enables many feedback/continuity follow-ons).  Synthesis MUST flag these so Phase 4 lanes + sequences them correctly.
5. **Candidate catalog** — every candidate, ordered by:  direction-defining + foundational first; then high-triangulation within each category; then by t-shirt size ascending.
6. **Cross-cutting tensions** — places where briefs disagreed (e.g., "inspiration-scout proposed parallax on a welcome surface; current-state-critic + the §9 surface map flag parallax on S-2 planning sections as flat motion §8 AP-1; resolution: limit any parallax to the MeshBackground S-1m island only").
7. **Already considered + rejected** — bullet list of candidates from the briefs that don't survive synthesis (1-2 sentence rejection reason each).
8. **Motion-vocabulary index** — table mapping each flat-canon `[MOT-N]` / `[EXP-N]` primitive cited across candidates to the candidate ids using it AND the job each serves.

## After writing

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set synthesis_path='".claude/notes/frontend-uplifts/<ID>/artifacts/synthesis.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set candidate_count=<N>
.claude/scripts/frontend-uplift/checkpoint.py <ID> synthesize-complete
```

## Anti-patterns

| Tempting belief | Reality |
|---|---|
| "I can synthesize without looking at the screenshots." | Visual evidence anchors visual claims.  Screenshots are 30% of the brief's value. |
| "Let me invent new categories." | Fixed taxonomy keeps Phase 4 ranking comparable across runs. |
| "Candidates with 1 brief source are still strong if they sound good." | Single-source candidates ARE weaker signal.  Flag for challenger scrutiny — don't filter them out, but rank them with eyes open. |
| "I'll write detailed implementation plans for each candidate." | Phase 4's job, not Phase 2's.  Sketches only. |
| "Skip the foundational-candidates surface — Phase 4 will figure out dependencies." | NO.  Foundational candidates change the sequencing math; surface them prominently in Section 3 so Phase 4 can RICE-rank with the right DAG context. |
| "Propose a library that's React-19 only." | Proclivity is React 18.  Park it. |
| "Propose Tailwind / shadcn adoption as a small candidate." | It's foundational and large.  Either surface it explicitly as a large foundational candidate with the full bundle / convention argument, or don't surface it. |
