# sprint-backlog-redesign-m1 — Research Brief

**Milestone ID:** `sprint-backlog-redesign-m1`  
**Scope:** Schema v2 fields and in-place normalization  
**Complexity:** S

---

## 1. Affected Files and Their Roles

| Path | Role |
|------|------|
| `src/types/index.ts` | Canonical type defs; will add `Todo.parentId?`, `Todo.targetDate?`, `Sprint.goal?`, `Sprint.retroNote?`, `Sprint.state` (required) |
| `src/storage/storage.ts` | Read + normalization layer; extends `normalizeState()` to backfill `Sprint.state` from legacy heuristic |
| `src/sections/sprint/sprintUtils.ts` | Date helpers including `todayMidnight()` (used by normalizer); `isArchived()` will stay unchanged in m1 |
| `src/storage/constants.ts` | Holds `STORAGE_KEY` and default settings; no changes needed in m1 |
| `test/fixtures/v1-state-*.json` | Three new fixture files capturing legacy data states for regression replay |
| `.github/scripts/check-bundle-size.mjs` | Bundle-size gate; enforce ≤ +2 kB delta from baseline |

---

## 2. Existing Patterns to Follow

### 2.1 Sprint Type Definition

**File:** `src/types/index.ts:73-80`

Current definition:
```typescript
export interface Sprint {
  id: string;
  name: string;
  /** Local-midnight timestamp of the sprint's first day (inclusive). */
  startsAt: number;
  /** Local-midnight timestamp of the sprint's last day (inclusive). */
  endsAt: number;
}
```

**Pattern:** Fields are required except for clearly documented optional ones using `?: T | undefined` form (see `Todo.notes`, `Todo.dueAt`, etc. at lines 28-49). Add the five new fields following this pattern:
- `parentId?: string | undefined` (on Todo, already on GanttTask at line 85)
- `targetDate?: number | undefined` (placeholder for future use, mirroring `dueAt` pattern)
- `goal?: string | undefined` (on Sprint, optional)
- `retroNote?: string | undefined` (on Sprint, optional)
- `state: "draft" | "active" | "closed"` (on Sprint, **required** — no `?`)

---

### 2.2 Normalization Pattern

**File:** `src/storage/storage.ts:49-63`

Current pattern (backfilling `closedAt` on legacy todos):

```typescript
function normalizeState(raw: ProclivityState): ProclivityState {
  const base = { ...EMPTY_STATE, ...raw };
  return {
    ...base,
    todos: base.todos.map((t) => {
      const w: Todo = (t as Todo & { tags?: string[] }).tags !== undefined ? t : { ...t, tags: [] };
      if (w.done && w.closedAt === undefined)
        return { ...w, closedAt: w.completedAt ?? w.createdAt ?? Date.now() };
      return w;
    }),
    reminders: base.reminders.map((r) =>
      (r as Reminder & { tags?: string[] }).tags !== undefined ? r : { ...r, tags: [] },
    ),
  };
}
```

**Pattern to follow:** Add a `.sprints` map that checks each sprint's `state` field:
- If `state` is absent or invalid (not one of the three allowed values), backfill it:
  - If `endsAt < todayMidnight()`, set `state = "closed"`
  - Otherwise, set `state = "active"`
  - No legacy data will ever have `"draft"` — that's new-sprint-only
- Preserve all other fields unchanged
- Inline a comment citing the legacy `isArchived()` heuristic (line 38-39 of `sprintUtils.ts`)

---

### 2.3 `todayMidnight()` Helper

**File:** `src/sections/sprint/sprintUtils.ts:20-24`

```typescript
export function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
```

**Storage-layer layering concern:** The normalizer lives in `src/storage/storage.ts`, which should not import from section-specific utils. **Solution:** Either:
1. Move `todayMidnight()` to `src/storage/constants.ts` or a shared `src/utils/date.ts`
2. Duplicate the logic inline in the normalizer with a comment noting why

Recommend **option 1** — extract `todayMidnight()` to `src/storage/constants.ts` so `storage.ts` can import it cleanly and `sprintUtils.ts` can re-export it or import it from the shared home. Check if any other util functions should move alongside it.

---

