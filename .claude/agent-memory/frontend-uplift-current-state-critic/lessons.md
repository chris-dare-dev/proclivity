# Lessons — frontend-uplift-current-state-critic

## Run: 2026q2-visual-refresh (2026-05-20)

**Lesson:** Gantt section accumulated a light-theme regression (`color-scheme: dark` hardcoded on `.gantt-task-date`) that was invisible when the section was built against a dark-only baseline. Future runs should grep `color-scheme` across all section CSS on the first pass — it surfaces in any section that was built before light-theme support was added.

**Lesson:** The sprint progress bar fill (`sprint.css:185`) and the mesh background fade-in (`MeshBackground.css:10`) both have reduced-motion guards for the OS preference but not for the in-app `[data-reduced-motion="true"]` toggle. This partial-guard pattern reappeared in QuickPrompt and the settings badge pulse. It appears to be a recurring drift where the in-app toggle path is the secondary consideration. Recommend the synthesizer surface a single "reduced-motion self-documentation pass" candidate that fixes all partial guards in one milestone rather than addressing them piecemeal.

**Lesson:** `#0b0e14` and `#fff` appear at ~10 sites as text-on-accent colors. The correct token is `var(--accent-on)`, which already exists in `theme.css` with separate dark and light values. These hardcodes accumulate when a component is built in dark-mode-only sessions. A grep for `#0b0e14\|#fff` (as text colors on accent backgrounds) at the start of future uplift runs is a reliable signal for this category.

**Lesson:** All `<Suspense fallback={null}>` sites (6 in `App.tsx`) are intentional decisions documented inline — the team knows the skeleton gap exists. The synthesis should frame skeleton loading as a targeted upgrade (3–4 specific surfaces with known shapes) rather than a global change, to make it easier to approve.
