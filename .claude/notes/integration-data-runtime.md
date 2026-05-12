# Integration Plan: Data Model, Storage & Runtime Application
# Settings Expansion — Data / Runtime Layer

> Author: Claude Sonnet 4.6 (sub-agent, integration specialist)
> Date: 2026-05-11
> Scope: Data model, storage migration, CSS theming runtime, Intl formatter layer,
>        mesh wiring, service-worker implications, export/import, bundle accounting.
> NOT in scope: SettingsModal UI controls (owned by sibling agent).
> Read before writing any code:
>   - src/types/index.ts
>   - src/storage/storage.ts, useStore.ts, constants.ts
>   - src/components/MeshBackground.tsx
>   - src/background/service-worker.ts
>   - All CSS files under src/

---

## Contract with the UI sibling agent

The UI agent designs controls (sliders, toggles, swatches, pickers). This plan owns
everything below the fold:

- The canonical `UserSettings` TypeScript interface (the **single source of truth**
  for what controls can read/write)
- The `DEFAULT_SETTINGS` const (what each field resolves to when absent)
- The storage migration strategy
- The CSS custom property names, their locations, and which HTML attribute drives them
- The `useFormatters()` hook API
- The mesh short-circuit contract
- The export/import envelope schema

The UI agent must write to `state.settings` via the existing
`storage.update((s) => ({ ...s, settings: { ...s.settings, <field>: <value> } }))` pattern.
It must read defaults from `DEFAULT_SETTINGS` for control initialization, not from
`state.settings` directly (a field absent in storage is `undefined`, not the default value).

---

## 1. Unified `UserSettings` Schema

### Auxiliary types (add above `UserSettings` in `src/types/index.ts`)

```typescript
/** Controls color scheme. "system" mirrors prefers-color-scheme at runtime. */
export type ThemeMode = "light" | "dark" | "system";

/** Base font size step. Maps to 13px / 15px / 17px. */
export type FontSizeScale = "sm" | "md" | "lg";

/** UI spacing density. Drives ~10 spacing custom properties. */
export type DensityLevel = "compact" | "default" | "spacious";

/** Wire color source for the 3D mesh. */
export type MeshColorMode = "auto" | "manual";
```

### Expanded `UserSettings` interface

Replace the current `UserSettings` in `src/types/index.ts` with:

```typescript
export interface UserSettings {
  // ── Existing ──────────────────────────────────────────────────────────
  /** Display name appended to the greeting. */
  name?: string | undefined;

  // ── Appearance: theme ─────────────────────────────────────────────────
  /**
   * v1. Three-way theme toggle.
   * "system" (default) mirrors prefers-color-scheme at runtime — never stored
   * as a resolved value. "light" / "dark" override regardless of OS.
   */
  theme?: ThemeMode | undefined;

  /**
   * v1. CSS-compatible color string (hex or oklch()).
   * Written to --accent custom property on <html>.
   * Default: "oklch(0.65 0.18 264)" (perceptual blue, works in both themes).
   */
  accentColor?: string | undefined;

  /**
   * v1. Spacing density multiplier.
   * Drives data-density attribute on <html>; overrides ~10 spacing tokens.
   * Default: "default".
   */
  density?: DensityLevel | undefined;

  /**
   * v2 deferred. Base font size step.
   * Low urgency: existing 15px default is fine; no layout restructuring needed now.
   * Keep the field defined here so the schema is stable when we add the control.
   */
  fontSize?: FontSizeScale | undefined;

  // ── Appearance: motion ────────────────────────────────────────────────
  /**
   * v1. In-app reduced-motion override.
   * undefined = defer to prefers-reduced-motion.
   * true = suppress animations even if OS is not in reduced-motion mode.
   * CANNOT be used to force animations ON when OS is in reduced-motion mode
   * (see §8 for the combination rule).
   */
  reducedMotion?: boolean | undefined;

  // ── Background ────────────────────────────────────────────────────────
  /**
   * v1. Whether to render the three.js mesh.
   * When false the lazy chunk is never fetched (~800 kB saved on first paint).
   * Default: true.
   */
  meshEnabled?: boolean | undefined;

  /**
   * v1. Wire opacity / intensity, 0–1. Passed directly to uAlpha uniform.
   * Default: 0.9 (matching the current hardcoded value).
   */
  meshIntensity?: number | undefined;

  /**
   * v2 deferred. Color source for the mesh wires.
   * "auto" = existing time-of-day cycle (default, current behavior).
   * "manual" = static color from meshColor field.
   * Defer: the auto cycle is Proclivity's identity; "manual" is a power-user feature.
   */
  meshColorMode?: MeshColorMode | undefined;

  /**
   * v2 deferred. Static wire color when meshColorMode === "manual".
   * CSS-compatible string (hex or oklch()).
   */
  meshColor?: string | undefined;

  // ── Locale / Formatting ───────────────────────────────────────────────
  /**
   * v1. 12h/24h toggle.
   * "auto" (default) = derive hourCycle from navigator.language at render time.
   * Maps "12h" -> hourCycle:"h12", "24h" -> hourCycle:"h23".
   */
  timeFormat?: "auto" | "12h" | "24h" | undefined;

  /**
   * v1. Display dates within ±7 days as relative strings ("2 days ago").
   * Falls back to absolute Intl.DateTimeFormat beyond that range.
   * Default: true.
   */
  relativeDates?: boolean | undefined;

  /**
   * v1. First day of the week. Affects Gantt column headers and sprint boundaries.
   * Default: derived from Intl.Locale.getWeekInfo(), fallback "mon".
   */
  weekStart?: "sun" | "mon" | "sat" | undefined;

  // ── Greeting ──────────────────────────────────────────────────────────
  /**
   * v1. Controls greeting display mode.
   * "time-of-day" (default) = "Good morning/afternoon/evening, {name}".
   * "none" = no greeting rendered at all.
   */
  greetingStyle?: "none" | "time-of-day" | undefined;

  // ── Section visibility ────────────────────────────────────────────────
  /**
   * v1. Per-section visibility flags.
   * Absent key = section is visible (default).
   * Object itself being undefined = all sections visible.
   *
   * Implemented as a nested object for diff-friendly partial updates:
   *   update((s) => ({ ...s, settings: { ...s.settings,
   *     sectionVisibility: { ...s.settings.sectionVisibility, gantt: false }
   *   }}))
   */
  sectionVisibility?: {
    today?: boolean | undefined;
    sprint?: boolean | undefined;
    longTerm?: boolean | undefined;
    gantt?: boolean | undefined;
    reminders?: boolean | undefined;
  } | undefined;

  // ── Reminders / Notifications ─────────────────────────────────────────
  /**
   * v1. Default lead time (minutes) prepopulated when creating a new reminder.
   * Accepted discrete values matching the picker options.
   * Default: 10.
   */
  defaultReminderLeadMinutes?: 0 | 5 | 10 | 15 | 30 | 60 | undefined;

  /**
   * v1. Default recurrence for new reminders.
   * Default: "none".
   */
  defaultRecurrence?: "none" | "daily" | "weekly" | undefined;

  /**
   * v1. Snooze duration offered in the notification action button.
   * Default: 10 (minutes).
   */
  snoozeMinutes?: 10 | 30 | 60 | undefined;

  /**
   * v1. Do-Not-Disturb quiet window. Both fields must be present or both absent.
   * Times are "HH:MM" 24-hour strings in the user's local clock.
   * from > to means the window crosses midnight (e.g. "22:00"–"07:00").
   * undefined = DND disabled.
   */
  quietHours?: {
    from: string;
    to: string;
  } | undefined;

  // ── Reserved / future ─────────────────────────────────────────────────
  /**
   * v2 deferred. UTC offset (minutes, from Date.getTimezoneOffset()) at the
   * time reminders were last created. Used to detect timezone drift on travel.
   * Not surfaced in the Settings UI in v1; purely internal.
   */
  lastKnownTzOffset?: number | undefined;
}
```

