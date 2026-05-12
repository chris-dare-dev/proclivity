/**
 * tools.ts — Gemini Nano tool-call schema, system-prompt builder,
 * parse/apply helpers for gemini-nano-m3.
 *
 * Schema strategy: flat object with a `type` discriminator constrained
 * via `pattern` (confirmed-safe keyword in Chrome's responseConstraint).
 * `oneOf`/`enum` are NOT used — they are unverified and a NotSupportedError
 * kills the entire prompt call if triggered. The flat schema uses only:
 *   type, object, array, properties, required, additionalProperties,
 *   items, maxItems, pattern, number, string, boolean.
 *
 * If the m3 eval shows `enum` works, the discriminator can be upgraded from
 * `pattern` to `enum` post-milestone. If `oneOf` also works, the schema can
 * be upgraded to a proper tagged union. Document outcomes in
 * plans/gemini-nano-eval-snapshot.md.
 */

import type {
  GanttChart,
  GanttTask,
  ProclivityState,
  Reminder,
  Tag,
  Todo,
  TodoScope,
} from "@/types";
import { uid } from "@/storage/storage";

// ── JSON Schema constant ────────────────────────────────────────────────────

/**
 * Flat-object JSON Schema passed as `responseConstraint` on every
 * `session.prompt()` call. The `type` field is the discriminator; payload
 * fields are all optional at the schema level — JS post-parse validation
 * enforces that the required payload fields are present for each `type`.
 *
 * Sub-objects for todo/task/reminder are nested to keep the schema readable
 * and to give the model a clearer structure cue while still using
 * confirmed-safe keywords only.
 */
export const TOOL_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      pattern: "^(chat|add_todo|add_gantt_task|set_reminder)$",
    },
    // ── chat payload ──────────────────────────────────────
    text: { type: "string" },
    // ── add_todo payload ──────────────────────────────────
    todo: {
      type: "object",
      properties: {
        title: { type: "string" },
        scope: { type: "string", pattern: "^(today|sprint|long)$" },
        notes: { type: "string" },
        dueAt: { type: "number" },
        sprintId: { type: "string" },
        tagIds: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    // ── add_gantt_task payload ─────────────────────────────
    task: {
      type: "object",
      properties: {
        chartId: { type: "string" },
        title: { type: "string" },
        startsAt: { type: "number" },
        endsAt: { type: "number" },
        parentId: { type: "string" },
        progress: { type: "number" },
        tagIds: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
        },
      },
      required: ["chartId", "title", "startsAt", "endsAt"],
      additionalProperties: false,
    },
    // ── set_reminder payload ───────────────────────────────
    reminder: {
      type: "object",
      properties: {
        title: { type: "string" },
        fireAt: { type: "number" },
        recurrence: {
          type: "string",
          pattern: "^(daily|weekly|none)$",
        },
        linkedTodoId: { type: "string" },
        tagIds: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
        },
      },
      required: ["title", "fireAt"],
      additionalProperties: false,
    },
  },
  required: ["type"],
  additionalProperties: false,
} as const;

// ── TypeScript tagged-union types ──────────────────────────────────────────

/** Chat response — the assistant answered conversationally. */
export interface ToolCallChat {
  kind: "chat";
  text: string;
}

/** Tool call to add a new todo item. */
export interface ToolCallAddTodo {
  kind: "add_todo";
  title: string;
  scope?: TodoScope;
  notes?: string;
  dueAt?: number;
  sprintId?: string;
  /** Raw tag ids from the model — caller validates / filters. */
  tagIds?: string[];
}

/** Tool call to add a new Gantt task. */
export interface ToolCallAddGanttTask {
  kind: "add_gantt_task";
  chartId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  parentId?: string;
  progress?: number;
  /** Raw tag ids from the model — caller validates / filters. */
  tagIds?: string[];
}

/** Tool call to set a reminder. */
export interface ToolCallSetReminder {
  kind: "set_reminder";
  title: string;
  fireAt: number;
  recurrence?: "daily" | "weekly" | "none";
  linkedTodoId?: string;
  /** Raw tag ids from the model — caller validates / filters. */
  tagIds?: string[];
}

/** Parse failed — the raw text was not valid JSON or had an unrecognised type. */
export interface ToolCallParseFailed {
  kind: "parse-failed";
  raw: string;
}

