# Observability — synthesis plan

A distilled, prioritized plan for adding permanent logging / tracing / metrics / assertions to proclivity. Pulls from two parallel research docs:

- **[plans/observability-audit.md](observability-audit.md)** — 649 lines. WHAT to instrument: 18 existing log/throw sites inventoried, 15 ranked gaps, 10 past-bug counterfactuals tying each rect commit to a debug signal that would have caught it.
- **[plans/observability-design.md](observability-design.md)** — 1084 lines. HOW to instrument: typed `getLogger(namespace)` API, console + ring-buffer sinks, DEBUG-style runtime toggle via `UserSettings.debug`, lazy-loaded in-app viewer, 4-phase rollout.

This synthesis is the **execution plan**. The two source docs are authoritative for detail; this one is for picking what to actually do.

---

## What we're building (one paragraph)

A small `src/observability/` module exporting `getLogger(namespace): Logger` with leveled methods (`trace`/`debug`/`info`/`warn`/`error`/`time`/`count`). Console output always for `info`+; trace/debug filtered by a DEBUG-style namespace glob stored in `state.settings.debug`. `warn`/`error` (and `info` when debug is on) persist to a 500-entry ring buffer at a new `proclivity:logs:v1` key. Service worker uses the same logger module. An in-app **Log Viewer** lives in Settings (lazy-loaded, dev-toggle-gated) for filtering / searching / exporting / clearing. Total infrastructure ~700 LOC across 4 phases; initial chunk impact ~3.5 kB. No new runtime npm dependencies.

---

## Prioritized phases

Each phase ships independently. Phase 1 is a prerequisite for the rest; phases 2-4 can interleave with feature work without blocking each other.

### Phase 1 — Logger module + console sink + runtime toggle (P0)

The foundation. Without this, every subsequent piece of instrumentation has nowhere to attach.

**Builds:**

- `src/observability/types.ts` — `LogLevel`, `LogEntry`, `Logger` interface.
- `src/observability/filter.ts` — DEBUG-glob matcher (`proclivity:*`, `nano:*,storage:!queue`, etc.).
- `src/observability/logger.ts` — `getLogger(namespace)` factory. Per-call decision: console always for ≥info; trace/debug only when namespace matches the filter. `time()` and `count()` helpers.
- `src/types/index.ts` — add `debug?: { enabled?: boolean; namespaces?: string }` to `UserSettings`; resolved variant in `ResolvedUserSettings`.
- `src/storage/constants.ts` — `DEFAULT_SETTINGS.debug = { enabled: false, namespaces: "proclivity:*" }`; resolver branch.
- `src/components/settings/SettingsModal.tsx` — new `DeveloperSection` with a toggle + a namespace-filter input. Hidden behind a "show developer options" Easter egg (e.g. shift-click on the "Settings" title) so it doesn't clutter the casual surface.

**Cost:** ~225 LOC, +3.5 kB initial chunk.

**Effect:** every future log site can use a stable API. The Phase 1 commit itself adds zero call sites — those are Phase 2.

**Acceptance:** `getLogger("test").info("hi")` prints to DevTools console. Toggling debug-on in Settings and setting namespaces to `"test:*"` then logging `getLogger("test").debug("hi")` prints; toggling off, the debug call is filtered.

---

### Phase 2 — Instrument the five P0 sites (P0)

The audit's top 5 ranked gaps. Each call site is 3–8 LOC.

| # | Site | What to log | File:line |
|---|---|---|---|
| 1 | SW `reconcileAlarms` before/after diff | counts of alarms created / cleared / missed-fired per restart | `src/background/service-worker.ts:60-104` |
| 2 | Storage write-chain error log | the silent `next.catch(() => undefined)` → `.catch(logger.warn)` | `src/storage/storage.ts:34-39` |
| 3 | Nano session lifecycle (create / destroy / count) | active session count gauge; lifecycle events | `src/llm/nano.ts:85-97` + `src/hooks/useChatSession.ts:113-127, 314-329, 373-384` |
| 4 | Per-prompt latency + kind | start/end timestamps, parsed `kind`, raw JSON length | `src/hooks/useChatSession.ts:173-178, 180-182` |
| 5 | Parse-fail rate log with raw output | log the raw on `parse-failed`; tag with `nano:parse-fail` | `src/hooks/useChatSession.ts:188-197` + `src/llm/tools.ts:240` |

**Cost:** ~90 LOC additions across 4 files. Bundle ≈ 0 kB (instrumentation is leaf calls to the Phase 1 module).

**Effect:** the 5 most opaque current behaviours become legible from DevTools console alone, without any persistence. This phase alone would have caught m1 H1, m2 H1, m2 H2, m3 M3 — four of the five rect-commit bugs the audit examined. It also makes the m3 eval reproducible: turn on `nano:*`, run the 20 prompts, copy the console output to the eval doc.

**Acceptance:** with `debug.enabled=true, namespaces="nano:*"`, sending one chat message produces ~6 lines in the console covering session-create (if cold), prompt-start, prompt-end with latency, parsed-kind, and any tool-call apply outcome.

---

### Phase 3 — Ring buffer for persistent error / event history (P1)

Without persistence, the SW kills its logs on each restart and the newtab loses everything on close. Phase 3 fixes both.

**Builds:**

- `src/observability/ring-buffer.ts` — append-with-cap, separate `chrome.storage.local` key `proclivity:logs:v1`, ~500 entries cap, dropped-oldest on overflow. Has its own write queue to prevent races with the SW.
- `src/observability/logger.ts` edit — every `warn`/`error` call schedules a ring-buffer write (best-effort, never blocks the caller). `info` writes when `debug.enabled=true`.
- `src/storage/constants.ts` — `LOG_STORAGE_KEY = "proclivity:logs:v1"`.
- `SECURITY.md` — §3 update documenting the new storage key, its size cap, and the no-PII expectation.

