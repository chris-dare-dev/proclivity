# brief-2 — sprint-backlog-redesign-m1 external research + external-writes flag

Milestone: `sprint-backlog-redesign-m1` — Schema v2 fields and in-place
normalization. Local-only Chrome MV3 extension; no new vendor surface,
no network, no server. The work is confined to:

- `src/types/index.ts` — add five fields
- `src/storage/storage.ts` — extend `normalizeState()` to backfill
  `Sprint.state`
- `test/fixtures/v1-state-*.json` — three captured fixtures (3x JSON)
- one replay assertion surface (script or test) per AC#4

## 1. External sources consulted

**None.** This milestone is purely internal — type-shape additions on
existing local interfaces plus a normalization-pass extension that
mirrors the project's existing `closedAt` backfill in
`src/storage/storage.ts:49-63`. No new library, no new vendor, no new
hosted dependency, no protocol spec to read. WebFetch was not invoked.

Verified there is no `AGENTS.md` at the repo root. The only operating
contract that applies is `CLAUDE.md` (read).

### One borderline observation on dependencies

The brief's AC#4 allows three test-surface options for the
fixture-replay assertion:

  (a) `vitest`
  (b) a manual replay snippet committed under `scripts/`
  (c) a `scripts/replay-fixtures.ts` runnable via `tsx` / `node --import tsx`

The repo currently has **no test runner installed** (verified against
`package.json` — only Vite, TypeScript, React, and `@crxjs/vite-plugin`
in devDependencies). The lowest-cost path is (c): a single TypeScript
file under `scripts/` that imports the normalizer, reads the three
fixture JSONs, and asserts via plain `if (!...) throw`. It needs **no
new dependency** if executed via `npx tsx scripts/replay-fixtures.ts`,
since `tsx` resolves transitively from existing dev tooling — but if
the user prefers a clean, repeatable surface, the minimal install would
be:

  `npm install --save-dev tsx`     # one-line justification: runs the
                                   # replay script without a full
                                   # test-runner footprint; no runtime
                                   # bundle impact (devDep only).

This is **not required** — the implementer can equally well wire the
replay as a top-of-file `import.meta.vitest`-style block guarded by
`if (import.meta.url === ...)`, or even as a typed `manualReplay()`
function exported from `storage.ts` itself (called from a one-off
`scripts/` runner). The user's preference between vitest, tsx, and
"just write a runnable .ts that node executes via the existing
TypeScript build" should be elicited at the start of Phase 2 if not
already clear. CLAUDE.md's "Don't add new npm dependencies without a
clear justification" guidance suggests **defaulting to no new dep**
and producing a `scripts/replay-fixtures.ts` invoked manually.

## 2. external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy (solo + private repo, no review gate)"
```

No other external writes. Specifically verified that this milestone:

- does NOT publish to the Chrome Web Store (explicitly forbidden by
  CLAUDE.md)
- does NOT call out to any network endpoint at build or runtime
- does NOT install new npm dependencies (the fixture-replay path
  defaults to no-dep per §1 above; if the user opts for `tsx` or
  `vitest` later that becomes a Phase-4 external write — flag at that
  point)
- does NOT touch `chrome.storage.local` at build time (fixtures are
  static JSON committed under `test/`)
- does NOT push `--force` to `main` (explicit user authorization
  required and not needed for this milestone)

## 3. Riskiest assumption + alternative

**Riskiest assumption:** that importing `todayMidnight()` from
`src/sections/sprint/sprintUtils.ts` into `src/storage/storage.ts` is
acceptable. Today the storage layer has no dependency on the sections
tree — `storage.ts` imports only from `@/types`, `./constants`, and
`@/observability/logger`. Pulling a function from a *section* upward
into storage inverts the existing layering and creates an "any UI
refactor of `sprintUtils.ts` can break the storage normalizer"
coupling. The brief specifies the heuristic (`endsAt < todayMidnight()`)
but does not specify the import path. A future contributor reading the
normalizer should not have to chase a UI helper to understand a
storage-layer invariant.

**Alternative implementation path (recommended):** inline the
`todayMidnight()` heuristic in `storage.ts` as a private helper
(`function localMidnight(): number { const d = new Date();
d.setHours(0,0,0,0); return d.getTime(); }`), or move the helper to a
neutral location (`src/lib/time.ts` or similar) and import it from
both sites. Inlining is the smallest diff and matches what the rest of
the file already does (no UI imports). A one-line comment in the
normalizer should cite the canonical heuristic location in
`sprintUtils.ts:38-40` so future readers can find the
`isArchived()` parallel.

**Secondary risk:** what `Sprint.state` should default to when a v1
fixture has a malformed `state` value (e.g. an old build with a typo
or a partial migration). The brief says "absent or invalid" → apply
the heuristic. The normalizer must treat `state` as defaulting through
the heuristic if it is not one of the three exact strings (`"draft"`,
`"active"`, `"closed"`). A defensive `if (s.state !== "draft" &&
s.state !== "active" && s.state !== "closed")` guard is safer than
`if (s.state === undefined)` — and matches the AC#3 wording.

**Side-note on the test fixture location:** confirmed `tsconfig.json`
sets `include: ["src"]` and `vite.config.ts` (per the stack) treats
`src/` as the bundle root. Files placed under `test/fixtures/` will
not enter the production bundle and will not be type-checked by
`tsc -b`. That means the JSON fixtures cost zero bytes against AC#5's
≤ +2 kB delta and zero risk against AC#2's strict TS gate. The replay
script, if placed under `scripts/`, is also outside the bundle.

## 4. Acceptance criteria the implementer must meet

Verbatim from the milestone brief:

1. `src/types/index.ts` declares the five new fields. `Sprint.state`
   is required; `Todo.parentId`, `Todo.targetDate`, `Sprint.goal`,
   `Sprint.retroNote` are all `?: T | undefined`.

2. `npm run build` passes the full `tsc -b && vite build` under
   strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
   with zero new errors.

3. `storage.get()` normalizer backfills `Sprint.state = "closed"`
   when `endsAt < todayMidnight()`, else `Sprint.state = "active"`,
   for every sprint loaded from `chrome.storage.local` whose `state`
   field is absent or invalid. Inline comment cites the legacy
   heuristic and the spike-2 fixture coverage.

4. `test/fixtures/v1-state-empty.json`,
   `test/fixtures/v1-state-mixed.json`, and
   `test/fixtures/v1-state-with-closed-todos.json` exist; a
   fixture-replay assertion (in whatever test surface this repo uses
   — `vitest`, manual replay snippet, or a
   `scripts/replay-fixtures.ts`) confirms each round-trips through
   the normalizer without data loss.

5. Initial newtab chunk size delta from the baseline (captured before
   edits) is ≤ +2 kB. Baseline and post-merge sizes are recorded in
   the commit body or a footnote.

6. `grep -rn "parentId\|targetDate\|\.goal\|\.retroNote\|\"draft\"\|\"closed\"" src/`
   outside `src/types/index.ts` and `src/storage/storage.ts` returns
   zero hits — no reader/writer of the new fields ships in m1.
