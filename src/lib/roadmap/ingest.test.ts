import { describe, it, expect } from "vitest";
import { EMPTY_STATE, type ProclivityState, type Todo } from "@/types";
import { startOfDay } from "@/lib/dateUtils";
import {
  ingestRoadmaps,
  isMirrorId,
  mkChartId,
  mkTodoId,
  parseMirrorId,
} from "./ingest";
import type { CollectedRoadmap, CompiledItem } from "./types";

const SRC = "arXMCP/paper-metadata";
const DAY = 24 * 60 * 60 * 1000;
const D1 = startOfDay(Date.UTC(2026, 6, 1) + 12 * 60 * 60 * 1000);
const D2 = D1 + 5 * DAY;

function item(partial: Partial<CompiledItem> & { id: string }): CompiledItem {
  return { kind: "task", title: `Item ${partial.id}`, ...partial };
}

function collected(
  items: CompiledItem[],
  prefs: CollectedRoadmap["prefs"] = { defaultScope: "today", surfaceInGantt: true },
  title = "Paper Metadata",
): CollectedRoadmap[] {
  return [{ srcKey: SRC, compiled: { slug: "paper-metadata", title, items }, prefs }];
}

function base(): ProclivityState {
  return structuredClone(EMPTY_STATE);
}

describe("mirror id scheme", () => {
  it("builds and parses task ids", () => {
    const id = mkTodoId(SRC, "paper-metadata-e1");
    expect(id).toBe("rm:arXMCP/paper-metadata#paper-metadata-e1");
    expect(isMirrorId(id)).toBe(true);
    expect(parseMirrorId(id)).toEqual({
      srcKey: SRC,
      itemId: "paper-metadata-e1",
    });
  });

  it("chart id has no # and does not parse as a task", () => {
    const chartId = mkChartId(SRC);
    expect(chartId).toBe("rm:arXMCP/paper-metadata");
    expect(parseMirrorId(chartId)).toBeNull();
  });

  it("rejects native (non-mirror) ids", () => {
    expect(isMirrorId("k3n8x1q")).toBe(false);
    expect(parseMirrorId("k3n8x1q")).toBeNull();
  });
});

describe("todo upsert", () => {
  it("maps task/spike to todos and skips epics/milestones", () => {
    const s = ingestRoadmaps(
      collected([
        item({ id: "paper-metadata-t-a", kind: "task", summary: "note a" }),
        item({ id: "paper-metadata-spike-1", kind: "spike" }),
        item({ id: "paper-metadata-e1", kind: "epic" }),
        item({ id: "paper-metadata-m1", kind: "milestone" }),
      ]),
    )(base());
    const ids = s.todos.map((t) => t.id).sort();
    expect(ids).toEqual([
      mkTodoId(SRC, "paper-metadata-spike-1"),
      mkTodoId(SRC, "paper-metadata-t-a"),
    ]);
    const a = s.todos.find((t) => t.id === mkTodoId(SRC, "paper-metadata-t-a"))!;
    expect(a.title).toBe("Item paper-metadata-t-a");
    expect(a.scope).toBe("today");
    expect(a.done).toBe(false);
    expect(a.tags).toEqual([]);
    expect(a.notes).toBe("note a");
  });

  it("is idempotent — re-ingesting identical input yields identical state", () => {
    const roadmaps = collected([
      item({ id: "paper-metadata-t-a", summary: "s", targetStart: D1, targetEnd: D2 }),
      item({ id: "paper-metadata-e1", kind: "epic", targetStart: D1, targetEnd: D2 }),
    ]);
    const s1 = ingestRoadmaps(roadmaps)(base());
    const s2 = ingestRoadmaps(roadmaps)(s1);
    expect(s2).toEqual(s1);
  });

  it("never clobbers user-owned fields on re-ingest", () => {
    const mkId = mkTodoId(SRC, "paper-metadata-t-a");
    const s0 = base();
    // Seed a mirror todo the user has since ticked, tagged, and sprinted.
    const userTodo: Todo = {
      id: mkId,
      title: "old title",
      scope: "long",
      done: true,
      createdAt: 111,
      completedAt: 222,
      closedAt: 333,
      sprintId: "sprint-x",
      tags: ["tag-1"],
    };
    s0.todos = [userTodo];
    const s1 = ingestRoadmaps(
      collected([item({ id: "paper-metadata-t-a", title: "new title", summary: "sum" })]),
    )(s0);
    const t = s1.todos.find((x) => x.id === mkId)!;
    // Ingest-owned fields updated:
    expect(t.title).toBe("new title");
    expect(t.scope).toBe("today");
    expect(t.notes).toBe("sum");
    // User-owned fields preserved:
    expect(t.done).toBe(true);
    expect(t.completedAt).toBe(222);
    expect(t.closedAt).toBe(333);
    expect(t.sprintId).toBe("sprint-x");
    expect(t.tags).toEqual(["tag-1"]);
    expect(t.createdAt).toBe(111);
  });

  it("leaves native todos untouched", () => {
    const s0 = base();
    const native: Todo = {
      id: "native1",
      title: "mine",
      scope: "today",
      done: false,
      createdAt: 5,
      tags: [],
    };
    s0.todos = [native];
    const s1 = ingestRoadmaps(collected([item({ id: "paper-metadata-t-a" })]))(s0);
    expect(s1.todos.find((t) => t.id === "native1")).toEqual(native);
    expect(s1.todos.some((t) => isMirrorId(t.id))).toBe(true);
  });
});

