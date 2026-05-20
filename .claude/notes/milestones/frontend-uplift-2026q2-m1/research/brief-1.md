---
milestone_id: "frontend-uplift-2026q2-m1"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources: []
injection_attempts: 0
---

# Codebase-Context Research Brief — frontend-uplift-2026q2-m1

## 1. Single source of truth for the 5 target tokens

**File:** `src/styles/theme.css`

All 5 tokens are declared in the `:root` block (dark theme baseline).
Light-theme overrides live in `[data-theme="light"]`.

### Dark theme (current — lines 22–29)

```css
/* line 22 */ --bg:       oklch(0.10 0.012 252);
/* line 23 */ --panel:    oklch(0.14 0.014 252);
/* line 24 */ --panel-2:  oklch(0.17 0.016 252);
/* line 25 */ --border:   oklch(0.22 0.018 252);
/* line 29 */ --text-dim: oklch(0.68 0.018 252);
```

### Light theme (current — lines 69–74)

```css
/* line 69 */ --bg:       oklch(0.97 0.004 252);
/* line 70 */ --panel:    oklch(1.00 0 0);
/* line 71 */ --panel-2:  oklch(0.95 0.005 252);
/* line 72 */ --border:   oklch(0.88 0.008 252);
/* line 74 */ --text-dim: oklch(0.45 0.018 252);
```

**Implementer note:** The milestone brief targets only the **dark-theme** `:root` block.
The light-theme `[data-theme="light"]` block uses `hue 252` throughout and has
lower chroma already (`--bg: 0.004`, `--panel-2: 0.005`, `--border: 0.008`).
The light-theme values are NOT in scope for this milestone — leave them untouched.

---

## 2. Token cascade map — every file that consumes the 5 tokens

A full grep across `src/**/*.css` and `src/**/*.tsx` reveals the following.
Tokens consumed via `var()` only — no JS/TS files call these tokens directly.

### `--bg`

Used as **background** at 4 sites:

| File | Line | Rule |
|---|---|---|
| `src/newtab/index.css` | 25 | `html, body, #root { background: var(--bg) }` — page root |
| `src/sections/sprint/sprint.css` | 382 | `.sprint-detail-meta` (inline badge bg) |
| `src/sections/sprint/sprint.css` | 517 | `.sprint-reorder-handle` (drag handle bg) |
| `src/sections/sprint/sprint.css` | 540 | `.sprint-subtask-row` (nested row bg) |
| `src/newtab/App.css` | 70 | `.settings-button[data-new="true"]::after { border: 2px solid var(--bg) }` — notification dot ring uses `--bg` as its border color to "cut out" against the panel surface |

The notification dot ring (`App.css:70`) is the only **non-background** use of `--bg`.
After the hue-shift, the ring color changes from hue 252 to hue 237 — both are within
the neutral dark range and the visual effect (dot punches through the button surface)
is preserved.

### `--panel`

Consumed at 50+ sites. Representative critical usages:

| File | Lines | Context |
|---|---|---|
| `src/newtab/App.css` | 46 | `.settings-button { background: var(--panel) }` |
| `src/sections/sections.css` | 22 | `.todo-item { background: var(--panel) }` |
| `src/components/Modal.css` | 20 | `.modal-panel { background: var(--panel) }` |
| `src/components/QuickPrompt.css` | 24, 112 | prompt box + result background |
| `src/sections/gantt/gantt.css` | 15, 69 | header + task row backgrounds |
| `src/sections/sprint/sprint.css` | 51, 113, 197, 261 | various sprint card surfaces |
| `src/sections/reminders/reminders.css` | 3, 74 | reminder item + form backgrounds |
| `src/sections/calendar/calendar.css` | 175, 221 | calendar header + day-cell bg |
| `src/components/settings/LogViewer.css` | 52, 72 | log pane backgrounds |
| `src/components/settings/NanoSection.css` | 51 | settings group panels |
| `src/components/closed/ClosedTodosView.css` | 86, 160 | closed-todos surfaces |
| `src/components/chat/ChatPanel.css` | 22 | chat panel background |
| `src/components/card/card.css` | 414 | card tag-chip background |

