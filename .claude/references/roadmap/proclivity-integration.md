# Proclivity integration — project-specific conventions

The `roadmap` skill writes outputs that other parts of Proclivity consume.
This file documents the contract on each side so the skill produces
artifacts that pair cleanly with the rest of the project.

## Project at a glance

Proclivity is a personal Chrome MV3 extension that replaces the new-tab
page with a planning surface: Today / Sprint / Long-term todos, Gantt
charts, reminders, and a slowly-evolving animated wireframe mesh
background.

- **Stack:** Vite + React 18 + TypeScript, `@crxjs/vite-plugin` for MV3,
  `chrome.storage.local` persistence, service worker for `chrome.alarms`
  + `chrome.notifications`, `@react-three/fiber` + `three.js` for the
  background canvas.
- **Distribution:** local only. Loaded unpacked from `dist/` after
  `npm run build`. Not published to the Chrome Web Store.
- **Solo project, single developer.** All work — including agent-driven
  work — runs directly on `main`. No feature branches, no PRs.

## Pairing with `/milestone-pipeline`

`milestone-pipeline` is the execution slash command at
`.claude/commands/milestone-pipeline.md`.
It runs ONE milestone end-to-end through Research → Implement → Critique
→ Rectify.

**Milestone-ID format consumed by milestone-pipeline:** the init-state
script greps for `### <ID> — ` headings. Proclivity convention:

- `<slug>-mN` — milestones produced by THIS skill, written to
  `plans/<slug>-roadmap.md`.

**The /roadmap command must:**

- Use `<slug>-mN` IDs (e.g. `gantt-drag-m1`, `gantt-drag-m2`,
  `reminders-recurrence-m1`).
- Write the milestone block in the format milestone-pipeline parses:

  ```
  ### <slug>-mN — Title

  **Description.** ...

  **Acceptance criteria.**
  - [ ] ...
  ```

- Slug shape is `^[a-z][a-z0-9-]*$`; reject any slug matching `^m\d+$`
  to avoid collision with milestone IDs.

**Bridge in milestone-pipeline:**
`.claude/skills/milestone-pipeline/scripts/init-state.sh`
searches `plans/*.md` for milestone briefs. Optional override:
`--brief-from <path>`.

**Phase 4 handoff offer (do NOT auto-invoke):**

> "First Now-lane milestone: `<slug>-m1`. Run `milestone-pipeline
> <slug>-m1` to execute."

The user invokes manually. Auto-invoke would cost cache (fresh prompt
prefix) and remove the user gate.

## Ticket-system integration: none by default

Proclivity has a GitHub remote (`git@github.com:chris-dare-dev/proclivity.git`)
but no active Issues / Projects board. The roadmap document IS the
tracking artifact.

**Default:** no tickets created.

**Opt-in:** `--gh-issues` flag drafts Issues for the Now-lane epic and
its child stories (materializer writes to local files; orchestrator runs
`gh issue create` after explicit `[y]`). Templates live at
`.claude/references/roadmap/templates/{epic-issue,story-issue}.md`.

**The /roadmap command never invokes `gh` itself.** When `--gh-issues` is
passed:

- Draft issue body files written by the materializer to `.claude/notes/roadmaps/<slug>/issue-drafts/`.
- The orchestrator resolves the GitHub repo via `gh repo view` and prompts `[y/N]` before creating.
- On `[y]`, the orchestrator runs `gh issue create` one at a time.

The user must explicitly confirm before any issues are created.

## Repo conventions to mirror

| convention | source | apply where |
|---|---|---|
| Conventional commits, `<type>(<scope>): <subject>` ≤ 50 chars after prefix | recent `git log` | Any commit the skill or its scripts produce |
| Conventional scopes: `gantt`, `sprint`, `reminders`, `mesh`, `storage`, `build`, `a11y`, `skill`, `roadmap`, `docs` | repo history | Pick the closest match |
| Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` | repo history | Suggest in any commit suggestions produced by the roadmap skill |
| Pre-commit hooks honored | git config | Never `--no-verify` unless the user explicitly authorizes |
| Project check: `npm run build` (runs `tsc -b && vite build`) | [package.json](package.json) | Reference in story AC; run during MATERIALIZE validation |
| TypeScript strict including `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` | [tsconfig.json](tsconfig.json) | New code must compile under these flags |

## Branching policy the skill must respect

From `CLAUDE.md` § Branching:

> "Solo project, single developer. **All work — including
> agent-assisted work — runs directly on `main`.** No feature branches,
> no topic branches, no PRs."

The roadmap doc must NOT propose feature branches, PRs, or branch
protection rules. Milestones land via direct commits to `main`.

If a session is running inside `.claude/worktrees/`, `cd` to the main
checkout (`/Users/chris.dare/Personal/SourceCode/proclivity`) before
doing any git work.

## Constitution rules the skill must respect

- **Local-only.** No epics that depend on publishing to the Chrome Web
  Store, hosting servers, or shipping over the network.
- **No background-script bloat.** The MV3 service worker can be killed
  at any time. Designs must not rely on long-running SW state. Use
  `chrome.alarms` + `chrome.storage` for persistence.
- **Bundle hygiene.** Initial newtab chunk stays under ~400 kB. Heavier
  features (e.g. three.js for the mesh background) must be lazy-imported
  via `React.lazy` + `Suspense`.
- **Personal-scale storage.** All persistence is `chrome.storage.local`
  (cap ~10 MB). Designs that imply IndexedDB, server sync, or
  cross-device replication need explicit justification.

The Refine phase produces a brief; if the brief implies any of these
rule violations, surface it explicitly in the Won't section.

## File and path conventions

| produces | path |
|---|---|
| Roadmap doc | `plans/<slug>-roadmap.md` |
| GitHub epic body drafts | `.claude/notes/roadmaps/<slug>/issue-drafts/<EPIC-ID>.md` |
| GitHub story body drafts | `.claude/notes/roadmaps/<slug>/issue-drafts/<STORY-ID>.md` |
| Roadmap state | `.claude/notes/roadmaps/<slug>/state.json` (gitignored) |

Draft issue files live under `.claude/notes/roadmaps/<slug>/issue-drafts/` —
written by the materializer, consumed by the orchestrator's `gh issue create`
loop (one at a time, after explicit `[y]`). There is no `create-tickets.sh`
script. The orchestrator IS the script.

`plans/` is committed by default — the roadmap doc is the tracking artifact.

## What the /roadmap command must NOT touch

- `.claude/notes/` (if present) — design notes, manually authored.
  Read-only.
- `.claude/commands/milestone-pipeline.md` — sibling slash command. Read-only.
- `dist/` — build output. Never commit.
- `src/` — application code. The roadmap command produces plans, not code.