## 3. Test Surface and Fixture Strategy

### 3.1 Current Test Infrastructure

The repository has **no test runner configured** (`vitest`, `jest`, etc. are absent from `package.json` and no `*.test.ts` files exist). This is intentional per the codebase pattern — the project uses **manual verification** rather than automated unit tests.

### 3.2 Recommended Fixture Approach

Per the AC and the precedent in the roadmap (spike-2 at line 170), capture **three fixture files** representing distinct v1 legacy states and verify they normalize correctly:

**Fixture files to create:**
- `test/fixtures/v1-state-empty.json` — Empty state (no sprints, no todos). Should normalize without error and return unmodified.
- `test/fixtures/v1-state-mixed.json` — Mixed active and expired sprints with v1 data shape. Sprints with `endsAt < todayMidnight()` should get `state = "closed"`, others `state = "active"`.
- `test/fixtures/v1-state-with-closed-todos.json` — Sprints with legacy closed todos (no `closedAt` field). Verifies that the sprint normalization doesn't interfere with the existing todo `closedAt` backfill.

**Verification method (non-automated):** Create a `scripts/replay-fixtures.ts` script (run via `npx tsx scripts/replay-fixtures.ts` or `bun run scripts/replay-fixtures.ts` if bun is available) that:
1. Reads each fixture JSON
2. Calls the normalizer on the raw state
3. Asserts that all sprints have a valid `state` field
4. Logs a summary before exiting

Alternatively, a minimal Node script in `.claude/notes/milestones/sprint-backlog-redesign-m1/scripts/replay.js` that the implementer can run locally and paste output into the commit message.

---

## 4. Call Sites and Layering

### 4.1 `isArchived()` Usage

**File:** `src/sections/sprint/sprintUtils.ts:38-40`

```typescript
export function isArchived(sprint: Sprint): boolean {
  return sprint.endsAt < todayMidnight();
}
```

**Call sites** (from grep at sprint/SprintManager.tsx):
- Line 428: `sprints.filter(isArchived)` — lists archived sprints
- Line 432: `sprints.filter((s) => !isArchived(s))` — lists active sprints
- Line 541: `sp.id !== activeSprintId && !isArchived(sp)` — filter for sprint switcher

**In m1:** `isArchived()` stays unchanged (the heuristic remains; `state` is backfilled to match it). **In m2:** `isArchived()` will be rewritten to check `sprint.state === "closed"` instead. All call sites will continue to work unchanged.

### 4.2 `storage.get()` Call Sites

The normalizer runs in:
1. `storage.get()` (line 72-73) — main read path
2. `storage.subscribe()` (line 113) — listener on `chrome.storage.onChanged` from service worker or other tabs

Both paths apply `normalizeState()`, so the backfill is uniform.

---

## 5. Strict TypeScript Compliance

**Config:** `tsconfig.json:14-16`

```json
"strict": true,
"exactOptionalPropertyTypes": true,
"noUncheckedIndexedAccess": true,
```

**Requirements for m1:**
- All five new fields must compile under these flags with **zero new errors**
- `Sprint.state: "draft" | "active" | "closed"` is **required** (no `?`), so spreading into a partial object must use type guards
- The other four fields are `?: T | undefined`, which allows spreads with `undefined` values (per the comment at lines 3-8 of `src/types/index.ts`)
- The normalizer's type assertions (e.g., `(t as Todo & { tags?: string[] })`) are already established; follow the same pattern for sprint normalization

---

## 6. Bundle-Size Verification

**Gate:** `.github/scripts/check-bundle-size.mjs`

**Thresholds:**
- **Warn at:** 200 kB (documented budget; warns but passes CI)
- **Fail at:** 220 kB (hard ceiling; fails CI)

**m1 Constraint (from AC):** Initial newtab chunk delta ≤ +2 kB from baseline.

**Verification steps:**
1. Run `npm run build` before making any changes; note the final JS KB from the output.
2. Land all m1 changes.
3. Run `npm run build` again; capture the final JS KB.
4. Assert `post - baseline ≤ 2` kB.
5. Record both numbers in the commit body or a footnote (per AC line 186).