describe("dropped → close", () => {
  it("closes a dropped item's mirror (done + closedAt)", () => {
    const mkId = mkTodoId(SRC, "paper-metadata-t-a");
    const s1 = ingestRoadmaps(
      collected([item({ id: "paper-metadata-t-a", status: "dropped" })]),
    )(base());
    const t = s1.todos.find((x) => x.id === mkId)!;
    expect(t.done).toBe(true);
    expect(typeof t.closedAt).toBe("number");
  });

  it("re-creates then re-closes a purged dropped mirror", () => {
    // Simulate a prior close that was later purged: no mirror todo present.
    const s0 = base();
    const s1 = ingestRoadmaps(
      collected([item({ id: "paper-metadata-t-a", status: "dropped" })]),
    )(s0);
    const t = s1.todos.find((x) => x.id === mkTodoId(SRC, "paper-metadata-t-a"))!;
    expect(t).toBeDefined();
    expect(t.done).toBe(true);
  });
});

describe("gantt build", () => {
  it("emits fully-formed tasks for dated items and omits undated", () => {
    const s1 = ingestRoadmaps(
      collected([
        item({ id: "paper-metadata-e1", kind: "epic", targetStart: D1, targetEnd: D2, progress: 40 }),
        item({ id: "paper-metadata-t-a", targetStart: D1, targetEnd: D2, status: "done" }),
        item({ id: "paper-metadata-t-b" }), // undated → omitted
      ]),
    )(base());
    expect(s1.ganttCharts).toHaveLength(1);
    expect(s1.ganttCharts[0]!.id).toBe(mkChartId(SRC));
    expect(s1.ganttCharts[0]!.name).toBe("Paper Metadata");
    const taskIds = s1.ganttTasks.map((t) => t.id).sort();
    expect(taskIds).toEqual([
      mkTodoId(SRC, "paper-metadata-e1"),
      mkTodoId(SRC, "paper-metadata-t-a"),
    ]);
    const epic = s1.ganttTasks.find((t) => t.id === mkTodoId(SRC, "paper-metadata-e1"))!;
    expect(epic.progress).toBe(40);
    expect(epic.startsAt).toBe(startOfDay(D1));
    expect(epic.endsAt).toBe(startOfDay(D2));
    const done = s1.ganttTasks.find((t) => t.id === mkTodoId(SRC, "paper-metadata-t-a"))!;
    expect(done.done).toBe(true);
  });

  it("links parentId only when the parent is dated, and clamps children", () => {
    // Child extends past parent's window → must be clamped inside it.
    const s1 = ingestRoadmaps(
      collected([
        item({ id: "paper-metadata-e1", kind: "epic", targetStart: D1, targetEnd: D1 + 2 * DAY }),
        item({
          id: "paper-metadata-t-a",
          parent: "paper-metadata-e1",
          targetStart: D1 - DAY,
          targetEnd: D2, // beyond parent end
        }),
        item({
          id: "paper-metadata-t-b",
          parent: "paper-metadata-x-undated", // parent not dated → no link
          targetStart: D1,
          targetEnd: D2,
        }),
      ]),
    )(base());
    const child = s1.ganttTasks.find((t) => t.id === mkTodoId(SRC, "paper-metadata-t-a"))!;
    expect(child.parentId).toBe(mkTodoId(SRC, "paper-metadata-e1"));
    expect(child.startsAt).toBe(startOfDay(D1)); // clamped up to parent start
    expect(child.endsAt).toBe(startOfDay(D1 + 2 * DAY)); // clamped down to parent end
    const orphan = s1.ganttTasks.find((t) => t.id === mkTodoId(SRC, "paper-metadata-t-b"))!;
    expect(orphan.parentId).toBeUndefined();
  });

  it("prunes charts + tasks when surfaceInGantt is false", () => {
    const withGantt = ingestRoadmaps(
      collected([item({ id: "paper-metadata-t-a", targetStart: D1, targetEnd: D2 })]),
    )(base());
    expect(withGantt.ganttTasks).toHaveLength(1);
    const pruned = ingestRoadmaps(
      collected([item({ id: "paper-metadata-t-a", targetStart: D1, targetEnd: D2 })], {
        defaultScope: "today",
        surfaceInGantt: false,
      }),
    )(withGantt);
    expect(pruned.ganttCharts).toHaveLength(0);
    expect(pruned.ganttTasks).toHaveLength(0);
  });

  it("preserves an existing chart createdAt across re-ingest", () => {
    const roadmaps = collected([
      item({ id: "paper-metadata-t-a", targetStart: D1, targetEnd: D2 }),
    ]);
    const s1 = ingestRoadmaps(roadmaps)(base());
    const created = s1.ganttCharts[0]!.createdAt;
    const s2 = ingestRoadmaps(roadmaps)(s1);
    expect(s2.ganttCharts[0]!.createdAt).toBe(created);
  });
});
