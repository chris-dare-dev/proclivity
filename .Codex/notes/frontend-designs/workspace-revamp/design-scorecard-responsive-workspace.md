# Design scorecard — responsive-workspace

**Surface:** Chrome new-tab workspace
**Scope:** program
**Thesis:** Proclivity is a private field desk where the current inclination receives the canvas and every other instrument waits quietly at the edge.
**Direction:** A — Focus Deck
**Persisted:** docs/design-direction-responsive-workspace.md
**Scorecard format version:** 2.0

Anti-pattern verdicts: 1 (tell present) / 0 (absent) / UNSCORABLE. Quality verdicts: 0-4 /
UNSCORABLE. Evidence: one artifact per row with a §14 tier — `✓ live <screenshot/computed
style>` · `✓ code <file:line>` · `~ inferred <why>`.

## Self score — anti-pattern tells

| # | Tell | Verdict | Evidence |
|---|---|---|---|
| 1 | navy/near-navy dark shell + 2+ neon accents (BAN-1) | 0 | ✓ live evidence/after-osint-1440.png CSS viewport=1440x900 uses one restrained blue accent; the ambient mesh is subdued. |
| 2 | 6+ equal rounded cards as primary layout (BAN-2) | 0 | ✓ live evidence/after-gantt-today-split-1440.png shows one dominant stage and one bounded companion, not a card matrix. |
| 3 | icon-in-rounded-square decoration tiles (BAN-3) | 0 | ✓ live evidence/after-osint-768.png icons annotate concrete Focus, Settings, and external-open actions only. |
| 4 | default Inter + Lucide + shadcn look untouched (BAN-4) | 0 | ✓ code src/newtab/App.css:1 authors a custom rail, stage, responsive composition, and state system with no shadcn surface. |
| 5 | no focal element / equal panel weight (BAN-5) | 0 | ✓ live evidence/after-gantt-today-split-1440.png gives the primary 838px and the companion 390px. |
| 6 | decorative, unannotated charts (BAN-6) | 0 | ✓ live evidence/after-gantt-1440.png renders an honest empty state instead of a decorative placeholder chart. |
| 7 | badge soup — >5 colored chips per view (BAN-7) | 0 | ✓ live evidence/after-osint-1440.png contains no colored status-chip system. |
| 8 | glow/gradient/glass without a layering reason (BAN-8) | 0 | ✓ live evidence/after-osint-1440.png uses borders and tonal planes to distinguish shell, panel, and embedded surface without glow. |
| 9 | multiple primary CTAs per viewport (BAN-9) | 0 | ✓ live evidence/after-photos-empty-1440.png provides one setup action in the empty state. |
| 10 | generic or cosplay copy (BAN-10) | 1 | ✓ live evidence/after-osint-1440.png still exposes the user-configurable default greeting “Good afternoon.” in the header. |
| 11 | semantic colors used decoratively (BAN-11) | 0 | ✓ live evidence/after-gantt-today-split-1440.png uses accent for selection/action and no decorative status colors. |
| 12 | uniform density, no authored modes (BAN-14) | 0 | ✓ live evidence/after-osint-375.png demonstrates the compact phone composition; src/newtab/App.css:461 separately authors the horizontal switchboard mode. |
| 13 | same-silhouette syndrome — another surface/run's shell reused as identity (BAN-15) | 0 | ✓ live evidence/after-gantt-today-split-1440.png shows the product-specific intent switchboard and primary/companion field desk. |

**Self anti total:** 1/13

## Self score — directed quality

| # | Dimension | Score (0-4) | Evidence |
|---|---|---|---|
| 1 | Task clarity — operator states posture + next action in 5s | 4 | ✓ live evidence/after-photos-empty-1440.png states surface, missing setup, local-cache scope, and one corrective action. |
| 2 | Priority fidelity — visual weight matches risk/cost/urgency | 4 | ✓ live evidence/after-gantt-today-split-1440.png keeps primary work dominant while navigation and companion recede. |
| 3 | Decision integrity — labels/units/scope/freshness/thresholds without hover | 3 | ✓ live evidence/after-finances-375.png names the protected surface and external escape, but Vite cannot supply an extension-aware iframe error. |
| 4 | Composition — regions answer distinct questions; no dead-space theater | 4 | ✓ live evidence/after-osint-1440.png gives grouped navigation, context header, panel toolbar, and live canvas separate jobs without withholding width. |
| 5 | Typography — roles encode hierarchy; legible at operating density | 3 | ✓ live evidence/after-osint-768.png clearly separates title, destination, toolbar, and time roles, though metadata remains deliberately small. |
| 6 | Semantic depth — layers mean nesting/selection/state, not decoration | 3 | ✓ live evidence/after-gantt-today-split-1440.png uses rail, selected destination, primary, and companion layers for real ownership. |
| 7 | Interaction & state craft — focus/selection/loading/empty/error/stale coherent | 4 | ✓ live evidence/after-photos-empty-1440.png pairs coherent selection and setup state with src/newtab/App.tsx:700 keyed focus-order preservation. |
| 8 | Product signature — logo removed, still recognizably this product + route-coherent | 3 | ✓ live evidence/after-osint-1440.png retains Proclivity's intent groups, quiet field-desk voice, and one-primary operating model. |