/** The full discriminated union returned by `parseToolCall`. */
export type ParsedToolCall =
  | ToolCallChat
  | ToolCallAddTodo
  | ToolCallAddGanttTask
  | ToolCallSetReminder
  | ToolCallParseFailed;

// ── System prompt builder ──────────────────────────────────────────────────

interface SystemPromptCtx {
  tags: readonly Tag[];
  ganttCharts: readonly GanttChart[];
}

/**
 * Build the system prompt injected via `initialPrompts` at session-create
 * time. Includes tool-call schema documentation, available tag ids/labels,
 * available chart ids/names, and the current timestamp.
 *
 * The system prompt is built once per session — if the user adds/deletes
 * tags or charts during the session, the list will be stale until "Clear
 * chat" creates a new session.
 */
export function buildSystemPrompt(ctx: SystemPromptCtx): string {
  const tagList =
    ctx.tags.length > 0
      ? ctx.tags.map((t) => `  - "${t.id}" (label: "${t.label}")`).join("\n")
      : "  (none)";

  const chartList =
    ctx.ganttCharts.length > 0
      ? ctx.ganttCharts
          .map((c) => `  - "${c.id}" (name: "${c.name}")`)
          .join("\n")
      : "  (none)";

  const nowMs = Date.now();
  const todayIso = new Date(nowMs).toISOString().split("T")[0] ?? "";

  return `You are Proclivity's AI assistant. You help the user manage their todos, Gantt tasks, and reminders.

Always respond in JSON. Choose the response type based on what the user wants:
- If the user asks a question or wants advice → { "type": "chat", "text": "your answer" }
- If the user wants to add a to-do → { "type": "add_todo", "todo": { "title": "...", "scope": "today|sprint|long", "notes": "...", "tagIds": [] } }
- If the user wants to add a Gantt chart task → { "type": "add_gantt_task", "task": { "chartId": "...", "title": "...", "startsAt": <ms>, "endsAt": <ms>, "progress": 0, "tagIds": [] } }
- If the user wants to set a reminder → { "type": "set_reminder", "reminder": { "title": "...", "fireAt": <ms>, "recurrence": "none|daily|weekly", "tagIds": [] } }

Rules:
- "scope" defaults to "today" if not specified.
- "startsAt", "endsAt", and "fireAt" are Unix timestamps in milliseconds (e.g. ${nowMs}).
- "fireAt" must be in the future (after ${nowMs}).
- "tagIds" must only contain ids from the Available tags list below. Omit if no tags apply.
- "chartId" must be an id from the Available charts list below.
- Only emit one action per response. If the user asks for multiple, pick the most relevant.

Today's date: ${todayIso}
Current time (Unix ms): ${nowMs}

Available tags (use the id value in tagIds):
${tagList}

Available charts (use the id value in chartId):
${chartList}`;
}

// ── Parse helper ───────────────────────────────────────────────────────────

/**
 * Parse the raw text returned by `session.prompt()` into a `ParsedToolCall`.
 *
 * Strategy:
 * 1. JSON.parse the raw string; on failure → parse-failed.
 * 2. Read `parsed.type`; if it doesn't match a known type → parse-failed.
 * 3. For each type, validate the required payload fields; on missing fields
 *    → parse-failed (the model produced a structurally invalid response).
 * 4. Return the strongly-typed union arm.
 */
