### `frontend-uplift-2026q2-m8` — UPL-25 sonner toasts + UPL-13 auto-animate

Two new dependencies in one milestone: `sonner` (~9 KB gz) for in-page toast feedback and `@formkit/auto-animate` (~3 KB gz) for FLIP-style list-mutation animations. Bundled together so a single OSS scout pass covers both license / CVE / size checks. Total deferred-chunk delta target: ≤ 15 KB.

**Stories:**

**`frontend-uplift-2026q2-e3-s14` — UPL-25: sonner toast feedback wired to action callbacks** (XS)

Given proclivity has no in-page feedback primitive — `chrome.notifications` is OS-level only, and reminder-created / settings-saved / quick-action-completed actions provide no confirmation, leaving the user unsure whether the action took
When the developer runs `npm install sonner@latest`, imports `<Toaster />` and `toast` from `sonner` in `src/newtab/App.tsx`, mounts `<Toaster position="bottom-right" />` once at the App root inside the existing `LazyMotion` provider but outside the `.app` content div, wraps the Toaster mount in a `useReducedMotion()` short-circuit that sets `theme="system"` + `closeButton` + the explicit `duration={3500}` baseline plus a `richColors` flag, and calls `toast.success("Reminder created")` / `toast.success("Settings saved")` from the 2–3 action callbacks that warrant confirmation (start with `Reminders.tsx`'s `addReminder` and `SettingsModal.tsx`'s save path — those are the highest-frequency action completions today)
Then performing a reminder-create or settings-save action displays a bottom-right toast with the success message that auto-dismisses after 3.5 s; the toast position never causes a layout shift in the main content area (verify CLS = 0 via DevTools Performance panel); under reduced-motion the toast animates with a 0 ms duration and shows / hides instantly; `npm run build` passes with sonner in the dependency tree; the deferred chunk that includes sonner grows by ~9 KB gz (verify via `vite build --report`)

Specialist: A11y reviewer — verify sonner's `aria-live="polite"` is on by default; confirm screen readers announce the toast text on render; confirm `useReducedMotion()` is wired to sonner's `duration` prop rather than expecting the library to detect it natively

Specialist: OSS scout — license confirmation (sonner is MIT), CVE check, MV3 CSP compatibility (sonner ships SVGs and inline styles only — no eval, no Function constructor), caret-pin discipline

**`frontend-uplift-2026q2-e3-s15` — UPL-13: `@formkit/auto-animate` on todo list mutations** (XS)

Given todo rows today appear/disappear instantly when added or removed — the m5-s9 stagger only fires on tab activation, not on per-item mutations — and small list deltas (add a single todo, complete a todo) currently feel jarring
When the developer runs `npm install @formkit/auto-animate@latest`, imports `useAutoAnimate` from `@formkit/auto-animate/react`, applies the hook to the `<ul className="todo-list">` containers in `TodoList.tsx`, `SprintManager.tsx` (active sprint `<ul>` AND ArchivedSprintRow `<ul>`), and any other surface where rows are added/removed (`ClosedTodosView.tsx`); confirms that the hook respects `prefers-reduced-motion` natively (the library's docs cite `respectMotionPreference: true` as default — verify); does NOT apply auto-animate to the `.card-canvas` card-mode container (different visual paradigm)
Then adding or completing a todo produces a smooth FLIP transition (item slides into / out of position over ~250 ms); under reduced-motion the FLIP collapses to instant; the m5-s9 stagger animation on tab activation is unaffected (auto-animate runs on list-mutation events, stagger runs on tab-data-staggered-attribute changes — distinct trigger paths); `npm run build` passes with `@formkit/auto-animate` in the dependency tree; the deferred chunk grows by ~3 KB gz

Specialist: Bundle-budget reviewer — verify auto-animate's tree-shaking via the named React entry (`@formkit/auto-animate/react`); confirm the package's `sideEffects: false` claim via the npm registry tarball metadata

Specialist: OSS scout — license (MIT), CVE, MV3 CSP compatibility (auto-animate uses Web Animations API natively — no inline scripts), caret-pin discipline

---