**Cost:** ~92 LOC. chrome.storage.local impact: max ~100 kB (500 × ~200 bytes/entry). Within the 10 MB cap.

**Effect:** the maintainer can answer "what happened the last time I noticed X?" by inspecting the ring buffer (Phase 4) or `chrome.storage.local` directly via DevTools.

**Acceptance:** triggering a `warn` then closing and reopening the tab, `chrome.storage.local.get("proclivity:logs:v1")` shows the entry. After 500 entries, the oldest is dropped.

---

### Phase 4 — In-app log viewer (P1 / P2)

Settings → Developer → **View logs**. Lazy-loaded, only the maintainer's session pays the cost.

**Builds:**

- `src/components/settings/LogViewer.tsx` — table view; filter by level + namespace + free text + time range; Copy-as-JSON button; Clear-all button.
- `src/components/settings/LogViewer.css` — table layout, level-coloured rows.
- `src/components/settings/SettingsModal.tsx` — `React.lazy` import + `Suspense` wrapper, gated on the developer toggle from Phase 1.

**Cost:** ~285 LOC. Lazy chunk ~8 kB gzipped. Zero initial-chunk impact.

**Effect:** debugging without DevTools. Especially useful for SW logs that fire while the maintainer isn't looking at the tab.

---

### Optional follow-ups (P1+)

After the four core phases, the audit's remaining ranked gaps and assertions:

- **State-invariant assertions** (audit §7). `assertStateIntegrity(state)` runs at boot + after every `update()`; warns on orphan tag ids, dangling sprintIds, etc. ~120 LOC. Catches reference corruption that today only surfaces as "ghost chip" UI bugs.
- **`getBytesInUse()` monitor** (audit §3 / gap #8). One periodic poll, log a warn at >80 % cap.
- **First-load state summary** (audit §3 / gap #10). `info` on store hydrate: counts of todos / reminders / tags / charts / settings shape version.
- **Settings save diff log** (audit §6 / gap #12). Log which fields changed in each Done press.
- **Bundle visualizer** (audit §8 / gap #15). `rollup-plugin-visualizer` as a devDep; one Vite plugin entry; opens `dist/bundle-analysis.html` on build.
- **`runEval()` hook** (audit §10 / gap #14). An in-app developer button that runs the 20 prompts from `gemini-nano-eval-snapshot.md` and writes the result table directly. Closes the loop on m3's manual-eval debt permanently.

---

## What this would have caught (audit §9 recap)

The audit walks each rect commit from m1-m3 and identifies the single signal that would have made each bug obvious before critique. Examples:

- **m1 H1** (`ProgressEvent.loaded` byte-vs-fraction): a `log.debug("nano:download", { loaded, total, fraction })` printed once per progress event would have shown 400 000 000 in the loaded column on the first download. Caught in seconds.
- **m2 H1** (no `useEffect` cleanup): a `log.count("nano:session.alive", +1)` on create / `-1` on destroy. After toggling `chatEnabled` off three times: count = 3, not 0. Caught in one test.
- **m3 M3** (`undo()` removed message before `update()` resolved): a `log.time("undo")` wrapping the awaited update + a `log.warn` in the catch would have surfaced both the latency and the rejection path.

Phase 2 covers these specifically. Phase 1 + Phase 2 is the high-leverage tranche.

---

## Decisions deferred to the maintainer (5)

1. **Phase ordering — strict 1→2→3→4, or 1→2 then pick from {3, 4, follow-ups}?** Phases 3 and 4 are independent of each other once Phase 1 exists. Recommend 1→2 first (high signal, lowest cost), then phase 4 (viewer) before 3 (persistence) if "I want to see what just happened" matters more than "I want to see what happened yesterday."

2. **Should the ring buffer persist across reinstalls?** Default behavior: yes (it's just a `chrome.storage.local` key, survives reinstalls if Chrome retains storage). Could opt to clear on first load after install version bump.

3. **Should the log viewer hide / redact user-typed content?** Tag labels, todo titles, chat prompts could appear in logs. SECURITY.md §3 says only the user types these and they stay local — so no privacy concern in normal operation. But "Copy logs" → paste-into-bug-report leaks them. Suggest: a redaction toggle in the viewer, default off.

4. **Developer-mode discoverability.** The plan suggests "shift-click the Settings title" to reveal the Developer section. Alternatives: a `?dev` URL query, a hidden Konami code, always-visible behind a "Developer" disclosure. Pick whichever feels right to the maintainer.

5. **`runEval()` button (follow-up #6).** Worth shipping or not? It closes the m3-eval loop forever but adds ~150 LOC of test harness inside the production bundle (lazy-loadable). Recommendation: yes, lazy-load it next to the Log Viewer.

---

## Suggested cut for first commit

If the maintainer wants to ship something small first to validate the approach:

- **Phase 1 only** (~225 LOC, +3.5 kB). One commit: `feat(observability): typed logger + dev-mode toggle`. No call sites instrumented yet — that's the next commit.
- Then **Phase 2 in one or two commits**, organized by subsystem (e.g. one commit for SW + storage; another for Nano + chat). Each commit is independently revertable.
- Phases 3 and 4 land later as standalone commits when there's a moment for them.

Each phase commit message references both source docs (`plans/observability-audit.md` + `plans/observability-design.md`) so future readers see the rationale.

---

## Verified against

- `plans/observability-audit.md` (sibling agent, 649 lines, sections 1–10).
- `plans/observability-design.md` (sibling agent, 1084 lines, sections 1–11).
- Codebase state at HEAD `035e00e` (post-m3 rect).