### `--panel-2`

Consumed at 30+ sites. Representative critical usages:

| File | Lines | Context |
|---|---|---|
| `src/newtab/index.css` | 38, 52, 65 | `button`, `input/textarea/select` default bg |
| `src/newtab/App.css` | 56 | `.settings-button:hover { background: var(--panel-2) }` |
| `src/components/QuickPrompt.css` | 40, 51 | result entry items |
| `src/components/Modal.css` | 66 | modal footer section bg |
| `src/components/chat/ChatPanel.css` | 97, 168, 232, 290 | chat message bubbles + input |
| `src/sections/gantt/gantt.css` | 20, 137 | gantt table header + date input wrapper |
| `src/sections/calendar/calendar.css` | 69, 184 | calendar toolbar + day header |
| `src/components/settings/SettingsModal.css` | 59, 298, 374 | settings sidebar + form fields |
| `src/components/closed/ClosedTodosView.css` | 138, 246, 323 | filter toolbar + counters |

### `--border`

Consumed at 80+ sites — virtually every component has at least one `border: 1px solid var(--border)` or `border-bottom: 1px solid var(--border)`.

Key structural usages:

| File | Lines | Context |
|---|---|---|
| `src/newtab/App.css` | 47, 84, 98 | settings button, tabs bar, tab hover underline |
| `src/newtab/index.css` | 39, 66 | button and input default borders |
| `src/sections/sections.css` | 23 | `.todo-item` border |
| `src/components/Modal.css` | 21, 67 | modal panel + footer border |
| `src/components/card/card.css` | 32, 148, 332, 415 | card drag track + surfaces |
| `src/components/settings/SettingsModal.css` | 37, 58, 185, 74 | settings nav dividers |
| `src/components/chat/ChatPanel.css` | 23, 42, 64, 225, 233, 291, 341, 365 | chat panel structure |

`--border` also appears as a **background fill** in two places:
- `src/components/settings/SettingsModal.css:74` — `.settings-nav-divider { background: var(--border) }`  
- `src/components/settings/SettingsModal.css:185` — `.settings-section-divider { background: var(--border) }`

These divider lines will correctly shift with the token — no special handling needed.

### `--text-dim`

Consumed at 60+ sites. Key usages relevant to the WCAG AA check:

| File | Lines | Context |
|---|---|---|
| `src/newtab/App.css` | 22, 49, 92 | `.date`, `.settings-button`, `.tab` text color |
| `src/sections/sections.css` | 29, 37, 62 | todo metadata text, empty-state text |
| `src/components/card/card.css` | 196, 269, 281, 298 | card metadata, tags, due-date |
| `src/components/chat/ChatPanel.css` | 56, 62, 90, 112, 144, 175, 188 | chat timestamps + hints |
| `src/sections/sprint/sprint.css` | 15, 36, 72, 91, 136 | sprint metadata |
| `src/components/settings/SettingsModal.css` | 85, 229, 255, 267, 274 | settings help text |

`--text-dim` also appears as a **background fill** in one place:
- `src/components/settings/SettingsModal.css:386` — `.settings-toggle-track { background: var(--text-dim) }` — unchecked toggle track. After the shift, the toggle track will shift from hue-252 to hue-237 at a lower chroma. The visual difference is minimal at L=0.68 and is acceptable.

---

## 3. Contrast pairs — WCAG AA verification (computed)

The 4 pairs specified in story `frontend-uplift-2026q2-e1-s2` were computed using
the OKLab → XYZ → relative-luminance path for the **proposed after-shift values**:

| Pair | After-shift values | Ratio | WCAG AA |
|---|---|---|---|
| `--text` on `--bg` | `oklch(0.93 0.008 252)` on `oklch(0.10 0.006 237)` | **16.76:1** | PASS (≥4.5:1) |
| `--text` on `--panel` | `oklch(0.93 0.008 252)` on `oklch(0.14 0.007 237)` | **16.20:1** | PASS (≥4.5:1) |
| `--text-dim` on `--panel` | `oklch(0.68 0.009 237)` on `oklch(0.14 0.007 237)` | **6.92:1** | PASS (≥4.5:1) |
| `--text-dim` on `--panel-2` | `oklch(0.68 0.009 237)` on `oklch(0.17 0.008 237)` | **6.65:1** | PASS (≥4.5:1) |

**Key insight:** At these low L-values (0.10–0.22), chroma and hue shifts produce
negligible luminance change — the ratios are effectively identical before and after
the token shift. WCAG AA is not at risk. The a11y specialist's job is to verify
in-browser with axe-core and document the actual computed ratios; the pre-computed
values here confirm the shift is safe to proceed.

**`--text` is unchanged** (`oklch(0.93 0.008 252)` stays at hue 252 per the brief):
the `--text` token is not in the 5-token target list.

---

## 4. Hardcoded magic numbers that interact with the token cascade

The upstream critic brief §6 enumerated 3 hardcoded values that interact with `--bg`
or neutral surfaces:

### 4a. `#0b0e14` — effectively `--bg`-dark hardcoded

| File | Line | Rule | Impact of token shift |
|---|---|---|---|
| `src/sections/gantt/gantt.css` | 235 | `.gantt-bar { color: #0b0e14 }` | No interaction with 5 shifted tokens; this is text on `--accent`. Shift does not worsen or fix this. |
| `src/components/Modal.css` | 84 | `.modal-btn-primary { color: #0b0e14 }` | Same — text on `--accent`. Token shift does not affect. |
| `src/components/Modal.css` | 91 | `.modal-btn-danger:hover { color: #0b0e14 }` | Same — text on `--danger`. Token shift does not affect. |

**Implementer note:** The `#0b0e14` instances are pre-existing L2 tech debt (critic brief §6).
This milestone does NOT fix them — it's outside scope. Confirm zero interference with
the 5-token shift.

### 4b. `#fff` — hardcoded white

| File | Lines | Rule | Impact |
|---|---|---|---|
| `src/newtab/index.css` | 56 | `.btn-danger:hover { color: #fff }` | Text on `--danger` bg. No interaction with shifted neutral tokens. |
| `src/sections/sprint/sprint.css` | 28, 329, 439 | Active tab/button states on `--accent` bg | No interaction. `--accent` not in shifted set. |
| `src/components/settings/SettingsModal.css` | 127, 396 | Toggle thumb + category label | Line 396 is `.settings-toggle-thumb` on `--accent`; line 127 is text on `--accent`. Neither interacts with the 5 shifted tokens. |

**Implementer note:** All `#fff` instances are on `--accent` or `--danger` backgrounds.
The token shift only touches neutral surfaces. No interference.

### 4c. `rgba(255, 255, 255, 0.02)` weekend columns

| File | Lines | Rule | Impact |
|---|---|---|---|
| `src/sections/gantt/gantt.css` | 194, 216 | Weekend column backgrounds `rgba(255,255,255,0.02)` | Composites over the Gantt table background. The table rows use `var(--panel)` and `var(--panel-2)`. After the shift, the base surface changes slightly but the `rgba(255,255,255,0.02)` overlay is compositionally stable — it adds 2% white regardless of the base. Not broken by this shift. |

---

## 5. Ancillary token consumers that may surprise the implementer

### `--border` used as background fill

`SettingsModal.css:74` and `SettingsModal.css:185` render `--border` as a 1px divider
line via `background: var(--border)`. After the shift `--border` moves from
`oklch(0.22 0.018 252)` to `oklch(0.22 0.009 237)`. The divider becomes very slightly
less saturated. Visual parity is preserved; no layout change.

### `--text-dim` used as toggle-track fill

