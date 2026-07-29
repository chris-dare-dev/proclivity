# CLAUDE.md — agent operating instructions for Proclivity

This file is loaded automatically into every agent session in this
repo. It overrides general agent defaults where they conflict.

## Branching — work on `main` only

**Solo project, single developer. All work — including agent-assisted
work — runs directly on `main`.**

- No feature branches.
- No topic branches.
- No `claude/*` or `agent-*` branches as the canonical home for
  successful work.
- No pull requests. There is no review pipeline.
- Push to `origin/main` once changes are committed and verified.

### Worktree precedence

When an agent is dispatched with `isolation: "worktree"`, the worktree
exists as a sandbox — it is NOT the canonical branch for successful
work. The worktree branch (`worktree-agent-<id>`) is throwaway.

Rule for delegated work in worktrees:

1. `cd` into the worktree if you're not already there.
2. `git checkout main` inside the worktree. Git worktrees share refs,
   so the commit lands on the parent checkout's `main`.
3. Commit the successful work to `main`.
4. The assigned worktree branch is left at its base SHA — that is
   expected. Cleanup scripts handle takedown.

If work fails or is aborted mid-flight, commit partial-but-coherent
progress to the worktree branch (NOT `main`) so the orchestrator can
surface the diff for inspection without polluting `main`.

### Pushing

`git push origin main` is allowed and expected after a meaningful
commit. The repo is private and personal; no review gate exists. Skip
the usual "confirm before pushing" pause — confirmation is implicit
in the work request.

`git push --force` to `main` requires explicit user authorization.

## Commits

- Conventional commits: `<type>(<scope>): <subject>` — subject ≤ 50
  chars after the prefix.
- Scopes in active use: `gantt`, `sprint`, `reminders`, `mesh`,
  `storage`, `build`, `a11y`, `skill`, `roadmap`, `docs`, `tune`,
  `style`, `perf`, `refactor`, `fix`, `feat`. Pick the closest match
  rather than inventing new scopes.
- Add a co-author trailer on commits you author, naming the **actual
  authoring model** — pin the form, never the value:
  `Co-Authored-By: <authoring Claude model> <noreply@anthropic.com>`
  (e.g. `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`). This line
  used to hardcode one model name; the trailer exists for provenance, so a
  pinned value silently becomes false as soon as a different model does the
  work, and every later commit misattributes its own authorship while
  looking compliant.
- Never use `--no-verify`. Honor pre-commit hooks.
- Never use `--amend` on a commit that has been pushed.

## Build and verification

Before reporting a code change as "done":

- `npm run build` must pass cleanly. This runs `tsc -b && vite build`,
  exercising the full strict TypeScript suite plus Vite production
  bundle.
- New code must compile under `strict: true`,
  `exactOptionalPropertyTypes: true`, and `noUncheckedIndexedAccess: true`
  (see [tsconfig.json](tsconfig.json)).
- Don't add new npm dependencies without a clear justification. The
  initial newtab chunk should stay under ~400 kB (soft warn) with a
  hard ceiling of 500 kB; heavier features (like `three.js`) must be
  lazy-imported via `React.lazy` + `Suspense`.

  **Chunk-budget rationale (revised 2026-05-20):** the previous ~200 kB
  / 220 kB hard ceiling was a self-imposed discipline rule, not a Chrome
  platform constraint. Cold-cache parse of a 400 kB chunk on modern
  hardware is ~50–80 ms (well under the 100 ms instant-perception
  threshold), and warm-cache reopens (the common case for new-tab) are
  ~3–7 ms regardless. The 200 kB target was unblockable for the
  `motion` foundation milestone (the synchronous LazyMotion provider is
  ~28 kB in v12); raising the ceiling lets the roadmap proceed while
  keeping a real discipline floor. The 400/500 kB targets are still
  tighter than 90% of comparable Chrome new-tab extensions in the wild
  (Tabliss / Momentum / Toby all sit between 300–600 kB initial).
  Lazy-loading discipline (`React.lazy` for `three.js`, settings, chat,
  photos, etc.) remains in force — the ceiling raise applies to the
  *initial* chunk, not the total page weight.

## Stack reminder

- Vite + React 18 + TypeScript.
- MV3 Chrome extension via `@crxjs/vite-plugin`.
- Persistence: `chrome.storage.local` (cap ~10 MB) through the wrapper
  in [src/storage/storage.ts](src/storage/storage.ts) and the
  `useStore()` hook in [src/storage/useStore.ts](src/storage/useStore.ts).
- Service worker: [src/background/service-worker.ts](src/background/service-worker.ts)
  drives `chrome.alarms` for reminders; delivery is in-app (pending-alert
  queue in `src/storage/alerts.ts` → persistent sonner toasts on the
  dashboard + toolbar badge). `chrome.notifications` was removed — OS-level
  delivery is silently suppressed on macOS and Windows.
- Background canvas: `@react-three/fiber` + `three.js`, lazy-loaded.

## What agents must not do

- Don't publish or attempt to publish to the Chrome Web Store.
- Don't add server-side components, hosted endpoints, or telemetry —
  this extension is local-only.
- Don't add cross-device sync, IndexedDB schemas, or migrations toward
  a multi-user model without explicit user direction.
- Don't `rm -rf` or `git reset --hard` without explicit user
  authorization. If unexpected state is encountered, investigate before
  destroying.
- Don't ship code that disables React's strict mode, the TypeScript
  strict flags, or pre-commit hooks to "make it pass."

## Available slash commands

- [/roadmap](.claude/commands/roadmap.md) — turn a brief into the
  canonical `plans/<slug>/roadmap.yaml` (roadmap/1) with `<slug>-mN`
  milestones. Scripts: `.claude/scripts/roadmap-*.py`
  (init, validate, score-moscow, score-rice, schema).
- [/milestone-pipeline](.claude/commands/milestone-pipeline.md) —
  execute one milestone end-to-end through Research → Implement →
  Critique → Rectify with sub-agent orchestration. Scripts:
  `.claude/scripts/milestone-pipeline-*` (check-deps, checkpoint,
  consolidate-memory, findings, init-state, record-progress,
  resolve-brief, status), plus `pipeline-outcome-log.py` (append-only
  run outcomes) and `pipeline-reconcile.py` (advisory drift-catcher —
  never edits, always exits 0). `findings.py` replaced the former
  `dedupe-findings.py`; it now owns the Phase-4 completion gate.

Both commands respect the "work on `main` only" rule above. They are
copy-synced from the claude-registry repo (hashes in
`.claude/.registry-manifest.json`) — never edit synced copies in-repo;
edit the registry and re-sync. Not everything under `.claude/` is synced:
the manifest is the authority, and this file plus `.claude/CLAUDE.md` and
the `milestone-{web-perf,infra,lfs}-critic` agents are repo-owned.
Project-specific conventions live in
[.claude/references/roadmap-proclivity-integration.md](.claude/references/roadmap-proclivity-integration.md).