**Expected outcome:** Since m1 only adds type definitions and a small normalizer pass (no UI, no React components), the delta should be negligible (< 1 kB).

---

## 7. CLAUDE.md Footguns Relevant to m1

### 7.1 Work on `main` Only (lines 6-16)

- All work runs directly on `main`.
- No feature branches.
- Push to `origin/main` after committing and verifying locally.
- If using a worktree, **checkout main inside the worktree** before committing.

### 7.2 Build and Verification (lines 59-71)

> Before reporting a code change as "done":
> - `npm run build` must pass cleanly. This runs `tsc -b && vite build`, exercising the full strict TypeScript suite plus Vite production bundle.
> - New code must compile under `strict: true`, `exactOptionalPropertyTypes: true`, and `noUncheckedIndexedAccess: true`.

**For m1:** The type additions and normalizer code must pass this gate with zero errors.

### 7.3 No New Dependencies (lines 69-71)

> Don't add new npm dependencies without a clear justification. The initial newtab chunk should stay under ~200 kB.

**For m1:** No new dependencies needed (pure TypeScript types + normalizer logic).

### 7.4 In-Place Normalization Precedent (referenced in REFINE section 35 of the roadmap)

The existing `closedAt` backfill in `storage.ts:49-63` sets the precedent: no `proclivity:state:v2` key, no migrations folder, just a normalization pass on read. **m1 follows this same pattern.**

### 7.5 Commits and Co-Authors (lines 46-57)

> - Conventional commits: `<type>(<scope>): <subject>`
> - Scope in active use for this work: likely `storage`, `feat`, or `refactor`
> - Add a co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
> - Never use `--no-verify`. Honor pre-commit hooks.
> - Never use `--amend` on a commit that has been pushed.

**For m1:** Use scope `storage` (the normalizer lives there) or `feat` (new schema fields). Single commit is expected.

---

## 8. Open Questions for the Implementer

1. **`todayMidnight()` extraction:** Should it move to `src/storage/constants.ts`, or stay in `sprintUtils.ts` and be duplicated in the normalizer inline? (Recommend extraction for layering clarity.)

2. **Fixture format and location:** Should fixtures live at `test/fixtures/v1-state-*.json` or `.claude/notes/milestones/sprint-backlog-redesign-m1/fixtures/`? (Recommend `test/fixtures/` for visibility in the main tree.)

3. **Replay script:** Should the fixture-replay assertion be a `scripts/replay-fixtures.ts` (Node + tsx), a `.js` file in `.claude/notes/`, or a manual verification checklist in the commit message? (Recommend a script in `.claude/notes/` if vitest is not added, run once locally before pushing.)

4. **Bundle-size baseline:** Should the baseline measurement be taken at the start of the commit (before edits) or after a clean `npm install && npm run build`? (Recommend before edits to capture the true delta.)

5. **Sprint.state validation logic:** If a sprint's `state` field exists but has an invalid value (not one of the three), should it be silently corrected to "active", or should the normalizer emit a console warning? (Recommend silent correction with an inline comment noting the defensive approach.)

---

## 9. Related Documents and Context

- **Roadmap:** `/plans/sprint-backlog-redesign-roadmap.md` — full roadmap with all milestones and spikes
- **Spike details:** Roadmap Phase 3, line 165–172 — three spikes that m1 must resolve
- **CLAUDE.md:** Project conventions and build gate
- **Existing precedent:** `storage.ts:49-63` (closedAt backfill pattern) and `sprintUtils.ts:38-40` (isArchived heuristic)
- **Bundle-size gate:** `.github/scripts/check-bundle-size.mjs` (200 kB warn / 220 kB fail)
- **CI workflow:** `.github/workflows/ci.yml` (runs on every push to main)

---

## Summary

**m1 is a pure enabler milestone:** add five new type fields, extend the storage normalizer to backfill `Sprint.state` from the legacy `endsAt < todayMidnight()` heuristic, capture three v1 fixture states, and verify under strict TS and bundle-size constraints. No UI affordance ships; all readers and writers of the new fields land in m2+. The normalizer follows the precedent set by the existing `closedAt` backfill and uses the same in-place pattern (no migrations, no new storage key).
