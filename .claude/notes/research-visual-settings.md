# Research: Visual / Aesthetic Settings Patterns for Proclivity

> Scope: Theme, Typography, Visual Density, Motion/A11y, Background, Accent Color, and Settings IA.
> Explicitly out of scope: time/date format, timezone, language, units, keyboard shortcuts (owned by sibling agent).
> Written for: a solo personal-use Chrome MV3 newtab extension with a three.js mesh background.
> Date: 2026-05-11

---

## 1. Executive Summary — Top Recommendations

**Pick two of these; the others are informational context.**

1. **Theme: `data-theme` on `<html>` + CSS custom properties in OKLCH — implement now.**
   Three-way toggle (Light / Dark / System) driven by a `data-theme="light|dark"` attribute on `<html>`.
   Under "System" mode, mirror `prefers-color-scheme` at runtime; store `"light" | "dark" | "system"` in `UserSettings`.
   All color tokens are OKLCH CSS custom properties. This is the single highest-leverage change: it touches every existing pixel and sets the foundation for every other bucket. Cost: one new enum field + ~40 CSS variable declarations + a tiny React `useEffect`. **Rank 1.**

2. **Background: on/off toggle + intensity slider — implement now.**
   The three.js mesh is Proclivity's most distinctive feature and its biggest battery/performance cost.
   Expose a boolean `meshEnabled` and a 0–1 float `meshIntensity` (controls `uAlpha` uniform).
   A disabled mesh renders `null` inside the `<Suspense>` fallback — the lazy chunk never loads.
   `meshIntensity` already maps to the `uAlpha` uniform so no shader changes are needed.
   This is the second most impactful change because it directly serves users on lower-powered devices or those who just want a clean background. **Rank 2.**

3. **Visual Density: three-step scale driven by a single CSS custom property — high ROI, low risk.**
   `--density: compact | default | spacious` sets a multiplier on padding/gap tokens.
   Only one new enum field + ~10 CSS variable overrides. No layout restructuring required.
   Comfortable default, compact for power users who want to see more content, spacious for large monitors.
   **Rank 3.**

4. **Accent color: 8 presets + `<input type="color">` fallback — medium ROI.**
   A row of preloaded swatch buttons plus a native `<input type="color">` for the power user who wants exact control.
   The native color picker has zero bundle impact. Accent color feeds one CSS custom property (`--accent`) that then propagates into active tab indicators, buttons, and todo checkmarks.
   **Rank 4.**

5. **Motion: explicit `reducedMotion` override — fast win for accessibility.**
   The mesh already reads `prefers-reduced-motion` but the user has no in-app override.
   A single boolean field surfaces this without requiring system accessibility settings.
   Also covers Gantt row animations and any future micro-interactions.
   **Rank 5.**

Typography (font family, font size scale) and settings IA changes are documented below but rank lower because they require more CSS surface area and offer less immediate personal-use value compared to the five above.

---

## 2. Settings Bucket Reviews

### 2.1 Theme — Light / Dark / System

**WHAT IT IS**
A three-way selector that controls whether the app renders in a light color scheme, a dark color scheme, or defers to the OS `prefers-color-scheme` media query.

**WHO DOES IT WELL**

- **Vercel Geist** — `System / Light / Dark` three-button picker placed once in a footer/settings page. Backed by `next-themes` which sets a `class="dark"` on `<html>`. Documentation: https://vercel.com/geist/theme-switcher
- **Linear** — "Light mode / Dark mode / System preference" under Preferences → Interface and theme. Sidebar-nav settings page. Also supports community-built full custom themes at https://linear.style/ (70+ themes, shareable as a color string).
- **Notion** — Appearance section: Default / Light / Dark, system toggle via keyboard shortcut `Cmd+Shift+L`. Small text toggle is a bonus.
- **shadcn/ui** — `.dark` class on `<html>`, OKLCH-based CSS custom properties for all tokens. Live at https://ui.shadcn.com/docs/theming

