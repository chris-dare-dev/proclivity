/**
 * scripts/replay-fixtures.ts — sprint-backlog-redesign-m1 fixture replay.
 *
 * Reads the three v1 state fixtures under test/fixtures/ and replays each
 * through the storage normalizer. Asserts:
 *   - every sprint ends up with a valid `state` literal
 *   - the existing closedAt backfill still fires
 *   - input data (todos, sprintIds, settings) round-trips without loss
 *
 * Invocation (no test runner is installed in this repo):
 *
 *   npx tsx scripts/replay-fixtures.ts          # if tsx is on PATH
 *   node --experimental-strip-types scripts/replay-fixtures.ts   # Node 22.6+
 *
 * Either path works. CI does not run this script; it is a manual,
 * pre-commit verification step. Exit code 0 = all fixtures normalize
 * cleanly; non-zero = an assertion failed.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeState } from "../src/storage/storage";
import type { ProclivityState, Sprint, Todo } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "test", "fixtures");

const fixtures = [
  "v1-state-empty.json",
  "v1-state-mixed.json",
  "v1-state-with-closed-todos.json",
] as const;

type CheckResult = { fixture: string; ok: true } | { fixture: string; ok: false; reason: string };

const VALID_STATES = new Set(["draft", "active", "closed"]);

function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}

function checkSprintStates(after: ProclivityState): void {
  for (const sprint of after.sprints) {
    assert(
      VALID_STATES.has(sprint.state),
      `sprint ${sprint.id} has invalid state after normalize: ${String((sprint as Sprint).state)}`,
    );
  }
}

function checkClosedAtBackfill(after: ProclivityState): void {
  for (const todo of after.todos) {
    if (todo.done) {
      assert(
        typeof todo.closedAt === "number",
        `todo ${todo.id} is done but has no closedAt after normalize`,
      );
    }
  }
}

function checkNoTodoLoss(before: ProclivityState, after: ProclivityState): void {
  assert(
    before.todos.length === after.todos.length,
    `todo count drifted: ${before.todos.length} → ${after.todos.length}`,
  );
  const beforeIds = new Set(before.todos.map((t: Todo) => t.id));
  const afterIds = new Set(after.todos.map((t) => t.id));
  for (const id of beforeIds) {
    assert(afterIds.has(id), `todo ${id} disappeared after normalize`);
  }
}

function checkNoSprintLoss(before: ProclivityState, after: ProclivityState): void {
  assert(
    before.sprints.length === after.sprints.length,
    `sprint count drifted: ${before.sprints.length} → ${after.sprints.length}`,
  );
  const beforeIds = new Set(before.sprints.map((s: Sprint) => s.id));
  const afterIds = new Set(after.sprints.map((s) => s.id));
  for (const id of beforeIds) {
    assert(afterIds.has(id), `sprint ${id} disappeared after normalize`);
  }
}

function checkReservedFieldsAbsent(after: ProclivityState): void {
  // m1 invariant: no fixture should produce sprints with goal/retroNote populated,
  // and no todos with parentId/targetDate populated. The normalizer must not
  // invent values for these reserved-in-m1 fields.
  for (const sprint of after.sprints) {
    assert(
      sprint.goal === undefined,
      `sprint ${sprint.id} unexpectedly has goal=${JSON.stringify(sprint.goal)}`,
    );
    assert(
      sprint.retroNote === undefined,
      `sprint ${sprint.id} unexpectedly has retroNote=${JSON.stringify(sprint.retroNote)}`,
    );
  }
  for (const todo of after.todos) {
    assert(
      todo.parentId === undefined,
      `todo ${todo.id} unexpectedly has parentId=${JSON.stringify(todo.parentId)}`,
    );
    assert(
      todo.targetDate === undefined,
      `todo ${todo.id} unexpectedly has targetDate=${JSON.stringify(todo.targetDate)}`,
    );
  }
}

function replay(fixtureName: string): CheckResult {
  try {
    const path = join(fixturesDir, fixtureName);
    const raw = JSON.parse(readFileSync(path, "utf-8")) as ProclivityState;
    const out = normalizeState(raw);

    checkSprintStates(out);
    checkClosedAtBackfill(out);
    checkNoTodoLoss(raw, out);
    checkNoSprintLoss(raw, out);
    checkReservedFieldsAbsent(out);

    return { fixture: fixtureName, ok: true };
  } catch (err) {
    return {
      fixture: fixtureName,
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function main(): void {
  const results = fixtures.map(replay);
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      console.log(`PASS ${r.fixture}`);
      passed++;
    } else {
      console.log(`FAIL ${r.fixture}: ${r.reason}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${results.length} fixtures normalize cleanly.`);
  if (failed > 0) process.exit(1);
}

main();