### Field classification summary

| Field | Tier | Justification |
|---|---|---|
| `theme` | v1 | Highest-leverage visual change; touches all existing CSS |
| `accentColor` | v1 | Single CSS var, zero bundle cost, immediate personal-use value |
| `density` | v1 | ~10 CSS var overrides, one enum — trivial to ship alongside theme |
| `reducedMotion` | v1 | The mesh already reads OS flag; surfacing it costs one boolean |
| `meshEnabled` | v1 | Battery/performance escape hatch; gates lazy three.js chunk |
| `meshIntensity` | v1 | `uAlpha` is already parameterized; wiring is 2 lines |
| `timeFormat` | v1 | Most-requested locale escape hatch; drives formatter cache |
| `relativeDates` | v1 | Boolean toggle; formatter cache already handles it |
| `weekStart` | v1 | Concrete Gantt/sprint impact; Intl.Locale fallback is safe |
| `greetingStyle` | v1 | `greetingFor()` already exists in App.tsx; add a null-guard |
| `sectionVisibility` | v1 | Hiding tabs has no layout cost; gating in App.tsx is 5 lines |
| `defaultReminderLeadMinutes` | v1 | Prepopulates form field; no SW impact |
| `defaultRecurrence` | v1 | Prepopulates form field; no SW impact |
| `snoozeMinutes` | v1 | SW reads this on notification click; minimal change |
| `quietHours` | v1 | SW checks before firing; the key safety feature |
| `fontSize` | v2 | UI is legible at 15px; complexity/CSS-risk ratio is high |
| `meshColorMode` | v2 | Auto cycle is the extension's identity; advanced opt-in only |
| `meshColor` | v2 | Depends on meshColorMode |
| `lastKnownTzOffset` | v2 | Travel banner UX not in v1 scope |

---

## 2. Defaults Strategy

### Decision: a `DEFAULT_SETTINGS` const in `src/storage/constants.ts`

```typescript
// Add to src/storage/constants.ts

import type { UserSettings } from "@/types";

export const DEFAULT_SETTINGS: Required<{
  [K in keyof UserSettings]: NonNullable<UserSettings[K]>
}> = {
  name:                       "",
  theme:                      "system",
  accentColor:                "oklch(0.65 0.18 264)",
  density:                    "default",
  fontSize:                   "md",
  reducedMotion:              false,
  meshEnabled:                true,
  meshIntensity:              0.9,
  meshColorMode:              "auto",
  meshColor:                  "oklch(0.57 0.18 264)",
  timeFormat:                 "auto",
  relativeDates:              true,
  weekStart:                  "mon",
  greetingStyle:              "time-of-day",
  sectionVisibility:          { today: true, sprint: true, longTerm: true, gantt: true, reminders: true },
  defaultReminderLeadMinutes: 10,
  defaultRecurrence:          "none",
  snoozeMinutes:              10,
  quietHours:                 undefined as unknown as { from: string; to: string },
  lastKnownTzOffset:          undefined as unknown as number,
} as const;
```

**Why a const instead of derived-at-read-time or per-field `?? fallback`:**

1. **Migration safety.** When a new build loads old stored data that lacks a field,
   `storage.get()` returns `{ ...EMPTY_STATE, ...stored }`. The `EMPTY_STATE.settings`
   is `{}` — so the new field is `undefined` in both the raw read and the merged result.
   `DEFAULT_SETTINGS` provides the single explicit fallback every consumer references,
   instead of scattering `?? "system"` across App.tsx, SettingsModal.tsx, service-worker.ts,
   and anywhere else settings are read.

2. **Control initialization.** The UI sibling needs to know what value to show in a
   control when the user has never saved that field. `DEFAULT_SETTINGS.theme` is the
   answer — no ambiguity.

3. **Alignment with `EMPTY_STATE`.** The existing pattern already uses a const for the
   shape of initial state. `DEFAULT_SETTINGS` mirrors that pattern one level deeper,
   specifically for the `settings` sub-object.

4. **No per-field `?? fallback` at call sites.** Callers use a helper:
   ```typescript
   // src/storage/constants.ts (add alongside DEFAULT_SETTINGS)
   export function resolvedSettings(s: UserSettings): Required<UserSettings> {
     return {
       ...DEFAULT_SETTINGS,
       ...s,
       sectionVisibility: { ...DEFAULT_SETTINGS.sectionVisibility, ...s.sectionVisibility },
     } as Required<UserSettings>;
   }
   ```
   The nested `sectionVisibility` object requires a one-level deep merge; all other fields
   are flat scalars. Callers use `resolvedSettings(state.settings)` when they need a
   guaranteed non-undefined value, and `state.settings.theme` when they only care if the
   user explicitly set it.

**Note on `quietHours` and `lastKnownTzOffset` in `DEFAULT_SETTINGS`:** these are
nullable by design (undefined = feature disabled). The `Required<>` mapped type forces
them into the const, which requires the `as unknown as T` cast shown above. The
`resolvedSettings()` helper preserves `undefined` for these fields because the spread
override from `s` keeps them as-is. This is correct behavior.

---

## 3. Storage Migration

### Current situation (verified by reading the code)

`storage.get()` in `src/storage/storage.ts` does:
```typescript
return { ...EMPTY_STATE, ...s };
```
This is a **shallow merge**. `EMPTY_STATE.settings` is `{}`, and the stored `s.settings`
is spread on top. Result: any field present in stored data is preserved; any field absent
from stored data is `{}` — i.e., `undefined`.

### Do new fields need an explicit migration?

**No, for all scalar fields.** The shallow merge plus `DEFAULT_SETTINGS` fallbacks in
`resolvedSettings()` handles all additive changes. A user with old data (only `name` stored)
loads a new build: `settings` is `{ name: "Chris" }`. `resolvedSettings()` returns
`{ ...DEFAULT_SETTINGS, name: "Chris" }` — every new field gets its default. No data lost,
no migration needed.

**Yes, one structural concern: `sectionVisibility`.** It is a nested object. The shallow
merge in `storage.get()` copies the reference to the stored `sectionVisibility` object if
it exists, which is fine. But `resolvedSettings()` does a one-level deep merge of this
sub-object, so adding a new key to `sectionVisibility` in a future version is also handled
without a migration.

### The only scenario requiring migration: renamed or type-changed fields

If a future version renames a field (e.g., `meshIntensity` → `meshOpacity`) or narrows
a type (e.g., `snoozeMinutes: number` → `snoozeMinutes: 10 | 30 | 60`), a migration
function is needed. The signature and location for any future migration:

```typescript
// src/storage/migrations.ts  (create this file when the first migration is needed)

import type { ProclivityState } from "@/types";

/**
 * Run all pending schema migrations on a raw stored state blob.
 * Called once inside storage.get() before returning to consumers.
 *
 * Each migration is idempotent: re-running on already-migrated data is safe.
 * Migrations never throw — on unexpected input they return the state unchanged.
 */
export function migrateState(raw: unknown): ProclivityState {
  let s = raw as ProclivityState;
  s = migrateV1toV2(s);
  // s = migrateV2toV3(s);  // add future migrations here
  return s;
}

function migrateV1toV2(s: ProclivityState): ProclivityState {
  // Example: if snoozeMinutes was stored as an arbitrary number, clamp to allowed values
  const snooze = s.settings.snoozeMinutes;
  if (snooze !== undefined && snooze !== 10 && snooze !== 30 && snooze !== 60) {
    return {
      ...s,
      settings: {
        ...s.settings,
        snoozeMinutes: 10,  // clamp to nearest valid value
      },
    };
  }
  return s;
}
```

Wire it into `storage.ts`:
```typescript
// In readRaw(), after parsing:
import { migrateState } from "./migrations";

async function readRaw(): Promise<ProclivityState> {
  if (isExtension) {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    const raw = (r[STORAGE_KEY] as ProclivityState | undefined) ?? EMPTY_STATE;
    return migrateState(raw);  // <-- add this line
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? (JSON.parse(raw) as ProclivityState) : EMPTY_STATE;
  return migrateState(parsed);  // <-- add this line
}
```

**For v1 settings as specified in this plan:** no migration file needed today. Create it
when the first breaking change happens.

---

## 4. Theming Runtime

### 4.1 Where the variables live

Create a new file: **`src/styles/theme.css`**

Import it exactly once, prepended to the existing `src/newtab/main.tsx` import list:
```typescript
// src/newtab/main.tsx  (no other change to this file)
import "../styles/theme.css";   // <-- add before index.css
import "./index.css";
```

`theme.css` owns all color and spacing custom properties. `index.css` will migrate its
existing `:root` color variables into `theme.css` and be left with only element-level
reset rules (box-sizing, body/html height, button/input base styles).

### 4.2 `data-theme` attribute placement

Apply on **`document.documentElement`** (`<html>`), not `<body>` or `#root`.

Rationale: CSS selectors like `[data-theme="dark"] input` and `[data-theme="dark"] ::-webkit-scrollbar`
only work from the topmost element. `<body>` misses browser-owned chrome (scrollbars);
`#root` misses any portaled content (modals rendered with `ReactDOM.createPortal` outside
`#root`). The existing `Modal.tsx` renders inside the React tree, so `#root` would
technically work today, but `<html>` is the durable choice.

Similarly: `data-density`, `data-font-size`, and `data-reduced-motion` all live on `<html>`.

### 4.3 OKLCH vs HSL — decision: OKLCH

The codebase has zero existing OKLCH usage. The existing tokens are hex. This is the right
moment to migrate because we are adding the token file from scratch.

Justification (specific to this codebase):
- The existing `--accent: #7c9cff` (a blue) and `--accent-2: #5be3c3` (a teal) have very
  different perceived brightnesses at the same hex luminance. OKLCH corrects this: both
  can be expressed at the same `L` value with different hue angles.
- The `reminders.css` already uses `color-mix(in srgb, var(--accent) 15%, transparent)` —
  indicating the project is comfortable with modern CSS color functions. OKLCH's relative
  color syntax (`oklch(from var(--accent) calc(l - 0.05) c h)`) enables hover states
  and tinted backgrounds without additional variables.
- Chrome 119+ supports OKLCH. The extension targets Chrome MV3, which implies Chrome 88+
  for MV3 support, but realistically users are on current versions. No polyfill risk.
- The existing dark-only hex palette maps cleanly to OKLCH:

  | Existing token | Hex | OKLCH equivalent |
  |---|---|---|
  | `--bg` | `#0f1115` | `oklch(0.10 0.012 252)` |
  | `--panel` | `#161a22` | `oklch(0.14 0.014 252)` |
  | `--panel-2` | `#1d222c` | `oklch(0.17 0.016 252)` |
  | `--border` | `#262c38` | `oklch(0.22 0.018 252)` |
  | `--text` | `#e7ecf3` | `oklch(0.93 0.008 252)` |
  | `--text-dim` | `#98a2b3` | `oklch(0.68 0.018 252)` |
  | `--accent` | `#7c9cff` | `oklch(0.70 0.14 268)` |
  | `--accent-2` | `#5be3c3` | `oklch(0.83 0.13 179)` |
  | `--danger` | `#ff7a7a` | `oklch(0.70 0.18 22)` |
  | `--warn` | `#ffb86b` | `oklch(0.80 0.15 60)` |
  | `--ok` | `#5be3c3` | `oklch(0.83 0.13 179)` |

### 4.4 Full `theme.css` content

```css
/* src/styles/theme.css
 * Single source of truth for all color and spacing tokens.
 * Imported once in src/newtab/main.tsx before index.css.
 *
 * Data attributes on <html> drive theme/density/motion:
 *   data-theme="light|dark"       (set by useThemeSync; default: dark matches current)
 *   data-density="compact|default|spacious"
 *   data-reduced-motion="true"
 * --accent is overridden inline via style attribute on <html>.
 */

/* ── Dark theme (default, matching current palette) ───────────── */
:root {
  color-scheme: dark;

  /* Elevation / surface */
  --bg:       oklch(0.10 0.012 252);
  --panel:    oklch(0.14 0.014 252);
  --panel-2:  oklch(0.17 0.016 252);
  --border:   oklch(0.22 0.018 252);

  /* Text */
  --text:     oklch(0.93 0.008 252);
  --text-dim: oklch(0.68 0.018 252);

  /* Accent — overridden by JS for user-chosen color */
  --accent:   oklch(0.70 0.14 268);
  --accent-2: oklch(0.83 0.13 179);

  /* Semantic */
  --danger:   oklch(0.70 0.18 22);
  --warn:     oklch(0.80 0.15 60);
  --ok:       oklch(0.83 0.13 179);

  /* Shape */
  --radius:   10px;

  /* Spacing scale — default density */
  --space-1:    4px;
  --space-2:    8px;
  --space-3:    12px;
  --space-4:    16px;
  --space-5:    20px;
  --row-height: 44px;
  --section-gap:20px;
  --panel-pad:  16px 20px;
  --form-gap:   12px;

  /* Typography */
  --font-size-base: 15px;
  --line-height-base: 1.5;

  /* Native form elements follow --accent automatically */
  accent-color: var(--accent);
}

/* ── Light theme ──────────────────────────────────────────────── */
[data-theme="light"] {
  color-scheme: light;

  --bg:       oklch(0.97 0.004 252);
  --panel:    oklch(1.00 0.000 252);
  --panel-2:  oklch(0.95 0.005 252);
  --border:   oklch(0.88 0.008 252);
  --text:     oklch(0.15 0.012 252);
  --text-dim: oklch(0.45 0.018 252);
  --accent:   oklch(0.55 0.18 268);   /* slightly darker for contrast on white */
  --accent-2: oklch(0.50 0.15 179);
  --danger:   oklch(0.55 0.22 22);
  --warn:     oklch(0.60 0.18 60);
  --ok:       oklch(0.50 0.15 179);
}

/* ── System theme — no overrides here; resolved by JS ────────── */
/* When theme === "system", JS reads prefers-color-scheme and sets
   data-theme="dark" or data-theme="light". No CSS-only mechanism needed. */

/* ── Density scale ────────────────────────────────────────────── */
[data-density="compact"] {
  --space-1:     2px;
  --space-2:     6px;
  --space-3:     8px;
  --space-4:     12px;
  --space-5:     16px;
  --row-height:  32px;
  --section-gap: 12px;
  --panel-pad:   10px 14px;
  --form-gap:    8px;
}

[data-density="spacious"] {
  --space-1:     6px;
  --space-2:     12px;
  --space-3:     18px;
  --space-4:     24px;
  --space-5:     28px;
  --row-height:  52px;
  --section-gap: 28px;
  --panel-pad:   20px 28px;
  --form-gap:    16px;
}

/* ── Reduced motion ───────────────────────────────────────────── */
/* data-reduced-motion="true" is set by JS when settings.reducedMotion === true
   OR when prefers-reduced-motion: reduce is detected (whichever is stronger). */
[data-reduced-motion="true"] *,
[data-reduced-motion="true"] *::before,
[data-reduced-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

/* OS-level reduced-motion also kills animations (belt-and-suspenders) */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 4.5 `prefers-color-scheme` + `theme: "system"` interplay

The `<html>` element's `data-theme` attribute must be set **synchronously before first
paint** to prevent a flash-of-wrong-theme. In a new-tab extension, `chrome.storage.local`
is async, so there is an unavoidable async gap. Mitigation: suppress transitions during
initialization (see `useThemeSync` below).

```typescript
// src/hooks/useThemeSync.ts  (new file)
//
// Reads the resolved settings and applies data-* attributes to <html>.
// Called once at the top of App.tsx, after useStore() returns.