`SettingsModal.css:386`: `.settings-toggle-track { background: var(--text-dim) }`.
The unchecked toggle track will shift to `oklch(0.68 0.009 237)`. This is a subtle
warm-gray rather than cool-gray track background. Expected and acceptable per brief intent.

### Sprint subtask / badge backgrounds reference `--bg` directly

`sprint.css:382,517,540` use `var(--bg)` as their background (nested rows and drag
handles placed visually "below" the panel surface). After the shift, these surfaces
shift from hue 252 to hue 237 — consistent with the overall palette shift.

### MeshBackground — no interaction

`src/components/MeshBackground.css` uses `opacity: var(--mesh-intensity, 0.2)` only.
It does not reference any of the 5 target tokens. The mesh canvas is unaffected.

---

## 6. Where the light-theme counterparts live (out of scope, for reference)

`src/styles/theme.css` lines 66–82 (`[data-theme="light"]` block). The light-theme
values use hue 252 throughout and already have lower chroma than the dark theme.
The milestone brief explicitly leaves `--accent` untouched; the light theme `--accent`
is also untouched (line 75: `--accent: #4859d0`).

---

## 7. Summary of the 5 target declarations the implementer must change

All changes are in `src/styles/theme.css`, `:root` block only.

| Token | Current value | Proposed value (brief) |
|---|---|---|
| `--bg` | `oklch(0.10 0.012 252)` | `oklch(0.10 0.006 237)` |
| `--panel` | `oklch(0.14 0.014 252)` | `oklch(0.14 0.007 237)` |
| `--panel-2` | `oklch(0.17 0.016 252)` | `oklch(0.17 0.008 237)` |
| `--border` | `oklch(0.22 0.018 252)` | `oklch(0.22 0.009 237)` |
| `--text-dim` | `oklch(0.68 0.018 252)` | `oklch(0.68 0.009 237)` |

Chroma halved, hue shifted from 252 → 237 for all 5.
`--text` and `--accent` and all semantic tokens are untouched.

---

## 8. Riskiest assumption + alternative

The brief assumes `chroma-halved + hue-shifted` for `--panel`, `--panel-2`, `--border`,
and `--text-dim` follows the same arithmetic as the explicitly-given `--bg` example
(chroma × 0.5, hue −15 across the board). The only token given in full detail is `--bg`.

**Risk:** If the implementer applies a different hue target to `--text-dim` (which at
L=0.68 is a mid-range value where hue is perceptually visible), the shift from
cool-to-warm on dim text could land at a visually unexpected tone. The contrast
numbers stay safe regardless (all pairs remain above 6:1), but the perceptual intent
of "warm-gray text" could look different at L=0.68 than at L=0.10–0.22.

**Alternative path:** Pin `--text-dim` hue to 237 as specified. If the result feels
too warm in browser review, the fallback is to leave `--text-dim` hue at 252 and
only shift chroma (`oklch(0.68 0.009 252)`) — this still reduces blue-chroma tension
without a hue change and preserves the existing dim-text tone.

---

## 9. Acceptance criteria the implementer must meet

1. Edit exactly 5 token declarations in `src/styles/theme.css` `:root` block (lines 22–29); no other CSS files are modified.
2. `--accent`, `--accent-2`, `--accent-on`, `--danger`, `--warn`, `--ok`, `--text` remain at their current values.
3. `[data-theme="light"]` block is unchanged.
4. `npm run build` passes with zero TypeScript errors (CSS-only change; TypeScript is not exercised).
5. `vite build --report` shows zero bundle-size delta versus pre-change baseline (CSS-only; no new bytes added to any chunk).
6. All 4 WCAG AA pairs (`--text`/`--text-dim` on `--bg`/`--panel`/`--panel-2`) must be verified with axe-core or DevTools computed contrast on the rendered newtab; each pair must exceed 4.5:1. Pre-computed ratios (≥6.6:1 for all pairs) are provided in section 3 above as a sanity baseline.
7. The 3 `#0b0e14` and 5 `#fff` hardcoded values identified in section 4 are left untouched — they are out of scope for this milestone.