export function parseToolCall(raw: string): ParsedToolCall {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "parse-failed", raw };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "parse-failed", raw };
  }

  const obj = parsed as Record<string, unknown>;
  const type = obj["type"];

  if (type === "chat") {
    const text = typeof obj["text"] === "string" ? obj["text"] : "";
    return { kind: "chat", text };
  }

  if (type === "add_todo") {
    const todo = obj["todo"];
    if (!todo || typeof todo !== "object" || Array.isArray(todo)) {
      return { kind: "parse-failed", raw };
    }
    const t = todo as Record<string, unknown>;
    const title = typeof t["title"] === "string" ? t["title"] : undefined;
    if (!title) return { kind: "parse-failed", raw };

    const result: ToolCallAddTodo = { kind: "add_todo", title };
    const scope = t["scope"];
    if (scope === "today" || scope === "sprint" || scope === "long") {
      result.scope = scope;
    }
    if (typeof t["notes"] === "string") result.notes = t["notes"];
    if (typeof t["dueAt"] === "number") result.dueAt = t["dueAt"];
    if (typeof t["sprintId"] === "string") result.sprintId = t["sprintId"];
    const tagIds = t["tagIds"];
    if (Array.isArray(tagIds)) {
      result.tagIds = tagIds.filter((x): x is string => typeof x === "string");
    }
    return result;
  }

  if (type === "add_gantt_task") {
    const task = obj["task"];
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      return { kind: "parse-failed", raw };
    }
    const t = task as Record<string, unknown>;
    const chartId =
      typeof t["chartId"] === "string" ? t["chartId"] : undefined;
    const title = typeof t["title"] === "string" ? t["title"] : undefined;
    const startsAt =
      typeof t["startsAt"] === "number" ? t["startsAt"] : undefined;
    const endsAt = typeof t["endsAt"] === "number" ? t["endsAt"] : undefined;
    if (!chartId || !title || startsAt === undefined || endsAt === undefined) {
      return { kind: "parse-failed", raw };
    }

    const result: ToolCallAddGanttTask = {
      kind: "add_gantt_task",
      chartId,
      title,
      startsAt,
      endsAt,
    };
    if (typeof t["parentId"] === "string") result.parentId = t["parentId"];
    if (typeof t["progress"] === "number") result.progress = t["progress"];
    const tagIds = t["tagIds"];
    if (Array.isArray(tagIds)) {
      result.tagIds = tagIds.filter((x): x is string => typeof x === "string");
    }
    return result;
  }

  if (type === "set_reminder") {
    const reminder = obj["reminder"];
    if (!reminder || typeof reminder !== "object" || Array.isArray(reminder)) {
      return { kind: "parse-failed", raw };
    }
    const r = reminder as Record<string, unknown>;
    const title = typeof r["title"] === "string" ? r["title"] : undefined;
    const fireAt =
      typeof r["fireAt"] === "number" ? r["fireAt"] : undefined;
    if (!title || fireAt === undefined) return { kind: "parse-failed", raw };

    const result: ToolCallSetReminder = { kind: "set_reminder", title, fireAt };
    const rec = r["recurrence"];
    if (rec === "daily" || rec === "weekly" || rec === "none") {
      result.recurrence = rec;
    }
    if (typeof r["linkedTodoId"] === "string") {
      result.linkedTodoId = r["linkedTodoId"];
    }
    const tagIds = r["tagIds"];
    if (Array.isArray(tagIds)) {
      result.tagIds = tagIds.filter((x): x is string => typeof x === "string");
    }
    return result;
  }

  return { kind: "parse-failed", raw };
}

// ── Apply helper ───────────────────────────────────────────────────────────

/** Payload attached to the `tool-result` chat message. */
export interface ToolResultPayload {
  type: "tool-result";
  /** Human-readable summary of what was created. */
  summary: string;
  /** Opaque token used to identify which undo to invoke. */
  undoToken: string;
  /** The full pre-call ProclivityState snapshot for rollback. */
  snapshot: ProclivityState;
  /** Unix ms when the undo window expires (createdAt + 10 000). */
  expiresAt: number;
}

interface ApplyResult {
  /** New state after the tool call was applied. */
  newState: ProclivityState;
  /** Payload to attach to the tool-result ChatMessage. */
  payload: ToolResultPayload;
  /** Any system-notice message to prepend (e.g. unknown chartId or tagId drop). */
  systemNotice: string | null;
}

/**
 * Apply a successfully parsed tool call to the state. Returns the new state,
 * a snapshot for undo, a human-readable summary, and an optional system-notice.
 *
 * Does NOT call `update()` — the caller owns the write so it can capture the
 * pre-snapshot before the async write resolves.
 *
 * Validation rules (per synthesis decisions):
 * - `add_gantt_task.chartId` not in `state.ganttCharts` → returns null (caller demotes).
 * - Unknown `tagIds` → silently dropped; if any were dropped, systemNotice is set.
 * - `set_reminder.fireAt <= Date.now()` → returns null (caller demotes).
 */