**Self quality mean:** 3.5/4

## Independent score — anti-pattern tells

| # | Tell | Verdict | Evidence |
|---|---|---|---|
| 1 | navy/near-navy dark shell + 2+ neon accents (BAN-1) | 0 | ✓ live evidence/after-osint-1440.png uses one blue accent; the faint mesh is subdued rather than a second neon system. |
| 2 | 6+ equal rounded cards as primary layout (BAN-2) | 0 | ✓ live evidence/after-gantt-today-split-1440.png replaces a card grid with one dominant work surface and one bounded companion. |
| 3 | icon-in-rounded-square decoration tiles (BAN-3) | 0 | ✓ live evidence/after-osint-768.png icons only annotate concrete Focus, Settings, and external-open actions. |
| 4 | default Inter + Lucide + shadcn look untouched (BAN-4) | 0 | ✓ code src/newtab/App.css:1 contains an authored shell, rail, responsive composition, and state styling with no shadcn or Inter-default surface. |
| 5 | no focal element / equal panel weight (BAN-5) | 0 | ✓ live evidence/after-gantt-today-split-1440.png makes Gantt visibly primary and Today a narrow companion. |
| 6 | decorative, unannotated charts (BAN-6) | 0 | ✓ live evidence/after-gantt-1440.png uses an honest empty state rather than decorative placeholder visualization. |
| 7 | badge soup — >5 colored chips per view (BAN-7) | 0 | ✓ live evidence/after-osint-1440.png shows no colored status-chip system. |
| 8 | glow/gradient/glass without a layering reason (BAN-8) | 0 | ✓ live evidence/after-osint-1440.png uses restrained material to distinguish shell, work surface, and embedded content without glow. |
| 9 | multiple primary CTAs per viewport (BAN-9) | 0 | ✓ live evidence/after-photos-empty-1440.png presents one primary setup action. |
| 10 | generic or cosplay copy (BAN-10) | 1 | ✓ live evidence/after-osint-1440.png retains the generic default greeting “Good afternoon.” despite otherwise specific functional labels. |
| 11 | semantic colors used decoratively (BAN-11) | 0 | ✓ live evidence/after-gantt-today-split-1440.png reserves accent for selection/action and shows no decorative ok/warn/error colors. |
| 12 | uniform density, no authored modes (BAN-14) | 0 | ✓ code src/styles/theme.css:103 defines compact and spacious density modes that change spacing, row height, and panel padding. |
| 13 | same-silhouette syndrome — another surface/run's shell reused as identity (BAN-15) | 0 | ✓ live evidence/after-gantt-today-split-1440.png uses an intent-grouped switchboard plus asymmetric primary/companion composition specific to this new-tab surface. |

**Independent anti total:** 1/13

## Independent score — directed quality

| # | Dimension | Score (0-4) | Evidence |
|---|---|---|---|
| 1 | Task clarity — operator states posture + next action in 5s | 4 | ✓ live evidence/after-photos-empty-1440.png makes surface, cause, local-cache scope, and corrective action immediately explicit. |
| 2 | Priority fidelity — visual weight matches risk/cost/urgency | 4 | ✓ live evidence/after-gantt-today-split-1440.png gives primary work most of the canvas while companion and navigation remain subordinate. |
| 3 | Decision integrity — labels/units/scope/freshness/thresholds without hover | 3 | ✓ live evidence/after-finances-375.png gives Finance scope and an external escape, but the failed embedded state has no diagnostic beyond the browser page. |
| 4 | Composition — regions answer distinct questions; no dead-space theater | 3 | ✓ live evidence/after-osint-1440.png is width-efficient and distinct by region, though the Gantt empty state leaves a large inert field. |
| 5 | Typography — roles encode hierarchy; legible at operating density | 3 | ✓ live evidence/after-osint-768.png clearly separates title, navigation, toolbar, and mono time; several metadata labels remain visually delicate. |
| 6 | Semantic depth — layers mean nesting/selection/state, not decoration | 3 | ✓ live evidence/after-gantt-today-split-1440.png makes rail, selection, primary, and companion encode real navigation and ownership. |
| 7 | Interaction & state craft — focus/selection/loading/empty/error/stale coherent | 3 | ✓ live evidence/after-photos-empty-1440.png proves coherent selection and actionable emptiness, but not populated Photos or a bespoke iframe error state. |
| 8 | Product signature — logo removed, still recognizably this product + route-coherent | 3 | ✓ live evidence/after-osint-1440.png makes the intent groups and primary/companion field-desk model recognizable, though restrained dark-tool styling is partly transferable. |

**Independent quality mean:** 3.25/4

## Verification notes

- Live DOM geometry measured exact CSS viewports at 1920×1080, 1440×900, 768×900, and 375×812 with no document overflow. The in-app browser rasterizes wide screenshots to its host capture width; the DOM measurements are authoritative for breakpoint geometry.
- Extension-only Google OAuth and Monarch declarative-network-request behavior are outside the regular Vite preview. Source boundaries remain intact and need an unpacked-extension smoke pass for end-to-end proof.