import { useEffect } from "react";
import type { UserSettings } from "@/types";
import { DEFAULT_SETTINGS, resolvedSettings } from "@/storage/constants";

export function useThemeSync(settings: UserSettings): void {
  const rs = resolvedSettings(settings);

  useEffect(() => {
    const html = document.documentElement;

    // ── Suppress transitions during attribute application ──────
    html.style.setProperty("transition", "none");
    // One rAF is enough to let the browser apply the attribute before
    // re-enabling transitions. requestAnimationFrame fires after paint.
    const rafId = requestAnimationFrame(() => {
      html.style.removeProperty("transition");
    });

    // ── Theme ──────────────────────────────────────────────────
    const resolvedTheme: "light" | "dark" =
      rs.theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : rs.theme;
    html.setAttribute("data-theme", resolvedTheme);

    // ── Density ────────────────────────────────────────────────
    if (rs.density === "default") {
      html.removeAttribute("data-density");   // :root defaults apply
    } else {
      html.setAttribute("data-density", rs.density);
    }

    // ── Reduced motion ─────────────────────────────────────────
    const osReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectiveReduced = osReducedMotion || rs.reducedMotion;
    if (effectiveReduced) {
      html.setAttribute("data-reduced-motion", "true");
    } else {
      html.removeAttribute("data-reduced-motion");
    }

    // ── Accent color ───────────────────────────────────────────
    // Written as inline style so it cascades above the :root block
    // without needing a new CSS rule for every possible color.
    html.style.setProperty("--accent", rs.accentColor);

    return () => cancelAnimationFrame(rafId);
  }, [rs.theme, rs.density, rs.reducedMotion, rs.accentColor]);

  // ── System theme: subscribe to OS changes ──────────────────
  useEffect(() => {
    if (rs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute(
        "data-theme",
        e.matches ? "dark" : "light",
      );
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [rs.theme]);
}
```

Call site in `App.tsx` (the `Header` component which already calls `useStore()`):
```typescript
// Inside Header() component, after const { state } = useStore():
useThemeSync(state.settings);
```

### 4.6 Density variables — what they replace in current CSS

The density system introduces 8 spacing tokens (`--space-1` through `--space-5`,
`--row-height`, `--section-gap`, `--panel-pad`, `--form-gap`) that must replace
hardcoded pixel values in the existing CSS files. Specific mappings:

| Current hardcoded value | Location | Replace with |
|---|---|---|
| `padding: 10px 12px` (`.todo-item`) | `sections.css:26` | `padding: var(--space-2) var(--space-3)` |
| `gap: 4px` (`.todo-list`) | `sections.css:16` | `gap: var(--space-1)` |
| `gap: 8px` (`.todo-input`) | `sections.css:3` | `gap: var(--space-2)` |
| `margin-bottom: 16px` (`.todo-input`) | `sections.css:4` | `margin-bottom: var(--space-4)` |
| `padding: 16px 20px` (`.reminder-form`) | `reminders.css:8` | `padding: var(--panel-pad)` |
| `gap: 12px` (`.reminder-form-grid`) | `reminders.css:21` | `gap: var(--form-gap)` |
| `padding: 12px 16px` (`.reminder-item`) | `reminders.css:79` | `padding: var(--space-3) var(--space-4)` |
| `padding: 16px` (`.sprint-form`) | `sprint.css:55` | `padding: var(--panel-pad)` |
| `gap: 10px` (`.sprint-form`) | `sprint.css:52` | `gap: var(--form-gap)` |
| `padding: 48px 32px 96px` (`.app`) | `App.css:4` | keep as-is; this is layout, not density |
| `margin-bottom: 32px` (`.header`) | `App.css:15` | `margin-bottom: var(--section-gap)` |

This is NOT an exhaustive list — it identifies the highest-value replacements. The
implementor should search for hardcoded `padding:`, `gap:`, and `margin-bottom:` values
in all 9 CSS files and evaluate each against the token map.

### 4.7 Accent color injection

The inline `style.setProperty("--accent", ...)` in `useThemeSync` is the write path.
Read path: every existing `var(--accent)` reference in CSS automatically picks up the
overridden value — no other changes needed for the 27 existing `var(--accent)` usages.

Additionally, the `:root` declaration adds:
```css
accent-color: var(--accent);
```
This makes native `<input type="checkbox">`, `<input type="range">`, `<input type="radio">`,
and `<select>` elements follow the accent color with zero per-element CSS. Currently
RemindersManager and SprintManager use these native elements; they all get the tint for free.

For the `<input type="color">` picker the UI sibling will add for accent selection: the
`value` it emits is hex. The write path should store it as-is (hex is valid CSS). No
conversion to OKLCH is required for storage — OKLCH is for authoring tokens, not for
runtime user values.

### 4.8 CSS files that need updating

Every file under `src/` that must be touched when the theme system ships:

| File | Changes required |
|---|---|
| `src/newtab/index.css` | Migrate `:root` color vars to `theme.css`; remove hex values; keep element resets |
| `src/newtab/App.css` | Replace hardcoded spacing with `--space-*` / `--section-gap` tokens |
| `src/components/Modal.css` | Replace `rgba(0,0,0,0.6)` backdrop with `oklch(0 0 0 / 60%)` for theme awareness |
| `src/components/MeshBackground.css` | Add `[data-reduced-motion="true"] .mesh-background { animation: none; }` |
| `src/components/SettingsModal.css` | Replace `opacity: 0.85` on hint text with `color: oklch(from var(--text-dim) l c h / 0.85)` |
| `src/sections/sections.css` | Replace hardcoded padding/gap with spacing tokens |
| `src/sections/gantt/gantt.css` | Replace hardcoded spacing; replace `rgba(255,255,255,0.02)` weekend col with `color-mix(in oklch, var(--text) 2%, transparent)` for light-mode correctness |
| `src/sections/reminders/reminders.css` | Replace hardcoded spacing; verify `color-mix` badge already works (it does — already uses `var(--accent)`) |
| `src/sections/sprint/sprint.css` | Replace hardcoded spacing |

**Do not touch:** `src/components/MeshBackground.css` opacity values (0.18 overall opacity
is the mesh's visual weight — not a density or theme token).

---

## 5. Mesh Background Integration

### 5.1 Short-circuiting the lazy import when `meshEnabled: false`

The key constraint: when `meshEnabled` is `false`, the `import()` call inside `lazy()`
must never be evaluated. React's `lazy()` defers the import until the component is first
rendered inside a `<Suspense>` boundary. **The conditional must gate the rendering, not the
import call.**

Current code in `App.tsx`:
```typescript
const MeshBackground = lazy(() =>
  import("@/components/MeshBackground").then((m) => ({ default: m.MeshBackground })),
);
// ...
<Suspense fallback={null}>
  <MeshBackground />
</Suspense>
```

Required change:
```typescript
// App.tsx — no changes to the lazy() declaration needed.
// Change only the render site:

const meshEnabled = resolvedSettings(state.settings).meshEnabled;

// In JSX:
{meshEnabled && (
  <Suspense fallback={null}>
    <MeshBackground
      intensity={state.settings.meshIntensity ?? DEFAULT_SETTINGS.meshIntensity}
      reducedMotion={effectiveReducedMotion}
    />
  </Suspense>
)}
```

When `meshEnabled` is `false`, the `<Suspense>` is never rendered, so the lazy component
is never instantiated, so the dynamic `import()` is never called, so the ~800 kB three.js
chunk is never fetched. Verified by React's lazy semantics: "React will suspend and try to
render the lazy component; if it hasn't been loaded, it suspends... the import() call
happens the first time the component tries to render."

### 5.2 `meshIntensity` → `uAlpha` wiring

In `MeshBackground.tsx`, the `WarpMesh` component's `uniforms` object currently has:
```typescript
uAlpha: { value: 0.9 },
```
This is a hardcoded constant. The `MeshBackground` exported component does not accept props.

Required changes:

**Step 1:** Add props interface to `MeshBackground.tsx`:
```typescript
interface MeshBackgroundProps {
  /** Wire opacity, 0–1. Passed to uAlpha uniform. Default: 0.9. */
  intensity?: number | undefined;
  /** When true, sets frameloop="demand" regardless of OS preference. */
  reducedMotion?: boolean | undefined;
}
```

**Step 2:** Thread `intensity` through to `WarpMesh`:
```typescript
// WarpMesh now accepts intensity prop
function WarpMesh({ intensity }: { intensity: number }) {
  // ...
  const uniforms = useMemo(
    () => ({
      // ... (all other uniforms unchanged)
      uAlpha: { value: intensity },   // was: { value: 0.9 }
    }),
    [],  // still no deps: intensity is stable (from resolvedSettings at mount)
  );
  // ...
}
```

**Step 3:** Update the `MeshBackground` component:
```typescript
export function MeshBackground({ intensity = 0.9, reducedMotion = false }: MeshBackgroundProps) {
  const osReducedMotion = useMemo(
    () => typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const effectiveReduced = reducedMotion || osReducedMotion;  // OR semantics
  // ... (active/visibility logic unchanged)
  return (
    <div className="mesh-background" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 11], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={effectiveReduced || !active ? "demand" : "always"}
      >
        <WarpMesh intensity={intensity} />
      </Canvas>
    </div>
  );
}
```

**Note on intensity reactivity:** `intensity` comes from `resolvedSettings(state.settings).meshIntensity`.
If the user changes it in the settings modal, `state` updates, `intensity` prop changes,
but the `uniforms` object was created with `useMemo([], [])` — the empty deps array means
the uniform value is NOT reactive. For v1 this is acceptable: the mesh fades in at the
new intensity on the next tab open, and in the settings modal context the user sees the
old value live and the new one on next open. If live preview is desired (v2), add
`intensity` to the `useMemo` deps and use a `useEffect` to update `uniforms.uAlpha.value`
imperatively when the prop changes (Three.js uniforms are mutable).

---

## 6. `Intl` Formatter Layer

### Design decisions

- A **module-level cache** (`Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat>`)
  is the right home for formatter instances. Constructing `Intl.DateTimeFormat` is
  expensive (locale data loading); caching per `locale:options` key amortizes the cost.
- Exposed as a **`useFormatters()` hook** that reads from the settings context/store.
  The hook returns a stable object reference (via `useMemo`) so consumers don't re-render
  when unrelated settings change.
- `navigator.language` is read at call time inside the formatters, not stored — it can
  change between browser sessions and should always reflect the current locale.

### Complete implementation sketch

```typescript
// src/hooks/useFormatters.ts
//
// Provides cached Intl formatter functions driven by UserSettings.
// Re-creates formatters only when settings fields that affect them change.
// Zero external dependencies.

import { useMemo } from "react";
import type { UserSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/storage/constants";

// ── Module-level formatter cache ──────────────────────────────────────────
// Survives re-renders; cleared only when the key changes.
// Key: "<locale>:<hourCycle>:<dateStyle>" etc.

const dtfCache = new Map<string, Intl.DateTimeFormat>();
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function getDtf(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(opts)}`;
  let fmt = dtfCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    dtfCache.set(key, fmt);
  }
  return fmt;
}

function getRtf(locale: string): Intl.RelativeTimeFormat {
  let fmt = rtfCache.get(locale);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    // "auto" gives "yesterday" / "tomorrow" instead of "-1 day" / "1 day"
    rtfCache.set(locale, fmt);
  }
  return fmt;
}

// ── Locale helpers ────────────────────────────────────────────────────────

function resolveHourCycle(
  timeFormat: "auto" | "12h" | "24h",
  locale: string,
): "h12" | "h23" | undefined {
  if (timeFormat === "12h") return "h12";
  if (timeFormat === "24h") return "h23";
  // "auto": derive from locale; return undefined to let Intl decide natively
  // (avoids constructing a full Intl.DateTimeFormat just to read hourCycle)
  return undefined;
}

// ── Public hook ───────────────────────────────────────────────────────────

export interface Formatters {
  /**
   * Format a Date or epoch ms as a time string.
   * Respects settings.timeFormat (12h/24h/auto).
   * Example outputs: "5:30 PM" | "17:30"
   */
  formatTime(date: Date | number): string;

  /**
   * Format a Date or epoch ms as a date string.
   * Always locale-aware; always absolute (no relative).
   * Example output: "May 11, 2026"
   */
  formatDate(date: Date | number): string;

  /**
   * Format a Date or epoch ms as a relative or absolute string.
   * Respects settings.relativeDates.
   * Within ±7 days: "2 days ago" / "tomorrow" / "in 3 days"
   * Beyond ±7 days: falls back to formatDate().
   * Example outputs: "yesterday" | "in 2 days" | "May 11, 2026"
   */
  formatRelative(date: Date | number): string;
}

export function useFormatters(settings: UserSettings): Formatters {
  const timeFormat  = settings.timeFormat  ?? DEFAULT_SETTINGS.timeFormat;
  const relativeDates = settings.relativeDates ?? DEFAULT_SETTINGS.relativeDates;

  return useMemo((): Formatters => {
    // Read locale at memo creation time (stable within a render pass)
    const locale = navigator.language;
    const hourCycle = resolveHourCycle(timeFormat, locale);

    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      ...(hourCycle !== undefined ? { hourCycle } : {}),
    };
    const dateOpts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

    return {
      formatTime(d: Date | number): string {
        return getDtf(locale, timeOpts).format(typeof d === "number" ? d : d);
      },

      formatDate(d: Date | number): string {
        return getDtf(locale, dateOpts).format(typeof d === "number" ? d : d);
      },

      formatRelative(d: Date | number): string {
        const ts = typeof d === "number" ? d : d.getTime();
        if (!relativeDates) {
          return getDtf(locale, dateOpts).format(ts);
        }
        const diffMs  = ts - Date.now();
        const diffDays = Math.round(diffMs / 86_400_000);
        if (Math.abs(diffDays) <= 7) {
          // Intl.RelativeTimeFormat handles the ±1 day / exact-day boundary automatically
          // when numeric:"auto" — "yesterday", "today", "tomorrow" etc.
          return getRtf(locale).format(diffDays, "day");
        }
        // Beyond 1 week: absolute date is more informative than "in 14 days"
        return getDtf(locale, dateOpts).format(ts);
      },
    };
  // Re-create only when the settings fields that affect formatting change.
  // navigator.language is stable within a session; if it changes, the user
  // has restarted the browser and a new tab will re-mount from scratch.
  }, [timeFormat, relativeDates]);
}
```

**Usage in components:**
```typescript
// In App.tsx Header component or any consumer:
const formatters = useFormatters(state.settings);

// Replace existing:
//   now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
// with:
//   formatters.formatTime(now)

// Replace existing:
//   now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
// with a dedicated full-date formatter (add formatFullDate() if needed for the header)
```

**Wire-up note:** `useFormatters` is a pure computation hook. It does not read from
`useStore()` directly — the caller passes `state.settings`. This keeps it testable and
avoids entangling it with the storage layer. The `Header` component is the natural call site
since it already owns the 1-second clock tick.

---

## 7. Service Worker / `chrome.alarms` Implications

### Which settings the SW must observe

| Setting | SW needs it | When |
|---|---|---|
| `quietHours` | Yes | Before calling `chrome.notifications.create()` |
| `snoozeMinutes` | Yes | When a "Snooze" notification button is pressed |
| `defaultReminderLeadMinutes` | No | UI-only: prepopulates the form; SW never reads it |
| `defaultRecurrence` | No | UI-only: prepopulates the form |
| `sectionVisibility.reminders` | Yes (weakly) | Could suppress notifications if section is hidden; see below |

### Read strategy: per-alarm-fire read, not subscription

The SW already calls `readState()` inside `handleAlarm()`. Reading settings from the same
`chrome.storage.local.get()` call costs nothing extra. **Do not add a `chrome.storage.onChanged`
subscription for settings** — the SW's `onChanged` listener is already wired for reminder
diffs; adding settings tracking there increases complexity with no benefit. The freshest
settings are always available via the per-fire `readState()`.

### Minimum change: quiet hours gating

Add a helper inside `service-worker.ts`:

```typescript
// src/background/service-worker.ts — add this helper

/**
 * Returns true if the current local time falls within the user's quiet hours window.
 * Supports windows that cross midnight (from > to).
 */
function isInQuietHours(quietHours: { from: string; to: string }): boolean {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [fromH = 0, fromM = 0] = quietHours.from.split(":").map(Number);
  const [toH = 0,   toM = 0  ] = quietHours.to.split(":").map(Number);
  const fromMinutes = fromH * 60 + fromM;
  const toMinutes   = toH   * 60 + toM;

  if (fromMinutes <= toMinutes) {
    // Same-day window (e.g. 09:00–17:00)
    return nowMinutes >= fromMinutes && nowMinutes < toMinutes;
  } else {
    // Crosses midnight (e.g. 22:00–07:00)
    return nowMinutes >= fromMinutes || nowMinutes < toMinutes;
  }
}
```

Wire it into `handleAlarm()` after reading state:

```typescript
async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const id = reminderIdFromAlarm(alarm.name);
  if (!id) return;

  const state = await readState();
  if (!state) return;

  const reminder = state.reminders.find((r) => r.id === id);
  if (!reminder) return;

  // ── Quiet hours check ─────────────────────────────────────────
  const qh = state.settings.quietHours;
  if (qh !== undefined && isInQuietHours(qh)) {
    // Defer: reschedule for end of quiet window on the same or next day
    const [toH = 7, toM = 0] = qh.to.split(":").map(Number);
    const resumeToday = new Date();
    resumeToday.setHours(toH, toM, 0, 0);
    const deferUntil =
      resumeToday.getTime() > Date.now()
        ? resumeToday.getTime()
        : resumeToday.getTime() + 24 * 60 * 60_000; // already past, use tomorrow
    chrome.alarms.create(alarm.name, { when: deferUntil });
    return;  // do NOT fire the notification
  }

  // ── Fire notification ─────────────────────────────────────────
  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "icon-128.png",
    title: "Proclivity",
    message: reminder.title,
    priority: 2,
  });
  // ... (rest of handleAlarm unchanged)
}
```

### Snooze implementation

Snooze requires a notification action button. Notification action buttons in Chrome MV3
extensions require defining `buttons` in `chrome.notifications.create()` and handling
`chrome.notifications.onButtonClicked`. Add to `service-worker.ts`:

```typescript
// In handleAlarm(), change notifications.create() call to:
chrome.notifications.create(alarm.name, {
  type: "basic",
  iconUrl: "icon-128.png",
  title: "Proclivity",
  message: reminder.title,
  priority: 2,
  buttons: [{ title: `Snooze ${state.settings.snoozeMinutes ?? 10} min` }],
});

// Add new listener (once, at module level):
chrome.notifications.onButtonClicked.addListener(
  (notificationId: string, buttonIndex: number) => {
    if (buttonIndex !== 0) return;  // only one button
    const state_p = readState();
    state_p.then((state) => {
      if (!state) return;
      const snoozeMs = (state.settings.snoozeMinutes ?? 10) * 60_000;
      chrome.alarms.create(notificationId, { when: Date.now() + snoozeMs });
      chrome.notifications.clear(notificationId);
    });
  },
);
```

### `sectionVisibility.reminders` — recommendation

**Do not gate notifications based on section visibility.** The user hiding the Reminders
tab in the UI is a display preference, not a "disable notifications" action. Suppressing
notifications because a section is hidden would be a non-obvious side effect that could
cause missed reminders. If the user wants no notifications, they should use `quietHours`
with a 24-hour window, or the OS notification settings.

---

## 8. `reducedMotion` Runtime

### Combination rule: OS-or-user, never user-disables-OS

```
effectiveReducedMotion = settings.reducedMotion || osPreference
```

Where `osPreference = window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

The user setting can only **add** reduced-motion preference, never remove it. Rationale:
the OS setting exists because vestibular disorders and other conditions make motion
physically harmful. A per-app override that lets a user re-enable motion while the OS
is in reduced-motion mode could cause real harm. The setting should be labelled in the
UI as "Reduce motion in Proclivity" (additive) rather than "Motion setting" (bi-directional).

### Runtime application locations

1. **CSS:** `useThemeSync` sets `data-reduced-motion="true"` on `<html>` when effective.
   The `theme.css` rule `[data-reduced-motion="true"] * { animation-duration: 0.01ms !important }` kills all CSS animations.
   The OS-level `@media (prefers-reduced-motion: reduce)` rule also applies (belt-and-suspenders).

2. **three.js mesh:** `MeshBackground` receives `reducedMotion={effectiveReducedMotion}`
   prop and sets `frameloop="demand"` when true. This does not stop rendering entirely
   but stops the per-frame `useFrame` loop — the mesh renders once and freezes.

3. **Modal animations:** `Modal.css` has `animation: modal-fade-in 120ms` and
   `modal-slide-in 150ms`. These are CSS animations and are killed by rule #1 above
   when `data-reduced-motion="true"` is set on `<html>`. No JS change needed.

4. **Sprint progress bar:** `sprint.css` has `transition: width 0.3s ease` on
   `.sprint-progress-bar-fill`. Same — killed by CSS rule.

5. **MeshBackground.css fade-in:** `animation: mesh-fade-in 800ms`. Killed by CSS rule.
   The existing `@media (prefers-reduced-motion: reduce) { animation: none }` in
   `MeshBackground.css` is redundant once the global rule in `theme.css` exists, but
   is harmless and provides fallback if the theme.css import order is wrong.

---

## 9. Export / Import Implementation

### JSON envelope shape

```typescript
// src/storage/exportImport.ts

export interface ProclivityExport {
  /** Integer schema version. Increment when ProclivityState shape changes in a
   *  breaking way. Import logic runs migrations up to the current version. */
  schemaVersion: 1;
  /** Informational — the extension version at time of export. Not used for migration. */
  appVersion: string;
  /** ISO 8601 timestamp. Human-readable; not used by import logic. */
  exportedAt: string;
  /** The full ProclivityState verbatim, as of the export moment. */
  data: ProclivityState;
}
```

### Export function

```typescript
// src/storage/exportImport.ts (continued)

import type { ProclivityState } from "@/types";
import { storage } from "./storage";

// Read from manifest at build time (Vite replaces this via define or import.meta.env)
declare const __APP_VERSION__: string;

export async function exportData(): Promise<void> {
  const state = await storage.get();
  const envelope: ProclivityExport = {
    schemaVersion: 1,
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `proclivity-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Note on `__APP_VERSION__`:** Add to `vite.config.ts`:
```typescript
define: {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
}
```

### Import function

```typescript
// src/storage/exportImport.ts (continued)

import { migrateState } from "./migrations";

export type ImportResult =
  | { ok: true }
  | { ok: false; error: string };

export async function importData(file: File): Promise<ImportResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Could not read the file." };
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !("schemaVersion" in envelope) ||
    typeof (envelope as Record<string, unknown>).schemaVersion !== "number" ||
    !("data" in envelope)
  ) {
    return { ok: false, error: "File does not appear to be a Proclivity backup." };
  }

  const raw = (envelope as { data: unknown }).data;
  let migrated: ProclivityState;
  try {
    migrated = migrateState(raw);
  } catch {
    return { ok: false, error: "Backup data could not be migrated to the current schema." };
  }

  await storage.set(migrated);
  return { ok: true };
}
```

### File reader in the UI (contract for SettingsModal sibling)

The UI agent wires a `<input type="file" accept=".json">` to this import function:

```typescript
// Pattern only — UI agent implements the actual control
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const result = await importData(file);
  if (!result.ok) {
    // Show error to user (inline message, not an alert())
    setImportError(result.error);
  } else {
    // storage.subscribe in useStore() fires automatically — no manual refresh needed
    onClose();
  }
};
```

### Location in codebase

New file: **`src/storage/exportImport.ts`**

The `exportData` and `importData` functions are pure utilities with no React dependency.
They can be called from anywhere but will typically be called from button `onClick` handlers
in the SettingsModal. No new dependencies required; `File` and `Blob` are browser globals.

---

## 10. Bundle-Size Accounting

### Initial chunk budget: ~200 kB (per CLAUDE.md)

Three.js + `@react-three/fiber` is already lazy-imported; it does NOT count against the
initial chunk. The initial chunk today is the React app without three.js.

### Per-setting cost analysis (v1 ship settings only)

| Change | Estimated size delta | Notes |
|---|---|---|
| `src/types/index.ts` expanded schema | ~0 kB | TypeScript types are erased at compile time |
| `src/storage/constants.ts` + `DEFAULT_SETTINGS` | ~0.3 kB | Small const object |
| `src/styles/theme.css` | ~1.5 kB (minified) | CSS; not counted toward JS chunk budget |
| `src/hooks/useThemeSync.ts` | ~0.8 kB | Small hook, no deps |
| `src/hooks/useFormatters.ts` | ~1.2 kB | Map + 3 Intl constructors; no library |
| `src/storage/exportImport.ts` | ~1.0 kB | Pure functions; `Blob`/`URL` are browser APIs |
| `src/storage/migrations.ts` | ~0.2 kB | Empty in v1; structure only |
| SW changes (`isInQuietHours`, notification buttons) | 0 kB to initial | SW is a separate bundle |
| CSS density token replacements (no new selectors) | ~0 kB net | Tokens replace hardcoded values 1:1 |

**Total initial chunk impact: ~3.5 kB** — comfortably within the 200 kB budget.

### What should be lazy-imported

Nothing new in v1 needs lazy importing. The existing lazy import of `MeshBackground` is
the only heavy module and is already handled. The formatter hook (`useFormatters`) uses
only browser-native `Intl` APIs — no external library. The export/import utilities use
`Blob`/`URL.createObjectURL` — also browser APIs.

**Explicitly do NOT add:** any color picker library (react-colorful, etc.) for the accent
color UI. The `<input type="color">` native picker covers the power-user case with zero
kB added to the bundle.

---

## Risks & Open Questions

1. **Flash of wrong theme on tab open.** `chrome.storage.local` is async. Between page
   load and the first `useStore()` resolution (typically 10–50ms), `<html>` has no
   `data-theme` attribute — it renders dark (the `:root` default). If the user is in light
   mode, there will be a dark flash. Mitigation: add a `<script>` tag directly in `newtab.html`
   that reads from `localStorage` as a synchronous pre-paint hint (a common Next.js pattern).
   However, this requires writing a thin copy of the resolved theme to `localStorage` on each
   settings save. Evaluate whether the flash is acceptable before investing in this.

2. **`chrome.storage.onChanged` in the SW fires on every settings write.** The existing
   `diffAndSyncAlarms()` listener diffs only `reminders`. If settings change frequently
   (e.g. the user drags the intensity slider), the SW's `onChanged` fires repeatedly but
   does nothing harmful — it returns early because only `reminders` keys are checked.
   No code change needed; this is benign but worth knowing.

3. **`meshIntensity` is not live-reactive.** As noted in §5, the `useMemo([], [])` pattern
   for three.js uniforms means intensity changes do not take effect until the next tab open.
   If the UI sibling implements a live preview slider for mesh intensity, the slider will
   appear to do nothing while the settings modal is open. Resolve before the UI is built:
   either accept the limitation (simplest) or add `useEffect` + imperative uniform mutation
   (more complex but enables live preview).

4. **`exactOptionalPropertyTypes` and the `sectionVisibility` nested object.** The pattern
   `{ ...s.settings.sectionVisibility, gantt: false }` is valid, but the spread of a
   potentially-undefined value (`s.settings.sectionVisibility`) must be written as
   `{ ...(s.settings.sectionVisibility ?? {}) }` to avoid a TypeScript error under
   `exactOptionalPropertyTypes`. All update call sites must use this pattern.

5. **`quietHours` midnight-crossing edge case in the SW.** The defer-to-end-of-window
   logic in `handleAlarm()` (§7) constructs a `Date` for "end of quiet window today".
   If the window crosses midnight (e.g. 22:00–07:00) and the current time is 02:00, the
   `toH:toM` target (07:00) is still today — `resumeToday.getTime() > Date.now()` is true
   — and it defers correctly. But if the current time is 08:00 and the window is 22:00–07:00,
   the check `isInQuietHours` returns false and we never reach the deferral logic. Edge cases
   around the exact boundary minute are worth a unit test before shipping.

6. **`snoozeMinutes` notification button requires `notifications` permission.** The current
   `manifest.json` likely already declares `"notifications"` since `chrome.notifications.create`
   is already called. Verify that `"notifications"` is in `permissions` and that
   `chrome.notifications.onButtonClicked` is available — it is, but only for notifications
   with `buttons` defined. No manifest change needed for MV3; confirm before shipping.

7. **OKLCH browser compatibility for CSS relative color syntax.** `oklch(from var(--accent) ...)` 
   (CSS relative color syntax, used in the "hover state" example in the research) requires
   Chrome 119+. Chrome 119 was released October 2023. For a MV3 extension targeting current
   Chrome, this is safe. However, do not use relative color syntax in `theme.css` on day one
   — verify the target Chrome version via `"minimum_chrome_version"` in `manifest.json` before
   authoring any `oklch(from ...)` rules. Fallback: explicit `--accent-hover` token.

8. **`DEFAULT_SETTINGS` and `Required<UserSettings>` mapped type.** The `Required<>` utility
   unwraps optionality but does not unwrap `| undefined` from union types under
   `exactOptionalPropertyTypes`. The `Required<{ [K in keyof UserSettings]: NonNullable<UserSettings[K]> }>`
   double-mapped type shown in §2 handles this correctly, but will cause a compile error if
   any future field is added to `UserSettings` without a corresponding entry in `DEFAULT_SETTINGS`.
   This is a feature (it enforces completeness), but the implementor must remember to update
   `DEFAULT_SETTINGS` when adding a field.

9. **Export/import and settings fields that contain user data vs. configuration.** The
   `ProclivityExport.data` envelope includes the full `ProclivityState`, which means `todos`,
   `reminders`, `ganttTasks` etc. are included. On import, `storage.set(migrated)` overwrites
   everything. If the user intends to import only settings (not data), this is destructive.
   Consider offering a "settings only" import path in v2 that merges only the `settings`
   sub-object.

10. **The `useStore()` hook re-renders all subscribers on every `chrome.storage.onChanged` event.**
    When the user adjusts the intensity slider live, each `storage.update()` call triggers a
    storage write, which fires `onChanged`, which calls `setState` in every mounted `useStore()`
    consumer — that is all sections (Today, Sprint, LongTerm, Gantt, Reminders), all of which
    are kept mounted (the `hidden` prop pattern in `App.tsx`). For a settings slider that fires
    on `onChange` (every mouse move), this could cause 20+ state updates per second. Mitigate:
    debounce slider writes at 200–300ms in the SettingsModal, not in the storage layer.

---

## Recommended Commit Sequence

### Commit 1 — `feat(types): expand UserSettings schema + defaults`

**Files:** `src/types/index.ts`, `src/storage/constants.ts`

**What it contains:** The full `UserSettings` interface, auxiliary types (`ThemeMode`,
`DensityLevel`, etc.), `DEFAULT_SETTINGS` const, and `resolvedSettings()` helper.

**Why first:** Everything else depends on the schema. No behavior changes; the extension
runs identically after this commit. The build must pass — TypeScript only, no runtime code.

**Verification:** `npm run build` passes. `EMPTY_STATE.settings` is still `{}` (no change).
Grep for any existing `state.settings.name` usages — they should all still type-check since
`name` remains `string | undefined`.

---

### Commit 2 — `feat(style): OKLCH theme system + density tokens`

**Files:** `src/styles/theme.css` (new), `src/newtab/index.css` (migrate vars),
`src/newtab/main.tsx` (add import), `src/hooks/useThemeSync.ts` (new),
all 9 CSS files (spacing token replacements).

**What it contains:** The complete CSS custom property system and the `useThemeSync` hook.
App.tsx gains a `useThemeSync(state.settings)` call in `Header`.

**Why second:** Purely visual; zero functional change. The default theme is `"system"` which
on a machine that was previously dark-only renders identically to before.

**Verification:** Visual QA in both `prefers-color-scheme: dark` and `light` (toggle in Chrome
DevTools → Rendering → Emulate CSS media feature). Check all 5 tabs. Check the Settings modal.
Check the Gantt chart (most CSS-dense section).

---

### Commit 3 — `feat(mesh): wire intensity + meshEnabled to MeshBackground`

**Files:** `src/components/MeshBackground.tsx`, `src/newtab/App.tsx`

**What it contains:** `MeshBackgroundProps` interface, `intensity` and `reducedMotion` props,
conditional render in `App.tsx` gated on `meshEnabled`.

**Why third:** Isolated to two files. No storage changes. Can be verified by temporarily setting
`meshEnabled: false` in `DEFAULT_SETTINGS` to confirm the three.js chunk does not load (DevTools
Network tab).

**Verification:** With `meshEnabled: true` (default), behavior unchanged. With `meshEnabled: false`
(manually set), the mesh div is absent from the DOM and the three.js chunk does not appear in
the Network tab. With `meshIntensity: 0.3`, the mesh is visibly more transparent.

---

### Commit 4 — `feat(storage): formatter hook + export/import`

**Files:** `src/hooks/useFormatters.ts` (new), `src/storage/exportImport.ts` (new),
`src/storage/migrations.ts` (new, stub only), `src/storage/storage.ts` (add `migrateState` call),
`vite.config.ts` (add `__APP_VERSION__` define).

**What it contains:** The `useFormatters()` hook (not yet wired to any component), the
export/import utility functions, and the migration stub. The `Header` component's clock and
date display can be migrated from `toLocaleTimeString()` / `toLocaleDateString()` to
`formatters.formatTime()` / `formatters.formatDate()` in this commit.

**Why fourth:** Self-contained utilities with no visual side effects. The migration stub can
be committed as an empty module.

**Verification:** `npm run build` passes. Time display in the header should look identical
(same locale, same format) unless `timeFormat` is explicitly changed in `DEFAULT_SETTINGS`.

---

### Commit 5 — `feat(sw): quiet hours + snooze + section gating`

**Files:** `src/background/service-worker.ts`

**What it contains:** `isInQuietHours()` helper, notification deferral logic in `handleAlarm()`,
snooze button in `chrome.notifications.create()`, `chrome.notifications.onButtonClicked` listener.

**Why last:** The SW is a separate bundle and the trickiest to test (requires a real Chrome
extension context, not Vite dev server). Ship it last so all the schema and storage machinery
is stable before touching the notification path.

**Verification:** Load the unpacked extension in Chrome. Create a reminder 2 minutes from now.
Set `quietHours: { from: "00:00", to: "23:59" }` manually in `chrome.storage.local` (DevTools
→ Application → Storage → Local). Confirm the notification does not fire. Remove quiet hours;
confirm it fires. Test the snooze button appears on the notification.

---

> End of integration plan. Total new code: ~250 lines of TS + ~80 lines of CSS.
> No new npm dependencies required.
