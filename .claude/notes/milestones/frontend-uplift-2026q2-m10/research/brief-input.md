### `frontend-uplift-2026q2-m10` — UPL-20 react-hotkeys-hook + UPL-19 Cmd+/ help overlay

The first half of epic e4. UPL-20 installs the declarative shortcut foundation; UPL-19 immediately exercises that foundation by adding a Cmd+/ keyboard help overlay. UPL-19 hard-depends on UPL-20's `useHotkeys` API — bundling them in one milestone keeps the dep + first-consumer atomic and gives the OSS scout one pass on the new library.

**Stories:**

**`frontend-uplift-2026q2-e4-s17` — UPL-20: adopt `react-hotkeys-hook` and replace ad-hoc keydown listeners** (S)

Given proclivity has ad-hoc `document.addEventListener("keydown", ...)` calls scattered across the codebase (verify via `grep -rn 'addEventListener.*keydown' src/`) — typically for modal-Escape-to-close handling — and each one is a manual lifecycle-management chore with no shared registry of "what keys are bound where"
When the developer runs `npm install react-hotkeys-hook@latest`, imports `useHotkeys` from `react-hotkeys-hook`, replaces every ad-hoc `keydown` listener with `useHotkeys("escape", handler, { enableOnFormTags: true })` or the appropriate-scope variant at the consumer site, ensures the `enableOnContentEditable` flag is set where needed for the Calendar / chat input contexts, and verifies the library's React 18 compatibility via the bundled types
Then every previous ad-hoc `keydown` listener is removed (`grep -rn 'addEventListener.*keydown' src/` returns empty or only platform-level listeners); modals still close on Escape; chat input shortcuts still work; `npm run build` passes with `react-hotkeys-hook` in the dependency tree; the initial chunk grows by ~3 KB gz (the library is ~3 KB and zero-dep per its npm page)

Specialist: A11y reviewer — confirm `useHotkeys` respects `aria-keyshortcuts` semantics (no automatic announcement; the hook is for behavior, not announcement); confirm no shortcut conflicts with assistive-tech defaults (Cmd+/ is fine; avoid Cmd+H, Cmd+W, etc.)

Specialist: OSS scout — license (MIT), CVE, zero-dep claim verification, caret-pin

**`frontend-uplift-2026q2-e4-s18` — UPL-19: Cmd+/ keyboard help overlay** (XS)

Given the application has multiple keyboard shortcuts (Escape to close modals, soon Cmd+K for palette, soon Cmd+/ for help) but no discoverable surface for the user to see what's available, leading to "what keys does this app respond to?" friction
When the developer creates `src/components/help/KeyboardHelpOverlay.tsx` — a lazy-loaded modal that lists every active keyboard shortcut (sourced from a single `src/lib/shortcuts.ts` const array that becomes the source of truth for both the registry and the overlay), wraps the modal in `<AnimatePresence>` reusing the m7 motion-library pattern (scale-in/out, 180 ms, reduced-motion respected), wires `useHotkeys("meta+slash, ctrl+slash", () => setHelpOpen(open => !open))` in App.tsx, ensures focus moves to the modal on open + returns to the previously focused element on close
Then pressing Cmd+/ (Mac) or Ctrl+/ (Windows/Linux) opens a modal listing every active shortcut grouped by category (Navigation, Editing, App); Escape dismisses it (via the same `useHotkeys` foundation s17 just installed); focus returns to the previously focused element on close; the modal renders with the m7 motion pattern under no-preference, instantly under reduced-motion; `npm run build` passes; the modal code is lazy-loaded via `React.lazy()` so initial chunk grows only by the registry size (~0.5 KB)

Specialist: A11y reviewer — confirm focus management (return-to-trigger on close); confirm the modal has `role="dialog"` + `aria-labelledby` + focus-trap; confirm Escape and the toggle key both close it

---