**TRADEOFFS**
- System is the right default — eliminates friction for >90% of users who just want the app to match the OS.
- Full custom themes (Linear's model) are overkill for a solo-use extension. Shareable theme strings add code and testing surface for zero benefit.
- The "flash of wrong theme" problem is real for SSR apps but irrelevant for a new-tab extension — the page starts fresh on every tab open and reads `chrome.storage.local` synchronously (via a `useEffect` on mount). The transition should be suppressed with `transition-duration: 0s` during theme initialization.

**IMPLEMENTATION PRIMITIVES**
```css
/* globals.css */
:root {
  color-scheme: light dark; /* tells browser to style scrollbars/inputs natively */
  --bg: oklch(0.98 0.005 240);
  --fg: oklch(0.12 0.01 240);
  --surface: oklch(0.94 0.008 240);
  --border: oklch(0.85 0.01 240);
  --accent: oklch(0.57 0.18 264); /* default accent; overridden per user */
}

[data-theme="dark"] {
  --bg: oklch(0.12 0.01 240);
  --fg: oklch(0.94 0.005 240);
  --surface: oklch(0.17 0.015 240);
  --border: oklch(0.25 0.012 240);
  --accent: oklch(0.65 0.18 264);
}
```

```ts
// in useEffect, after loading settings from chrome.storage.local
document.documentElement.setAttribute(
  "data-theme",
  settings.theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : settings.theme
);
```

Why `data-theme` attribute over `.dark` class: the attribute approach works cleanly with TypeScript exhaustiveness checks and avoids class-name collisions. Both approaches are equivalent in CSS selector weight.

Why OKLCH over HSL: OKLCH is perceptually uniform — `oklch(0.57 0.18 264)` and `oklch(0.57 0.18 30)` look equally bright even though their hues are totally different. HSL's "lightness" axis warps badly across hues (yellow at 50% L looks much brighter than blue at 50% L). OKLCH's predictable lightness is the key property for generating hover/active states programmatically. See: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl

CSS relative color syntax (CSS Color Module 5, supported Chrome 119+) enables automatic hover states:
```css
.btn:hover {
  background: oklch(from var(--accent) calc(l + 0.07) c h);
}
```
This eliminates the need to define separate `--accent-hover` tokens.

---

### 2.2 Typography — Font Family and Size Scale

**WHAT IT IS**
Controls over which font family renders the UI text, and a scale factor (S/M/L or numeric) applied to the base `font-size`.

**WHO DOES IT WELL**

- **Obsidian** — Three separate pickers: Interface font, Text font, Monospace font. Each is a plain `<select>` populated with installed fonts (Electron, so it can enumerate them). CSS variables: `--font-interface`, `--font-text`, `--font-monospace`. Plus a numeric font-size field. Documentation: https://docs.obsidian.md/Reference/CSS+variables/Foundations/Typography
- **Notion** — "Default / Serif / Mono" font family selector (three curated choices, not open-ended). Plus "Small text" toggle (effectively 13px vs 16px). Very approachable — no overwhelming choice.
- **Linear** — Font size adjustment slider in Preferences → Interface and theme. Single axis, no family choice (Linear owns its branding font).
- **VS Code** — Open-ended `editor.fontFamily` string + numeric `editor.fontSize`. The power-user approach; overwhelming for a personal productivity tool.

**TRADEOFFS**
- Font family choice is most valuable for markdown-heavy or note-taking apps (Obsidian, Notion). For a task/Gantt dashboard like Proclivity, font family choice is cosmetic and risky — custom webfonts add bundle weight (violates the <200 kB constraint), and enumerable installed fonts are not available in a Chrome extension (no Electron).
- A size-scale toggle (S/M/L) is universally valuable and zero-cost: it maps to 3 values of `--base-font-size` (13px, 15px, 17px). This is especially useful for dense Gantt rows vs. relaxed reading.
- **Recommendation**: Skip font family for now. Add a 3-step size scale (`"sm" | "md" | "lg"`) that drives a single CSS custom property. One enum field, trivially reversible.

**IMPLEMENTATION PRIMITIVES**
```css
:root {
  --font-size-base: 15px; /* default "md" */
  --line-height-base: 1.5;
  --font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
[data-font-size="sm"] { --font-size-base: 13px; --line-height-base: 1.45; }
[data-font-size="lg"] { --font-size-base: 17px; --line-height-base: 1.55; }
```

`data-font-size` on `<html>`, same pattern as `data-theme`. System font stack ships with zero bytes.

---

### 2.3 Visual Density — Compact / Default / Spacious

**WHAT IT IS**
A spacing-scale multiplier that controls padding, gap, and row heights across the entire UI without changing font size.

**WHO DOES IT WELL**

- **Linear** — Implicitly manages density through its Inbox redesign (2024): "increased density and better contrast." No exposed user control — they pick one density and own it.
- **Material 3** — Defines a `density` scale (-4 to 0) that adjusts component heights. Each step reduces heights by 4px. CSS: `--md-comp-list-item-container-height`.
- **GitHub** — No density control, but the "compact" density of issues lists is a consistently requested feature; users route around it with browser zoom.
- **Notion** — No explicit density control. The "small text" toggle is the closest proxy.

**TRADEOFFS**
- A 3-step density scale is one of the most requested settings in productivity tools and one of the cheapest to implement (it's a multiplier on ~10 spacing tokens).
- Compact is loved by power users with large monitor setups who want to see 30+ todo items without scrolling. Spacious is loved by touch users and those who prefer breathing room.
- Fully independent from font size (see §2.2) — you can have large text with compact spacing, which is a valid accessibility configuration.
- Avoid more than 3 steps — each additional step multiplies QA surface. 3 values cover >95% of use cases.

**IMPLEMENTATION PRIMITIVES**
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --row-height: 44px;
  --section-gap: 20px;
}
[data-density="compact"] {
  --space-1: 2px; --space-2: 6px; --space-3: 8px; --space-4: 12px;
  --row-height: 32px; --section-gap: 12px;
}
[data-density="spacious"] {
  --space-1: 6px; --space-2: 12px; --space-3: 18px; --space-4: 24px;
  --row-height: 52px; --section-gap: 28px;
}
```
All `data-*` attributes live on `<html>` and are set by the same `useEffect` pattern as `data-theme`.

---

### 2.4 Motion / Accessibility — Reduced Motion and Animation Intensity

**WHAT IT IS**
A user-controllable override for animation behavior — distinct from the OS-level `prefers-reduced-motion` because users may want to suppress app animations without changing their OS accessibility settings globally.

**WHO DOES IT WELL**

- **Proclivity (current)** — Already reads `prefers-reduced-motion` in `MeshBackground.tsx` and switches to `frameloop="demand"`. This is correct, but the OS flag is coarse-grained.
- **Raycast** — No explicit "reduced motion" toggle in settings, defers to system.
- **Slack** — No in-app motion control; defers to system.
- **Arc Browser** — Respects system `prefers-reduced-motion`.
- **Most apps** — Defer to the OS. An in-app override is a bonus, not standard.

**TRADEOFFS**
- If the app already reads `prefers-reduced-motion` correctly (as Proclivity does), the main gap is the in-app escape hatch for users who want to reduce motion only in Proclivity but not system-wide.
- An explicit boolean `reducedMotion` stored in settings beats asking users to go into macOS Accessibility to flip a system switch just to calm down a background animation.
- Animation intensity (float 0–1) is more granular but harder to explain to users. A simple on/off is the right default.

**IMPLEMENTATION PRIMITIVES**
```ts
// In useEffect after loading settings:
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const effectiveReducedMotion = settings.reducedMotion ?? prefersReduced;
// Pass effectiveReducedMotion down to MeshBackground via prop or context
// MeshBackground already accepts: frameloop={reducedMotion ? "demand" : "always"}
```

No new CSS needed. The boolean simply gates `frameloop` in `<Canvas>`. Future micro-animations (Gantt row slides, modal transitions) should check this same flag.

Also: the CSS `prefers-reduced-motion` media query should be used as a baseline in all animation CSS:
```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```
When `data-reduced-motion="true"` is on `<html>`, apply the same rule unconditionally:
```css
[data-reduced-motion="true"] * {
  transition-duration: 0.01ms !important;
  animation-duration: 0.01ms !important;
}
```

---

### 2.5 Background — Mesh Toggle, Intensity, Color Tint

**WHAT IT IS**
Controls for the three.js animated wireframe mesh: on/off, animation intensity (alpha/amplitude), and color mode (auto time-of-day vs. manual tint).

**WHO DOES IT WELL**

- **Proclivity (current)** — Already has a sophisticated time-of-day color cycle hard-coded in `MeshBackground.tsx`. The `uAlpha` uniform is set to 0.9 and never changes. No user control.
- **Momentum (Chrome newtab extension)** — Background photo with an on/off toggle for the daily image, plus blur intensity. Industry standard for newtab background settings.
- **Notion** — No custom background animation; static backgrounds only.
- **Vanta.js demos** — Show per-effect controls: `backgroundColor`, `color` (wire color), `points`, `maxDistance`, `spacing`, `showDots`. This is the right model for a mesh-type background.

**TRADEOFFS**
- The `meshEnabled` boolean is the most valuable field: users who open 50+ tabs/day will eventually want to disable the GPU-heavy animation. Without a setting, they'll uninstall.
- `meshIntensity` (0–1, maps to `uAlpha`) controls visual presence. Low values give a subtle watermark effect; full value gives the current dramatic look. A slider is appropriate.
- Color tint: the existing time-of-day auto-cycle is distinctive and beloved. A manual override (static color) is useful for focus contexts (e.g., "always use my calm blue"). But this adds complexity. Recommendation: implement `meshColorMode: "auto" | "manual"` and `meshColor: string` (OKLCH or hex) as optional fields, but only surface the manual option behind an "Advanced" disclosure. This keeps the default behavior unchanged while enabling power-user customization.
- `meshEnabled: false` causes the `<Suspense>` boundary to render `null` instead of the lazy `MeshBackground` chunk — the three.js ~800 kB bundle never loads on first paint for disabled-mesh users. This is a meaningful performance benefit.

**IMPLEMENTATION PRIMITIVES**

```tsx
// App.tsx
{settings.meshEnabled !== false && (
  <Suspense fallback={null}>
    <MeshBackground
      intensity={settings.meshIntensity ?? 0.9}
      reducedMotion={effectiveReducedMotion}
    />
  </Suspense>
)}
```

```tsx
// MeshBackground.tsx — accept new props
interface MeshBackgroundProps {
  intensity?: number;   // 0–1, drives uAlpha
  reducedMotion?: boolean;
}
// In WarpMesh, replace hardcoded uAlpha: { value: 0.9 } with
// uAlpha: { value: intensity ?? 0.9 }
```

No shader changes needed. The `uAlpha` uniform already exists; it just isn't wired to user settings.

---

### 2.6 Accent / Brand Color Picker Patterns

**WHAT IT IS**
A UI element that lets users choose a primary accent color that propagates throughout the app (active tab border, button fills, checkbox accent, link color, focus rings).

**WHO DOES IT WELL**

- **Linear** (v1 custom themes) — Takes a background color, text color, and accent color. Generates complementary shades automatically from those three. Shared as a comma-separated hex string. Documentation: https://linear.app/changelog/2020-12-04-themes
- **Slack** — 8-color sidebar theme (Column Background, Active Item, Active Item Text, etc.). Exposed as 8 `<input type="color">` pickers. Very granular but overwhelming; most users use presets.
- **Raycast** — Theme Studio with background + primary + support colors. Exports as JSON. Requires Pro subscription for custom themes.
- **Obsidian Minimal** — Accent color via Style Settings plugin: hex input + random palette generator.
- **Arc Browser** — A "theme color" swatch that Arc derives the entire sidebar chrome from. Single color, no granularity. Most elegant from a UX perspective.

**THREE MAIN PATTERNS**

| Pattern | Example | Bundle cost | UX | Best for |
|---|---|---|---|---|
| Preset swatches only | Arc, most mobile apps | Zero | Lowest friction | Apps with strong brand identity |
| Swatches + `<input type="color">` | Slack (simplified), Obsidian | Zero | Medium | Solo/power-user tools |
| Full HSL/OKLCH picker | Linear custom themes, Raycast | Can be zero (native) or large (picker library) | Most expressive | Pro/design tools |

**RECOMMENDATION FOR PROCLIVITY**
Preset swatches (8–10 curated colors) + a native `<input type="color">` escape hatch. The native color picker (Chrome's OS-integrated picker) has zero bundle footprint and covers power users. Preset swatches cover 95% of users who just want "something blue" or "something purple."

The accent color propagates through a single CSS custom property:
```css
:root { --accent: oklch(0.57 0.18 264); }
/* automatic hover states via relative color: */
.btn-primary:hover { background: oklch(from var(--accent) calc(l + 0.07) c h); }
```

CSS `accent-color` property also makes native checkboxes, range inputs, and radio buttons follow the user's chosen color automatically — one line, zero effort:
```css
:root { accent-color: var(--accent); }
```

**TRADEOFFS**
- A `<input type="color">` returns a hex string. Converting to OKLCH for storage is optional but recommended to keep the token system uniform.
- If storing the accent as OKLCH in settings, a small (~100 LOC) hex-to-OKLCH conversion utility is needed at write time. No runtime library needed.
- Avoid picker libraries (react-colorful, etc.) — they add 20–40 kB to the initial chunk and violate the <200 kB constraint unless dynamically imported.

---

## 3. Information Architecture for Settings

### Single-page vs. Tabbed vs. Sidebar Nav

| Architecture | Example | When right |
|---|---|---|
| **Single scrollable page** | Notion appearance settings, mobile apps | < 15 settings, all in one category |
| **Tabbed** | Browser devtools, Raycast general prefs | 2–5 distinct categories, peer-level |
| **Sidebar nav** | VS Code, GitHub, Linear prefs | 8+ categories, hierarchical, searchable |
| **Sectioned modal** | Slack preferences, Arc preferences | Medium complexity, contained in a modal |

**For Proclivity today (expanding from 1 field to ~12):** a **sectioned single-page scrollable modal** is correct. The design is:
1. Keep the existing `<Modal>` shell.
2. Add visually distinct section headings inside the modal body: "Appearance", "Background", "Accessibility".
3. No tabs, no sidebar. The total settings count won't justify nav complexity for a solo user.
4. If settings grow beyond ~25 fields (unlikely for a local personal extension), add tabs at that point.

**Search within settings** (VS Code, macOS System Preferences) adds significant dev complexity and is only justified above ~50 settings. Skip it.

### Live Preview vs. Apply-on-Save vs. Revert

**The right model for appearance settings in a personal extension:**

**Live preview (instant apply) for all visual settings.** Productivity evidence: when a user picks a dark theme or changes accent color, they expect to see it immediately. Requiring a "Save" click creates friction and cognitive load.

Implementation:
- Write to `chrome.storage.local` on each input change (debounced ~300ms for sliders/color pickers).
- Since `useStore()` subscribes to `chrome.storage.onChanged`, all open tabs update in real time.
- Keep a `Cancel` button that reverts to the last-saved state (store a snapshot of `settings` when the modal opens, restore it on cancel).
- Remove the explicit `Save` button for visual settings; keep it for destructive/complex settings (name, future work-hour ranges).

This matches the pattern used by Slack (sidebar theme updates instantly), Arc (theme color preview is live), and Raycast (Theme Studio shows live preview).

### Discoverability in a Small Extension

- The gear icon in the header is the right access point — it already exists.
- Settings bucket labels should be descriptive: "Appearance", "Background & Animation", "Accessibility" rather than abstract ("Display", "Visual", "UI").
- Each setting should have a one-line hint (like the current "Appears in the greeting at the top of the page." pattern in `SettingsModal.tsx`). Hints are more useful than tooltips for a solo user who opens settings rarely.
- A settings search is not needed. 12–18 settings in a scrollable modal are trivially scannable.

---

## 4. Proposed `UserSettings` Field Additions (TypeScript Schema)

These are schema additions only. No implementation. Compatible with `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`.

```typescript
// Additions to the existing UserSettings interface in src/types/index.ts

/** "light" | "dark" follow the user's explicit choice.
 *  "system" defers to prefers-color-scheme at runtime. */
export type ThemeMode = "light" | "dark" | "system";

/** S=13px, M=15px (default), L=17px base font size. */
export type FontSizeScale = "sm" | "md" | "lg";

/** Compact shrinks row heights and padding. Spacious expands them.
 *  Default is mid-way. */
export type DensityLevel = "compact" | "default" | "spacious";

/** How the 3D mesh background chooses its wire color.
 *  "auto" = existing time-of-day cycle (default).
 *  "manual" = use meshColor. */
export type MeshColorMode = "auto" | "manual";

export interface UserSettings {
  /** Display name appended to the greeting. */
  name?: string | undefined;

  // ── Theme ─────────────────────────────────────────────────────────
  /** Light/dark/system theme mode. Default: "system". */
  theme?: ThemeMode | undefined;

  // ── Accent color ──────────────────────────────────────────────────
  /** Primary accent color as a CSS-compatible string (hex or oklch()).
   *  Feeds --accent CSS custom property.
   *  Default: oklch(0.57 0.18 264) (a mid-blue). */
  accentColor?: string | undefined;

  // ── Typography ────────────────────────────────────────────────────
  /** Base font size scale. Default: "md" (15px). */
  fontSize?: FontSizeScale | undefined;

  // ── Visual density ────────────────────────────────────────────────
  /** UI spacing density. Default: "default". */
  density?: DensityLevel | undefined;

  // ── Motion / Accessibility ────────────────────────────────────────
  /** Explicit in-app reduced-motion override. When undefined, defers to
   *  window.matchMedia("(prefers-reduced-motion: reduce)"). */
  reducedMotion?: boolean | undefined;

  // ── Background (3D mesh) ──────────────────────────────────────────
  /** Whether to render the three.js mesh background.
   *  Default: true. Setting to false prevents the lazy chunk from loading. */
  meshEnabled?: boolean | undefined;

  /** Wire opacity / intensity, 0–1. Maps to uAlpha uniform.
   *  Default: 0.9. */
  meshIntensity?: number | undefined;

  /** Whether mesh wire color follows the auto time-of-day cycle or
   *  a user-supplied static color. Default: "auto". */
  meshColorMode?: MeshColorMode | undefined;

  /** Static wire color used when meshColorMode is "manual".
   *  CSS-compatible color string (hex or oklch()). */
  meshColor?: string | undefined;
}
```

**Field count summary:** 9 new optional fields (+ the existing `name`).
**Estimated storage footprint:** ~200 bytes per settings object. Negligible against the 10 MB `chrome.storage.local` cap.
**Default behavior when fields are absent:** every field uses a sensible default via `?? fallback` at read time, so existing stored state (which has none of these) degrades gracefully.

---

## 5. References

All links consulted during research:

- **Linear preferences docs**: https://linear.app/docs/account-preferences
- **Linear custom themes changelog**: https://linear.app/changelog/2020-12-04-themes
- **Linear design analysis**: https://blog.logrocket.com/ux-design/linear-design/
- **Linear theme gallery**: https://linear.style/
- **shadcn/ui theming docs**: https://ui.shadcn.com/docs/theming
- **OKLCH in CSS — Evil Martians**: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- **OKLCH color picker reference**: https://oklch.net/
- **Radix Colors overview**: https://www.radix-ui.com/colors
- **Vercel Geist theme switcher**: https://vercel.com/geist/theme-switcher
- **Raycast themes manual**: https://manual.raycast.com/themes
- **Raycast theme explorer**: https://ray.so/themes
- **Slack theme customization**: https://slack.com/help/articles/205166337-Change-your-Slack-theme
- **Obsidian typography CSS vars**: https://docs.obsidian.md/Reference/CSS+variables/Foundations/Typography
- **Obsidian Minimal theme settings**: https://github.com/kepano/obsidian-minimal-settings
- **Smashing Magazine: color scheme persistence with CSS + JS**: https://www.smashingmagazine.com/2024/03/setting-persisting-color-scheme-preferences-css-javascript/
- **VS Code settings UX guidelines**: https://code.visualstudio.com/api/ux-guidelines/settings
- **CSS accent-color MDN**: https://developer.mozilla.org/en-US/docs/Web/CSS/accent-color
- **prefers-reduced-motion MDN**: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- **prefers-color-scheme web.dev**: https://web.dev/articles/prefers-color-scheme
- **LogRocket: CSS motion and theme preferences**: https://blog.logrocket.com/adapting-user-motion-theme-preferences-css-javascript/
- **Material 3 dynamic color overview**: https://m3.material.io/styles/color/system/overview
- **System font stacks**: https://systemfontstack.com/
- **Mobbin color picker UX glossary**: https://mobbin.com/glossary/color-picker
- **tweakcn (shadcn theme editor)**: https://tweakcn.com
- **DEV: shadcn OKLCH theme generator**: https://dev.to/rodrigo_luglio_f63c6051de/shadcn-ui-theme-generator-with-oklch-colors-and-ancient-sacred-geometry-2f06