export function applyToolCall(
  call: ToolCallAddTodo | ToolCallAddGanttTask | ToolCallSetReminder,
  state: ProclivityState,
): ApplyResult | null {
  const snapshot = state; // full pre-call snapshot
  const undoToken = uid();
  const expiresAt = Date.now() + 10_000;

  if (call.kind === "add_todo") {
    const { validTagIds, droppedTagIds } = resolveTagIds(
      call.tagIds ?? [],
      state.tags,
    );
    const newTodo: Todo = {
      id: uid(),
      title: call.title,
      scope: call.scope ?? "today",
      done: false,
      createdAt: Date.now(),
      tags: validTagIds,
    };
    if (call.notes !== undefined) newTodo.notes = call.notes;
    if (call.dueAt !== undefined) newTodo.dueAt = call.dueAt;
    if (call.sprintId !== undefined) newTodo.sprintId = call.sprintId;

    const newState: ProclivityState = {
      ...state,
      todos: [...state.todos, newTodo],
    };
    const summary = `Added to-do: "${call.title}"`;
    const systemNotice = droppedTagIds.length > 0
      ? `Note: tag${droppedTagIds.length > 1 ? "s" : ""} "${droppedTagIds.join('", "')}" weren't found and were skipped.`
      : null;
    return {
      newState,
      payload: { type: "tool-result", summary, undoToken, snapshot, expiresAt },
      systemNotice,
    };
  }

  if (call.kind === "add_gantt_task") {
    // Validate chartId.
    const chartExists = state.ganttCharts.some((c) => c.id === call.chartId);
    if (!chartExists) return null;

    const { validTagIds, droppedTagIds } = resolveTagIds(
      call.tagIds ?? [],
      state.tags,
    );
    const newTask: GanttTask = {
      id: uid(),
      chartId: call.chartId,
      title: call.title,
      startsAt: call.startsAt,
      endsAt: call.endsAt,
      progress: call.progress ?? 0,
      done: false,
    };
    if (call.parentId !== undefined) newTask.parentId = call.parentId;
    // GanttTask does not have a `tags` field in the current type.
    // We intentionally omit tagIds from GanttTask for now.
    // The type shape from types/index.ts shows GanttTask has no `tags` field.
    void validTagIds; // suppress unused-var if tags not available on GanttTask
    void droppedTagIds;

    const newState: ProclivityState = {
      ...state,
      ganttTasks: [...state.ganttTasks, newTask],
    };
    const summary = `Added Gantt task: "${call.title}"`;
    // No tag support for GanttTask in the current schema.
    return {
      newState,
      payload: { type: "tool-result", summary, undoToken, snapshot, expiresAt },
      systemNotice: null,
    };
  }

  if (call.kind === "set_reminder") {
    // Validate fireAt is in the future.
    if (call.fireAt <= Date.now()) return null;

    const { validTagIds, droppedTagIds } = resolveTagIds(
      call.tagIds ?? [],
      state.tags,
    );
    const newReminder: Reminder = {
      id: uid(),
      title: call.title,
      fireAt: call.fireAt,
      tags: validTagIds,
    };
    if (call.recurrence !== undefined) newReminder.recurrence = call.recurrence;
    if (call.linkedTodoId !== undefined) {
      newReminder.linkedTodoId = call.linkedTodoId;
    }

    const newState: ProclivityState = {
      ...state,
      reminders: [...state.reminders, newReminder],
    };
    const summary = `Added reminder: "${call.title}"`;
    const systemNotice = droppedTagIds.length > 0
      ? `Note: tag${droppedTagIds.length > 1 ? "s" : ""} "${droppedTagIds.join('", "')}" weren't found and were skipped.`
      : null;
    return {
      newState,
      payload: { type: "tool-result", summary, undoToken, snapshot, expiresAt },
      systemNotice,
    };
  }

  return null;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function resolveTagIds(
  rawTagIds: string[],
  tags: readonly Tag[],
): { validTagIds: string[]; droppedTagIds: string[] } {
  const validSet = new Set(tags.map((t) => t.id));
  const validTagIds: string[] = [];
  const droppedTagIds: string[] = [];
  for (const id of rawTagIds) {
    if (validSet.has(id)) {
      validTagIds.push(id);
    } else {
      droppedTagIds.push(id);
    }
  }
  return { validTagIds, droppedTagIds };
}
